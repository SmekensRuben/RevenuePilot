import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "react-toastify";
import {
  db,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  auth,
  signOut,
} from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";

function formatDateInput(date = new Date()) {
  return date.toISOString().split("T")[0];
}

const VISIBLE_COLUMNS = [
  { key: "fullName", label: "Guest" },
  { key: "arrivalDate", label: "Arrival" },
  { key: "departureDate", label: "Departure" },
  { key: "room", label: "Room" },
  { key: "roomTypeCode", label: "Room Type" },
  { key: "nights", label: "Nights" },
  { key: "shareAmount", label: "Share Amount" },
  { key: "insertUser", label: "Insert User" },
  { key: "companyName", label: "Company" },
];

export default function MadeReservationsPage() {
  const { hotelUid } = useHotelContext();
  const [selectedDate, setSelectedDate] = useState(formatDateInput());
  const [importDate, setImportDate] = useState(formatDateInput());
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "arrivalDate", direction: "asc" });
  const fileInputRef = useRef(null);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    async function fetchReservations() {
      if (!hotelUid || !selectedDate) {
        setReservations([]);
        return;
      }
      setIsLoading(true);
      try {
        const docRef = doc(
          db,
          `hotels/${hotelUid}/reservationsCreatedByDate`,
          selectedDate
        );
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};
        setReservations(Array.isArray(data.reservations) ? data.reservations : []);
      } catch (error) {
        console.error("Failed to load reservations", error);
        toast.error("Kon reservaties niet laden.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReservations();
  }, [hotelUid, selectedDate]);

  const handleImportClick = () => {
    setIsImporting(true);
    setImportDate(selectedDate);
  };

  const sortedReservations = useMemo(() => {
    if (!sortConfig.key) {
      return reservations;
    }

    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;

    const toComparable = (value) => {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
      return String(value || "");
    };

    return [...reservations].sort((a, b) => {
      const aValue = toComparable(a?.[sortConfig.key]);
      const bValue = toComparable(b?.[sortConfig.key]);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * directionMultiplier;
      }

      return String(aValue).localeCompare(String(bValue), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * directionMultiplier;
    });
  }, [reservations, sortConfig]);

  const handleSort = (columnKey) => {
    setSortConfig((current) => {
      if (current.key === columnKey) {
        return {
          key: columnKey,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const parseBoolean = (value) => {
    if (typeof value === "boolean") return value;
    return String(value || "").trim().toUpperCase() === "Y";
  };

  const parseNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const mapCsvRow = (row) => ({
    marketCode: row?.MARKET_CODE || "",
    room: row?.ROOM || "",
    fullName: row?.FULL_NAME || "",
    departureDate: row?.DEPARTURE || "",
    guaranteeCodeDescription: row?.GUARANTEE_CODE_DESC || "",
    amountOfPeople: parseNumber(row?.PERSONS),
    amountOfRooms: parseNumber(row?.NO_OF_ROOMS),
    roomTypeCode: row?.ROOM_CATEGORY_LABEL || "",
    rateCode: row?.RATE_CODE || "",
    isHouseUse: parseBoolean(row?.HOUSE_USE_YN),
    isComplimentary: parseBoolean(row?.COMPLIMENTARY_YN),
    insertUser: row?.INSERT_USER || "",
    insertDate: row?.INSERT_DATE || "",
    guaranteeCode: row?.GUARANTEE_CODE || "",
    arrivalDate: row?.ARRIVAL || "",
    shareAmount: parseNumber(row?.SHARE_AMOUNT),
    nights: parseNumber(row?.NIGHTS),
    groupName: row?.GROUP_NAME || "",
    originOfBooking: row?.ORIGIN_OF_BOOKING_DESC || "",
    companyName: row?.COMPANY_NAME || "",
    resNameId: row?.RESV_NAME_ID || "",
    externalReference: row?.EXTERNAL_REFERENCE || "",
  });

  const handleCsvUpload = async (event) => {
    event.preventDefault();
    if (!hotelUid) {
      toast.error("Selecteer eerst een hotel.");
      return;
    }
    if (!importDate) {
      toast.error("Kies een datum voor import.");
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Kies een CSV bestand.");
      return;
    }

    setIsImporting(false);
    toast.info("CSV bestand wordt ingelezen...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = Array.isArray(results.data) ? results.data : [];
          const mappedRows = rows.map(mapCsvRow);
          const docRef = doc(
            db,
            `hotels/${hotelUid}/reservationsCreatedByDate`,
            importDate
          );
          await setDoc(docRef, {
            reservations: mappedRows,
            updatedAt: serverTimestamp(),
          });
          toast.success("Reservaties geïmporteerd.");
          setSelectedDate(importDate);
        } catch (error) {
          console.error("Failed to save reservations", error);
          toast.error("Opslaan van reservaties mislukt.");
        } finally {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      },
      error: (error) => {
        console.error("CSV parse error", error);
        toast.error("CSV kon niet ingelezen worden.");
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">
              Reservations
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold">Made Reservations</h1>
            <p className="text-gray-600 mt-1">
              Overzicht van ingevoerde reservaties per datum. Kies een datum om de tabel te bekijken of importeer een nieuw CSV bestand.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <label className="flex flex-col text-sm font-semibold text-gray-700">
              Bekijk datum
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={handleImportClick}
              className="bg-[#b41f1f] text-white px-4 py-2 rounded font-semibold shadow hover:bg-[#961919] transition-colors"
            >
              Import CSV
            </button>
          </div>
        </div>

        {isImporting && (
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Nieuwe reservaties importeren</h2>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCsvUpload}>
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                Datum
                <input
                  type="date"
                  value={importDate}
                  onChange={(e) => setImportDate(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                CSV bestand
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="bg-[#b41f1f] text-white px-4 py-2 rounded font-semibold shadow hover:bg-[#961919] transition-colors"
                >
                  Importeren
                </button>
                <button
                  type="button"
                  onClick={() => setIsImporting(false)}
                  className="bg-gray-100 text-gray-800 px-4 py-2 rounded font-semibold border border-gray-300 hover:bg-gray-200"
                >
                  Annuleren
                </button>
              </div>
            </form>
          </Card>
        )}

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Reservaties</h2>
              <p className="text-sm text-gray-600">{selectedDate || "Geen datum gekozen"}</p>
            </div>
            {isLoading && <span className="text-sm text-gray-500">Laden...</span>}
          </div>
          {reservations.length === 0 ? (
            <p className="text-gray-600">Geen reservaties gevonden voor deze datum.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {VISIBLE_COLUMNS.map((column) => {
                      const isActiveSort = sortConfig.key === column.key;
                      const sortIndicator = isActiveSort
                        ? sortConfig.direction === "asc"
                          ? "▲"
                          : "▼"
                        : "⇅";

                      return (
                        <th
                          key={column.key}
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(column.key)}
                            className="inline-flex items-center gap-2 focus:outline-none"
                          >
                            <span>{column.label}</span>
                            <span className="text-gray-400 text-[10px]">{sortIndicator}</span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {sortedReservations.map((reservation, index) => (
                    <tr key={`${reservation.resNameId || index}-${index}`}>
                      {VISIBLE_COLUMNS.map((column) => (
                        <td key={column.key} className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                          {reservation[column.key] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-3">
            Alle geïmporteerde velden worden opgeslagen in Firebase. De tabel toont de belangrijkste kolommen voor snelle controle.
          </p>
        </Card>
      </PageContainer>
    </div>
  );
}
