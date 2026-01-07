import React, { useMemo, useState } from "react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { useHotelContext } from "../../contexts/HotelContext";
import { auth, db, doc, signOut, writeBatch } from "../../firebaseConfig";

const normalizeArrivalFile = (rawText) => {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const headerLine = lines.shift();

  if (!headerLine) {
    return null;
  }

  const headers = headerLine.split("\t");
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

  const sanitizeBillToAddress = (columns) => {
    if (billToIndex < 0) {
      return columns;
    }

    const sanitized = [...columns];
    sanitized[billToIndex] = String(sanitized[billToIndex] ?? "").replace(
      /[\r\n]+/g,
      " "
    );
    return sanitized;
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
      currentColumns[targetIndex] = `${currentColumns[targetIndex]} ${addressPart}`.trim();
      if (rest.length) {
        const startIndex = targetIndex + 1;
        while (currentColumns.length < startIndex) {
          currentColumns.push("");
        }
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
      if (currentColumns) {
        rows.push(sanitizeBillToAddress(normalizeColumns(currentColumns)));
      }
      currentColumns = line.split("\t");
      return;
    }

    appendContinuation(line);
  });

  if (currentColumns) {
    rows.push(sanitizeBillToAddress(normalizeColumns(currentColumns)));
  }

  return { headers, rows };
};

const buildCsv = (headers, rows) => {
  const escapeValue = (value) => {
    const stringValue = String(value ?? "");
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const headerRow = headers.map(escapeValue).join(",");
  const dataRows = rows.map((row) => row.map(escapeValue).join(","));
  return [headerRow, ...dataRows].join("\r\n");
};

const buildArrivalRecords = (headers, rows) => {
  const indexMap = headers.reduce((acc, header, index) => {
    acc[header] = index;
    return acc;
  }, {});

  const getValue = (row, header) => {
    const index = indexMap[header];
    if (index === undefined) {
      return "";
    }
    return row[index] ?? "";
  };

  const normalizeDateKey = (value) =>
    String(value ?? "")
      .trim()
      .replace(/[\\/]/g, "-");

  return rows
    .map((row) => {
      const arrivalDate = String(getValue(row, "TRUNC_BEGIN")).trim();
      const dateKey = normalizeDateKey(arrivalDate);
      const reservationId = String(getValue(row, "RESV_NAME_ID")).trim();

      if (!dateKey || !reservationId) {
        return null;
      }

      const products = String(getValue(row, "PRODUCTS"))
        .split(",")
        .map((product) => product.trim())
        .filter(Boolean);

      return {
        dateKey,
        reservationId,
        data: {
          roomNr: String(getValue(row, "DISP_ROOM_NO")).trim(),
          arrivalDate,
          departureDate: String(getValue(row, "TRUNC_END")).trim(),
          products,
          rateCode: String(getValue(row, "RATE_CODE")).trim(),
        },
      };
    })
    .filter(Boolean);
};

const downloadFile = (contents, filename) => {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function ArrivalConverterPage() {
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [summary, setSummary] = useState(null);
  const { hotelUid } = useHotelContext();

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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setStatus({ type: "loading", message: "Bestand verwerken..." });
    setSummary(null);

    try {
      const rawText = await file.text();
      const parsed = normalizeArrivalFile(rawText);

      if (!parsed) {
        setStatus({ type: "error", message: "Het bestand bevat geen data." });
        return;
      }

      const csvContents = buildCsv(parsed.headers, parsed.rows);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const outputName = `${baseName || "arrival-converter"}-corrected.csv`;
      downloadFile(csvContents, outputName);

      if (hotelUid) {
        const arrivalRecords = buildArrivalRecords(parsed.headers, parsed.rows);
        if (arrivalRecords.length) {
          const batch = writeBatch(db);
          arrivalRecords.forEach(({ dateKey, reservationId, data }) => {
            const recordRef = doc(
              db,
              `hotels/${hotelUid}/arrivalsDetailedPackages`,
              dateKey,
              "reservations",
              reservationId
            );
            batch.set(recordRef, data, { merge: true });
          });
          await batch.commit();
        }
      }

      setSummary({ rows: parsed.rows.length, columns: parsed.headers.length });
      setStatus({ type: "success", message: "Bestand is verwerkt en gedownload." });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Het verwerken van het bestand is mislukt." });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">Tools</p>
          <h1 className="text-3xl font-semibold">Arrival converter</h1>
          <p className="text-gray-600 mt-2 max-w-3xl">
            Upload het tab-gescheiden arrival bestand. We herstellen records waarbij de
            BILL_TO_ADDRESS meerdere regels bevat en leveren een correct CSV-bestand dat
            direct in Excel geopend kan worden.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Bestand uploaden</h2>
              <p className="text-sm text-gray-600">
                Kies het originele exportbestand (tab-gescheiden). Na upload start de download.
              </p>
            </div>
            <label className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#b41f1f] text-white font-semibold cursor-pointer hover:bg-[#9c1a1a]">
              CSV uploaden
              <input
                type="file"
                accept=".csv,.tsv,text/plain"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {status.type !== "idle" && (
            <div
              className={`text-sm rounded-md px-3 py-2 border ${
                status.type === "error"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : status.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              {status.message}
            </div>
          )}

          {summary && (
            <div className="text-sm text-gray-600">
              Verwerkte rijen: <span className="font-semibold">{summary.rows}</span> · Kolommen:
              <span className="font-semibold"> {summary.columns}</span>
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
