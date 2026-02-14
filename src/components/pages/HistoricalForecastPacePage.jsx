import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "react-toastify";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { FileInput } from "lucide-react";
import {
  auth,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  signOut,
  writeBatch,
} from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { Button } from "../layout/Button";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip);

const BASE_FIELD_MAPPINGS = [
  { header: "Events", field: "events" },
  { header: "Occ%", field: "occupancyPercentage" },
  { header: "Total Rooms OTB", field: "totalRoomsOtb" },
  { header: "OOO Rooms", field: "oooRooms" },
  { header: "Rooms to Sell", field: "roomsToSell" },
  { header: "Total Trans OTB", field: "totalTransientOtb" },
  { header: "Total Group OTB", field: "totalGroupOtb" },
];

const SEGMENT_MAPPINGS = [
  { header: "REG", segment: "Retail" },
  { header: "RTR", segment: "Retail" },
  { header: "BEN", segment: "Retail" },
  { header: "ADP", segment: "Discount" },
  { header: "PKG", segment: "Package" },
  { header: "CRS", segment: "Negotiated" },
  { header: "SFB", segment: "Package" },
  { header: "SPE", segment: "Negotiated" },
  { header: "NOM", segment: "Negotiated" },
  { header: "WHO", segment: "Wholesale" },
  { header: "SDC", segment: "Discount" },
  { header: "OTD", segment: "Discount" },
  { header: "ECM", segment: "House Use" },
  { header: "CMP", segment: "Complimentary" },
  { header: "MAR", segment: "Brand Redemptions" },
  { header: "BMR", segment: "Brand Redemptions" },
  { header: "AAA", segment: "Discount" },
];

const SEGMENT_OPTIONS = [
  ...Array.from(new Set(SEGMENT_MAPPINGS.map(({ segment }) => segment))),
  "Groups",
];

const SEGMENT_FIELD_OVERRIDES = {
  Groups: "totalGroupOtb",
};

const COMPARISON_OFFSETS = [1, 3, 7, 14, 21];

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const parseNumber = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(",", ".").replace(/%/g, "").trim();
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const toCamelCase = (label = "") =>
  label
    .toLowerCase()
    .replace(/[-\s]+(.)?/g, (match, chr) => (chr ? chr.toUpperCase() : ""))
    .replace(/^(.)/, (chr) => chr.toLowerCase());

const getValueByHeader = (row, header) => {
  if (row[header] !== undefined) return row[header];
  const matchingKey = Object.keys(row).find(
    (key) => key === header || key.startsWith(`${header}_`)
  );
  return matchingKey ? row[matchingKey] : undefined;
};

const normalizeHistoricalDate = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const slashMatch = trimmed.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})$/);
  if (!slashMatch) return null;

  const [, day, month, yearPart] = slashMatch;
  const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateInput(parsed);
};

export default function HistoricalForecastPacePage() {
  const { hotelUid } = useHotelContext();
  const [selectedReportDate, setSelectedReportDate] = useState(formatDateInput());
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFilterDate, setSelectedFilterDate] = useState(formatDateInput());
  const [selectedSegments, setSelectedSegments] = useState(SEGMENT_OPTIONS);
  const [historicalData, setHistoricalData] = useState([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState(formatDateInput());
  const [rangeEndDate, setRangeEndDate] = useState(formatDateInput());
  const [rangeComparisons, setRangeComparisons] = useState([]);
  const [loadingRangeComparisons, setLoadingRangeComparisons] = useState(false);
  const fileInputRef = useRef(null);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const handleToggleSegment = (segment) => {
    setSelectedSegments((current) =>
      current.includes(segment)
        ? current.filter((item) => item !== segment)
        : [...current, segment]
    );
  };

  const handleToggleAllSegments = () => {
    setSelectedSegments((current) =>
      current.length === SEGMENT_OPTIONS.length ? [] : SEGMENT_OPTIONS
    );
  };

  const openDateDialog = () => {
    setIsDateDialogOpen(true);
  };

  const confirmDateAndOpenFilePicker = () => {
    if (!selectedReportDate) {
      toast.error("Selecteer eerst een datum voor het historische rapport.");
      return;
    }
    setIsDateDialogOpen(false);
    fileInputRef.current?.click();
  };

  const parseDateToStartOfDay = (value) => {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const findClosestPreviousSnapshot = (snapshots, latestReportDate, targetOffset) => {
    const latestDate = parseDateToStartOfDay(latestReportDate);
    if (!latestDate) return null;

    let bestMatch = null;

    snapshots.forEach((snapshot) => {
      const snapshotDate = parseDateToStartOfDay(snapshot.reportDate);
      if (!snapshotDate) return;

      const diffMs = latestDate - snapshotDate;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return;

      const distanceFromTarget = Math.abs(diffDays - targetOffset);

      if (
        !bestMatch ||
        distanceFromTarget < bestMatch.distanceFromTarget ||
        (distanceFromTarget === bestMatch.distanceFromTarget && diffDays < bestMatch.diffDays)
      ) {
        bestMatch = { ...snapshot, diffDays, distanceFromTarget };
      }
    });

    return bestMatch;
  };

  const fetchHistoricalSegments = async () => {
    if (!hotelUid) {
      toast.error("Selecteer een hotel om data te laden.");
      return;
    }

    if (!selectedFilterDate) {
      toast.error("Kies een datum om te filteren.");
      return;
    }

    setLoadingHistorical(true);

    try {
      const reportCollection = collection(
        db,
        `hotels/${hotelUid}/historicalBobPerSegment`
      );

      const reportSnapshot = await getDocs(reportCollection);

      const entries = await Promise.all(
        reportSnapshot.docs.map(async (reportDoc) => {
          const reportData = reportDoc.data();
          const reportDate = reportData?.reportDate || reportDoc.id;

          const dateDocRef = doc(reportDoc.ref, "dates", selectedFilterDate);
          const dateDocSnap = await getDoc(dateDocRef);

          if (!dateDocSnap.exists()) return null;

          return {
            reportDate,
            ...dateDocSnap.data(),
          };
        })
      );

      const validEntries = entries
        .filter(Boolean)
        .sort((a, b) => (a.reportDate || "").localeCompare(b.reportDate || ""));

      setHistoricalData(validEntries);

      if (!validEntries.length) {
        toast.info("Geen data gevonden voor deze datum.");
      }
    } catch (err) {
      console.error("Error fetching historical forecast pace", err);
      toast.error("Kon historische forecast pace niet laden.");
    } finally {
      setLoadingHistorical(false);
    }
  };

  const fetchRangeComparisons = async () => {
    if (!hotelUid) {
      toast.error("Selecteer een hotel om data te laden.");
      return;
    }

    const parsedStart = parseDateToStartOfDay(rangeStartDate);
    const parsedEnd = parseDateToStartOfDay(rangeEndDate);

    if (!parsedStart || !parsedEnd) {
      toast.error("Selecteer zowel een start- als einddatum.");
      return;
    }

    if (parsedStart > parsedEnd) {
      toast.error("De startdatum moet voor de einddatum liggen.");
      return;
    }

    setLoadingRangeComparisons(true);

    try {
      const reportCollection = collection(db, `hotels/${hotelUid}/historicalBobPerSegment`);
      const reportSnapshot = await getDocs(reportCollection);

      const stayDateSnapshots = {};

      await Promise.all(
        reportSnapshot.docs.map(async (reportDoc) => {
          const reportData = reportDoc.data();
          const reportDate = reportData?.reportDate || reportDoc.id;

          const dateDocs = await getDocs(collection(reportDoc.ref, "dates"));

          dateDocs.forEach((dateDoc) => {
            const stayDate = dateDoc.id;
            const stayDateObj = parseDateToStartOfDay(stayDate);

            if (!stayDateObj || stayDateObj < parsedStart || stayDateObj > parsedEnd) return;

            stayDateSnapshots[stayDate] = stayDateSnapshots[stayDate] || [];
            stayDateSnapshots[stayDate].push({
              reportDate,
              data: dateDoc.data(),
            });
          });
        })
      );

      const comparisons = Object.entries(stayDateSnapshots)
        .map(([stayDate, snapshots]) => {
          const orderedSnapshots = snapshots.sort((a, b) =>
            (a.reportDate || "").localeCompare(b.reportDate || "")
          );

          const latestSnapshot = orderedSnapshots[orderedSnapshots.length - 1];

          const segmentComparisons = selectedSegments.reduce((acc, segment) => {
            const fieldName = SEGMENT_FIELD_OVERRIDES[segment] || `${toCamelCase(segment)}Otb`;
            const currentValue = Number(latestSnapshot.data?.[fieldName] ?? 0);

            acc[segment] = COMPARISON_OFFSETS.reduce((offsetAcc, offset) => {
              const reference = findClosestPreviousSnapshot(
                orderedSnapshots,
                latestSnapshot.reportDate,
                offset
              );

              if (!reference) {
                offsetAcc[offset] = null;
                return offsetAcc;
              }

              const referenceValue = Number(reference.data?.[fieldName] ?? 0);
              offsetAcc[offset] = {
                value: currentValue - referenceValue,
                referenceReportDate: reference.reportDate,
              };
              return offsetAcc;
            }, {});

            return acc;
          }, {});

          return {
            stayDate,
            latestReportDate: latestSnapshot.reportDate,
            comparisons: segmentComparisons,
          };
        })
        .sort((a, b) => a.stayDate.localeCompare(b.stayDate));

      setRangeComparisons(comparisons);

      if (!comparisons.length) {
        toast.info("Geen data gevonden voor deze datumrange.");
      }
    } catch (err) {
      console.error("Error fetching range comparisons", err);
      toast.error("Kon de datumrange vergelijkingen niet laden.");
    } finally {
      setLoadingRangeComparisons(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!hotelUid) {
      toast.error("Selecteer een hotel om data op te slaan.");
      event.target.value = "";
      return;
    }

    setUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: async ({ data, errors }) => {
        if (errors?.length) {
          console.warn("CSV parse errors", errors);
          toast.warn("Sommige rijen konden niet worden gelezen en zijn overgeslagen.");
        }

        try {
          const validRows = data
            .map((row) => {
              const rawDate = getValueByHeader(row, "Date");
              const normalizedDate = normalizeHistoricalDate(rawDate);
              if (!normalizedDate) return null;

              const payload = { date: normalizedDate };

              BASE_FIELD_MAPPINGS.forEach(({ header, field }) => {
                const value = parseNumber(getValueByHeader(row, header));
                if (value !== null) {
                  payload[field] = value;
                }
              });

              const segmentTotals = {};
              SEGMENT_MAPPINGS.forEach(({ header, segment }) => {
                const value = parseNumber(getValueByHeader(row, header));
                if (value === null) return;

                const fieldName = `${toCamelCase(segment)}Otb`;
                segmentTotals[fieldName] = (segmentTotals[fieldName] || 0) + value;
              });

              Object.entries(segmentTotals).forEach(([field, value]) => {
                payload[field] = value;
              });

              return payload;
            })
            .filter(Boolean);

          if (!validRows.length) {
            toast.error("Geen geldige rijen gevonden in het CSV-bestand.");
            return;
          }

          const reportCollection = collection(
            db,
            `hotels/${hotelUid}/historicalBobPerSegment`
          );
          const reportDocRef = doc(reportCollection, selectedReportDate);

          await setDoc(
            reportDocRef,
            {
              reportDate: selectedReportDate,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const datesCollection = collection(reportDocRef, "dates");
          let batch = writeBatch(db);
          let batchCounter = 0;

          const commitBatch = async () => {
            if (!batchCounter) return;
            await batch.commit();
            batch = writeBatch(db);
            batchCounter = 0;
          };

          for (const row of validRows) {
            const rowRef = doc(datesCollection, row.date);
            batch.set(
              rowRef,
              {
                ...row,
                reportDate: selectedReportDate,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
            batchCounter += 1;

            if (batchCounter === 400) {
              await commitBatch();
            }
          }

          await commitBatch();
          toast.success(`Historische forecast pace opgeslagen (${validRows.length} rijen).`);
        } catch (err) {
          console.error("Error storing historical forecast pace", err);
          toast.error("Kon historische forecast pace niet opslaan.");
        } finally {
          setUploading(false);
          event.target.value = "";
        }
      },
      error: (err) => {
        console.error("Error parsing CSV", err);
        toast.error("CSV kon niet gelezen worden.");
        setUploading(false);
        event.target.value = "";
      },
    });
  };

  const historicalChartData = useMemo(() => {
    if (!historicalData.length || !selectedSegments.length) return null;

    const palette = [
      "#b41f1f",
      "#2563eb",
      "#16a34a",
      "#f59e0b",
      "#a855f7",
      "#0ea5e9",
      "#ef4444",
      "#10b981",
    ];

    const labels = historicalData.map(({ reportDate }) => reportDate);
    const datasets = selectedSegments.map((segment, index) => {
      const color = palette[index % palette.length];
      const fieldName = SEGMENT_FIELD_OVERRIDES[segment] || `${toCamelCase(segment)}Otb`;

      return {
        label: segment,
        data: historicalData.map((item) => Number(item[fieldName] ?? 0)),
        borderColor: color,
        backgroundColor: `${color}33`,
        tension: 0.25,
        pointRadius: 3,
      };
    });

    return { labels, datasets };
  }, [historicalData, selectedSegments]);

  const historicalChartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { position: "top" },
        tooltip: { mode: "index", intersect: false },
      },
      interaction: { mode: "nearest", intersect: false },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    }),
    []
  );

  const renderDeltaCell = (delta) => {
    if (!delta) {
      return <span className="text-gray-400">—</span>;
    }

    return (
      <div className="space-y-1">
        <div className="font-medium">{delta.value.toLocaleString("nl-NL")}</div>
        {delta.referenceReportDate && (
          <div className="text-xs text-gray-500">vs {delta.referenceReportDate}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={today} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Historical Forecast Pace
            </h1>
            <p className="text-gray-600">
              Importeer een historisch forecast pace CSV en sla de gegevens per datum en segment op.
            </p>
          </div>
          <div className="flex items-center justify-end w-full sm:w-auto">
            <Button
              onClick={openDateDialog}
              disabled={uploading}
              className="bg-[#b41f1f] hover:bg-[#9d1b1b] flex items-center gap-2"
            >
              <FileInput className="h-4 w-4" />
              <span>{uploading ? "Bezig met import..." : "Importeer pace CSV"}</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </div>
        </div>

        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Hoe werkt het?</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm sm:text-base">
            <li>Klik op "Importeer pace CSV" en kies eerst de rapportdatum.</li>
            <li>Na het kiezen van de datum kun je een CSV-bestand uploaden.</li>
            <li>
              Rijen zonder geldige datum in de kolom <code>Date</code> (dd/mm/jjjj) worden overgeslagen.
            </li>
            <li>
              Segmentcodes worden automatisch gemapt naar de huidige segmenten en als <code>*Otb</code>-velden opgeslagen.
            </li>
            <li>
              Data wordt opgeslagen onder <code>historicalBobPerSegment/{"{documentId}"}/dates</code>.
            </li>
          </ul>
        </Card>

        <Card className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr_auto] items-start">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Datum</label>
              <input
                type="date"
                value={selectedFilterDate}
                onChange={(e) => setSelectedFilterDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-sm font-semibold text-gray-700">Segmenten</label>
                <Button
                  type="button"
                  onClick={handleToggleAllSegments}
                  className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  {selectedSegments.length === SEGMENT_OPTIONS.length
                    ? "Deselecteer alles"
                    : "Selecteer alles"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {SEGMENT_OPTIONS.map((segment) => (
                  <label
                    key={segment}
                    className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedSegments.includes(segment)}
                      onChange={() => handleToggleSegment(segment)}
                    />
                    {segment}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex w-full lg:w-auto lg:justify-end">
              <Button
                type="button"
                onClick={fetchHistoricalSegments}
                disabled={loadingHistorical || !hotelUid}
                className="w-full lg:w-auto"
              >
                {loadingHistorical ? "Laden..." : "Toon historische pace"}
              </Button>
            </div>
          </div>
          {!hotelUid && (
            <p className="text-sm text-red-600">
              Selecteer een hotel om historische pace-data te laden.
            </p>
          )}
        </Card>

        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Historische pace per segment</h2>
              <p className="text-sm text-gray-500">
                {historicalData.length
                  ? `${historicalData.length} rapporten gevonden`
                  : "Kies een datum en segmenten om de grafiek te laden."}
              </p>
            </div>
            <div className="text-sm text-gray-600">
              {selectedSegments.length} segment(en) geselecteerd
            </div>
          </div>

          {loadingHistorical ? (
            <p className="text-gray-600">Data laden...</p>
          ) : historicalChartData && historicalChartData.datasets.length ? (
            <Line data={historicalChartData} options={historicalChartOptions} />
          ) : (
            <p className="text-gray-600">
              Geen data beschikbaar voor de gekozen combinatie van datum en segmenten.
            </p>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Datumrange vergelijking per segment</h2>
              <p className="text-sm text-gray-500">
                Bekijk hoeveel boekingen er zijn toegevoegd ten opzichte van eerdere rapporten.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Startdatum</label>
                <input
                  type="date"
                  value={rangeStartDate}
                  onChange={(e) => setRangeStartDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Einddatum</label>
                <input
                  type="date"
                  value={rangeEndDate}
                  onChange={(e) => setRangeEndDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={fetchRangeComparisons}
                  disabled={loadingRangeComparisons || !hotelUid}
                  className="w-full"
                >
                  {loadingRangeComparisons ? "Berekenen..." : "Toon datumrange"}
                </Button>
              </div>
            </div>
          </div>

          {!selectedSegments.length ? (
            <p className="text-sm text-gray-600">
              Selecteer minstens één segment om vergelijkingen te tonen.
            </p>
          ) : loadingRangeComparisons ? (
            <p className="text-gray-600">Vergelijkingen laden...</p>
          ) : !rangeComparisons.length ? (
            <p className="text-gray-600">
              Kies een datumrange en laad de vergelijkingen om resultaten te zien.
            </p>
          ) : (
            <div className="space-y-4">
              {rangeComparisons.map(({ stayDate, latestReportDate, comparisons }) => (
                <div
                  key={stayDate}
                  className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-semibold text-gray-900">{stayDate}</div>
                    <div className="text-sm text-gray-600">
                      Laatste rapport: {latestReportDate}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-gray-800">
                      <thead>
                        <tr className="bg-white">
                          <th className="p-2 font-semibold">Segment</th>
                          {COMPARISON_OFFSETS.map((offset) => (
                            <th key={offset} className="p-2 font-semibold text-center">
                              +{offset} dag{offset === 1 ? "" : "en"}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSegments.map((segment) => (
                          <tr key={segment} className="odd:bg-white even:bg-gray-100">
                            <td className="p-2 font-medium text-gray-900">{segment}</td>
                            {COMPARISON_OFFSETS.map((offset) => (
                              <td key={offset} className="p-2 align-top">
                                {renderDeltaCell(comparisons[segment]?.[offset])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </PageContainer>

      {isDateDialogOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Kies datum voor historisch rapport
            </h3>
            <p className="text-sm text-gray-600">
              Deze datum wordt gebruikt als documentId in Firestore.
            </p>
            <input
              type="date"
              value={selectedReportDate}
              onChange={(e) => setSelectedReportDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <Button
                type="button"
                className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                onClick={() => setIsDateDialogOpen(false)}
                disabled={uploading}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                onClick={confirmDateAndOpenFilePicker}
                disabled={uploading || !selectedReportDate}
              >
                Kies CSV-bestand
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
