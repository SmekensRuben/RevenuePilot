import React, { useMemo, useState } from "react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";

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

  const appendContinuation = (line) => {
    if (!currentColumns) {
      return;
    }

    const targetIndex =
      billToIndex >= 0 ? billToIndex : Math.max(currentColumns.length - 1, 0);

    while (currentColumns.length <= targetIndex) {
      currentColumns.push("");
    }

    currentColumns[targetIndex] = `${currentColumns[targetIndex]} ${line}`.trim();
  };

  lines.forEach((line) => {
    if (!line) {
      return;
    }

    if (line.includes("\t")) {
      if (currentColumns) {
        rows.push(normalizeColumns(currentColumns));
      }
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

const buildCsv = (headers, rows) => {
  const escapeValue = (value) => {
    const stringValue = String(value ?? "");
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const headerRow = headers.map(escapeValue).join(",");
  const dataRows = rows.map((row) => row.map(escapeValue).join(","));
  return [headerRow, ...dataRows].join("\r\n");
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
