import React, { useEffect, useMemo, useRef, useState } from "react";
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
  ArcElement,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
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
import { FileInput } from "lucide-react";

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip, ArcElement);
const DATE_PRESETS = [
  { key: "yesterday", labelKey: "filters.presets.yesterday" },
  { key: "thisWeek", labelKey: "filters.presets.thisWeek" },
  { key: "thisMonth", labelKey: "filters.presets.thisMonth" },
  { key: "lastMonth", labelKey: "filters.presets.lastMonth" },
  { key: "custom", labelKey: "filters.presets.custom" },
];

function parseDateFromInput(value) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (![year, month, day].every(Number.isFinite)) {
    return null;
  }

  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateRangeForPreset(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { start: formatDateInput(yesterday), end: formatDateInput(yesterday) };
  }

  if (preset === "thisWeek") {
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = (day + 6) % 7; // Monday as start of week
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    return { start: formatDateInput(startOfWeek), end: formatDateInput(today) };
  }

  if (preset === "thisMonth") {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: formatDateInput(startOfMonth), end: formatDateInput(today) };
  }

  if (preset === "lastMonth") {
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      start: formatDateInput(startOfLastMonth),
      end: formatDateInput(endOfLastMonth),
    };
  }

  return { start: formatDateInput(today), end: formatDateInput(today) };
}

export default function MadeReservationsPage() {
  const { t } = useTranslation("reservations");
  const { hotelUid } = useHotelContext();
  const [datePreset, setDatePreset] = useState("yesterday");
  const [dateRange, setDateRange] = useState(() => getDateRangeForPreset("yesterday"));
  const [importDate, setImportDate] = useState(formatDateInput());
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "arrivalDate", direction: "asc" });
  const [showGraph, setShowGraph] = useState(false);
  const [roomTypeFilter, setRoomTypeFilter] = useState([]);
  const [isRoomTypeDropdownOpen, setIsRoomTypeDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);

  const visibleColumns = useMemo(
    () => [
      { key: "fullName", label: t("columns.guest") },
      { key: "arrivalDate", label: t("columns.arrival") },
      { key: "departureDate", label: t("columns.departure") },
      { key: "room", label: t("columns.room") },
      { key: "roomTypeCode", label: t("columns.roomType") },
      { key: "nights", label: t("columns.nights") },
      { key: "shareAmount", label: t("columns.shareAmount") },
      { key: "companyName", label: t("columns.company") },
    ],
    [t]
  );

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }),
    []
  );

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  const datePresetOptions = useMemo(
    () => DATE_PRESETS.map((preset) => ({ ...preset, label: t(preset.labelKey) })),
    [t]
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    if (datePreset !== "custom") {
      setDateRange(getDateRangeForPreset(datePreset));
    }
  }, [datePreset]);

  useEffect(() => {
    async function fetchReservations() {
      if (!hotelUid || !dateRange.start) {
        setReservations([]);
        return;
      }

      const startDate = parseDateFromInput(dateRange.start);
      if (!startDate) {
        setReservations([]);
        return;
      }

      const endDateCandidate = parseDateFromInput(dateRange.end) || startDate;
      const normalizedEndDate = endDateCandidate < startDate ? startDate : endDateCandidate;

      const datesToLoad = [];
      const cursor = new Date(startDate);
      while (cursor <= normalizedEndDate) {
        datesToLoad.push(formatDateInput(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      setIsLoading(true);
      try {
        const results = await Promise.all(
          datesToLoad.map(async (date) => {
            try {
              const docRef = doc(
                db,
                `hotels/${hotelUid}/reservationsCreatedByDate`,
                date
              );
              const snap = await getDoc(docRef);
              const data = snap.exists() ? snap.data() : {};
              return { date, reservations: Array.isArray(data.reservations) ? data.reservations : [] };
            } catch (error) {
              console.error(`Failed to load reservations for ${date}`, error);
              return { date, reservations: [] };
            }
          })
        );

        const reservationsWithDates = results.flatMap((result) =>
          (result.reservations || []).map((reservation) => ({
            ...reservation,
            __sourceDate: result.date,
          }))
        );

        setReservations(reservationsWithDates);
      } catch (error) {
        console.error("Failed to load reservations", error);
        toast.error(t("messages.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchReservations();
  }, [hotelUid, dateRange, t]);

  const handleImportClick = () => {
    setIsImporting(true);
    setImportDate(dateRange.start || formatDateInput());
  };

  const handleDateChange = (key, value) => {
    setDateRange((current) => ({
      ...current,
      [key]: value,
    }));
    setDatePreset("custom");
  };

  const dateRangeLabel = useMemo(() => {
    if (!dateRange.start) {
      return t("filters.dateRangeMissing");
    }

    if (!dateRange.end || dateRange.end === dateRange.start) {
      return dateRange.start;
    }

    return `${dateRange.start} – ${dateRange.end}`;
  }, [dateRange, t]);

  const roomTypeOptions = useMemo(() => {
    const types = new Set();
    reservations.forEach((reservation) => {
      if (reservation.roomTypeCode) {
        types.add(String(reservation.roomTypeCode));
      }
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    if (!roomTypeFilter.length) return reservations;
    const selected = roomTypeFilter.map((type) => String(type).toLowerCase());
    return reservations.filter((reservation) =>
      selected.includes(String(reservation.roomTypeCode || "").toLowerCase())
    );
  }, [reservations, roomTypeFilter]);

  const sortedReservations = useMemo(() => {
    if (!sortConfig.key) {
      return filteredReservations;
    }

    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;

    const toComparable = (value) => {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
      return String(value || "");
    };

    return [...filteredReservations].sort((a, b) => {
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
  }, [filteredReservations, sortConfig]);

  const reservationSummary = useMemo(() => {
    const totalReservations = filteredReservations.length;
    const totalNights = filteredReservations.reduce(
      (sum, reservation) => sum + (Number(reservation?.nights) || 0),
      0
    );

    const totalRevenue = filteredReservations.reduce((sum, reservation) => {
      const nights = Number(reservation?.nights) || 0;
      const shareAmount = Number(reservation?.shareAmount) || 0;
      return sum + nights * shareAmount;
    }, 0);

    const companyCounts = filteredReservations.reduce((acc, reservation) => {
      const company = String(reservation?.companyName || "").trim();
      if (!company) return acc;
      acc[company] = (acc[company] || 0) + 1;
      return acc;
    }, {});

    const topCompany = Object.entries(companyCounts).reduce(
      (currentTop, [company, count]) => {
        if (!currentTop || count > currentTop.count) {
          return { company, count };
        }
        return currentTop;
      },
      null
    );

    const roomTypeCounts = filteredReservations.reduce((acc, reservation) => {
      const roomType = reservation.roomTypeCode || t("page.noData");
      acc[roomType] = (acc[roomType] || 0) + 1;
      return acc;
    }, {});

    return {
      totalReservations,
      totalNights,
      totalRevenue: currencyFormatter.format(totalRevenue),
      topCompany,
      roomTypeCounts,
    };
  }, [currencyFormatter, filteredReservations, t]);

  const dailyMetrics = useMemo(() => {
    const grouped = filteredReservations.reduce((acc, reservation) => {
      const dateKey = reservation.__sourceDate || reservation.arrivalDate;
      if (!dateKey) return acc;

      if (!acc[dateKey]) {
        acc[dateKey] = { reservations: 0, nights: 0, revenue: 0 };
      }

      const nights = Number(reservation?.nights) || 0;
      const shareAmount = Number(reservation?.shareAmount) || 0;

      acc[dateKey].reservations += 1;
      acc[dateKey].nights += nights;
      acc[dateKey].revenue += nights * shareAmount;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([date, metrics]) => ({ date, ...metrics }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredReservations]);

  const chartData = useMemo(() => {
    const labels = dailyMetrics.map((item) => item.date);

    return {
      labels,
      datasets: [
        {
          label: t("summary.reservations"),
          data: dailyMetrics.map((item) => item.reservations),
          borderColor: "#b41f1f",
          backgroundColor: "rgba(180, 31, 31, 0.2)",
          tension: 0.25,
        },
        {
          label: t("summary.nights"),
          data: dailyMetrics.map((item) => item.nights),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.2)",
          tension: 0.25,
        },
        {
          label: t("summary.revenue"),
          data: dailyMetrics.map((item) => item.revenue),
          borderColor: "#059669",
          backgroundColor: "rgba(5, 150, 105, 0.2)",
          yAxisID: "y1",
          tension: 0.25,
        },
      ],
    };
  }, [dailyMetrics, t]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || "";
              const value = context.raw;

              if (context.dataset.yAxisID === "y1") {
                return `${label}: ${currencyFormatter.format(value)}`;
              }

              return `${label}: ${value}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: t("filters.datePreset"),
          },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: t("summary.reservations") },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: t("summary.revenue") },
          ticks: {
            callback: (value) => currencyFormatter.format(value),
          },
        },
      },
    }),
    [currencyFormatter, t]
  );

  const roomTypeChartData = useMemo(() => {
    const entries = Object.entries(reservationSummary.roomTypeCounts || {});
    if (!entries.length) return null;

    const colors = [
      "#b41f1f",
      "#2563eb",
      "#059669",
      "#f59e0b",
      "#7c3aed",
      "#0ea5e9",
    ];

    return {
      labels: entries.map(([label]) => label || t("page.noData")),
      datasets: [
        {
          label: t("summary.roomTypeBreakdown"),
          data: entries.map(([, count]) => count),
          backgroundColor: entries.map((_, index) => colors[index % colors.length]),
          borderWidth: 1,
        },
      ],
    };
  }, [reservationSummary.roomTypeCounts, t]);

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
      toast.error(t("messages.selectHotel"));
      return;
    }
    if (!importDate) {
      toast.error(t("messages.chooseDate"));
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error(t("messages.chooseCsv"));
      return;
    }

    setIsImporting(false);
    toast.info(t("messages.parsing"));

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = Array.isArray(results.data) ? results.data : [];
          const validRows = rows.filter(
            (row) => String(row?.INSERT_USER || "").trim().length > 0
          );
          const mappedRows = validRows.map(mapCsvRow);
          const docRef = doc(
            db,
            `hotels/${hotelUid}/reservationsCreatedByDate`,
            importDate
          );
          await setDoc(docRef, {
            reservations: mappedRows,
            updatedAt: serverTimestamp(),
          });
          toast.success(t("messages.imported"));
          setDateRange({ start: importDate, end: importDate });
        } catch (error) {
          console.error("Failed to save reservations", error);
          toast.error(t("messages.saveFailed"));
        } finally {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      },
      error: (error) => {
        console.error("CSV parse error", error);
        toast.error(t("messages.csvError"));
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">
              {t("page.tag")}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold">{t("page.title")}</h1>
            <p className="text-gray-600 mt-1">{t("page.description")}</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={handleImportClick}
              className="bg-[#b41f1f] text-white px-3 py-2 rounded-full shadow hover:bg-[#961919] transition-colors"
              aria-label={t("import.import")}
              title={t("import.import")}
            >
              <FileInput className="h-5 w-5" />
              <span className="sr-only">{t("import.import")}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-start w-full">
          <p className="text-sm font-semibold text-gray-700">{t("filters.title")}</p>
          <div className="flex flex-wrap items-end gap-3 w-full">
            <label className="flex flex-col text-sm font-semibold text-gray-700 w-52 min-w-[12rem]">
              {t("filters.datePreset")}
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {datePresetOptions.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            {datePreset === "custom" && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col text-sm font-semibold text-gray-700 w-40">
                  {t("filters.startDate")}
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => handleDateChange("start", e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-sm font-semibold text-gray-700 w-40">
                  {t("filters.endDate")}
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => handleDateChange("end", e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRoomTypeDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 bg-white shadow-sm"
              >
                <div className="text-left">
                  <div>{t("filters.roomType")}</div>
                  <div className="text-xs text-gray-500">
                    {roomTypeFilter.length
                      ? t("filters.roomTypeSelected", { count: roomTypeFilter.length })
                      : t("filters.roomTypeAll")}
                  </div>
                </div>
                <span className="text-gray-500">▾</span>
              </button>
              {isRoomTypeDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-lg shadow-xl ring-1 ring-black/5 z-30 overflow-hidden bg-white text-gray-900">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      {t("filters.roomType")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setRoomTypeFilter([])}
                      className="text-xs font-semibold text-[#b41f1f] hover:text-[#961919]"
                    >
                      {t("filters.roomTypeAll")}
                    </button>
                  </div>
                  <div className="py-2 max-h-48 overflow-y-auto">
                    {roomTypeOptions.length === 0 && (
                      <p className="px-4 py-2 text-sm text-gray-600">{t("summary.noRoomTypes")}</p>
                    )}
                    {roomTypeOptions.map((option) => {
                      const isSelected = roomTypeFilter.includes(option);
                      return (
                        <label
                          key={option}
                          className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setRoomTypeFilter((current) =>
                                isSelected
                                  ? current.filter((value) => value !== option)
                                  : [...current, option]
                              );
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-800">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={showGraph}
                onChange={(e) => setShowGraph(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("filters.showGraph")}
            </label>
          </div>
        </div>

        <Card>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold">{t("summary.title")}</h2>
            <span className="text-xs text-gray-500">{t("page.compactHint")}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 items-start">
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                  {t("summary.reservations")}
                </p>
                <p className="text-base font-bold text-gray-900 leading-tight">
                  {reservationSummary.totalReservations}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{t("summary.nights")}</p>
                <p className="text-base font-bold text-gray-900 leading-tight">{reservationSummary.totalNights}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{t("summary.revenue")}</p>
                <p className="text-base font-bold text-gray-900 leading-tight">{reservationSummary.totalRevenue}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{t("summary.topCompany")}</p>
                {reservationSummary.topCompany ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 leading-tight truncate">
                      {reservationSummary.topCompany.company}
                    </span>
                    <span className="text-[11px] bg-gray-200 text-gray-800 px-2 py-1 rounded-full">
                      {t("summary.topCompanyCount", { count: reservationSummary.topCompany.count })}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">{t("page.noData")}</p>
                )}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white border border-gray-100 h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                  {t("summary.roomTypeBreakdown")}
                </p>
                <span className="text-[11px] text-gray-500">{reservationSummary.totalReservations}</span>
              </div>
              {roomTypeChartData ? (
                <div className="h-52 md:h-60 flex items-center justify-center">
                  <Pie data={roomTypeChartData} options={{ plugins: { legend: { position: "right" } } }} />
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t("summary.noRoomTypes")}</p>
              )}
            </div>
          </div>
        </Card>

        {showGraph && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{t("charts.dailyTitle")}</h2>
                <p className="text-sm text-gray-600">{t("charts.dailySubtitle")}</p>
              </div>
              {!dailyMetrics.length && (
                <span className="text-sm text-gray-500">{t("page.noData")}</span>
              )}
            </div>
            {dailyMetrics.length > 0 && (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[400px]">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
            )}
          </Card>
        )}

        {isImporting && (
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">{t("import.title")}</h2>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCsvUpload}>
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                {t("import.date")}
                <input
                  type="date"
                  value={importDate}
                  onChange={(e) => setImportDate(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                {t("import.file")}
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
                  {t("import.import")}
                </button>
                <button
                  type="button"
                  onClick={() => setIsImporting(false)}
                  className="bg-gray-100 text-gray-800 px-4 py-2 rounded font-semibold border border-gray-300 hover:bg-gray-200"
                >
                  {t("import.cancel")}
                </button>
              </div>
            </form>
          </Card>
        )}

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold">{t("table.title")}</h2>
              <p className="text-sm text-gray-600">{dateRangeLabel}</p>
            </div>
            {isLoading && <span className="text-sm text-gray-500">{t("table.loading")}</span>}
          </div>
          {filteredReservations.length === 0 ? (
            <p className="text-gray-600">
              {roomTypeFilter.length ? t("messages.noRoomTypeMatches") : t("table.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {visibleColumns.map((column) => {
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
                      {visibleColumns.map((column) => (
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
            {t("table.footer")}
          </p>
        </Card>
      </PageContainer>
    </div>
  );
}
