import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "react-toastify";
import { FileInput, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import {
  collection,
  db,
  doc,
  getDoc,
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

const PICKUP_BUCKETS = Array.from({ length: 30 }, (_, index) => ({
  label: `${index}`,
  minDays: index,
  maxDays: index,
}));

const DEFAULT_OCCUPANCY_WEIGHTS = [
  { threshold: 0.8, weight: 1 },
  { threshold: 0.9, weight: 0.7 },
  { threshold: 0.95, weight: 0.4 },
  { threshold: 1.01, weight: 0.1 },
];

const normalizeOccupancyWeights = (weights) => {
  if (!Array.isArray(weights)) return DEFAULT_OCCUPANCY_WEIGHTS;

  const cleaned = weights
    .map((item) => ({ threshold: Number(item?.threshold), weight: Number(item?.weight) }))
    .filter(({ threshold, weight }) => Number.isFinite(threshold) && Number.isFinite(weight));

  return cleaned.length ? cleaned.sort((a, b) => a.threshold - b.threshold) : DEFAULT_OCCUPANCY_WEIGHTS;
};

const getDefaultSegmentWeights = () =>
  Object.fromEntries(
    SEGMENT_OVERVIEW_FIELDS.map(({ roomsSoldField }) => [
      roomsSoldField,
      Math.round(100 / SEGMENT_OVERVIEW_FIELDS.length),
    ])
  );

const getDefaultPickupCurves = () => {
  const defaultPortion = 100 / PICKUP_BUCKETS.length;

  return Object.fromEntries(
    SEGMENT_OVERVIEW_FIELDS.map(({ roomsSoldField }) => [
      roomsSoldField,
      Array.from({ length: PICKUP_BUCKETS.length }, () => defaultPortion),
    ])
  );
};

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
  const [revenueToForecast, setRevenueToForecast] = useState("");
  const [segmentWeights, setSegmentWeights] = useState(getDefaultSegmentWeights);
  const [pickupCurves, setPickupCurves] = useState(getDefaultPickupCurves);
  const [occupancyWeights, setOccupancyWeights] = useState(DEFAULT_OCCUPANCY_WEIGHTS);
  const [forecastedRooms, setForecastedRooms] = useState({});
  const [forecastSettingsCollapsed, setForecastSettingsCollapsed] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const normalizePickupCurves = (curves) => {
    const defaults = getDefaultPickupCurves();
    const source = curves || {};

    return Object.fromEntries(
      SEGMENT_OVERVIEW_FIELDS.map(({ roomsSoldField }) => [
        roomsSoldField,
        PICKUP_BUCKETS.map((_, index) => {
          const value = source[roomsSoldField]?.[index];
          return value !== undefined ? value : defaults[roomsSoldField][index];
        }),
      ])
    );
  };

  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const forecastBaseDate = useMemo(
    () => latestReportDate || selectedReportDate || null,
    [latestReportDate, selectedReportDate]
  );

  const selectedMonthLabel = useMemo(() => {
    if (!forecastBaseDate) return "";
    const parsed = new Date(forecastBaseDate);
    return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [forecastBaseDate]);

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

  const settingsDocRef = useMemo(
    () => (hotelUid ? doc(db, `hotels/${hotelUid}/weeklyForecastSettings`, "settings") : null),
    [hotelUid]
  );

  const loadForecastSettings = async () => {
    if (!settingsDocRef) return;

    try {
      setSettingsLoading(true);
      const snapshot = await getDoc(settingsDocRef);
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      if (data.selectedReportDate) {
        setSelectedReportDate(data.selectedReportDate);
      }
      if (data.revenueToForecast !== undefined) {
        setRevenueToForecast(String(data.revenueToForecast ?? ""));
      }
      setSegmentWeights(data.segmentWeights || getDefaultSegmentWeights());
      setPickupCurves(normalizePickupCurves(data.pickupCurves));
      setOccupancyWeights(normalizeOccupancyWeights(data.occupancyWeights));
    } catch (err) {
      console.error("Error loading forecast settings", err);
      toast.error("Kon de forecast instellingen niet laden.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveForecastSettings = async () => {
    if (!settingsDocRef) {
      toast.error("Selecteer eerst een hotel om instellingen op te slaan.");
      return;
    }

    try {
      setSavingSettings(true);
      await setDoc(
        settingsDocRef,
        {
          selectedReportDate,
          revenueToForecast: Number(revenueToForecast) || 0,
          segmentWeights,
          pickupCurves,
          occupancyWeights: normalizeOccupancyWeights(occupancyWeights),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast.success("Forecast instellingen opgeslagen.");
    } catch (err) {
      console.error("Error saving forecast settings", err);
      toast.error("Kon forecast instellingen niet opslaan.");
    } finally {
      setSavingSettings(false);
    }
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

  useEffect(() => {
    loadForecastSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsDocRef]);

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

  const formatDecimal = (value) => {
    if (value === null || value === undefined) return null;
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  const forecastBaseDay = useMemo(() => {
    if (!forecastBaseDate) return 1;
    const parsed = new Date(forecastBaseDate);
    return Number.isNaN(parsed.getTime()) ? 1 : parsed.getDate();
  }, [forecastBaseDate]);

  const dayNumbers = useMemo(() => {
    const daysInMonth = getDaysInMonth(forecastBaseDate);
    return Array.from({ length: daysInMonth }, (_, index) => index + 1);
  }, [forecastBaseDate]);

  const averageTotalAdr = useMemo(() => {
    const validAdrs = overviewRows.map((row) => row.totalAdr).filter((value) => value !== null && value !== undefined);

    if (!validAdrs.length) return null;

    const total = validAdrs.reduce((sum, value) => sum + Number(value || 0), 0);
    return total / validAdrs.length;
  }, [overviewRows]);

  const roomsToForecast = useMemo(() => {
    const revenueValue = Number(revenueToForecast);
    if (!Number.isFinite(revenueValue) || revenueValue <= 0 || !averageTotalAdr || averageTotalAdr <= 0) {
      return 0;
    }

    return revenueValue / averageTotalAdr;
  }, [averageTotalAdr, revenueToForecast]);

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

  const hasForecastedRooms = useMemo(() => {
    return Object.values(forecastedRooms).some((segments) =>
      Object.values(segments || {}).some((value) => Number(value || 0) > 0)
    );
  }, [forecastedRooms]);

  const forecastSummaryByDay = useMemo(() => {
    return dayNumbers.map((day) => {
      const forecastForDay = forecastedRooms[day] || {};
      const addedRooms = Object.values(forecastForDay).reduce((sum, value) => sum + Number(value || 0), 0);
      const baseAdr = overviewByDay[day]?.totalAdr ?? averageTotalAdr ?? 0;

      const addedRevenue = SEGMENT_OVERVIEW_FIELDS.reduce((sum, { roomsSoldField, adrField }) => {
        const rooms = Number(forecastForDay[roomsSoldField] || 0);
        if (!rooms) return sum;
        const adr = overviewByDay[day]?.[adrField] ?? baseAdr;
        return sum + rooms * (adr || 0);
      }, 0);

      const baseRooms = overviewByDay[day]?.totalRoomsSold ?? 0;

      return {
        day,
        addedRooms,
        addedRevenue,
        occupancyRooms: baseRooms + addedRooms,
      };
    });
  }, [averageTotalAdr, dayNumbers, forecastedRooms, overviewByDay]);

  const monthlyForecastTotals = useMemo(() => {
    return forecastSummaryByDay.reduce(
      (acc, { addedRooms, addedRevenue }) => {
        acc.totalAddedRooms += Number(addedRooms || 0);
        acc.totalAddedRevenue += Number(addedRevenue || 0);
        return acc;
      },
      { totalAddedRooms: 0, totalAddedRevenue: 0 }
    );
  }, [forecastSummaryByDay]);

  const getLeadTimeBucket = (leadTime) =>
    PICKUP_BUCKETS.findIndex(({ minDays, maxDays }) => leadTime >= minDays && leadTime <= maxDays);

  const handleWeightChange = (field, value) => {
    setSegmentWeights((prev) => ({ ...prev, [field]: value }));
  };

  const handleCurveChange = (field, bucketIndex, value) => {
    setPickupCurves((prev) => {
      const currentBuckets = PICKUP_BUCKETS.map((_, index) => prev[field]?.[index] ?? 0);
      const updatedBuckets = [...currentBuckets];
      updatedBuckets[bucketIndex] = value;
      return { ...prev, [field]: updatedBuckets };
    });
  };

  const handleOccupancyWeightChange = (index, field, value) => {
    setOccupancyWeights((prev) => {
      const updated = [...prev];
      const numericValue = Number(value);
      updated[index] = {
        ...updated[index],
        [field]: Number.isFinite(numericValue) ? numericValue : updated[index]?.[field] ?? 0,
      };
      return updated;
    });
  };

  const effectiveOccupancyWeights = useMemo(
    () => normalizeOccupancyWeights(occupancyWeights),
    [occupancyWeights]
  );

  const segmentWeightValues = useMemo(
    () => SEGMENT_OVERVIEW_FIELDS.map(({ roomsSoldField }) => Number(segmentWeights[roomsSoldField] || 0)),
    [segmentWeights]
  );

  const maxSegmentWeight = useMemo(() => Math.max(100, ...segmentWeightValues), [segmentWeightValues]);

  const handleCalculateForecast = () => {
    if (!roomsToForecast) {
      toast.error("Voer een geldige revenue in om kamers te forecasten.");
      return;
    }

    const totalWeight = Object.values(segmentWeights).reduce((sum, value) => sum + Number(value || 0), 0);
    if (!totalWeight) {
      toast.error("Voeg een weight toe per segment om te verdelen.");
      return;
    }

    const roundAllocations = (entries, targetTotal, caps = {}) => {
      const normalizedTarget = Math.max(Math.round(targetTotal), 0);
      const baseEntries = entries.map(({ key, value }) => {
        const cap = caps[key] ?? Infinity;
        const floored = Math.min(Math.floor(value), cap);
        return {
          key,
          floored,
          fraction: Math.max(value - floored, 0),
          cap,
        };
      });

      let currentTotal = baseEntries.reduce((sum, { floored }) => sum + floored, 0);
      let remainder = normalizedTarget - currentTotal;
      const result = Object.fromEntries(baseEntries.map(({ key, floored }) => [key, floored]));

      const distribute = (sortedEntries, step) => {
        sortedEntries.forEach(({ key, cap }) => {
          if (!remainder) return;
          const limit = Math.max(0, cap - result[key]);
          if (limit <= 0) return;
          const delta = Math.min(step, remainder, limit);
          result[key] += delta;
          remainder -= delta;
        });
      };

      if (remainder > 0) {
        const sorted = [...baseEntries].sort((a, b) => b.fraction - a.fraction);
        while (remainder > 0) {
          distribute(sorted, 1);
          const hasCapacity = sorted.some(({ key, cap }) => result[key] < cap);
          if (!hasCapacity) break;
        }
      } else if (remainder < 0) {
        const sorted = [...baseEntries].sort((a, b) => a.fraction - b.fraction);
        while (remainder < 0) {
          sorted.forEach(({ key }) => {
            if (remainder < 0 && result[key] > 0) {
              result[key] -= 1;
              remainder += 1;
            }
          });
          const hasRooms = sorted.some(({ key }) => result[key] > 0);
          if (!hasRooms) break;
        }
      }

      return result;
    };

    const allocateSegmentsForDay = (segments, targetRooms) => {
      const entries = Object.entries(segments || {});
      if (!entries.length || !targetRooms) return {};

      const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
      if (!total) return {};

      const scaled = entries.map(([key, value]) => ({ key, value: (Number(value || 0) / total) * targetRooms }));
      return roundAllocations(scaled, targetRooms);
    };

    const getOccupancyWeight = (occupancy) => {
      const step = effectiveOccupancyWeights.find(({ threshold }) => occupancy < threshold);
      return step ? step.weight : effectiveOccupancyWeights[effectiveOccupancyWeights.length - 1].weight;
    };

    const base = forecastBaseDate ? new Date(forecastBaseDate) : new Date();
    const normalizedBaseDate = Number.isNaN(base.getTime()) ? new Date() : base;
    const baseDay = normalizedBaseDate.getDate();
    const daysInMonth = getDaysInMonth(normalizedBaseDate);
    const remainingDaysInMonth = Math.max(daysInMonth - baseDay + 1, 0);
    const forecastHorizon = Math.min(remainingDaysInMonth, 30);
    const targetTotalRooms = Math.max(Math.round(roomsToForecast), 0);

    const forecastDays = Array.from({ length: forecastHorizon }, (_, offset) => baseDay + offset);

    const bucketDays = PICKUP_BUCKETS.map(() => []);
    forecastDays.forEach((dayNumber) => {
      const bucket = getLeadTimeBucket(dayNumber - baseDay);
      if (bucket >= 0) {
        bucketDays[bucket].push(dayNumber);
      }
    });

    const newForecast = {};

    SEGMENT_OVERVIEW_FIELDS.forEach(({ roomsSoldField }) => {
      const segmentWeight = Number(segmentWeights[roomsSoldField]) || 0;
      if (segmentWeight <= 0) return;

      const segmentRooms = (roomsToForecast * segmentWeight) / totalWeight;
      const curve = PICKUP_BUCKETS.map((_, index) => Number(pickupCurves[roomsSoldField]?.[index] || 0));
      const bucketInfo = bucketDays
        .map((days, index) => ({ days, weight: curve[index] }))
        .filter(({ days }) => days.length);

      if (!bucketInfo.length) return;

      const weightSum = bucketInfo.reduce((sum, { weight }) => sum + weight, 0);
      const normalizedBuckets = weightSum
        ? bucketInfo.map(({ days, weight }) => ({ days, portion: weight / weightSum }))
        : bucketInfo.map(({ days }) => ({ days, portion: 1 / bucketInfo.length }));

      normalizedBuckets.forEach(({ portion, days }) => {
        if (portion <= 0) return;

        const bucketRooms = segmentRooms * portion;
        const perDay = bucketRooms / days.length;

        days.forEach((day) => {
          newForecast[day] = newForecast[day] || {};
          newForecast[day][roomsSoldField] = (newForecast[day][roomsSoldField] || 0) + perDay;
        });
      });
    });

    const baseDayEntries = forecastDays.map((day) => {
      const segments = newForecast[day] || {};
      const total = Object.values(segments).reduce((sum, value) => sum + Number(value || 0), 0);
      return { key: day, value: total, segments };
    });

    const roundedBaseTotals = roundAllocations(baseDayEntries, targetTotalRooms);

    const occupancyAdjusted = forecastDays.map((day) => {
      const dayOverview = overviewByDay[day] || {};
      const totalRoomsSold = Number(dayOverview.totalRoomsSold || 0);
      const roomsLeftToSell = Number(dayOverview.roomsLeftToSell || 0);
      const availableRooms = totalRoomsSold + roomsLeftToSell;
      const currentOtbRooms = totalRoomsSold;
      const occupancyBefore = availableRooms > 0 ? currentOtbRooms / availableRooms : 0;
      const occupancyWeight = getOccupancyWeight(occupancyBefore);
      const maxAddable = Math.max(availableRooms - currentOtbRooms, 0);
      const baseRooms = roundedBaseTotals[day] || 0;

      return {
        day,
        baseRooms,
        occupancyBefore,
        occupancyWeight,
        maxAddable,
        segments: newForecast[day] || {},
      };
    });

    const caps = Object.fromEntries(occupancyAdjusted.map(({ day, maxAddable }) => [day, maxAddable]));
    const adjustedTotals = roundAllocations(
      occupancyAdjusted.map(({ day, baseRooms, occupancyWeight }) => ({ key: day, value: baseRooms * occupancyWeight })),
      targetTotalRooms,
      caps
    );

    const totalCapacity = forecastDays.reduce((sum, day) => sum + Math.max(caps[day] ?? Infinity, 0), 0);
    let allocatedTotal = Object.values(adjustedTotals).reduce((sum, value) => sum + Number(value || 0), 0);
    let remainder = Math.max(0, Math.min(targetTotalRooms, totalCapacity) - allocatedTotal);

    if (remainder > 0) {
      const allocateNextRoom = () => {
        const candidates = forecastDays
          .map((day) => {
            const capacity = Math.max(caps[day] ?? Infinity, 0);
            const currentTotal = Math.max(adjustedTotals[day] || 0, 0);
            const remainingCapacity = Math.max(capacity - currentTotal, 0);

            if (!remainingCapacity) return null;

            const fillRatio = capacity === Infinity ? 0 : currentTotal / capacity;
            return { day, remainingCapacity, fillRatio };
          })
          .filter(Boolean)
          .sort((a, b) => {
            if (a.fillRatio === b.fillRatio) return a.day - b.day;
            return a.fillRatio - b.fillRatio;
          });

        if (!candidates.length) return false;

        const lowestFill = candidates[0].fillRatio;
        const lowestFillDays = candidates.filter(({ fillRatio }) => fillRatio === lowestFill);

        lowestFillDays.forEach(({ day, remainingCapacity }) => {
          if (!remainder || !remainingCapacity) return;
          adjustedTotals[day] = (adjustedTotals[day] || 0) + 1;
          remainder -= 1;
        });

        return remainder > 0;
      };

      while (remainder > 0 && allocateNextRoom()) {
        // continue distributing until no remainder or all capacity is filled
      }

      allocatedTotal = Object.values(adjustedTotals).reduce((sum, value) => sum + Number(value || 0), 0);
    }

    const unreachableRemainder = Math.max(0, targetTotalRooms - allocatedTotal);

    if (unreachableRemainder > 0) {
      toast.warn(
        `Er zijn ${formatNumber(unreachableRemainder)} kamers die niet kunnen worden verdeeld vanwege capaciteitslimieten.`
      );
    }

    const forecastDaySet = new Set(forecastDays);

    const finalForecast = dayNumbers.reduce((acc, day) => {
      if (!forecastDaySet.has(day)) {
        acc[day] = {};
        return acc;
      }

      const dayTotal = adjustedTotals[day] || 0;
      const segments = allocateSegmentsForDay(newForecast[day], dayTotal);
      acc[day] = segments;
      return acc;
    }, {});

    setForecastedRooms(finalForecast);
    toast.success("Forecast berekend. Er zijn geen wijzigingen opgeslagen.");
  };

  const buildExportData = (includeForecastedRooms = false) => {
    const headerRow = ["Segment", "Meting", ...dayNumbers.map((day) => `Dag ${day}`)];

    const roundExportValue = (value) => {
      if (value === null || value === undefined) return "";
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? Math.round(numericValue) : "";
    };

    const rows = SEGMENT_OVERVIEW_FIELDS.flatMap(({ label, roomsSoldField, adrField }) => {
      const roomsSoldRow = [
        label,
        "Rooms Sold",
        ...dayNumbers.map((day) => {
          const baseRooms = overviewByDay[day]?.[roomsSoldField];

          if (!includeForecastedRooms) {
            return baseRooms ?? "";
          }

          const forecastRooms = forecastedRooms[day]?.[roomsSoldField];
          const hasBase = baseRooms !== undefined && baseRooms !== null;
          const hasForecast = forecastRooms !== undefined && forecastRooms !== null;

          if (!hasBase && !hasForecast) return "";

          return Number(baseRooms || 0) + Number(forecastRooms || 0);
        }),
      ];

      const adrRow = [label, "ADR", ...dayNumbers.map((day) => roundExportValue(overviewByDay[day]?.[adrField]))];

      const revenueRow = [
        label,
        "Revenue",
        ...dayNumbers.map((day) => {
          const adr = overviewByDay[day]?.[adrField];
          if (adr === null || adr === undefined) return "";

          const baseRooms = Number(overviewByDay[day]?.[roomsSoldField] || 0);
          const forecastRooms = includeForecastedRooms ? Number(forecastedRooms[day]?.[roomsSoldField] || 0) : 0;
          const totalRooms = includeForecastedRooms ? baseRooms + forecastRooms : baseRooms;

          if (!totalRooms) return "";

          return roundExportValue(totalRooms * adr);
        }),
      ];

      return [roomsSoldRow, adrRow, revenueRow];
    });

    return [
      ["Weekly Forecast Tool export"],
      ["Hotel", hotelUid || "-"],
      ["Rapportdatum", selectedReportDate || "-"],
      ["Maand", selectedMonthLabel || "-"],
      [],
      headerRow,
      ...rows,
    ];
  };

  const exportToExcel = (includeForecastedRooms = false) => {
    if (!overviewRows.length) {
      toast.warn("Geen pickup data om te exporteren.");
      return;
    }

    if (includeForecastedRooms && !hasForecastedRooms) {
      toast.warn("Bereken eerst een forecast om deze export te gebruiken.");
      return;
    }

    const exportData = buildExportData(includeForecastedRooms);
    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pickup overzicht");

    const filenameSuffix = includeForecastedRooms ? "-calculated" : "";
    const filename = `weekly-forecast${filenameSuffix}-${selectedReportDate || "export"}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success("Excel export aangemaakt.");
  };

  const handleExportToExcel = () => exportToExcel(false);
  const handleCalculatedForecastExport = () => exportToExcel(true);

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
              onClick={handleCalculatedForecastExport}
              disabled={!overviewRows.length || !hasForecastedRooms}
              className="bg-emerald-700 hover:bg-emerald-800 flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Calculated forecast exporteren</span>
            </Button>
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

        <Card className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Forecast instellingen</h2>
              <p className="text-gray-600 text-sm sm:text-base">
                Verdeel de nog te forecasten revenue over segmenten en lead times. Deze berekening past niets in
                Firestore aan.
              </p>
              <p className="text-xs text-gray-600">
                Forecast start vanaf pickup report datum {latestReportDateLabel || selectedMonthLabel || "-"}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <div className="text-right text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
                <p className="font-semibold">Gemiddelde Total ADR</p>
                <p>{averageTotalAdr ? formatEuro(averageTotalAdr) : "Geen ADR bekend"}</p>
              </div>
              <Button
                onClick={saveForecastSettings}
                disabled={savingSettings || settingsLoading}
                className="bg-blue-700 hover:bg-blue-800"
              >
                {savingSettings ? "Opslaan..." : "Instellingen opslaan"}
              </Button>
              <Button
                onClick={() => setForecastSettingsCollapsed((prev) => !prev)}
                className="bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                {forecastSettingsCollapsed ? "Toon instellingen" : "Minimaliseer instellingen"}
              </Button>
            </div>
          </div>

          {settingsLoading ? (
            <p className="text-gray-600">Instellingen worden geladen...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-gray-800">Revenue still to be forecasted</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={revenueToForecast}
                    onChange={(event) => setRevenueToForecast(event.target.value)}
                    placeholder="Bijv. 50000"
                    className="border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
                  />
                </label>

                <div className="flex flex-col justify-center gap-1 bg-gray-50 border rounded px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">Rooms to be forecasted</span>
                  <span className="text-2xl font-semibold text-blue-700">{formatNumber(roomsToForecast)}</span>
                  <p className="text-xs text-gray-600">Berekend op basis van de meest recente Total ADR.</p>
                </div>
              </div>

              {!forecastSettingsCollapsed && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Weight per segment (%)</h3>
                      <p className="text-sm text-gray-600">
                        Totaal: {formatDecimal(Object.values(segmentWeights).reduce((sum, value) => sum + Number(value || 0), 0)) || 0}%
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
                      {SEGMENT_OVERVIEW_FIELDS.map(({ label, roomsSoldField }) => {
                        const value = Number(segmentWeights[roomsSoldField] || 0);
                        const height = maxSegmentWeight > 0 ? Math.min((value / maxSegmentWeight) * 160, 160) : 0;

                        return (
                          <div
                            key={roomsSoldField}
                            className="flex flex-col gap-3 border rounded-lg p-3 bg-gray-50 h-full"
                          >
                            <span className="font-semibold text-gray-800">{label}</span>
                            <div className="flex items-end justify-center gap-2 flex-1">
                              <div className="flex flex-col items-center gap-1">
                                <div className="relative w-10 bg-blue-100 rounded-sm flex items-end justify-center" style={{ height: 160 }}>
                                  <div
                                    className="w-full bg-blue-500 rounded-sm transition-all duration-200"
                                    style={{ height }}
                                  />
                                  <span className="absolute -top-6 text-sm font-semibold text-blue-800">{formatDecimal(value)}%</span>
                                </div>
                              </div>
                            </div>
                            <label className="flex flex-col gap-1 text-sm">
                              <span className="text-gray-700">Aanpassen (%)</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={segmentWeights[roomsSoldField] ?? ""}
                                onChange={(event) => handleWeightChange(roomsSoldField, event.target.value)}
                                className="border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Pickup curves per segment</h3>
                        <p className="text-sm text-gray-600">Verdeel de weight per lead time (dagen).</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-md font-semibold">Occupancy weight</h4>
                          <p className="text-sm text-gray-600">Configureer hoeveel forecast meeweegt per bezettingsniveau.</p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          {effectiveOccupancyWeights.map((step, index) => (
                            <div key={`occupancy-step-${index}`} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                              <div className="text-sm text-gray-700">
                                <p className="font-semibold">Drempel: &lt; {formatDecimal(step.threshold * 100)}% occupancy</p>
                                <p className="text-xs text-gray-600">Pas de drempel of het gewicht aan.</p>
                              </div>
                              <label className="flex flex-col gap-1 text-sm">
                                <span className="text-gray-700">Drempel (%)</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={step.threshold}
                                  onChange={(event) => handleOccupancyWeightChange(index, "threshold", event.target.value)}
                                  className="border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-sm">
                                <span className="text-gray-700">Weight (0-1)</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={step.weight}
                                  onChange={(event) => handleOccupancyWeightChange(index, "weight", event.target.value)}
                                  className="border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
                                />
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        {SEGMENT_OVERVIEW_FIELDS.map(({ label, roomsSoldField }) => {
                          const bucketValues = PICKUP_BUCKETS.map((_, index) => Number(pickupCurves[roomsSoldField]?.[index] || 0));
                          const maxBucket = Math.max(20, ...bucketValues);

                          return (
                            <div key={`${roomsSoldField}-curve`} className="border rounded-lg p-3">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <p className="font-semibold text-gray-800">{label}</p>
                                <p className="text-xs text-gray-600">
                                  Lead time buckets: 0, 1-3, 4-7, 8-14, 15-21 en 22+ dagen.
                                </p>
                              </div>
                              <div className="mt-4 overflow-x-auto">
                                <div className="min-w-[600px]">
                                  <div className="flex items-end gap-4 pb-4">
                                    {PICKUP_BUCKETS.map(({ label: labelText }, index) => {
                                      const value = bucketValues[index] ?? 0;
                                      const height = maxBucket > 0 ? Math.min((value / maxBucket) * 160, 160) : 0;

                                      return (
                                        <div key={`${roomsSoldField}-bucket-${labelText}`} className="flex-1 min-w-[80px]">
                                          <div className="flex flex-col items-center gap-2">
                                            <div className="relative w-full max-w-[70px] bg-emerald-100 rounded-sm" style={{ height: 160 }}>
                                              <div
                                                className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-sm transition-all duration-200"
                                                style={{ height }}
                                              />
                                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-semibold text-emerald-800">
                                                {formatDecimal(value)}%
                                              </span>
                                            </div>
                                            <span className="text-xs text-gray-700">{labelText} dagen</span>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.1"
                                              value={pickupCurves[roomsSoldField]?.[index] ?? ""}
                                              onChange={(event) => handleCurveChange(roomsSoldField, index, event.target.value)}
                                              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-200"
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                </>
              )}

              <div className="flex justify-end">
                <Button onClick={handleCalculateForecast} className="bg-green-700 hover:bg-green-800">
                  Calculate forecast
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Forecast toevoegingen per dag</h2>
              <p className="text-gray-600 text-sm">Kamers en revenue die via de forecast worden toegevoegd plus totale bezetting.</p>
            </div>
            <div className="text-sm text-gray-700 bg-gray-100 rounded px-3 py-1.5">
              Forecast vanaf dag {forecastBaseDay} van {selectedMonthLabel || "onbekend"}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[600px] w-full text-sm text-right">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Dag</th>
                  <th className="px-3 py-2">Kamers toegevoegd</th>
                  <th className="px-3 py-2">Revenue toegevoegd</th>
                  <th className="px-3 py-2">Bezetting (rooms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {forecastSummaryByDay.map(({ day, addedRooms, addedRevenue, occupancyRooms }) => (
                  <tr key={`forecast-summary-${day}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-left font-medium text-gray-800">{day}</td>
                    <td className="px-3 py-2 text-green-700 font-semibold">+{formatNumber(addedRooms)}</td>
                    <td className="px-3 py-2 text-green-700 font-semibold">{formatEuro(addedRevenue)}</td>
                    <td className="px-3 py-2 font-medium">{formatNumber(occupancyRooms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm text-green-800">Kamers toegevoegd (maandtotaal)</p>
                <p className="text-lg font-semibold text-green-900">
                  +{formatNumber(monthlyForecastTotals.totalAddedRooms)} kamers
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm text-blue-800">Revenue toegevoegd (maandtotaal)</p>
                <p className="text-lg font-semibold text-blue-900">{formatEuro(monthlyForecastTotals.totalAddedRevenue)}</p>
              </div>
            </div>
          </div>
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
                          const forecastAddition = forecastedRooms[day]?.[roomsSoldField];
                              return (
                            <td key={`${label}-roomsSold-${day}`} className="px-4 py-2">
                              {forecastAddition !== undefined ? (
                                <div className="text-xs text-green-700 font-semibold leading-tight">
                                  +{formatNumber(forecastAddition)}
                                </div>
                              ) : null}
                              <div>{formatNumber(roomsSold)}</div>
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
