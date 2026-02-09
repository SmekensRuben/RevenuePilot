import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import {
  getMarketSegmentCodes,
  normalizeMarketSegmentCode,
} from "../../utils/segmentationUtils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip);

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

const getYesterday = (baseDate = new Date()) => {
  const yesterday = new Date(baseDate);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
};

const getRangeByPreset = (preset) => {
  const now = new Date();
  if (preset === "last-month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  let end = getYesterday(now);
  if (end < start) {
    end = new Date(start);
  }
  return { start, end };
};

const CHART_COLORS = [
  "rgb(59, 130, 246)",
  "rgb(16, 185, 129)",
  "rgb(249, 115, 22)",
  "rgb(139, 92, 246)",
  "rgb(236, 72, 153)",
  "rgb(14, 116, 144)",
  "rgb(202, 138, 4)",
  "rgb(100, 116, 139)",
];

export default function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const { hotelUid } = useHotelContext();
  const [rangePreset, setRangePreset] = useState("this-month");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [marketSegments, setMarketSegments] = useState([]);
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [chartLabels, setChartLabels] = useState([]);
  const [segmentSeries, setSegmentSeries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    const { start, end } = getRangeByPreset(rangePreset);
    if (rangePreset !== "custom") {
      setRangeStart(formatDateInput(start));
      setRangeEnd(formatDateInput(end));
    }
  }, [rangePreset]);

  useEffect(() => {
    let isActive = true;
    const loadSegments = async () => {
      if (!hotelUid) {
        if (isActive) {
          setMarketSegments([]);
        }
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

  const segmentOptions = useMemo(
    () =>
      marketSegments
        .map((segment) => {
          const codes = getMarketSegmentCodes(segment)
            .map((code) => normalizeMarketSegmentCode(code))
            .filter(Boolean);
          if (!codes.length) return null;
          const label = segment.name || codes[0];
          const key = segment.id || label;
          return { key, label, codes };
        })
        .filter(Boolean),
    [marketSegments]
  );

  useEffect(() => {
    setSelectedSegments((current) => {
      const available = segmentOptions.map((segment) => segment.key);
      if (!current.length) {
        return available;
      }
      return current.filter((key) => available.includes(key));
    });
  }, [segmentOptions]);

  useEffect(() => {
    let isActive = true;
    const loadStatistics = async () => {
      setErrorMessage("");
      if (!hotelUid || !rangeStart || !rangeEnd || !segmentOptions.length) {
        if (isActive) {
          setChartLabels([]);
          setSegmentSeries([]);
        }
        return;
      }

      const startDate = parseDateInput(rangeStart);
      const endDate = parseDateInput(rangeEnd);
      if (!startDate || !endDate) {
        if (isActive) {
          setErrorMessage(t("invalidDateRange"));
        }
        return;
      }
      if (startDate > endDate) {
        if (isActive) {
          setErrorMessage(t("invalidDateRange"));
        }
        return;
      }

      setIsLoading(true);
      try {
        const dateCursor = new Date(startDate);
        const dates = [];
        while (dateCursor <= endDate) {
          dates.push(new Date(dateCursor));
          dateCursor.setDate(dateCursor.getDate() + 1);
        }

        const lookup = new Map();
        segmentOptions.forEach((segment) => {
          segment.codes.forEach((code) => {
            lookup.set(code, { key: segment.key, label: segment.label });
          });
        });

        const dailyStats = await Promise.all(
          dates.map(async (date) => {
            const dateKey = formatDateInput(date);
            const docRef = doc(db, `hotels/${hotelUid}/reservationStatistics`, dateKey);
            const snap = await getDoc(docRef);
            const data = snap.exists() ? snap.data() : {};
            const marketStats = data?.reservationsStatisticsByMarketCode || [];
            const rows = Array.isArray(marketStats)
              ? marketStats.map((item) => ({
                  marketCode: String(item?.marketCode || "").trim(),
                  roomsSold: Number(item?.roomsSold ?? 0),
                }))
              : Object.entries(marketStats).map(([marketCode, value]) => ({
                  marketCode: String(marketCode || "").trim(),
                  roomsSold: Number(value?.roomsSold ?? 0),
                }));
            return { dateKey, rows };
          })
        );

        const seriesMap = new Map(
          segmentOptions.map((segment) => [
            segment.key,
            { key: segment.key, label: segment.label, data: [] },
          ])
        );

        dailyStats.forEach(({ rows }) => {
          const totals = new Map();
          rows.forEach((row) => {
            const normalized = normalizeMarketSegmentCode(row.marketCode);
            const mapped = lookup.get(normalized);
            if (!mapped) return;
            totals.set(mapped.key, (totals.get(mapped.key) || 0) + (Number(row.roomsSold) || 0));
          });
          seriesMap.forEach((series) => {
            series.data.push(totals.get(series.key) || 0);
          });
        });

        if (isActive) {
          setChartLabels(dailyStats.map((entry) => entry.dateKey));
          setSegmentSeries(Array.from(seriesMap.values()));
        }
      } catch (loadError) {
        console.error("Fout bij ophalen van reservation statistics:", loadError);
        if (isActive) {
          setErrorMessage(t("loadError"));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadStatistics();
    return () => {
      isActive = false;
    };
  }, [hotelUid, rangeStart, rangeEnd, segmentOptions, t]);

  const chartData = useMemo(() => {
    if (!chartLabels.length || !segmentSeries.length) return null;
    const datasets = segmentSeries
      .filter((series) => selectedSegments.includes(series.key))
      .map((series, index) => {
        const color = CHART_COLORS[index % CHART_COLORS.length];
        return {
          label: series.label,
          data: series.data,
          borderColor: color,
          backgroundColor: color,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        };
      });
    return {
      labels: chartLabels,
      datasets,
    };
  }, [chartLabels, segmentSeries, selectedSegments]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    }),
    []
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const handleToggleSegment = (key) => {
    setSelectedSegments((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  const handleSelectAllSegments = () => {
    setSelectedSegments(segmentOptions.map((segment) => segment.key));
  };

  const handleClearSegments = () => {
    setSelectedSegments([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={today} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <Card className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-500">{t("dateRangeLabel")}</p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={rangePreset}
                  onChange={(event) => setRangePreset(event.target.value)}
                  className="rounded border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="this-month">{t("datePresets.thisMonth")}</option>
                  <option value="last-month">{t("datePresets.lastMonth")}</option>
                  <option value="custom">{t("datePresets.custom")}</option>
                </select>
                {rangePreset === "custom" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm font-semibold text-gray-700">
                      {t("startDate")}
                    </label>
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(event) => setRangeStart(event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm"
                    />
                    <label className="text-sm font-semibold text-gray-700">
                      {t("endDate")}
                    </label>
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={(event) => setRangeEnd(event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    {rangeStart} → {rangeEnd}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span className="font-semibold text-gray-700">{t("segmentFilterTitle")}</span>
              <button
                type="button"
                onClick={handleSelectAllSegments}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700"
              >
                {t("selectAll")}
              </button>
              <button
                type="button"
                onClick={handleClearSegments}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700"
              >
                {t("clearAll")}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {segmentOptions.length ? (
              segmentOptions.map((segment) => (
                <label
                  key={segment.key}
                  className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedSegments.includes(segment.key)}
                    onChange={() => handleToggleSegment(segment.key)}
                    className="h-4 w-4"
                  />
                  {segment.label}
                </label>
              ))
            ) : (
              <span className="text-sm text-gray-500">{t("noSegments")}</span>
            )}
          </div>
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t("chartTitle")}</h2>
            <p className="text-sm text-gray-600">{t("chartSubtitle")}</p>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
              {t("loading")}
            </div>
          ) : chartData && chartData.datasets.length ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <Line data={chartData} options={chartOptions} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
              {t("noData")}
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}
