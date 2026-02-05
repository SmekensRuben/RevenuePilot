import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { Button } from "../layout/Button";
import {
  auth,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  signOut,
} from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date) =>
  date.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const buildCompareDate = (dateString, compareYear) => {
  if (!dateString) return null;
  const [, month, day] = dateString.split("-").map(Number);
  if (!month || !day) return null;
  return new Date(compareYear, month - 1, day);
};

export default function AutoquoterPage() {
  const { hotelUid } = useHotelContext();
  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const years = useMemo(
    () => Array.from({ length: 10 }, (_, index) => currentYear - index),
    [currentYear]
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rooms, setRooms] = useState("10");
  const [compareYear, setCompareYear] = useState(String(currentYear - 1));
  const [generatedDates, setGeneratedDates] = useState([]);
  const [marketOverview, setMarketOverview] = useState([]);
  const [marketSegments, setMarketSegments] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const compareStartDate = useMemo(
    () => buildCompareDate(startDate, Number(compareYear)),
    [compareYear, startDate]
  );
  const compareEndDate = useMemo(
    () => buildCompareDate(endDate, Number(compareYear)),
    [compareYear, endDate]
  );
  const sortedMarketSegments = useMemo(() => {
    return [...marketSegments].sort((a, b) =>
      (a?.name || "").localeCompare(b?.name || "", undefined, { sensitivity: "base" })
    );
  }, [marketSegments]);

  useEffect(() => {
    let isActive = true;
    const loadSegments = async () => {
      if (!hotelUid) {
        setMarketSegments([]);
        return;
      }
      try {
        const ref = collection(db, `hotels/${hotelUid}/marketSegments`);
        const snapshot = await getDocs(query(ref, orderBy("name")));
        const segments = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        if (isActive) {
          setMarketSegments(segments);
        }
      } catch (loadError) {
        console.error("Fout bij ophalen van market segments:", loadError);
        if (isActive) {
          setMarketSegments([]);
        }
      }
    };
    loadSegments();
    return () => {
      isActive = false;
    };
  }, [hotelUid]);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const handleGenerate = async () => {
    setError("");
    setMarketOverview([]);
    if (!startDate || !endDate) {
      setGeneratedDates([]);
      setError("Vul een start- en einddatum in om een quote te genereren.");
      return;
    }

    const compareYearNumber = Number(compareYear);
    const compareStart = buildCompareDate(startDate, compareYearNumber);
    const compareEnd = buildCompareDate(endDate, compareYearNumber);

    if (!compareStart || !compareEnd || Number.isNaN(compareStart.getTime())) {
      setGeneratedDates([]);
      setError("De gekozen datums zijn niet geldig.");
      return;
    }

    if (compareStart > compareEnd) {
      setGeneratedDates([]);
      setError("De startdatum moet voor de einddatum liggen.");
      return;
    }

    const rangeStart = new Date(compareStart);
    rangeStart.setDate(rangeStart.getDate() - 5);
    const rangeEnd = new Date(compareEnd);
    rangeEnd.setDate(rangeEnd.getDate() + 5);

    const days = [];
    const cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    setGeneratedDates(days);

    if (!hotelUid) {
      setError("Geen hotel geselecteerd om data op te halen.");
      return;
    }

    setIsLoading(true);
    try {
      const overview = await Promise.all(
        days.map(async (date) => {
          const dateKey = formatDateInput(date);
          const docRef = doc(db, `hotels/${hotelUid}/reservationStatistics`, dateKey);
          const snap = await getDoc(docRef);
          const data = snap.exists() ? snap.data() : {};
          const marketStats = data?.reservationsStatisticsByMarketCode || {};
          const rows = Object.entries(marketStats).map(([marketCode, value]) => ({
            marketCode,
            roomsSold: Number(value?.roomsSold ?? 0),
          }));
          rows.sort((a, b) => a.marketCode.localeCompare(b.marketCode));
          return {
            dateKey,
            displayDate: formatDisplayDate(date),
            rows,
          };
        })
      );
      setMarketOverview(overview);
    } catch (fetchError) {
      console.error("Fout bij ophalen van reservation statistics:", fetchError);
      setError("Er ging iets mis bij het ophalen van de reservation statistics.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <Card className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Autoquoter 9000</h2>
            <p className="text-gray-600">
              Stel een datarange en aantal kamers in om een vergelijking te maken met een
              eerder jaar.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Startdatum</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Einddatum</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Aantal rooms</label>
              <input
                type="number"
                min="1"
                value={rooms}
                onChange={(event) => setRooms(event.target.value)}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Compare with</label>
              <select
                value={compareYear}
                onChange={(event) => setCompareYear(event.target.value)}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleGenerate} disabled={isLoading}>
              Generate quote
            </Button>
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Overzicht</h3>
              <p className="text-sm text-gray-600">
                {generatedDates.length
                  ? `Voor ${rooms} kamers, vergelijkingsjaar ${compareYear}.`
                  : "Nog geen quote gegenereerd."}
              </p>
            </div>
            {compareStartDate && compareEndDate ? (
              <div className="text-sm text-gray-500">
                {formatDateInput(compareStartDate)} tot {formatDateInput(compareEndDate)}
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
              Reservation statistics worden geladen...
            </div>
          ) : generatedDates.length ? (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Market segment</th>
                    {generatedDates.map((date) => (
                      <th key={date.toISOString()} className="px-4 py-3 font-semibold">
                        {formatDisplayDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedMarketSegments.map((segment) => (
                    <tr key={segment.id || segment.marketSegmentCode} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-semibold text-gray-700">
                        {segment.name || segment.marketSegmentCode || "Onbekend"}
                      </td>
                      {marketOverview.map((day) => {
                        const match = day.rows.find(
                          (row) => row.marketCode === segment.marketSegmentCode
                        );
                        return (
                          <td
                            key={`${day.dateKey}-${segment.marketSegmentCode || segment.id}`}
                            className="px-4 py-3 text-gray-700"
                          >
                            {match ? match.roomsSold : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {!sortedMarketSegments.length ? (
                    <tr className="border-t border-gray-100">
                      <td
                        className="px-4 py-3 text-gray-500"
                        colSpan={generatedDates.length + 1}
                      >
                        Geen market segments gevonden voor deze periode.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
              Klik op &quot;Generate quote&quot; om het overzicht te vullen.
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}
