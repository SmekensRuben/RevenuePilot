import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "react-toastify";
import { FileInput } from "lucide-react";
import {
  auth,
  collection,
  db,
  doc,
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
