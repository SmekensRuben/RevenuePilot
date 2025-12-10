import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "react-toastify";
import { FileInput } from "lucide-react";
import {
  collection,
  db,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
  auth,
  signOut,
} from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { Button } from "../layout/Button";

const SEGMENT_MAPPINGS = [
  { header: "Total", field: "totalRoomsSold" },
  { header: "To Sell", field: "roomsLeftToSell" },
  { header: "Trans", field: "transientRoomsSold" },
  { header: "Retail", field: "retailRoomsSold" },
  { header: "Discount", field: "discountRoomsSold" },
  { header: "Internet Non-Opaque", field: "internetNonOpaqueRoomsSold" },
  { header: "Internet Opaque", field: "internetOpaqueRoomsSold" },
  { header: "Negotiated", field: "negotiatedRoomsSold" },
  { header: "Government", field: "governmentRoomsSold" },
  { header: "Package", field: "packageRoomsSold" },
  { header: "Brand Redemptions", field: "brandRedemptionsRoomsSold" },
  { header: "Wholesale", field: "wholesaleRoomsSold" },
  { header: "Contract Base", field: "contractBaseRoomsSold" },
  { header: "Complimentary", field: "complimentaryRoomsSold" },
  { header: "House Use", field: "houseUseRoomsSold" },
  { header: "Group", field: "groupRoomsSold" },
  { header: "Group Corporate", field: "groupCorporateRoomsSold" },
  { header: "Group SMERF", field: "groupSmerfRoomsSold" },
  { header: "Group Government", field: "groupGovernmentRoomsSold" },
  { header: "Group Association", field: "groupAssociationRoomsSold" },
  { header: "Group Tour/Travel", field: "groupTourTravelRoomsSold" },
  { header: "Group City Wide", field: "groupCityWideRoomsSold" },
];

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const parseNumber = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(",", ".").trim();
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const normalizeCsvDate = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const [, day, month, yearPart] = slashMatch;
    const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
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

const getValueByHeader = (row, header) => {
  if (row[header] !== undefined) return row[header];
  const matchingKey = Object.keys(row).find(
    (key) => key === header || key.startsWith(`${header}_`)
  );
  return matchingKey ? row[matchingKey] : undefined;
};

export default function WeeklyForecastToolPage() {
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
      toast.error("Selecteer eerst een datum voor het pickup report.");
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
      delimiter: "",
      header: true,
      skipEmptyLines: "greedy",
      complete: async ({ data, errors, meta }) => {
        if (errors?.length) {
          console.warn("CSV parse errors", errors);
          toast.warn("Sommige rijen hadden een foutief formaat en zijn overgeslagen.");
        }

        try {
          const validRows = data
            .map((row) => {
              const rawDate = getValueByHeader(row, "Date");
              const normalizedDate = normalizeCsvDate(rawDate);
              if (!normalizedDate) return null;

              const payload = { date: normalizedDate };

              SEGMENT_MAPPINGS.forEach(({ header, field }) => {
                const value = parseNumber(getValueByHeader(row, header));
                if (value !== null) {
                  payload[field] = value;
                }
              });

              return payload;
            })
            .filter(Boolean);

          if (!validRows.length) {
            toast.error("Geen geldige rijen gevonden in het CSV-bestand.");
            return;
          }

          const reportCollection = collection(db, `hotels/${hotelUid}/pickupReport`);
          const reportDocRef = doc(reportCollection, selectedReportDate);

          await setDoc(
            reportDocRef,
            {
              reportDate: selectedReportDate,
              updatedAt: serverTimestamp(),
              delimiter: meta?.delimiter,
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
          toast.success(`Pickup report opgeslagen (${validRows.length} rijen).`);
        } catch (err) {
          console.error("Error storing pickup report", err);
          toast.error("Kon pickup report niet opslaan.");
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Forecast Tool</h1>
            <p className="text-gray-600">
              Importeer een pickup report CSV en sla de resultaten gestructureerd op.
            </p>
          </div>
          <div className="flex items-center justify-end w-full sm:w-auto">
            <Button onClick={openDateDialog} disabled={uploading} className="bg-[#b41f1f] hover:bg-[#9d1b1b] flex items-center gap-2">
              <FileInput className="h-4 w-4" />
              <span>{uploading ? "Bezig met import..." : "Importeer pickup CSV"}</span>
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
            <li>Klik op "Importeer pickup CSV" en kies eerst de rapportdatum.</li>
            <li>Na het selecteren van een datum kun je een CSV-bestand uploaden.</li>
            <li>Rijen zonder geldige datum in de kolom "Date" worden overgeslagen.</li>
            <li>De waarden worden in Firestore opgeslagen per datum in de subcollectie <code>dates</code>.</li>
          </ul>
        </Card>
      </PageContainer>

      {isDateDialogOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Kies datum voor pickup report</h3>
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
