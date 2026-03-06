import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { FileUp } from "lucide-react";
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

const columns = [
  { key: "block", label: "Block" },
  { key: "beginDate", label: "Begin date" },
  { key: "endDate", label: "End date" },
  { key: "roomStatus", label: "Room status" },
  { key: "lastUpdate", label: "Last Update" },
  { key: "roomNights", label: "Room nights" },
];

export default function BlocksPage() {
  const navigate = useNavigate();
  const { hotelUid } = useHotelContext();
  const fileInputRef = useRef(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [blockFilter, setBlockFilter] = useState("");
  const [beginDateFilter, setBeginDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [roomStatusFilter, setRoomStatusFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "lastUpdate", direction: "desc" });

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

  const filteredBlocks = useMemo(() => {
    const blockQuery = blockFilter.trim().toLowerCase();
    const statusQuery = roomStatusFilter.trim().toLowerCase();

    return blocks.filter((block) => {
      const latest = block.latestChange || {};
      const blockValue = String(block.blockName || block.id || "").toLowerCase();
      const statusValue = String(latest.roomStatus || "").toLowerCase();
      const beginDate = String(latest.beginDate || "");
      const endDate = String(latest.endDate || "");

      const matchesBlock = blockQuery ? blockValue.includes(blockQuery) : true;
      const matchesStatus = statusQuery ? statusValue.includes(statusQuery) : true;
      const matchesBeginDate = beginDateFilter ? beginDate === beginDateFilter : true;
      const matchesEndDate = endDateFilter ? endDate === endDateFilter : true;

      return matchesBlock && matchesStatus && matchesBeginDate && matchesEndDate;
    });
  }, [blocks, blockFilter, roomStatusFilter, beginDateFilter, endDateFilter]);

  const sortedBlocks = useMemo(() => {
    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;

    return [...filteredBlocks].sort((a, b) => {
      const aLatest = a.latestChange || {};
      const bLatest = b.latestChange || {};

      const aValue =
        sortConfig.key === "block"
          ? String(a.blockName || a.id || "")
          : String(aLatest[sortConfig.key] || "");

      const bValue =
        sortConfig.key === "block"
          ? String(b.blockName || b.id || "")
          : String(bLatest[sortConfig.key] || "");

      return aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: "base" })
        * directionMultiplier;
    });
  }, [filteredBlocks, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

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
          roomNights: String(
            getCsvValue(row, "CF_NIGTHS") || getCsvValue(row, "CF_NIGHTS") || ""
          ).trim(),
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

  return (
    <>
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 space-y-6">
          <Card>
            <div className="p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Blocks</h1>
                <p className="text-sm text-gray-600 mt-1">Klik op een rij om details te openen.</p>
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
          </Card>

          <Card>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                  Begin date
                  <input
                    type="date"
                    value={beginDateFilter}
                    onChange={(event) => setBeginDateFilter(event.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-sm font-semibold text-gray-700">
                  End date
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(event) => setEndDateFilter(event.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-sm font-semibold text-gray-700">
                  Room status
                  <input
                    type="text"
                    value={roomStatusFilter}
                    onChange={(event) => setRoomStatusFilter(event.target.value)}
                    className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Bijv. ACT"
                  />
                </label>
              </div>

              {loading ? (
                <p className="text-sm text-gray-500">Blocks laden...</p>
              ) : !sortedBlocks.length ? (
                <p className="text-sm text-gray-500">Geen blocks gevonden voor deze filters.</p>
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
                          onClick={() => navigate(`/groups-me/blocks/${block.id}`)}
                          className="border-b last:border-b-0 text-gray-800 cursor-pointer hover:bg-gray-50"
                        >
                          <td className="py-2 pr-4 font-medium">{block.blockName || block.id}</td>
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
    </>
  );
}
