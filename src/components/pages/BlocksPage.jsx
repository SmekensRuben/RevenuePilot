import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FileUp, X } from "lucide-react";
import { toast } from "react-toastify";
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
  setDoc,
  signOut,
} from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";

const normalizeHeader = (header) => String(header || "").replace(/^\uFEFF/, "").trim();

const MONTHS = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const normalizeYear = (yearDigits) => {
  const normalized = String(yearDigits || "").trim();
  if (/^\d{4}$/.test(normalized)) return normalized;
  if (!/^\d{2}$/.test(normalized)) return "";
  return String(2000 + Number(normalized));
};

const toIsoDate = ({ day, month, year }) => {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return "";
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900) return "";
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== m || date.getUTCDate() !== d) {
    return "";
  }
  return iso;
};

const parseExcelSerial = (value) => {
  const serial = Number(value);
  if (!Number.isFinite(serial)) return "";
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  return toIsoDate({
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  });
};

const formatCompactDate = (value) => {
  const digits = String(value || "").trim().replace(/\D/g, "");
  if (!/^\d{5,8}$/.test(digits)) return "";
  const yearDigits = digits.length >= 7 ? digits.slice(-4) : digits.slice(-2);
  const year = normalizeYear(yearDigits);
  if (!year) return "";
  const prefix = digits.slice(0, digits.length - yearDigits.length);
  if (prefix.length === 4) return toIsoDate({ day: prefix.slice(0, 2), month: prefix.slice(2, 4), year });
  if (prefix.length === 3) {
    return (
      toIsoDate({ day: prefix.slice(0, 1), month: prefix.slice(1, 3), year }) ||
      toIsoDate({ day: prefix.slice(0, 2), month: prefix.slice(2, 3), year })
    );
  }
  return "";
};

const parseDateValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return parseExcelSerial(value);

  const raw = String(value).trim().replace(/^'+/, "").replace(/^"|"$/g, "");
  if (!raw) return "";

  const monthNameMatch = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (monthNameMatch) {
    const [, day, monthName, yearCandidate] = monthNameMatch;
    const month = MONTHS[monthName.toUpperCase()];
    const year = normalizeYear(yearCandidate);
    if (month && year) return toIsoDate({ day, month, year });
  }

  if (/^\d+(\.\d+)?$/.test(raw)) return parseExcelSerial(raw);

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return toIsoDate({ day, month, year });
  }

  const parts = raw.split(/[^\d]+/).filter(Boolean);
  if (parts.length >= 3) {
    const [day, month, yearCandidate] = parts;
    const year = normalizeYear(yearCandidate);
    if (year) return toIsoDate({ day, month, year });
  }

  return formatCompactDate(raw);
};

const parseCsvFile = (file) =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: resolve,
      error: reject,
    });
  });

const getCsvValue = (row, columnName) => {
  if (!row || typeof row !== "object") return "";
  if (columnName in row) return row[columnName];
  const normalizedTarget = String(columnName || "").replace(/^\uFEFF/, "").trim().toUpperCase();
  const key = Object.keys(row).find((candidate) => {
    const normalizedCandidate = String(candidate || "").replace(/^\uFEFF/, "").trim().toUpperCase();
    return normalizedCandidate === normalizedTarget;
  });
  return key ? row[key] : "";
};

const getLatestChange = (changes) => {
  if (!Array.isArray(changes) || !changes.length) return null;
  return [...changes].sort((a, b) =>
    String(a.insertDate || a.beginDate || "").localeCompare(String(b.insertDate || b.beginDate || ""))
  )[changes.length - 1];
};

const parseIsoToDate = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const columns = [
  { key: "block", label: "Block" },
  { key: "owner", label: "Owner" },
  { key: "beginDate", label: "Begin date" },
  { key: "endDate", label: "End date" },
  { key: "roomStatus", label: "Room status" },
  { key: "lastUpdate", label: "Last Update" },
  { key: "roomNights", label: "Room nights" },
];

const getStatusColorClass = (status) => {
  const key = String(status || "").trim().toLowerCase();
  if (key === "prospect") return "bg-blue-100 text-blue-800 border-blue-300";
  if (key === "te1") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (key === "def" || key === "act") return "bg-green-100 text-green-800 border-green-300";
  if (key === "tdn") return "bg-purple-100 text-purple-800 border-purple-300";
  if (key === "can" || key === "roos") return "bg-pink-100 text-pink-800 border-pink-300";
  if (key === "los" || key === "rood") return "bg-red-100 text-red-800 border-red-300";
  return "bg-gray-100 text-gray-800 border-gray-300";
};

export default function BlocksPage() {
  const { hotelUid } = useHotelContext();
  const fileInputRef = useRef(null);
  const roomStatusDropdownRef = useRef(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [blockFilter, setBlockFilter] = useState("");
  const [beginDateFrom, setBeginDateFrom] = useState("");
  const [beginDateTo, setBeginDateTo] = useState("");
  const [endDateFrom, setEndDateFrom] = useState("");
  const [endDateTo, setEndDateTo] = useState("");
  const [roomStatusFilter, setRoomStatusFilter] = useState([]);
  const [isRoomStatusOpen, setIsRoomStatusOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "lastUpdate", direction: "desc" });
  const [displayMode, setDisplayMode] = useState("list");
  const [calendarView, setCalendarView] = useState("week");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedBlock, setSelectedBlock] = useState(null);

  const todayLabel = useMemo(
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

  const loadBlocks = async () => {
    if (!hotelUid) {
      setBlocks([]);
      return;
    }
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, `hotels/${hotelUid}/blocks`));
      const items = snapshot.docs.map((entry) => {
        const data = entry.data();
        return { id: entry.id, ...data, latestChange: getLatestChange(data.changes) };
      });
      items.sort((a, b) => String(a.blockName || a.id).localeCompare(String(b.blockName || b.id)));
      setBlocks(items);
    } catch (error) {
      console.error("Blokken laden mislukt", error);
      toast.error("Blokken konden niet geladen worden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, [hotelUid]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (roomStatusDropdownRef.current && !roomStatusDropdownRef.current.contains(event.target)) {
        setIsRoomStatusOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBlocks = useMemo(() => {
    const blockQuery = blockFilter.trim().toLowerCase();

    return blocks.filter((block) => {
      const latest = block.latestChange || {};
      const blockValue = String(block.blockName || block.id || "").toLowerCase();
      const statusValue = String(latest.roomStatus || "").trim();
      const beginDate = String(latest.beginDate || "");
      const endDate = String(latest.endDate || "");

      const matchesBlock = blockQuery ? blockValue.includes(blockQuery) : true;
      const matchesStatus = roomStatusFilter.length ? roomStatusFilter.includes(statusValue) : true;
      const matchesBeginDateFrom = beginDateFrom ? beginDate >= beginDateFrom : true;
      const matchesBeginDateTo = beginDateTo ? beginDate <= beginDateTo : true;
      const matchesEndDateFrom = endDateFrom ? endDate >= endDateFrom : true;
      const matchesEndDateTo = endDateTo ? endDate <= endDateTo : true;

      return (
        matchesBlock
        && matchesStatus
        && matchesBeginDateFrom
        && matchesBeginDateTo
        && matchesEndDateFrom
        && matchesEndDateTo
      );
    });
  }, [blocks, blockFilter, roomStatusFilter, beginDateFrom, beginDateTo, endDateFrom, endDateTo]);

  const roomStatusOptions = useMemo(() => {
    const set = new Set(
      blocks
        .map((block) => String(block.latestChange?.roomStatus || "").trim())
        .filter(Boolean)
    );
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [blocks]);

  const sortedBlocks = useMemo(() => {
    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;

    return [...filteredBlocks].sort((a, b) => {
      const aLatest = a.latestChange || {};
      const bLatest = b.latestChange || {};

      const getSortValue = (entry, latest) => {
        if (sortConfig.key === "block") return String(entry.blockName || entry.id || "");
        if (sortConfig.key === "owner") return String(entry.ownerCode || "");
        if (sortConfig.key === "lastUpdate") return String(latest.insertDate || "");
        return String(latest[sortConfig.key] || "");
      };

      const aValue = getSortValue(a, aLatest);
      const bValue = getSortValue(b, bLatest);

      return aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: "base" })
        * directionMultiplier;
    });
  }, [filteredBlocks, sortConfig]);

  const calendarCursorDate = useMemo(() => {
    const [year, month, day] = String(calendarCursor || "").split("-").map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day);
  }, [calendarCursor]);

  const weekStarts = useMemo(() => {
    if (calendarView === "week") return [startOfWeek(calendarCursorDate)];
    const firstDay = new Date(calendarCursorDate.getFullYear(), calendarCursorDate.getMonth(), 1);
    const firstWeekStart = startOfWeek(firstDay);
    return Array.from({ length: 6 }, (_, i) => addDays(firstWeekStart, i * 7));
  }, [calendarCursorDate, calendarView]);

  const buildWeekBars = (weekStart) => {
    const weekEnd = addDays(weekStart, 6);

    const segments = filteredBlocks
      .map((block) => {
        const begin = parseIsoToDate(block.latestChange?.beginDate);
        const end = parseIsoToDate(block.latestChange?.endDate);
        if (!begin || !end) return null;
        if (end < weekStart || begin > weekEnd) return null;

        const segmentStart = begin < weekStart ? weekStart : begin;
        const segmentEnd = end > weekEnd ? weekEnd : end;
        const startCol = Math.round((segmentStart - weekStart) / (24 * 60 * 60 * 1000)) + 1;
        const endCol = Math.round((segmentEnd - weekStart) / (24 * 60 * 60 * 1000)) + 2;

        return { block, startCol, endCol };
      })
      .filter(Boolean)
      .sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);

    const lanes = [];
    segments.forEach((segment) => {
      let laneIndex = lanes.findIndex((lane) => lane.lastEnd < segment.startCol);
      if (laneIndex === -1) {
        lanes.push({ lastEnd: segment.endCol - 1, items: [segment] });
      } else {
        lanes[laneIndex].items.push(segment);
        lanes[laneIndex].lastEnd = segment.endCol - 1;
      }
    });

    return lanes.map((lane) => lane.items);
  };

  const shiftCalendar = (direction) => {
    const base = new Date(calendarCursorDate);
    if (calendarView === "week") base.setDate(base.getDate() + direction * 7);
    else base.setMonth(base.getMonth() + direction);
    setCalendarCursor(formatDateKey(base));
  };

  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      return { key, direction: "asc" };
    });
  };

  const handleRoomStatusToggle = (status) => {
    setRoomStatusFilter((current) => (current.includes(status)
      ? current.filter((item) => item !== status)
      : [...current, status]));
  };

  const roomStatusLabel = roomStatusFilter.length ? `${roomStatusFilter.length} geselecteerd` : "Alle statussen";

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !hotelUid) return;

    setImporting(true);
    try {
      const result = await parseCsvFile(file);
      const rows = Array.isArray(result.data) ? result.data : [];
      if (!rows.length) {
        toast.warn("Geen rijen gevonden in CSV.");
        return;
      }

      const groupedById = new Map();
      rows.forEach((row) => {
        const blockId = String(getCsvValue(row, "ALLOTMENT_HEADER_ID") || "").trim();
        if (!blockId) return;

        if (!groupedById.has(blockId)) {
          groupedById.set(blockId, {
            blockName: String(getCsvValue(row, "DESCRIPTION") || "").trim(),
            ownerCode: String(getCsvValue(row, "OWNER_CODE") || "").trim(),
            companyName: String(getCsvValue(row, "COMPANY") || "").trim(),
            changes: [],
          });
        }

        const beginDateRaw = getCsvValue(row, "BEGIN_DATE") || getCsvValue(row, "BEGIN_DATE_SORT");
        const endDateRaw = getCsvValue(row, "END_DATE") || getCsvValue(row, "END_DATE_SORT");
        const insertDateRaw = getCsvValue(row, "INSERT_DATE_SORT");

        groupedById.get(blockId).changes.push({
          beginDate: parseDateValue(beginDateRaw),
          endDate: parseDateValue(endDateRaw),
          roomRevenue: String(getCsvValue(row, "CF_ROOM_REVENUE") || "").trim(),
          insertDate: parseDateValue(insertDateRaw),
          roomStatus: String(getCsvValue(row, "ROOM_STATUS") || "").trim(),
          cateringStatus: String(getCsvValue(row, "CATERING_STATUS") || "").trim(),
          roomNights: String(getCsvValue(row, "CF_NIGTHS") || getCsvValue(row, "CF_NIGHTS") || "").trim(),
        });
      });

      const entries = [...groupedById.entries()];
      for (const [blockId, payload] of entries) {
        const blockRef = doc(db, `hotels/${hotelUid}/blocks`, blockId);
        const existing = await getDoc(blockRef);
        const existingChanges = existing.exists() && Array.isArray(existing.data().changes)
          ? existing.data().changes
          : [];

        await setDoc(
          blockRef,
          {
            blockName: payload.blockName,
            ownerCode: payload.ownerCode,
            companyName: payload.companyName,
            changes: [...existingChanges, ...payload.changes],
          },
          { merge: true }
        );
      }

      toast.success(`${entries.length} blocks geïmporteerd.`);
      await loadBlocks();
    } catch (error) {
      console.error("Import blocks mislukt", error);
      toast.error("Importeren van blocks is mislukt.");
    } finally {
      setImporting(false);
    }
  };

  const selectedChanges = useMemo(() => {
    const arr = Array.isArray(selectedBlock?.changes) ? [...selectedBlock.changes] : [];
    return arr.sort((a, b) =>
      String(b.insertDate || b.beginDate || "").localeCompare(String(a.insertDate || a.beginDate || ""))
    );
  }, [selectedBlock]);

  return (
    <>
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 space-y-6">
          <Card>
            <div className="p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Blocks</h1>
                <p className="text-sm text-gray-600 mt-1">Klik op een block in de kalender of lijst voor details.</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDisplayMode("list")}
                    className={`px-2 py-1 text-xs rounded ${displayMode === "list" ? "bg-[#b41f1f] text-white" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    Lijst
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode("calendar")}
                    className={`px-2 py-1 text-xs rounded ${displayMode === "calendar" ? "bg-[#b41f1f] text-white" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    Kalender
                  </button>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={importing || !hotelUid}>
                    <FileUp className="h-4 w-4 mr-2" />
                    {importing ? "Importeren..." : "Import blocks"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="flex flex-col text-sm font-semibold text-gray-700">
                  Search block
                  <input
                    type="text"
                    value={blockFilter}
                    onChange={(event) => setBlockFilter(event.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Zoek block"
                  />
                </label>
                <label className="flex flex-col text-sm font-semibold text-gray-700">
                  Begin Date From
                  <input
                    type="date"
                    value={beginDateFrom}
                    onChange={(event) => setBeginDateFrom(event.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-sm font-semibold text-gray-700">
                  Begin Date To
                  <input
                    type="date"
                    value={beginDateTo}
                    onChange={(event) => setBeginDateTo(event.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-sm font-semibold text-gray-700">
                  Room status
                  <div ref={roomStatusDropdownRef} className="relative mt-1">
                    <button
                      type="button"
                      onClick={() => setIsRoomStatusOpen((prev) => !prev)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-left bg-white flex items-center justify-between"
                    >
                      <span className="truncate">{roomStatusLabel}</span>
                      <span className="text-xs text-gray-500">▾</span>
                    </button>
                    {isRoomStatusOpen && (
                      <div className="absolute z-20 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg p-2 max-h-52 overflow-y-auto">
                        {roomStatusOptions.length === 0 ? (
                          <p className="text-xs text-gray-500 px-1 py-2">Geen room statussen beschikbaar.</p>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setRoomStatusFilter([])}
                              className="text-xs text-[#b41f1f] font-semibold px-1 py-1 mb-1"
                            >
                              Wis selectie
                            </button>
                            {roomStatusOptions.map((status) => (
                              <label key={status} className="flex items-center gap-2 px-1 py-1 text-sm">
                                <input
                                  type="checkbox"
                                  checked={roomStatusFilter.includes(status)}
                                  onChange={() => handleRoomStatusToggle(status)}
                                />
                                <span>{status}</span>
                              </label>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </label>
                <label className="flex flex-col text-sm font-semibold text-gray-700">
                  End Date From
                  <input
                    type="date"
                    value={endDateFrom}
                    onChange={(event) => setEndDateFrom(event.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-sm font-semibold text-gray-700">
                  End Date To
                  <input
                    type="date"
                    value={endDateTo}
                    onChange={(event) => setEndDateTo(event.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {displayMode === "calendar" && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded border border-gray-200 p-3 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => setCalendarView("week")}
                      className={calendarView === "week" ? "" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}
                    >
                      Week
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setCalendarView("month")}
                      className={calendarView === "month" ? "" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}
                    >
                      Month
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => shiftCalendar(-1)} className="px-3 py-2 rounded bg-[#b41f1f] text-white font-semibold hover:bg-[#961919]">←</button>
                    <button type="button" onClick={() => setCalendarCursor(formatDateKey(new Date()))} className="px-3 py-2 rounded bg-[#b41f1f] text-white font-semibold hover:bg-[#961919]">Vandaag</button>
                    <button type="button" onClick={() => shiftCalendar(1)} className="px-3 py-2 rounded bg-[#b41f1f] text-white font-semibold hover:bg-[#961919]">→</button>
                  </div>
                </div>
              )}

              {loading ? (
                <p className="text-sm text-gray-500">Blocks laden...</p>
              ) : displayMode === "list" && !sortedBlocks.length ? (
                <p className="text-sm text-gray-500">Geen blocks gevonden voor deze filters.</p>
              ) : displayMode === "calendar" ? (
                <div className="space-y-4">
                  {weekStarts.map((weekStart) => {
                    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                    const lanes = buildWeekBars(weekStart);
                    return (
                      <div key={formatDateKey(weekStart)} className="border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-7 bg-gray-50 border-b">
                          {weekDays.map((day) => {
                            const dayKey = formatDateKey(day);
                            const inMonth = day.getMonth() === calendarCursorDate.getMonth();
                            return (
                              <div key={dayKey} className={`px-2 py-2 text-xs border-r last:border-r-0 ${inMonth ? "text-gray-700" : "text-gray-400"}`}>
                                {dayKey}
                              </div>
                            );
                          })}
                        </div>
                        <div className="p-2 space-y-1 bg-white">
                          {lanes.length === 0 ? (
                            <p className="text-xs text-gray-400 px-1 py-1">Geen blocks in deze periode.</p>
                          ) : (
                            lanes.map((lane, laneIndex) => (
                              <div key={laneIndex} className="grid grid-cols-7 gap-1">
                                {lane.map((segment) => {
                                  const latest = segment.block.latestChange || {};
                                  const statusClass = getStatusColorClass(latest.roomStatus);
                                  return (
                                    <button
                                      key={`${segment.block.id}-${laneIndex}-${segment.startCol}`}
                                      type="button"
                                      onClick={() => setSelectedBlock(segment.block)}
                                      className={`text-left text-xs border rounded px-2 py-1 truncate ${statusClass}`}
                                      style={{ gridColumn: `${segment.startCol} / ${segment.endCol}` }}
                                      title={`${segment.block.blockName || segment.block.id} | ${latest.roomStatus || "-"} | RN: ${latest.roomNights || "-"}`}
                                    >
                                      <span className="font-semibold">{segment.block.blockName || segment.block.id}</span>
                                      <span className="ml-1">(RN {latest.roomNights || "-"})</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-600">
                        {columns.map((column) => {
                          const isActive = sortConfig.key === column.key;
                          const indicator = isActive
                            ? sortConfig.direction === "asc"
                              ? "▲"
                              : "▼"
                            : "⇅";
                          return (
                            <th key={column.key} className="py-2 pr-4">
                              <button
                                type="button"
                                onClick={() => handleSort(column.key)}
                                className="inline-flex items-center gap-1 font-semibold"
                              >
                                <span>{column.label}</span>
                                <span className="text-xs text-gray-500">{indicator}</span>
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBlocks.map((block) => (
                        <tr
                          key={block.id}
                          onClick={() => setSelectedBlock(block)}
                          className="border-b last:border-b-0 text-gray-800 cursor-pointer hover:bg-gray-50"
                        >
                          <td className="py-2 pr-4 font-medium">{block.blockName || block.id}</td>
                          <td className="py-2 pr-4">{block.ownerCode || "-"}</td>
                          <td className="py-2 pr-4">{block.latestChange?.beginDate || "-"}</td>
                          <td className="py-2 pr-4">{block.latestChange?.endDate || "-"}</td>
                          <td className="py-2 pr-4">{block.latestChange?.roomStatus || "-"}</td>
                          <td className="py-2 pr-4">{block.latestChange?.insertDate || "-"}</td>
                          <td className="py-2 pr-4">{block.latestChange?.roomNights || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </PageContainer>

      {selectedBlock && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between p-4 border-b">
              <div>
                <h2 className="text-xl font-bold">{selectedBlock.blockName || selectedBlock.id}</h2>
                <p className="text-sm text-gray-600">Block ID: {selectedBlock.id} · Owner: {selectedBlock.ownerCode || "-"}</p>
              </div>
              <button type="button" onClick={() => setSelectedBlock(null)} className="p-2 rounded hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">Changes</h3>
              {!selectedChanges.length ? (
                <p className="text-sm text-gray-500">Geen changes gevonden.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-600">
                        <th className="py-2 pr-4">Insert date</th>
                        <th className="py-2 pr-4">Begin date</th>
                        <th className="py-2 pr-4">End date</th>
                        <th className="py-2 pr-4">Room status</th>
                        <th className="py-2 pr-4">Room nights</th>
                        <th className="py-2 pr-4">Room revenue</th>
                        <th className="py-2 pr-4">Catering status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedChanges.map((change, index) => (
                        <tr key={`${change.insertDate || "no-date"}-${index}`} className="border-b last:border-b-0">
                          <td className="py-2 pr-4">{change.insertDate || "-"}</td>
                          <td className="py-2 pr-4">{change.beginDate || "-"}</td>
                          <td className="py-2 pr-4">{change.endDate || "-"}</td>
                          <td className="py-2 pr-4">{change.roomStatus || "-"}</td>
                          <td className="py-2 pr-4">{change.roomNights || "-"}</td>
                          <td className="py-2 pr-4">{change.roomRevenue || "-"}</td>
                          <td className="py-2 pr-4">{change.cateringStatus || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
