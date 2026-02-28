import React, { useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  auth,
  collection,
  db,
  getDocs,
  signOut,
  doc,
  writeBatch,
  updateDoc,
  getDoc,
  setDoc,
} from "../../firebaseConfig";

const REQUIRED_HEADERS = [
  "EXTERNAL_REFERENCE",
  "ARRIVAL",
  "PRODUCTS",
  "MARKET_CODE",
  "RATE_CODE",
  "DEPARTURE",
  "ADULTS",
];

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDdMmYy = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const digitsOnly = normalized.replace(/[^\d]/g, "");
  let day = 0;
  let month = 0;
  let year = 0;

  if (digitsOnly.length === 6) {
    day = Number(digitsOnly.slice(0, 2));
    month = Number(digitsOnly.slice(2, 4));
    year = 2000 + Number(digitsOnly.slice(4, 6));
  } else if (digitsOnly.length === 8) {
    day = Number(digitsOnly.slice(0, 2));
    month = Number(digitsOnly.slice(2, 4));
    year = Number(digitsOnly.slice(4, 8));
  } else {
    return "";
  }

  const parsed = new Date(year, month - 1, day);
  const isValidDate =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;

  if (!isValidDate) {
    return "";
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const parseIsoDate = (value) => {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  const isValidDate =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
  return isValidDate ? parsed : null;
};

const calculateNights = (dateOfArrival, dateOfDeparture) => {
  const arrival = parseIsoDate(dateOfArrival);
  const departure = parseIsoDate(dateOfDeparture);
  if (!arrival || !departure) return 0;
  const diffMs = departure.getTime() - arrival.getTime();
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
};
const normalizeTsvRows = (rawText) => {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const headerLine = lines.shift();

  if (!headerLine) {
    return null;
  }

  const headers = headerLine.split("\t").map((header) => header.trim());
  const expectedColumnCount = headers.length;
  const billToIndex = headers.indexOf("BILL_TO_ADDRESS");
  const rows = [];
  let currentColumns = null;

  const normalizeColumns = (columns) => {
    let normalizedColumns = columns;
    if (columns.length > expectedColumnCount) {
      normalizedColumns = [
        ...columns.slice(0, expectedColumnCount - 1),
        columns.slice(expectedColumnCount - 1).join("\t"),
      ];
    } else if (columns.length < expectedColumnCount) {
      normalizedColumns = [
        ...columns,
        ...Array(expectedColumnCount - columns.length).fill(""),
      ];
    }
    return normalizedColumns;
  };

  const appendContinuation = (line) => {
    if (!currentColumns) {
      return;
    }

    const targetIndex =
      billToIndex >= 0 ? billToIndex : Math.max(currentColumns.length - 1, 0);

    while (currentColumns.length <= targetIndex) {
      currentColumns.push("");
    }

    if (line.includes("\t")) {
      const [addressPart, ...rest] = line.split("\t");
      currentColumns[targetIndex] =
        `${currentColumns[targetIndex]} ${addressPart}`.trim();
      if (rest.length) {
        currentColumns.push(...rest);
      }
      return;
    }

    currentColumns[targetIndex] =
      `${currentColumns[targetIndex]} ${line}`.trim();
  };

  lines.forEach((line) => {
    if (!line) {
      return;
    }

    const isRecordStart = line.startsWith("\t");
    if (!currentColumns) {
      currentColumns = line.split("\t");
      return;
    }

    if (isRecordStart) {
      rows.push(normalizeColumns(currentColumns));
      currentColumns = line.split("\t");
      return;
    }

    appendContinuation(line);
  });

  if (currentColumns) {
    rows.push(normalizeColumns(currentColumns));
  }

  return { headers, rows };
};

const parseTsv = (rawText) => {
  const normalizedRows = normalizeTsvRows(rawText);
  if (!normalizedRows) return null;

  const { headers, rows } = normalizedRows;
  const missing = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missing.length) {
    throw new Error(`Ontbrekende kolommen: ${missing.join(", ")}`);
  }

  const indexMap = headers.reduce((acc, header, index) => {
    acc[header] = index;
    return acc;
  }, {});

  const getValue = (row, header) => {
    const index = indexMap[header];
    if (index === undefined) return "";
    return String(row[index] ?? "").trim();
  };

  const mappedRows = rows.map((row) => {
    const addedPackages = getValue(row, "PRODUCTS")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      reservationNumber: getValue(row, "EXTERNAL_REFERENCE"),
      dateOfArrival: parseDdMmYy(getValue(row, "ARRIVAL")),
      addedPackages,
      marketCode: getValue(row, "MARKET_CODE"),
      rateCode: getValue(row, "RATE_CODE"),
      dateOfDeparture: parseDdMmYy(getValue(row, "DEPARTURE")),
      adults: Number(getValue(row, "ADULTS") || 0),
    };
  });

  const validRows = mappedRows.filter((row) => row.marketCode);
  return {
    rows: validRows,
    skippedMarketCode: mappedRows.length - validRows.length,
    totalRows: mappedRows.length,
  };
};

const createTrackedPackage = () => ({
  id: `tracked-package-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: "",
  price: "",
  type: "perAdult",
});

const normalizePackageName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export default function VatChangeCorrectionPage() {
  const { hotelUid, roles } = useHotelContext();
  const navigate = useNavigate();
  const isAdmin = useMemo(
    () =>
      Array.isArray(roles) &&
      roles.some((role) => String(role).toLowerCase() === "admin"),
    [roles],
  );
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [activeList, setActiveList] = useState("to-change");
  const [confirmReservation, setConfirmReservation] = useState(null);
  const [trackedPackages, setTrackedPackages] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [availableDateKeys, setAvailableDateKeys] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: "reservationNumber",
    direction: "asc",
  });
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const fetchRowsForDate = async (dateKey) => {
    if (!hotelUid || !dateKey) {
      return [];
    }

    const stayDateCollectionRef = collection(
      db,
      `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedPerStayDate/${dateKey}`,
    );
    const snapshot = await getDocs(stayDateCollectionRef);
    const loadedRows = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    loadedRows.sort((a, b) =>
      String(a.reservationNumber || "").localeCompare(
        String(b.reservationNumber || ""),
      ),
    );
    return loadedRows;
  };

  const loadRowsForDate = async (dateKey) => {
    const loadedRows = await fetchRowsForDate(dateKey);
    setRows(loadedRows);
    return loadedRows;
  };

  const loadAvailableDatesAndRows = async () => {
    if (!hotelUid) {
      setRows([]);
      setAvailableDateKeys([]);
      setSelectedDateKey("");
      return;
    }

    const completeListRef = collection(
      db,
      `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedCompleteList/listOfAllReservations`,
    );
    const completeListSnapshot = await getDocs(completeListRef);
    const candidateDateKeys = Array.from(
      new Set(
        completeListSnapshot.docs
          .map(
            (docSnap) =>
              parseDdMmYy(docSnap.data()?.dateOfArrival || "") ||
              docSnap.data()?.dateOfArrival,
          )
          .map((dateValue) => String(dateValue || "").trim())
          .filter((dateValue) => /^\d{4}-\d{2}-\d{2}$/.test(dateValue)),
      ),
    ).sort((a, b) => b.localeCompare(a));

    const datesWithReservations = [];
    let initialDateKey = "";
    let initialRows = null;

    for (const dateKey of candidateDateKeys) {
      const loadedRows = await fetchRowsForDate(dateKey);
      if (!loadedRows.length) {
        continue;
      }

      datesWithReservations.push(dateKey);
      if (!initialDateKey) {
        initialDateKey = dateKey;
        initialRows = loadedRows;
      }
    }

    if (!initialDateKey) {
      const todayRows = await fetchRowsForDate(todayKey);
      if (todayRows.length) {
        initialDateKey = todayKey;
        initialRows = todayRows;
        datesWithReservations.push(todayKey);
      }
    }

    setAvailableDateKeys(datesWithReservations);
    setSelectedDateKey(initialDateKey || todayKey);
    setRows(initialRows || []);
  };

  const loadTrackedPackages = async () => {
    if (!hotelUid) {
      setTrackedPackages([]);
      return;
    }

    const settingsRef = doc(db, `hotels/${hotelUid}/settings`, hotelUid);
    const settingsSnap = await getDoc(settingsRef);
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const storedPackages = Array.isArray(settings?.vatChangeTrackedPackages)
      ? settings.vatChangeTrackedPackages
      : [];

    setTrackedPackages(
      storedPackages.map((pkg) => ({
        id: `tracked-package-${
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(16).slice(2)
        }`,
        name: String(pkg?.name || ""),
        price: String(pkg?.price ?? ""),
        type: pkg?.type === "perReservation" ? "perReservation" : "perAdult",
      })),
    );
  };

  const persistTrackedPackages = async (nextPackages) => {
    if (!hotelUid) return;
    const settingsRef = doc(db, `hotels/${hotelUid}/settings`, hotelUid);
    const payload = nextPackages
      .map((pkg) => ({
        name: String(pkg.name || "").trim(),
        price: Number(pkg.price) || 0,
        type: pkg.type === "perReservation" ? "perReservation" : "perAdult",
      }))
      .filter((pkg) => pkg.name);

    await setDoc(
      settingsRef,
      { vatChangeTrackedPackages: payload },
      { merge: true },
    );
  };

  const updateTrackedPackages = (updater) => {
    setTrackedPackages((prev) => {
      const nextPackages =
        typeof updater === "function" ? updater(prev) : updater;
      persistTrackedPackages(nextPackages).catch((error) => {
        console.error(error);
        setStatus({
          type: "error",
          message: "Opslaan van package settings is mislukt.",
        });
      });
      return nextPackages;
    });
  };

  useEffect(() => {
    Promise.all([loadAvailableDatesAndRows(), loadTrackedPackages()]).catch(
      (error) => {
        console.error(error);
        setStatus({ type: "error", message: "Laden van data is mislukt." });
      },
    );
  }, [hotelUid, todayKey]);

  const todayOverview = useMemo(() => {
    const totalReservations = rows.length;
    const toChangeReservations = rows.filter(
      (row) => row.toChange === true && row.isChanged !== true,
    ).length;
    const changedReservations = rows.filter(
      (row) => row.toChange === true && row.isChanged === true,
    ).length;
    return {
      totalReservations,
      toChangeReservations,
      changedReservations,
    };
  }, [rows]);

  const trackedPackageTotals = useMemo(() => {
    return trackedPackages
      .map((pkg) => {
        const normalizedName = normalizePackageName(pkg.name);
        if (!normalizedName) return null;
        const unitPrice = Number(pkg.price) || 0;

        const totalIncludedVat = rows.reduce((sum, row) => {
          const rowPackages = Array.isArray(row.addedPackages)
            ? row.addedPackages
            : [];
          const hasPackage = rowPackages.some(
            (item) => normalizePackageName(item) === normalizedName,
          );
          if (!hasPackage) return sum;

          if (pkg.type === "perReservation") {
            return sum + unitPrice;
          }

          const adults = Number.isFinite(Number(row.adults))
            ? Number(row.adults)
            : 0;
          return sum + unitPrice * adults;
        }, 0);

        return {
          ...pkg,
          totalIncludedVat,
        };
      })
      .filter(Boolean);
  }, [trackedPackages, rows]);

  const filteredRows = useMemo(() => {
    if (activeList === "is-changed") {
      return rows.filter(
        (row) => row.toChange === true && row.isChanged === true,
      );
    }

    return rows.filter(
      (row) => row.toChange === true && row.isChanged !== true,
    );
  }, [rows, activeList]);

  const sortedFilteredRows = useMemo(() => {
    const getSortValue = (row) => {
      if (sortConfig.key === "adults") {
        return Number(row.adults) || 0;
      }
      if (
        sortConfig.key === "dateOfArrival" ||
        sortConfig.key === "dateOfDeparture"
      ) {
        return parseIsoDate(row[sortConfig.key])?.getTime() || 0;
      }
      if (sortConfig.key === "addedPackages") {
        return (Array.isArray(row.addedPackages) ? row.addedPackages : [])
          .join(", ")
          .toLowerCase();
      }
      return String(row[sortConfig.key] || row.id || "").toLowerCase();
    };

    return [...filteredRows].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((previous) =>
      previous.key === key
        ? { key, direction: previous.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const handleDateChange = async (dateKey) => {
    if (!dateKey || dateKey === selectedDateKey) {
      return;
    }

    setSelectedDateKey(dateKey);
    await loadRowsForDate(dateKey);
  };

  const handleConfirmChanged = async () => {
    if (!confirmReservation || !hotelUid) {
      setConfirmReservation(null);
      return;
    }

    try {
      const { row, nextIsChanged } = confirmReservation;
      const reservationNumber = row.reservationNumber || row.id;
      const docRef = doc(
        db,
        `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedPerStayDate/${selectedDateKey}/${reservationNumber}`,
      );
      const activeUser =
        auth.currentUser?.displayName ||
        auth.currentUser?.email ||
        auth.currentUser?.uid ||
        "Unknown user";
      const updatePayload = nextIsChanged
        ? { isChanged: true, lastChangedByUser: activeUser }
        : { isChanged: false };

      await updateDoc(docRef, updatePayload);
      setRows((previousRows) =>
        previousRows.map((currentRow) =>
          (currentRow.reservationNumber || currentRow.id) === reservationNumber
            ? {
                ...currentRow,
                isChanged: nextIsChanged,
                ...(nextIsChanged ? { lastChangedByUser: activeUser } : {}),
              }
            : currentRow,
        ),
      );
      setStatus({
        type: "success",
        message: nextIsChanged
          ? `Reservatie ${reservationNumber} is afgevinkt als gewijzigd.`
          : `Reservatie ${reservationNumber} is teruggezet naar nog te wijzigen.`,
      });
    } catch (error) {
      console.error(error);
      setStatus({
        type: "error",
        message: "Bijwerken van reservatie is mislukt.",
      });
    } finally {
      setConfirmReservation(null);
    }
  };

  const handleImport = async (event, destination) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !hotelUid) {
      return;
    }

    try {
      const rawText = await file.text();
      const parsed = parseTsv(rawText);
      if (!parsed?.rows?.length) {
        setStatus({
          type: "error",
          message: "Geen geldige rijen gevonden in het bestand.",
        });
        return;
      }

      const batch = writeBatch(db);
      let reservationsToChange = new Set();

      if (destination === "stay-date") {
        const completeListRef = collection(
          db,
          `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedCompleteList/listOfAllReservations`,
        );
        const completeListSnapshot = await getDocs(completeListRef);
        reservationsToChange = new Set(
          completeListSnapshot.docs.map((docSnap) => docSnap.id),
        );
      }

      let importedRows = 0;
      parsed.rows.forEach((row) => {
        if (!row.reservationNumber) return;

        const targetPath =
          destination === "complete-list"
            ? `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedCompleteList/listOfAllReservations/${row.reservationNumber}`
            : `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedPerStayDate/${selectedDateKey || todayKey}/${row.reservationNumber}`;

        const docRef = doc(db, targetPath);
        const shouldMarkToChange =
          destination === "stay-date" &&
          reservationsToChange.has(row.reservationNumber);
        const rowPayload =
          destination === "complete-list"
            ? {
                ...row,
                nights: calculateNights(row.dateOfArrival, row.dateOfDeparture),
              }
            : {
                ...row,
                toChange: shouldMarkToChange,
                isChanged: false,
              };

        batch.set(docRef, rowPayload, { merge: true });
        importedRows += 1;
      });
      await batch.commit();

      const skippedInfo = parsed.skippedMarketCode
        ? ` (${parsed.skippedMarketCode} rij(en) met lege MARKET_CODE overgeslagen)`
        : "";
      const destinationLabel =
        destination === "complete-list"
          ? "arrivalsDetailedCompleteList/listOfAllReservations"
          : `arrivalsDetailedPerStayDate/${selectedDateKey || todayKey}`;
      setStatus({
        type: "success",
        message: `Import gelukt naar ${destinationLabel} (${importedRows} van ${parsed.totalRows} rijen).${skippedInfo}`,
      });

      if (destination !== "complete-list") {
        await loadRowsForDate(selectedDateKey || todayKey);
      }
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: error.message || "Import mislukt." });
    }
  };

  return (
    <>
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer title="VAT Change Correction">
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Today's Overview
                </h2>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-700">
                  <p>
                    Reservations:{" "}
                    <span className="font-semibold">
                      {todayOverview.totalReservations}
                    </span>
                  </p>
                  <p>
                    To Change:{" "}
                    <span className="font-semibold">
                      {todayOverview.toChangeReservations}
                    </span>
                  </p>
                  <p>
                    Already Changed:{" "}
                    <span className="font-semibold">
                      {todayOverview.changedReservations}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={() =>
                    navigate("/reservations/vat-change-correction/how-to")
                  }
                >
                  How To
                </button>
                <button
                  type="button"
                  className="rounded border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsSettingsOpen(true)}
                  aria-label="Open package settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-1 text-sm text-gray-700">
              {trackedPackageTotals.length ? (
                trackedPackageTotals.map((pkg) => (
                  <p key={pkg.id || pkg.name}>
                    {pkg.name} Total Included Vat:{" "}
                    <span className="font-semibold">
                      € {pkg.totalIncludedVat.toFixed(2)}
                    </span>
                  </p>
                ))
              ) : (
                <p className="text-gray-500">
                  Geen package tracking ingesteld.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600">Overzicht voor</p>
              <select
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                value={selectedDateKey || todayKey}
                onChange={(event) => handleDateChange(event.target.value)}
              >
                {(availableDateKeys.length
                  ? availableDateKeys
                  : [selectedDateKey || todayKey]
                ).map((dateKey) => (
                  <option key={dateKey} value={dateKey}>
                    {dateKey}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="inline-flex cursor-pointer items-center rounded bg-[#b41f1f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991919]">
                Import stayovers
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(event) => handleImport(event, "stay-date")}
                />
              </label>
              {isAdmin ? (
                <label className="inline-flex cursor-pointer items-center rounded bg-[#7d1d1d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#661717]">
                  Import naar complete list
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(event) => handleImport(event, "complete-list")}
                  />
                </label>
              ) : null}
            </div>
          </div>

          {status.message ? (
            <div
              className={`rounded border px-3 py-2 text-sm ${
                status.type === "error"
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-green-300 bg-green-50 text-green-700"
              }`}
            >
              {status.message}
            </div>
          ) : null}

          <div className="rounded border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
              <button
                type="button"
                onClick={() => setActiveList("to-change")}
                className={`rounded px-3 py-1 text-sm font-semibold ${
                  activeList === "to-change"
                    ? "bg-[#b41f1f] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                To Change
              </button>
              <button
                type="button"
                onClick={() => setActiveList("is-changed")}
                className={`rounded px-3 py-1 text-sm font-semibold ${
                  activeList === "is-changed"
                    ? "bg-[#b41f1f] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Is Changed
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { label: "Reservation Number", key: "reservationNumber" },
                      { label: "Market Code", key: "marketCode" },
                      { label: "Adults", key: "adults" },
                      { label: "Arrival", key: "dateOfArrival" },
                      { label: "Departure", key: "dateOfDeparture" },
                      { label: "Packages", key: "addedPackages" },
                    ].map((column) => (
                      <th
                        key={column.key}
                        className="px-4 py-3 text-left font-semibold text-gray-700"
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-gray-900"
                          onClick={() => handleSort(column.key)}
                        >
                          {column.label}
                          {sortConfig.key === column.key
                            ? sortConfig.direction === "asc"
                              ? "↑"
                              : "↓"
                            : "↕"}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedFilteredRows.length ? (
                    sortedFilteredRows.map((row) => {
                      const packages = Array.isArray(row.addedPackages)
                        ? row.addedPackages
                        : [];
                      return (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                          onClick={() =>
                            setConfirmReservation({
                              row,
                              nextIsChanged: activeList === "to-change",
                            })
                          }
                        >
                          <td className="px-4 py-3">
                            {row.reservationNumber || row.id}
                          </td>
                          <td className="px-4 py-3">{row.marketCode || "-"}</td>
                          <td className="px-4 py-3">{row.adults ?? 0}</td>
                          <td className="px-4 py-3">
                            {row.dateOfArrival || "-"}
                          </td>
                          <td className="px-4 py-3">
                            {row.dateOfDeparture || "-"}
                          </td>
                          <td className="px-4 py-3">
                            {packages.join(", ") || "-"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        className="px-4 py-6 text-center text-gray-500"
                        colSpan={6}
                      >
                        {activeList === "to-change"
                          ? "Geen reservaties gevonden met To Change = true en Is Changed = false."
                          : "Geen reservaties gevonden met Is Changed = true."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {confirmReservation ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-md rounded bg-white p-4 shadow-lg">
                <h3 className="text-base font-semibold text-gray-900">
                  Bevestig wijziging
                </h3>
                <p className="mt-2 text-sm text-gray-700">
                  {confirmReservation.nextIsChanged
                    ? "Is de rate in deze reservatie gerebate en vervangen door een 6% versie?"
                    : "Wil je deze reservatie terugzetten naar de To Change lijst?"}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setConfirmReservation(null)}
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    className="rounded bg-[#b41f1f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#991919]"
                    onClick={handleConfirmChanged}
                  >
                    Bevestigen
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isSettingsOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-2xl rounded bg-white p-4 shadow-lg">
                <h3 className="text-base font-semibold text-gray-900">
                  Package tracking settings
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Definieer welke packages je wil tracken voor VAT en kies prijs
                  per adult of per reservatie.
                </p>

                <div className="mt-4 space-y-3">
                  {trackedPackages.length ? (
                    trackedPackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="grid gap-2 rounded border border-gray-200 p-3 md:grid-cols-12"
                      >
                        <input
                          type="text"
                          placeholder="Package naam"
                          className="rounded border border-gray-300 px-3 py-2 text-sm md:col-span-4"
                          value={pkg.name}
                          onChange={(event) =>
                            updateTrackedPackages((prev) =>
                              prev.map((item) =>
                                item.id === pkg.id
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price"
                          className="rounded border border-gray-300 px-3 py-2 text-sm md:col-span-3"
                          value={pkg.price}
                          onChange={(event) =>
                            updateTrackedPackages((prev) =>
                              prev.map((item) =>
                                item.id === pkg.id
                                  ? { ...item, price: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <select
                          className="rounded border border-gray-300 px-3 py-2 text-sm md:col-span-3"
                          value={pkg.type}
                          onChange={(event) =>
                            updateTrackedPackages((prev) =>
                              prev.map((item) =>
                                item.id === pkg.id
                                  ? { ...item, type: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="perAdult">Per Adult</option>
                          <option value="perReservation">
                            Per Reservation
                          </option>
                        </select>
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 md:col-span-2"
                          onClick={() =>
                            updateTrackedPackages((prev) =>
                              prev.filter((item) => item.id !== pkg.id),
                            )
                          }
                        >
                          Verwijder
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      Nog geen packages toegevoegd.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() =>
                      updateTrackedPackages((prev) => [
                        ...prev,
                        createTrackedPackage(),
                      ])
                    }
                  >
                    Package toevoegen
                  </button>
                  <button
                    type="button"
                    className="rounded bg-[#b41f1f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#991919]"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    Sluiten
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </PageContainer>
    </>
  );
}
