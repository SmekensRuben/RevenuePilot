import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  auth,
  collection,
  collectionGroup,
  db,
  getDocs,
  signOut,
} from "../../firebaseConfig";

const MONTHS = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseArrivalDate = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parts = normalized.split("-");
  if (parts.length === 3) {
    const [dayPart, monthPart, yearPart] = parts;
    const monthIndex = MONTHS[monthPart?.toUpperCase()];
    const day = Number(dayPart);
    const year = Number(yearPart?.length === 2 ? `20${yearPart}` : yearPart);
    if (Number.isFinite(day) && Number.isFinite(year) && monthIndex !== undefined) {
      return new Date(year, monthIndex, day);
    }
  }

  return null;
};

const normalizePackageName = (value) => String(value || "").trim().toLowerCase();

export default function ArrivalConverterProductDetailPage() {
  const { hotelUid } = useHotelContext();
  const { productName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [reservations, setReservations] = useState([]);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const startDate = searchParams.get("start") || "";
  const endDate = searchParams.get("end") || "";
  const decodedProductName = useMemo(
    () => decodeURIComponent(productName || ""),
    [productName]
  );
  const normalizedProductName = useMemo(
    () => normalizePackageName(decodedProductName),
    [decodedProductName]
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const handleBack = () => {
    const nextParams = new URLSearchParams();
    if (startDate) nextParams.set("start", startDate);
    if (endDate) nextParams.set("end", endDate);
    navigate(`/tools/arrival-converter?${nextParams.toString()}`);
  };

  useEffect(() => {
    const fetchReservations = async () => {
      if (!hotelUid) {
        setStatus({ type: "error", message: "Selecteer eerst een hotel." });
        return;
      }

      if (!startDate || !endDate) {
        setStatus({ type: "error", message: "Er is geen datumfilter geselecteerd." });
        return;
      }

      const rangeStart = parseArrivalDate(startDate);
      const rangeEnd = parseArrivalDate(endDate);
      if (!rangeStart || !rangeEnd) {
        setStatus({ type: "error", message: "De datums konden niet worden gelezen." });
        return;
      }

      const rangeEndExclusive = new Date(rangeEnd);
      rangeEndExclusive.setHours(0, 0, 0, 0);
      rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

      setStatus({ type: "loading", message: "Reserveringen ophalen..." });
      setReservations([]);

      try {
        const arrivalsRef = collection(
          db,
          `hotels/${hotelUid}/arrivalsDetailedPackages`
        );
        const arrivalsSnapshot = await getDocs(arrivalsRef);
        const matchedReservations = [];

        const processReservations = (arrivalDateKey, reservationsSnapshot) => {
          reservationsSnapshot.forEach((reservationDoc) => {
            const data = reservationDoc.data();
            const arrivalDateValue = parseArrivalDate(data.arrivalDate);
            const departureDateValue = parseArrivalDate(data.departureDate);
            if (!arrivalDateValue || !departureDateValue) {
              return;
            }

            const overlapStart = arrivalDateValue > rangeStart ? arrivalDateValue : rangeStart;
            const overlapEnd =
              departureDateValue < rangeEndExclusive ? departureDateValue : rangeEndExclusive;
            const overlapDays = Math.max(
              0,
              Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY)
            );
            if (!overlapDays) {
              return;
            }

            const hasProduct = (data.products || []).some(
              (product) => normalizePackageName(product) === normalizedProductName
            );
            if (!hasProduct) return;

            matchedReservations.push({
              id: reservationDoc.id,
              arrivalDate: data.arrivalDate,
              departureDate: data.departureDate,
              roomNr: data.roomNr || "-",
              adults: Number.isFinite(Number(data.adults)) ? Number(data.adults) : 0,
              products: data.products || [],
              overlapDays,
            });
          });
        };

        if (arrivalsSnapshot.size) {
          await Promise.all(
            arrivalsSnapshot.docs.map(async (arrivalDoc) => {
              const arrivalDateKey = arrivalDoc.id;
              const arrivalDateFromKey = parseArrivalDate(arrivalDateKey);
              if (!arrivalDateFromKey || arrivalDateFromKey > rangeEnd) {
                return;
              }

              const reservationsRef = collection(
                db,
                `hotels/${hotelUid}/arrivalsDetailedPackages`,
                arrivalDateKey,
                "reservations"
              );
              const reservationsSnapshot = await getDocs(reservationsRef);
              processReservations(arrivalDateKey, reservationsSnapshot);
            })
          );
        } else {
          const reservationsGroup = collectionGroup(db, "reservations");
          const reservationsSnapshot = await getDocs(reservationsGroup);

          reservationsSnapshot.forEach((reservationDoc) => {
            const reservationPath = reservationDoc.ref.path;
            const expectedPrefix = `hotels/${hotelUid}/arrivalsDetailedPackages/`;
            if (!reservationPath.startsWith(expectedPrefix)) {
              return;
            }

            const arrivalDateKey = reservationDoc.ref.parent.parent?.id;
            if (!arrivalDateKey) {
              return;
            }

            processReservations(arrivalDateKey, {
              size: 1,
              forEach: (callback) => callback(reservationDoc),
            });
          });
        }

        matchedReservations.sort(
          (a, b) => parseArrivalDate(a.arrivalDate) - parseArrivalDate(b.arrivalDate)
        );
        setReservations(matchedReservations);
        setStatus({ type: "success", message: "Reserveringen geladen." });
      } catch (error) {
        console.error(error);
        setStatus({
          type: "error",
          message: "Het ophalen van de reserveringen is mislukt.",
        });
      }
    };

    fetchReservations();
  }, [hotelUid, startDate, endDate, normalizedProductName]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Tools</p>
            <h1 className="text-3xl font-semibold">Productdetail</h1>
            <p className="text-gray-600 mt-2 max-w-3xl">
              Overzicht van reserveringen met het product{" "}
              <span className="font-semibold">{decodedProductName}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Terug naar overzicht
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div>
              <span className="font-semibold text-gray-900">Begindatum:</span>{" "}
              {startDate || "-"}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Einddatum:</span>{" "}
              {endDate || "-"}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Reserveringen:</span>{" "}
              {reservations.length}
            </div>
          </div>

          {status.type !== "idle" && (
            <div
              className={`text-sm rounded-md px-3 py-2 border ${
                status.type === "error"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : status.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              {status.message}
            </div>
          )}

          {reservations.length ? (
            <div className="overflow-hidden border border-gray-200 rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Reservering</th>
                    <th className="text-left px-4 py-2 font-semibold">Kamer</th>
                    <th className="text-left px-4 py-2 font-semibold">Aankomst</th>
                    <th className="text-left px-4 py-2 font-semibold">Vertrek</th>
                    <th className="text-right px-4 py-2 font-semibold">Adults</th>
                    <th className="text-right px-4 py-2 font-semibold">Nachten</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td className="px-4 py-2 text-gray-900">{reservation.id}</td>
                      <td className="px-4 py-2 text-gray-900">{reservation.roomNr}</td>
                      <td className="px-4 py-2 text-gray-900">
                        {reservation.arrivalDate}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {reservation.departureDate}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {reservation.adults}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {reservation.overlapDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            status.type === "success" && (
              <div className="text-sm text-gray-600">
                Geen reserveringen gevonden voor dit product.
              </div>
            )
          )}
        </div>
      </PageContainer>
    </div>
  );
}
