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

  useEffect(() => {
    loadTodayRows().catch((error) => {
      console.error(error);
      setStatus({ type: "error", message: "Laden van data is mislukt." });
    });
  }, [hotelUid, todayKey]);

  const handleImport = async (event) => {
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
      let importedRows = 0;
      parsed.rows.forEach((row) => {
        if (!row.reservationNumber) return;
        const docRef = doc(
          db,
          `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedPerStayDate/${todayKey}/${row.reservationNumber}`
        );
        batch.set(docRef, row, { merge: true });
        importedRows += 1;
      });
      await batch.commit();

      const skippedInfo = parsed.skippedMarketCode
        ? ` (${parsed.skippedMarketCode} rij(en) met lege MARKET_CODE overgeslagen)`
        : "";
      setStatus({
        type: "success",
        message: `Import gelukt (${importedRows} van ${parsed.totalRows} rijen).${skippedInfo}`,
      });
      await loadTodayRows();
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Overzicht voor {todayKey}</p>
            <label className="inline-flex cursor-pointer items-center rounded bg-[#b41f1f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991919]">
              Import tab-gescheiden CSV
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImport} />
            </label>
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
                  {["Reservation Number", "Market Code", "adults", "Packages", "12% Breakfast"].map(
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
                    const includesBreakfast = packages.some(
                      (item) => String(item).trim().toLowerCase() === "12% breakfast"
                    );
                    return (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-4 py-3">{row.reservationNumber || row.id}</td>
                        <td className="px-4 py-3">{row.marketCode || "-"}</td>
                        <td className="px-4 py-3">{row.adults ?? 0}</td>
                        <td className="px-4 py-3">{packages.join(", ") || "-"}</td>
                        <td className="px-4 py-3">{includesBreakfast ? "Yes" : "No"}</td>
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
