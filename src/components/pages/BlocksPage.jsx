import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FileUp, Layers } from "lucide-react";
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

const toIsoDate = ({ day, month, year }) => {
  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);

  if (
    !Number.isInteger(dayNum) ||
    !Number.isInteger(monthNum) ||
    !Number.isInteger(yearNum) ||
    dayNum < 1 ||
    dayNum > 31 ||
    monthNum < 1 ||
    monthNum > 12 ||
    yearNum < 1900
  ) {
    return "";
  }

  const isoDate = `${String(yearNum).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
  const checkDate = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(checkDate.getTime())) return "";
  if (checkDate.getUTCFullYear() !== yearNum) return "";
  if (checkDate.getUTCMonth() + 1 !== monthNum) return "";
  if (checkDate.getUTCDate() !== dayNum) return "";

  return isoDate;
};

const normalizeYear = (yearDigits) => {
  const normalized = String(yearDigits || "").trim();
  if (/^\d{4}$/.test(normalized)) return normalized;
  if (!/^\d{2}$/.test(normalized)) return "";

  const yearNum = Number(normalized);
  return String(2000 + yearNum);
};

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

const formatCompactDate = (value) => {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!/^\d{5,8}$/.test(digits)) return "";

  const yearDigits = digits.length >= 7 ? digits.slice(-4) : digits.slice(-2);
  const year = normalizeYear(yearDigits);
  if (!year) return "";

  const prefix = digits.slice(0, digits.length - yearDigits.length);

  if (prefix.length === 4) {
    return toIsoDate({ day: prefix.slice(0, 2), month: prefix.slice(2, 4), year });
  }

  if (prefix.length === 3) {
    const asDmm = toIsoDate({ day: prefix.slice(0, 1), month: prefix.slice(1, 3), year });
    if (asDmm) return asDmm;
    return toIsoDate({ day: prefix.slice(0, 2), month: prefix.slice(2, 3), year });
  }

  return "";
};

const formatSlashDate = (value) => {
  if (value === null || value === undefined) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return toIsoDate({
      day: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
    });
  }

  const raw = String(value)
    .trim()
    .replace(/^'+/, "")
    .replace(/^"|"$/g, "");
  if (!raw) return "";

  const monthNameMatch = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (monthNameMatch) {
    const [, day, monthName, yearCandidate] = monthNameMatch;
    const month = MONTHS[monthName.toUpperCase()];
    const year = normalizeYear(yearCandidate);
    if (month && year) {
      return toIsoDate({ day, month, year });
    }
  }

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (Number.isFinite(serial)) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
      return toIsoDate({
        day: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        year: date.getUTCFullYear(),
      });
    }
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return toIsoDate({ day, month, year });
  }

  const parts = raw.split(/[^\d]+/).filter(Boolean);
  if (parts.length < 3) return "";

  const [day, month, yearCandidate] = parts;
  const year = normalizeYear(yearCandidate);
  if (!year) return "";

  return toIsoDate({ day, month, year });
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

  const normalizedTarget = String(columnName || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toUpperCase();

  const key = Object.keys(row).find((candidate) => {
    const normalizedCandidate = String(candidate || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toUpperCase();
    return normalizedCandidate === normalizedTarget;
  });

  return key ? row[key] : "";
};

export default function BlocksPage() {
  const { hotelUid } = useHotelContext();
  const fileInputRef = useRef(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

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
      const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
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

  const triggerImport = () => {
    if (importing) return;
    fileInputRef.current?.click();
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

        const insertDateRaw = getCsvValue(row, "INSERT_DATE_SORT");
        const beginDateRaw = getCsvValue(row, "BEGIN_DATE") || getCsvValue(row, "BEGIN_DATE_SORT");
        const endDateRaw = getCsvValue(row, "END_DATE") || getCsvValue(row, "END_DATE_SORT");

        const change = {
          beginDate: formatSlashDate(beginDateRaw) || formatCompactDate(beginDateRaw),
          endDate: formatSlashDate(endDateRaw) || formatCompactDate(endDateRaw),
          roomRevenue: String(getCsvValue(row, "CF_ROOM_REVENUE") || "").trim(),
          insertDate:
            formatSlashDate(insertDateRaw) || formatCompactDate(insertDateRaw),
          roomStatus: String(getCsvValue(row, "ROOM_STATUS") || "").trim(),
          cateringStatus: String(getCsvValue(row, "CATERING_STATUS") || "").trim(),
          roomNights: String(
            getCsvValue(row, "CF_NIGTHS") || getCsvValue(row, "CF_NIGHTS") || ""
          ).trim(),
        };

        groupedById.get(blockId).changes.push(change);
      });

      const entries = [...groupedById.entries()];
      if (!entries.length) {
        toast.warn("Geen geldige ALLOTMENT_HEADER_ID waarden gevonden.");
        return;
      }

      for (const [blockId, payload] of entries) {
        const blockRef = doc(db, `hotels/${hotelUid}/blocks`, blockId);
        const existing = await getDoc(blockRef);
        const existingChanges = existing.exists() && Array.isArray(existing.data().changes)
          ? existing.data().changes
          : [];

        await setDoc(blockRef, {
          blockName: payload.blockName,
          ownerCode: payload.ownerCode,
          companyName: payload.companyName,
          changes: [...existingChanges, ...payload.changes],
        }, { merge: true });
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
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Blocks</h1>
                  <p className="text-sm text-gray-600 mt-1">Overzicht van alle blocks per hotel.</p>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button onClick={triggerImport} disabled={importing || !hotelUid}>
                    <FileUp className="h-4 w-4 mr-2" />
                    {importing ? "Importeren..." : "Import blocks"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-5 sm:p-6">
              {loading ? (
                <p className="text-sm text-gray-500">Blocks laden...</p>
              ) : !blocks.length ? (
                <p className="text-sm text-gray-500">Nog geen blocks gevonden.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-600">
                        <th className="py-2 pr-4">ID</th>
                        <th className="py-2 pr-4">Blocknaam</th>
                        <th className="py-2 pr-4">Owner code</th>
                        <th className="py-2 pr-4">Company</th>
                        <th className="py-2 pr-4">Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blocks.map((block) => (
                        <tr key={block.id} className="border-b last:border-b-0 text-gray-800">
                          <td className="py-2 pr-4 font-medium">{block.id}</td>
                          <td className="py-2 pr-4">{block.blockName || "-"}</td>
                          <td className="py-2 pr-4">{block.ownerCode || "-"}</td>
                          <td className="py-2 pr-4">{block.companyName || "-"}</td>
                          <td className="py-2 pr-4">
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                              <Layers className="h-3 w-3" />
                              {Array.isArray(block.changes) ? block.changes.length : 0}
                            </span>
                          </td>
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
