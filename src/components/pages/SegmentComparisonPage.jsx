import React, { useEffect, useMemo, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
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
import {
  getMarketSegmentCodes,
  normalizeMarketSegmentCode,
} from "../../utils/segmentationUtils";

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (dateString) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeCode = normalizeMarketSegmentCode;
const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const DAY_FILTER_OPTIONS = [
  { value: "all", label: "Alles" },
  { value: "weekdays", label: "Weekdagen" },
  { value: "weekend", label: "Weekend" },
];

const formatAdr = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function SegmentComparisonPage() {
  const { hotelUid } = useHotelContext();
  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);
  const [rangeAStart, setRangeAStart] = useState("");
  const [rangeAEnd, setRangeAEnd] = useState("");
  const [rangeBStart, setRangeBStart] = useState("");
  const [rangeBEnd, setRangeBEnd] = useState("");
  const [marketSegments, setMarketSegments] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [dayFilter, setDayFilter] = useState("all");

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

  const fetchRangeStatistics = async (startDate, endDate) => {
    const days = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const overview = await Promise.all(
      days.map(async (date) => {
        const dateKey = formatDateInput(date);
        const docRef = doc(db, `hotels/${hotelUid}/reservationStatistics`, dateKey);
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};
        const marketStats = data?.reservationsStatisticsByMarketCode || [];
        const rows = Array.isArray(marketStats)
          ? marketStats.map((item) => ({
              marketCode: String(item?.marketCode || "").trim(),
              roomsSold: Number(item?.roomsSold ?? 0),
              adr: item?.adr === null || item?.adr === undefined ? null : Number(item?.adr),
            }))
          : Object.entries(marketStats).map(([marketCode, value]) => ({
              marketCode: String(marketCode || "").trim(),
              roomsSold: Number(value?.roomsSold ?? 0),
              adr: value?.adr === null || value?.adr === undefined ? null : Number(value?.adr),
            }));
        return { date, rows };
      })
    );

    return overview;
  };

  const aggregateBySegment = (entries, filter) => {
    const totals = new Map();
    let dayCount = 0;
    entries.forEach(({ date, rows }) => {
      const dayIsWeekend = isWeekend(date);
      if (filter === "weekdays" && dayIsWeekend) return;
      if (filter === "weekend" && !dayIsWeekend) return;
      dayCount += 1;
      rows.forEach((row) => {
        const code = normalizeCode(row.marketCode);
        if (!code) return;
        const existing = totals.get(code) || {
          roomsSold: 0,
          adrRooms: 0,
          adrRevenue: 0,
        };
        const roomsSold = Number(row.roomsSold) || 0;
        existing.roomsSold += roomsSold;
        const adrValue = Number(row.adr);
        if (Number.isFinite(adrValue) && roomsSold > 0) {
          existing.adrRooms += roomsSold;
          existing.adrRevenue += roomsSold * adrValue;
        }
        totals.set(code, existing);
      });
    });

    if (filter !== "all" && dayCount > 0) {
      totals.forEach((value, key) => {
        totals.set(key, {
          roomsSold: value.roomsSold / dayCount,
          adrRooms: value.adrRooms,
          adrRevenue: value.adrRevenue,
        });
      });
    }
    return totals;
  };

  const buildLabels = (totalsA, totalsB) => {
    const segmentMap = new Map();
    marketSegments.forEach((segment) => {
      const codes = getMarketSegmentCodes(segment);
      if (!codes.length) return;
      codes.forEach((code) => {
        const normalized = normalizeCode(code);
        if (!normalized) return;
        segmentMap.set(normalized, segment.name || code || normalized);
      });
    });

    const allCodes = new Set([
      ...segmentMap.keys(),
      ...totalsA.keys(),
      ...totalsB.keys(),
    ]);

    return Array.from(allCodes)
      .map((code) => ({
        code,
        label: segmentMap.get(code) || code,
      }))
      .sort((a, b) => {
        const roomsA = totalsA.get(a.code)?.roomsSold ?? 0;
        const roomsB = totalsA.get(b.code)?.roomsSold ?? 0;
        if (roomsB !== roomsA) {
          return roomsB - roomsA;
        }
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
      });
  };

  const handleCompare = async () => {
    setError("");
    setComparisonData(null);

    if (!rangeAStart || !rangeAEnd || !rangeBStart || !rangeBEnd) {
      setError("Vul beide periodes volledig in om te vergelijken.");
      return;
    }

    const startA = parseDateInput(rangeAStart);
    const endA = parseDateInput(rangeAEnd);
    const startB = parseDateInput(rangeBStart);
    const endB = parseDateInput(rangeBEnd);

    if (!startA || !endA || !startB || !endB) {
      setError("De gekozen datums zijn niet geldig.");
      return;
    }

    if (startA > endA || startB > endB) {
      setError("De startdatum moet voor de einddatum liggen.");
      return;
    }

    if (!hotelUid) {
      setError("Geen hotel geselecteerd om data op te halen.");
      return;
    }

    setIsLoading(true);
    try {
      const [rowsA, rowsB] = await Promise.all([
        fetchRangeStatistics(startA, endA),
        fetchRangeStatistics(startB, endB),
      ]);

      const totalsA = aggregateBySegment(rowsA, dayFilter);
      const totalsB = aggregateBySegment(rowsB, dayFilter);
      const labels = buildLabels(totalsA, totalsB);

      const roomsA = labels.map((label) => totalsA.get(label.code)?.roomsSold ?? 0);
      const roomsB = labels.map((label) => totalsB.get(label.code)?.roomsSold ?? 0);
      const adrA = labels.map((label) => {
        const entry = totalsA.get(label.code);
        if (!entry || entry.adrRooms === 0) return null;
        return entry.adrRevenue / entry.adrRooms;
      });
      const adrB = labels.map((label) => {
        const entry = totalsB.get(label.code);
        if (!entry || entry.adrRooms === 0) return null;
        return entry.adrRevenue / entry.adrRooms;
      });

      setComparisonData({ labels, roomsA, roomsB, adrA, adrB });
    } catch (fetchError) {
      console.error("Fout bij ophalen van reservation statistics:", fetchError);
      setError("Er ging iets mis bij het ophalen van de reservation statistics.");
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!comparisonData) return null;
    return {
      labels: comparisonData.labels.map((label) => label.label),
      datasets: [
        {
          label: "Periode 1",
          data: comparisonData.roomsA,
          backgroundColor: "rgba(59, 130, 246, 0.6)",
        },
        {
          label: "Periode 2",
          data: comparisonData.roomsB,
          backgroundColor: "rgba(16, 185, 129, 0.6)",
        },
      ],
    };
  }, [comparisonData]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            afterLabel: (context) => {
              if (!comparisonData) return "";
              const datasetIndex = context.datasetIndex;
              const adrValue =
                datasetIndex === 0
                  ? comparisonData.adrA[context.dataIndex]
                  : comparisonData.adrB[context.dataIndex];
              return `ADR: ${formatAdr(adrValue)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
          title: {
            display: true,
            text: dayFilter === "all" ? "Rooms sold" : "Gemiddelde rooms sold",
          },
        },
      },
    }),
    [comparisonData, dayFilter]
  );

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <Card className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Segment Comparison</h2>
            <p className="text-gray-600">
              Kies twee dataranges om de market segments en ADR naast elkaar te vergelijken.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700">Periode 1</h3>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Startdatum</label>
                <input
                  type="date"
                  value={rangeAStart}
                  onChange={(event) => setRangeAStart(event.target.value)}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Einddatum</label>
                <input
                  type="date"
                  value={rangeAEnd}
                  onChange={(event) => setRangeAEnd(event.target.value)}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700">Periode 2</h3>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Startdatum</label>
                <input
                  type="date"
                  value={rangeBStart}
                  onChange={(event) => setRangeBStart(event.target.value)}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Einddatum</label>
                <input
                  type="date"
                  value={rangeBEnd}
                  onChange={(event) => setRangeBEnd(event.target.value)}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700" htmlFor="dayFilter">
                Dagfilter
              </label>
              <select
                id="dayFilter"
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
                className="rounded border border-gray-200 px-3 py-2 text-sm"
              >
                {DAY_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" onClick={handleCompare} disabled={isLoading}>
              Vergelijk segments
            </Button>
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Market segment overzicht</h3>
              <p className="text-sm text-gray-600">
                {comparisonData
                  ? "Rooms sold per market segment met ADR tooltip."
                  : "Nog geen vergelijking gemaakt."}
              </p>
            </div>
            {comparisonData ? (
              <div className="text-sm text-gray-500">
                {rangeAStart} tot {rangeAEnd} vs. {rangeBStart} tot {rangeBEnd}
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
              Reservation statistics worden geladen...
            </div>
          ) : chartData ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <Bar data={chartData} options={chartOptions} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
              Klik op &quot;Vergelijk segments&quot; om de grafiek te vullen.
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}
