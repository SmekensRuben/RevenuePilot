import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { useHotelContext } from "../../contexts/HotelContext";
import { auth, collection, db, getDocs, signOut, doc, writeBatch } from "../../firebaseConfig";

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
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;

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
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
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

    const targetIndex = billToIndex >= 0 ? billToIndex : Math.max(currentColumns.length - 1, 0);

    while (currentColumns.length <= targetIndex) {
      currentColumns.push("");
    }

    if (line.includes("\t")) {
      const [addressPart, ...rest] = line.split("\t");
      currentColumns[targetIndex] = `${currentColumns[targetIndex]} ${addressPart}`.trim();
      if (rest.length) {
        currentColumns.push(...rest);
      }
      return;
    }

    currentColumns[targetIndex] = `${currentColumns[targetIndex]} ${line}`.trim();
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
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
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

export default function VatChangeCorrectionPage() {
  const { hotelUid } = useHotelContext();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [completeListSummary, setCompleteListSummary] = useState({ reservations: 0, totalNights: 0 });
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
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

  const loadTodayRows = async () => {
    if (!hotelUid) {
      setRows([]);
      return;
    }

    const todayCollectionRef = collection(
      db,
      `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedPerStayDate/${todayKey}`
    );
    const snapshot = await getDocs(todayCollectionRef);
    const loadedRows = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    loadedRows.sort((a, b) =>
      String(a.reservationNumber || "").localeCompare(String(b.reservationNumber || ""))
    );
    setRows(loadedRows);
  };

  const loadCompleteListSummary = async () => {
    if (!hotelUid) {
      setCompleteListSummary({ reservations: 0, totalNights: 0 });
      return;
    }

    const completeListRef = collection(
      db,
      `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedCompleteList/listOfAllReservations`
    );
    const snapshot = await getDocs(completeListRef);
    const totalNights = snapshot.docs.reduce((sum, docSnap) => {
      const data = docSnap.data() || {};
      const storedNights = Number(data.nights);
      if (Number.isFinite(storedNights) && storedNights > 0) {
        return sum + storedNights;
      }
      return sum + calculateNights(data.dateOfArrival, data.dateOfDeparture);
    }, 0);

    setCompleteListSummary({ reservations: snapshot.size, totalNights });
  };

  useEffect(() => {
    Promise.all([loadTodayRows(), loadCompleteListSummary()]).catch((error) => {
      console.error(error);
      setStatus({ type: "error", message: "Laden van data is mislukt." });
    });
  }, [hotelUid, todayKey]);

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
        setStatus({ type: "error", message: "Geen geldige rijen gevonden in het bestand." });
        return;
      }

      const batch = writeBatch(db);
      let reservationsToChange = new Set();

      if (destination === "stay-date") {
        const completeListRef = collection(
          db,
          `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedCompleteList/listOfAllReservations`
        );
        const completeListSnapshot = await getDocs(completeListRef);
        reservationsToChange = new Set(completeListSnapshot.docs.map((docSnap) => docSnap.id));
      }

      let importedRows = 0;
      parsed.rows.forEach((row) => {
        if (!row.reservationNumber) return;

        const targetPath =
          destination === "complete-list"
            ? `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedCompleteList/listOfAllReservations/${row.reservationNumber}`
            : `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedPerStayDate/${todayKey}/${row.reservationNumber}`;

        const docRef = doc(db, targetPath);
        const shouldMarkToChange =
          destination === "stay-date" && reservationsToChange.has(row.reservationNumber);
        const rowPayload =
          destination === "complete-list"
            ? {
                ...row,
                nights: calculateNights(row.dateOfArrival, row.dateOfDeparture),
              }
            : {
                ...row,
                ...(shouldMarkToChange ? { toChange: true } : {}),
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
          : `arrivalsDetailedPerStayDate/${todayKey}`;
      setStatus({
        type: "success",
        message: `Import gelukt naar ${destinationLabel} (${importedRows} van ${parsed.totalRows} rijen).${skippedInfo}`,
      });

      if (destination === "complete-list") {
        await loadCompleteListSummary();
      } else {
        await loadTodayRows();
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
            <h2 className="text-sm font-semibold text-gray-800">Complete list overzicht</h2>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-700">
              <p>
                Reservaties: <span className="font-semibold">{completeListSummary.reservations}</span>
              </p>
              <p>
                Totaal nights: <span className="font-semibold">{completeListSummary.totalNights}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600">Overzicht voor {todayKey}</p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="inline-flex cursor-pointer items-center rounded bg-[#b41f1f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991919]">
                Import naar today list
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(event) => handleImport(event, "stay-date")}
                />
              </label>
              <label className="inline-flex cursor-pointer items-center rounded bg-[#7d1d1d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#661717]">
                Import naar complete list
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(event) => handleImport(event, "complete-list")}
                />
              </label>
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

          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Reservation Number", "Market Code", "adults", "Packages", "To Change"].map(
                    (header) => (
                      <th key={header} className="px-4 py-3 text-left font-semibold text-gray-700">
                        {header}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => {
                    const packages = Array.isArray(row.addedPackages) ? row.addedPackages : [];
                    return (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-4 py-3">{row.reservationNumber || row.id}</td>
                        <td className="px-4 py-3">{row.marketCode || "-"}</td>
                        <td className="px-4 py-3">{row.adults ?? 0}</td>
                        <td className="px-4 py-3">{packages.join(", ") || "-"}</td>
                        <td className="px-4 py-3">{row.toChange ? "Yes" : "No"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                      Geen reservaties gevonden voor vandaag.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
