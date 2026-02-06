import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FileInput } from "lucide-react";
import { toast } from "react-toastify";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { Button } from "../layout/Button";
import { auth, db, doc, serverTimestamp, signOut, writeBatch } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";

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
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.replace(/\//g, "-");
  const year = parsed.getFullYear();
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
            const inventoryRef = doc(
              db,
              `hotels/${hotelUid}/marshaData/${dateKey}/marshaInventory`,
              roomTypeKey
            );
            batch.set(inventoryRef, {
              date: dateKey,
              roomtype,
              AC: parseNumber(row.AC),
              AU: parseNumber(row.AU),
              RS: parseNumber(row.RS),
              RA: parseNumber(row.RA),
              AA: parseNumber(row.AA),
              updatedAt: serverTimestamp(),
            });
            importedRows += 1;
          });

          dateSet.forEach((dateKey) => {
            const dateRef = doc(db, `hotels/${hotelUid}/marshaData`, dateKey);
            batch.set(
              dateRef,
              {
                date: dateKey,
                updatedAt: serverTimestamp(),
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
            <h1 className="text-2xl sm:text-3xl font-bold">Marsha Inventory import</h1>
            <p className="text-gray-600 mt-1">
              Upload een Marsha Inventory CSV om de inventaris per datum en roomtype op te slaan.
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

        <Card>
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">CSV formaat</h2>
              <p className="text-gray-600">
                Gebruik een CSV met kolommen: {requiredHeaders.join(", ")}. De waarden worden per
                datum en roomtype opgeslagen onder marshaInventory.
              </p>
            </div>
            {lastImport && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                <p className="font-semibold">Laatste import</p>
                <ul className="mt-2 space-y-1">
                  <li>Bestand: {lastImport.fileName}</li>
                  <li>Rijen geïmporteerd: {lastImport.total}</li>
                  <li>Rijen overgeslagen: {lastImport.skipped}</li>
                  <li>Aantal datums: {lastImport.dates}</li>
                </ul>
              </div>
            )}
          </div>
        </Card>
      </PageContainer>
    </div>
  );
}
