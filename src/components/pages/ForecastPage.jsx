import React, { useEffect, useMemo, useState } from "react";
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
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  signOut,
  where,
  writeBatch,
} from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { Button } from "../layout/Button";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip);

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const NUMBER_FIELDS = {
  adults: "ADULTS",
  children: "CHILDREN",
  arrivalRooms: "ARRIVAL_ROOMS",
  departureRooms: "DEPARTURE_ROOMS",
  netRoomRevenue: "NET_ROOM",
  packageRevenue: "PKG_REV",
  definiteRooms: "DEFINITE_ROOMS",
  tentativeRooms: "TENTATIVE_ROOMS",
  outOfService: "OUT_OF_SERVICE",
  outOfOrder: "OUT_OF_ORDER",
  guests: "GUESTS",
  percentageDefiniteOccupancy: "PER_DEF_OCC",
  percentageTentativeOccupancy: "PER_TENT_OCC",
};

const parseNumber = (value) => {
  const num = Number(String(value ?? "").toString().replace(",", "."));
  return Number.isFinite(num) ? num : 0;
};

const normalizeDateString = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  // If the value is already an ISO string (yyyy-mm-dd), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle dd.mm.yy formatting from certain CSV exports
  const dotSeparatedMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
  if (dotSeparatedMatch) {
    const [, day, month, shortYear] = dotSeparatedMatch;
    const year = shortYear.length === 2 ? `20${shortYear}` : shortYear;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateInput(parsed);
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatDateInput(parsed);
};

const detectDelimiter = (file) =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      preview: 1,
      delimiter: "",
      complete: ({ meta }) => {
        resolve(meta?.delimiter || ",");
      },
      error: (err) => reject(err),
    });
  });

export default function ForecastPage() {
  const { hotelUid } = useHotelContext();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const [startDate, setStartDate] = useState(formatDateInput());
  const [endDate, setEndDate] = useState(() => {
    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    return formatDateInput(twoWeeks);
  });
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedReservationType, setSelectedReservationType] = useState("");

  useEffect(() => {
    if (!hotelUid) return;
    fetchForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelUid, startDate, endDate]);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const fetchForecast = async () => {
    if (!hotelUid || !startDate || !endDate) return;
    setLoading(true);
    try {
      const forecastRef = collection(db, `hotels/${hotelUid}/occupancyForecast`);
      const forecastQuery = query(
        forecastRef,
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date")
      );
      const snapshot = await getDocs(forecastQuery);
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setForecastData(items);
    } catch (err) {
      console.error("Error loading forecast", err);
      toast.error("Kon forecast niet laden.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !hotelUid) return;

    setUploading(true);

    try {
      const delimiter = await detectDelimiter(file);

      Papa.parse(file, {
        delimiter,
        header: true,
        skipEmptyLines: "greedy",
        skipLinesWithError: true,
        complete: async ({ data, errors }) => {
          if (errors?.length) {
            console.error("CSV parse errors", errors);
            toast.error("CSV bevat rijen met een afwijkend formaat en zijn overgeslagen.");
          }

          try {
            const forecastCollection = collection(db, `hotels/${hotelUid}/occupancyForecast`);
            let batch = writeBatch(db);
            let batchCounter = 0;
            let storedRows = 0;

            const commitBatch = async () => {
              if (batchCounter === 0) return;
              await batch.commit();
              batch = writeBatch(db);
              batchCounter = 0;
            };

            for (const row of data) {
              const dateString = normalizeDateString(row["CONSIDERED_DATE"]);
              if (!dateString) {
                continue;
              }

              const payload = {
                reservationType: row["RESV_TYPE"] || "",
                date: dateString,
                updatedAt: serverTimestamp(),
              };

              Object.entries(NUMBER_FIELDS).forEach(([field, column]) => {
                payload[field] = parseNumber(row[column]);
              });

              const docRef = doc(forecastCollection);
              batch.set(docRef, payload, { merge: true });
              batchCounter += 1;
              storedRows += 1;

              if (batchCounter === 400) {
                await commitBatch();
              }
            }

            await commitBatch();
            toast.success(`Forecast geladen (${storedRows} rijen).`);
            fetchForecast();
          } catch (err) {
            console.error("Error storing forecast", err);
            toast.error("Kon forecast niet opslaan.");
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
    } catch (err) {
      console.error("Error detecting CSV delimiter", err);
      toast.error("CSV kon niet gelezen worden.");
      setUploading(false);
      event.target.value = "";
    }
  };

  const reservationTypes = useMemo(() => {
    return Array.from(
      new Set(forecastData.map((item) => item.reservationType).filter(Boolean))
    ).sort();
  }, [forecastData]);

  useEffect(() => {
    if (!reservationTypes.length) {
      setSelectedReservationType("");
      return;
    }

    if (!selectedReservationType || !reservationTypes.includes(selectedReservationType)) {
      setSelectedReservationType(reservationTypes[0]);
    }
  }, [reservationTypes, selectedReservationType]);

  const filteredForecastData = useMemo(() => {
    if (!selectedReservationType) return forecastData;
    return forecastData.filter((item) => item.reservationType === selectedReservationType);
  }, [forecastData, selectedReservationType]);

  const chartData = useMemo(() => {
    const labels = filteredForecastData.map((item) => item.date);
    return {
      labels,
      datasets: [
        {
          label: "% Definite Occupancy",
          data: filteredForecastData.map((item) => Number(item.percentageDefiniteOccupancy) || 0),
          borderColor: "#b41f1f",
          backgroundColor: "rgba(180, 31, 31, 0.1)",
          tension: 0.25,
        },
        {
          label: "% Tentative Occupancy",
          data: filteredForecastData.map((item) => Number(item.percentageTentativeOccupancy) || 0),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          tension: 0.25,
        },
      ],
    };
  }, [filteredForecastData]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: { mode: "index", intersect: false },
    },
    interaction: { mode: "nearest", intersect: false },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: 100,
        ticks: {
          callback: (value) => `${value}%`,
        },
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={today} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Forecast</h1>
            <p className="text-gray-600">
              Importeer een occupancy forecast CSV en bekijk de bezetting per dag.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#b41f1f] text-white rounded-md font-semibold cursor-pointer hover:bg-[#9d1b1b] transition">
            <FileInput className="h-4 w-4" />
            <span>{uploading ? "Bezig met import..." : "Importeer CSV"}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>

        <Card className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Startdatum</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Einddatum</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex sm:justify-end">
              <Button onClick={fetchForecast} disabled={loading || !hotelUid} className="w-full sm:w-auto">
                {loading ? "Laden..." : "Toon bezetting"}
              </Button>
            </div>
          </div>
          {!hotelUid && <p className="text-sm text-red-600">Selecteer een hotel om data te laden.</p>}
        </Card>

        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Bezetting</h2>
              <span className="text-sm text-gray-500">
                {filteredForecastData.length} dagen gevonden
              </span>
            </div>
            <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm font-semibold text-gray-700">
              Reservatietype
              <select
                value={selectedReservationType}
                onChange={(e) => setSelectedReservationType(e.target.value)}
                className="border rounded px-3 py-2 text-sm min-w-[200px]"
                disabled={!reservationTypes.length}
              >
                {!reservationTypes.length && <option value="">Geen data beschikbaar</option>}
                {reservationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {filteredForecastData.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <p className="text-gray-600">
              {loading
                ? "Data laden..."
                : "Geen data beschikbaar voor deze periode of dit reservatietype."}
            </p>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}
