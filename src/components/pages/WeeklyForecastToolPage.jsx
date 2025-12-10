import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "react-toastify";
import { FileInput, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import {
  collection,
  db,
  doc,
  getDocs,
  orderBy,
  query,
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

const ADR_MAPPINGS = [
  { header: "Total ADR", field: "totalAdr" },
  { header: "Trans", field: "transientAdr" },
  { header: "Retail", field: "retailAdr" },
  { header: "Discount", field: "discountAdr" },
  { header: "Internet Non-Opaque", field: "internetNonOpaqueAdr" },
  { header: "Internet Opaque", field: "internetOpaqueAdr" },
  { header: "Negotiated", field: "negotiatedAdr" },
  { header: "Government", field: "governmentAdr" },
  { header: "Package", field: "packageAdr" },
  { header: "Brand Redemptions", field: "brandRedemptionsAdr" },
  { header: "Wholesale", field: "wholesaleAdr" },
  { header: "Contract Base", field: "contractBaseAdr" },
  { header: "Complimentary", field: "complimentaryAdr" },
  { header: "House Use", field: "houseUseAdr" },
  { header: "Group", field: "groupAdr" },
  { header: "Group Corporate", field: "groupCorporateAdr" },
  { header: "Group SMERF", field: "groupSmerfAdr" },
  { header: "Group Government", field: "groupGovernmentAdr" },
  { header: "Group Association", field: "groupAssociationAdr" },
  { header: "Group Tour/Travel", field: "groupTourTravelAdr" },
  { header: "Group City Wide", field: "groupCityWideAdr" },
];

const SEGMENT_OVERVIEW_FIELDS = [
  { label: "Group Corporate", roomsSoldField: "groupRoomsSold", adrField: "groupAdr" },
  { label: "Retail", roomsSoldField: "retailRoomsSold", adrField: "retailAdr" },
  { label: "Negotiated", roomsSoldField: "negotiatedRoomsSold", adrField: "negotiatedAdr" },
  { label: "Government", roomsSoldField: "governmentRoomsSold", adrField: "governmentAdr" },
  { label: "Wholesale", roomsSoldField: "wholesaleRoomsSold", adrField: "wholesaleAdr" },
  {
    label: "Internet Non-Opaque",
    roomsSoldField: "internetNonOpaqueRoomsSold",
    adrField: "internetNonOpaqueAdr",
  },
  {
    label: "Internet Opaque",
    roomsSoldField: "internetOpaqueRoomsSold",
    adrField: "internetOpaqueAdr",
  },
  { label: "Package", roomsSoldField: "packageRoomsSold", adrField: "packageAdr" },
  { label: "Discount", roomsSoldField: "discountRoomsSold", adrField: "discountAdr" },
  {
    label: "Brand Redemptions",
    roomsSoldField: "brandRedemptionsRoomsSold",
    adrField: "brandRedemptionsAdr",
  },
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

const getDaysInMonth = (dateString) => {
  const parsed = new Date(dateString || Date.now());

  if (Number.isNaN(parsed.getTime())) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  }

  return new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate();
};

const getDayFromDate = (dateString) => {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getDate();
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

const createAdrHeaderLookup = (fields) => {
  if (!fields?.length) return {};

  const normalizeHeader = (header) => header.replace(/_\d+$/, "");
  const adrStartIndex = fields.findIndex(
    (field) => normalizeHeader(field) === "Total ADR"
  );

  if (adrStartIndex === -1) return {};

  return ADR_MAPPINGS.reduce((acc, { header, field }) => {
    const matchingField = fields
      .slice(adrStartIndex)
      .find((fieldName) => normalizeHeader(fieldName) === header);

    if (matchingField) {
      acc[field] = matchingField;
    }

    return acc;
  }, {});
};

export default function WeeklyForecastToolPage() {
  const { hotelUid } = useHotelContext();
  const [selectedReportDate, setSelectedReportDate] = useState(formatDateInput());
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewRows, setOverviewRows] = useState([]);
  const [latestReportDate, setLatestReportDate] = useState("");
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

  const selectedMonthLabel = useMemo(() => {
    if (!selectedReportDate) return "";
    const parsed = new Date(selectedReportDate);
    return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [selectedReportDate]);

  const latestReportDateLabel = useMemo(() => {
    if (!latestReportDate) return "";
    const parsed = new Date(latestReportDate);
    if (Number.isNaN(parsed.getTime())) return latestReportDate;

    return parsed.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [latestReportDate]);

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
          const adrHeaderLookup = createAdrHeaderLookup(meta?.fields);
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

              ADR_MAPPINGS.forEach(({ field }) => {
                const headerKey = adrHeaderLookup[field];
                if (!headerKey) return;

                const value = parseNumber(row[headerKey]);
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
          await fetchOverviewData();
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

  const fetchOverviewData = async () => {
    if (!hotelUid) return;

    try {
      setOverviewLoading(true);
      const reportCollection = collection(db, `hotels/${hotelUid}/pickupReport`);
      const reportsSnapshot = await getDocs(query(reportCollection, orderBy("reportDate", "desc")));

      const mostRecentReportDoc = reportsSnapshot.docs?.[0];
      const mostRecentReportDate = mostRecentReportDoc
        ? mostRecentReportDoc.data()?.reportDate || mostRecentReportDoc.id
        : null;

      if (!mostRecentReportDate) {
        setOverviewRows([]);
        setLatestReportDate("");
        return;
      }

      if (mostRecentReportDate !== selectedReportDate) {
        setSelectedReportDate(mostRecentReportDate);
      }

      setLatestReportDate(mostRecentReportDate);

      const reportDocRef = doc(reportCollection, mostRecentReportDate);
      const datesCollection = collection(reportDocRef, "dates");
      const snapshot = await getDocs(query(datesCollection, orderBy("date", "asc")));
      const targetMonth = new Date(mostRecentReportDate).getMonth();
      const targetYear = new Date(mostRecentReportDate).getFullYear();

      const rows = snapshot.docs
        .map((docSnap) => docSnap.data())
        .filter((row) => {
          const rowDate = new Date(row.date);
          return rowDate.getMonth() === targetMonth && rowDate.getFullYear() === targetYear;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setOverviewRows(rows);
    } catch (err) {
      console.error("Error loading pickup report overview", err);
      toast.error("Kon de pickup gegevens niet ophalen.");
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelUid]);

  const formatEuro = (value) => {
    if (value === null || value === undefined) return "-";
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return "-";
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const dayNumbers = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedReportDate);
    return Array.from({ length: daysInMonth }, (_, index) => index + 1);
  }, [selectedReportDate]);

  const overviewByDay = useMemo(() => {
    if (!overviewRows?.length) return {};

    return overviewRows.reduce((acc, row) => {
      const day = getDayFromDate(row.date);
      if (day !== null) {
        acc[day] = row;
      }
      return acc;
    }, {});
  }, [overviewRows]);

  const handleExportToExcel = () => {
    if (!overviewRows.length) {
      toast.warn("Geen pickup data om te exporteren.");
      return;
    }

    const headerRow = ["Segment", "Meting", ...dayNumbers.map((day) => `Dag ${day}`)];

    const rows = SEGMENT_OVERVIEW_FIELDS.flatMap(({ label, roomsSoldField, adrField }) => {
      const roomsSoldRow = [label, "Rooms Sold", ...dayNumbers.map((day) => overviewByDay[day]?.[roomsSoldField] ?? "")];
      const adrRow = [label, "ADR", ...dayNumbers.map((day) => overviewByDay[day]?.[adrField] ?? "")];
      const revenueRow = [
        label,
        "Revenue",
        ...dayNumbers.map((day) => {
          const roomsSold = overviewByDay[day]?.[roomsSoldField];
          const adr = overviewByDay[day]?.[adrField];
          return roomsSold !== null && roomsSold !== undefined && adr !== null && adr !== undefined
            ? roomsSold * adr
            : "";
        }),
      ];

      return [roomsSoldRow, adrRow, revenueRow];
    });

    const exportData = [
      ["Weekly Forecast Tool export"],
      ["Hotel", hotelUid || "-"],
      ["Rapportdatum", selectedReportDate || "-"],
      ["Maand", selectedMonthLabel || "-"],
      [],
      headerRow,
      ...rows,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pickup overzicht");

    const filename = `weekly-forecast-${selectedReportDate || "export"}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success("Excel export aangemaakt.");
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
          <div className="flex items-center justify-end w-full sm:w-auto gap-3">
            <Button
              onClick={handleExportToExcel}
              disabled={!overviewRows.length}
              className="bg-green-700 hover:bg-green-800 flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Exporteren naar Excel</span>
            </Button>
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

        <Card className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Business on books: {latestReportDateLabel || "geen data beschikbaar"}
              </h2>
              <p className="text-gray-600">Overzicht voor {selectedMonthLabel || "geselecteerde maand"}.</p>
            </div>
            <Button onClick={fetchOverviewData} disabled={overviewLoading}>
              {overviewLoading ? "Bezig met laden..." : "Ververs overzicht"}
            </Button>
          </div>

          {!overviewRows.length && !overviewLoading ? (
            <p className="text-gray-600">Geen pickup data gevonden voor deze rapportdatum.</p>
          ) : null}

          <div className="space-y-6">
            {SEGMENT_OVERVIEW_FIELDS.map(({ label, roomsSoldField, adrField }) => (
              <div key={label} className="border border-gray-200 rounded-lg">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{label}</h3>
                  <span className="text-sm text-gray-600">Rooms Sold / ADR / Revenue</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[800px] text-sm text-right">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-4 py-2 font-semibold text-left sticky left-0 bg-gray-100">Meting</th>
                        {dayNumbers.map((day) => (
                          <th key={`${label}-day-${day}`} className="px-4 py-2 font-semibold">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-semibold text-left sticky left-0 bg-gray-50">
                          Rooms Sold
                        </td>
                        {dayNumbers.map((day) => {
                          const roomsSold = overviewByDay[day]?.[roomsSoldField] ?? null;
                          return (
                            <td key={`${label}-roomsSold-${day}`} className="px-4 py-2">
                              {formatNumber(roomsSold)}
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-semibold text-left sticky left-0 bg-gray-50">ADR</td>
                        {dayNumbers.map((day) => {
                          const adr = overviewByDay[day]?.[adrField] ?? null;
                          return (
                            <td key={`${label}-adr-${day}`} className="px-4 py-2">
                              {formatEuro(adr)}
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-semibold text-left sticky left-0 bg-gray-50">
                          Revenue
                        </td>
                        {dayNumbers.map((day) => {
                          const roomsSold = overviewByDay[day]?.[roomsSoldField];
                          const adr = overviewByDay[day]?.[adrField];
                          const revenue =
                            roomsSold !== null && roomsSold !== undefined && adr !== null && adr !== undefined
                              ? roomsSold * adr
                              : null;

                          return (
                            <td key={`${label}-revenue-${day}`} className="px-4 py-2">
                              {formatEuro(revenue)}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
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
