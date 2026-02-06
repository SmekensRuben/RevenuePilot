import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FileInput } from "lucide-react";
import { toast } from "react-toastify";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { Button } from "../layout/Button";
import { auth, db, doc, getDoc, serverTimestamp, signOut, writeBatch } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { subscribeRoomClasses } from "../../services/firebaseRoomClasses";

const requiredHeaders = ["date", "roomtype", "AC", "AU", "RS", "RA", "AA"];

const normalizeKey = (value) => String(value || "").trim();

const normalizeDateKey = (value, fallbackYear) => {
  const raw = normalizeKey(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{1,2}-\d{1,2}$/.test(raw)) {
    const [day, month] = raw.split("-");
    return buildDateKey(
      { year: null, month: Number(month), day: Number(day) },
      fallbackYear
    );
  }
  if (/^\d{1,2}\/\d{1,2}$/.test(raw)) {
    const [day, month] = raw.split("/");
    return buildDateKey(
      { year: null, month: Number(month), day: Number(day) },
      fallbackYear
    );
  }
  const hasExplicitYear =
    /\d{4}/.test(raw) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2}$/.test(raw);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.replace(/\//g, "-");
  const year = hasExplicitYear && Number.isFinite(parsed.getFullYear())
    ? parsed.getFullYear()
    : fallbackYear || parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const extractDateParts = (value) => {
  const raw = normalizeKey(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return { year: Number(year), month: Number(month), day: Number(day), hasYear: true };
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("-");
    return { year: Number(year), month: Number(month), day: Number(day), hasYear: true };
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");
    return { year: Number(year), month: Number(month), day: Number(day), hasYear: true };
  }
  if (/^\d{8}$/.test(raw)) {
    const year = raw.slice(0, 4);
    const month = raw.slice(4, 6);
    const day = raw.slice(6, 8);
    return { year: Number(year), month: Number(month), day: Number(day), hasYear: true };
  }
  if (/^\d{1,2}-\d{1,2}$/.test(raw)) {
    const [day, month] = raw.split("-");
    return { year: null, month: Number(month), day: Number(day), hasYear: false };
  }
  if (/^\d{1,2}\/\d{1,2}$/.test(raw)) {
    const [day, month] = raw.split("/");
    return { year: null, month: Number(month), day: Number(day), hasYear: false };
  }
  const hasExplicitYear =
    /\d{4}/.test(raw) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2}$/.test(raw);
  if (!hasExplicitYear) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
    hasYear: !Number.isNaN(parsed.getFullYear()),
  };
};

const buildDateKey = ({ year, month, day }, fallbackYear) => {
  const resolvedYear = Number.isFinite(year) ? year : fallbackYear;
  if (!resolvedYear || !month || !day) return "";
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${resolvedYear}-${paddedMonth}-${paddedDay}`;
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

export default function InventoryBalancerPage() {
  const fileInputRef = useRef(null);
  const { hotelUid } = useHotelContext();
  const [uploading, setUploading] = useState(false);
  const [lastImport, setLastImport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [roomClasses, setRoomClasses] = useState([]);
  const [inventoryData, setInventoryData] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

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
    if (!hotelUid) {
      setRoomClasses([]);
      return undefined;
    }
    return subscribeRoomClasses(hotelUid, setRoomClasses);
  }, [hotelUid]);

  useEffect(() => {
    if (!hotelUid || !selectedDate) {
      setInventoryData(null);
      return;
    }
    let isActive = true;
    const fetchInventory = async () => {
      setInventoryLoading(true);
      try {
        const dateRef = doc(db, `hotels/${hotelUid}/marshaData`, selectedDate);
        const snapshot = await getDoc(dateRef);
        if (!isActive) return;
        setInventoryData(snapshot.exists() ? snapshot.data() : null);
      } catch (error) {
        console.error("Marsha inventory load error", error);
        toast.error("Marsha Inventory kon niet geladen worden.");
      } finally {
        if (isActive) setInventoryLoading(false);
      }
    };
    fetchInventory();
    return () => {
      isActive = false;
    };
  }, [hotelUid, selectedDate]);

  const inventoryByRoom = useMemo(() => {
    const marshaInventory = inventoryData?.marshaInventory || {};
    return roomClasses.map((roomClass) => {
      const normalizedCode = normalizeKey(roomClass.code).replace(/\//g, "-");
      const inventory = normalizedCode ? marshaInventory[normalizedCode] : null;
      return {
        ...roomClass,
        normalizedCode,
        raValue: inventory?.RA ?? null,
      };
    });
  }, [inventoryData, roomClasses]);

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!hotelUid) {
      toast.error("Selecteer eerst een hotel.");
      return;
    }

    setUploading(true);
    setLastImport(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data, errors, meta }) => {
        try {
          const headers = meta?.fields?.map((field) => field.trim()) || [];
          const missingHeaders = requiredHeaders.filter(
            (field) => !headers.includes(field)
          );
          if (missingHeaders.length > 0) {
            toast.error(
              `CSV mist kolommen: ${missingHeaders.join(", ")}. Gebruik het Marsha Inventory formaat.`
            );
            setUploading(false);
            return;
          }

          if (errors?.length) {
            console.warn("CSV parse warnings", errors);
          }

          const batch = writeBatch(db);
          const dateSet = new Set();
          const inventoryByDate = {};
          let importedRows = 0;
          let skippedRows = 0;

          const currentYear = new Date().getFullYear();
          const datePartsList = data.map((row) => extractDateParts(row.date));
          const missingYearMonths = datePartsList
            .filter((parts) => parts && !parts.hasYear)
            .map((parts) => parts.month);
          const hasDecember = missingYearMonths.includes(12);
          const hasJanuary = missingYearMonths.includes(1);
          const nextYearFromJanuary = hasDecember && hasJanuary;

          data.forEach((row, index) => {
            const parts = datePartsList[index];
            let dateKey = "";
            if (parts) {
              const fallbackYear =
                parts.hasYear
                  ? parts.year
                  : parts.month === 1 && nextYearFromJanuary
                    ? currentYear + 1
                    : currentYear;
              dateKey = buildDateKey(parts, fallbackYear);
            }
            if (!dateKey) {
              dateKey = normalizeDateKey(row.date, currentYear);
            }
            const roomtype = normalizeKey(row.roomtype);
            if (!dateKey || !roomtype) {
              skippedRows += 1;
              return;
            }

            dateSet.add(dateKey);
            const roomTypeKey = roomtype.replace(/\//g, "-");
            if (!inventoryByDate[dateKey]) {
              inventoryByDate[dateKey] = {};
            }
            inventoryByDate[dateKey][roomTypeKey] = {
              roomtype,
              AC: parseNumber(row.AC),
              AU: parseNumber(row.AU),
              RS: parseNumber(row.RS),
              RA: parseNumber(row.RA),
              AA: parseNumber(row.AA),
            };
            importedRows += 1;
          });

          dateSet.forEach((dateKey) => {
            const dateRef = doc(db, `hotels/${hotelUid}/marshaData`, dateKey);
            batch.set(
              dateRef,
              {
                date: dateKey,
                updatedAt: serverTimestamp(),
                marshaInventory: inventoryByDate[dateKey] || {},
              },
              { merge: true }
            );
          });

          if (importedRows === 0) {
            toast.error("Geen geldige rijen gevonden om te importeren.");
            setUploading(false);
            return;
          }

          await batch.commit();
          setLastImport({
            total: importedRows,
            skipped: skippedRows,
            dates: dateSet.size,
            fileName: file.name,
          });
          toast.success("Marsha Inventory is geïmporteerd.");
        } catch (error) {
          console.error("Import error", error);
          toast.error("Importeren mislukt. Controleer het CSV-bestand.");
        } finally {
          setUploading(false);
        }
      },
      error: (error) => {
        console.error("CSV parse error", error);
        toast.error("CSV kon niet gelezen worden.");
        setUploading(false);
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
              Inventory Balancer
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button
              type="button"
              onClick={handleFileClick}
              className="flex items-center gap-2 bg-[#b41f1f] hover:bg-[#961919]"
              disabled={uploading}
            >
              <FileInput className="h-4 w-4" />
              <span>{uploading ? "Import bezig..." : "Importeer Marsha Inventory"}</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {lastImport && (
          <Card>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <p className="font-semibold">Laatste import</p>
              <ul className="mt-2 space-y-1">
                <li>Bestand: {lastImport.fileName}</li>
                <li>Rijen geïmporteerd: {lastImport.total}</li>
                <li>Rijen overgeslagen: {lastImport.skipped}</li>
                <li>Aantal datums: {lastImport.dates}</li>
              </ul>
            </div>
          </Card>
        )}

        <Card>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Availability Overview</h2>
                <p className="text-gray-600">
                  Kies een datum om de RA-waarde per room class te bekijken.
                </p>
              </div>
              <label className="flex flex-col text-sm font-medium text-gray-700">
                Datum filter
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#b41f1f] focus:outline-none focus:ring-2 focus:ring-[#b41f1f]/40"
                />
              </label>
            </div>

            {!hotelUid && (
              <p className="text-sm text-amber-700">
                Selecteer eerst een hotel om room classes en inventory te zien.
              </p>
            )}

            {hotelUid && (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">
                        Room Class
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">
                        MARSHA
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {roomClasses.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-gray-500">
                          Nog geen room classes gevonden.
                        </td>
                      </tr>
                    )}
                    {roomClasses.length > 0 && inventoryByRoom.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-gray-500">
                          Geen inventory data beschikbaar.
                        </td>
                      </tr>
                    )}
                    {inventoryByRoom.map((roomClass) => (
                      <tr key={roomClass.id}>
                        <td className="px-4 py-2 text-gray-900">{roomClass.code}</td>
                        <td className="px-4 py-2 text-gray-900">
                          {inventoryLoading
                            ? "Laden..."
                            : roomClass.raValue ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </PageContainer>
    </div>
  );
}
