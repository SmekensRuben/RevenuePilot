import React, { useMemo, useState } from "react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  auth,
  collection,
  db,
  doc,
  getDocs,
  orderBy,
  query,
  signOut,
  writeBatch,
} from "../../firebaseConfig";

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

const MONTHS = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

const parseArrivalDate = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parts = normalized.split("-");
  if (parts.length === 3) {
    const [dayPart, monthPart, yearPart] = parts;
    const monthIndex = MONTHS[monthPart?.toUpperCase()];
    const day = Number(dayPart);
    const year = Number(yearPart?.length === 2 ? `20${yearPart}` : yearPart);
    if (Number.isFinite(day) && Number.isFinite(year) && monthIndex !== undefined) {
      return new Date(year, monthIndex, day);
    }
  }

  return null;
};

export default function ArrivalConverterPage() {
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [summary, setSummary] = useState(null);
  const [searchStatus, setSearchStatus] = useState({
    type: "idle",
    message: "",
  });
  const [productSummary, setProductSummary] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
      console.debug("ArrivalConverter: No file selected.");
      return;
    }

    setStatus({ type: "loading", message: "Bestand verwerken..." });
    setSummary(null);

    try {
      if (!hotelUid) {
        console.debug("ArrivalConverter: Missing hotelUid.");
        setStatus({ type: "error", message: "Selecteer eerst een hotel." });
        return;
      }

      console.debug("ArrivalConverter: Processing file.", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        hotelUid,
      });
      const rawText = await file.text();
      console.debug("ArrivalConverter: File loaded.", {
        characters: rawText.length,
      });
      const parsed = normalizeArrivalFile(rawText);

      if (!parsed) {
        console.debug("ArrivalConverter: No parsed data from file.");
        setStatus({ type: "error", message: "Het bestand bevat geen data." });
        return;
      }

      const arrivalRecords = buildArrivalRecords(parsed.headers, parsed.rows);
      console.debug("ArrivalConverter: Parsed records.", {
        headers: parsed.headers,
        rows: parsed.rows.length,
        records: arrivalRecords.length,
      });
      if (arrivalRecords.length) {
        const batch = writeBatch(db);
        arrivalRecords.forEach(({ dateKey, reservationId, data }) => {
          console.debug("ArrivalConverter: Writing record.", {
            dateKey,
            reservationId,
            arrivalDate: data.arrivalDate,
            products: data.products?.length || 0,
          });
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
        console.debug("ArrivalConverter: Batch write committed.", {
          records: arrivalRecords.length,
        });
      }

      setSummary({ rows: parsed.rows.length, columns: parsed.headers.length });
      setStatus({ type: "success", message: "Bestand is verwerkt en opgeslagen." });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Het verwerken van het bestand is mislukt." });
    }
  };

  const handleSearch = async () => {
    if (!hotelUid) {
      console.debug("ArrivalConverter: Missing hotelUid on search.");
      setSearchStatus({ type: "error", message: "Selecteer eerst een hotel." });
      return;
    }

    if (!startDate || !endDate) {
      console.debug("ArrivalConverter: Missing date range.", {
        startDate,
        endDate,
      });
      setSearchStatus({
        type: "error",
        message: "Vul een begin- en einddatum in.",
      });
      return;
    }

    if (startDate > endDate) {
      console.debug("ArrivalConverter: Invalid date range.", {
        startDate,
        endDate,
      });
      setSearchStatus({
        type: "error",
        message: "De begindatum moet vóór de einddatum liggen.",
      });
      return;
    }

    const rangeStart = parseArrivalDate(startDate);
    const rangeEnd = parseArrivalDate(endDate);
    if (!rangeStart || !rangeEnd) {
      console.debug("ArrivalConverter: Unable to parse date range.", {
        startDate,
        endDate,
        rangeStart,
        rangeEnd,
      });
      setSearchStatus({
        type: "error",
        message: "De datums konden niet worden gelezen.",
      });
      return;
    }
    rangeEnd.setHours(23, 59, 59, 999);

    console.info("ArrivalConverter: Searching product overview.", {
      hotelUid,
      startDate,
      endDate,
      rangeStart,
      rangeEnd,
    });
    setSearchStatus({ type: "loading", message: "Overzicht ophalen..." });
    setProductSummary([]);

    try {
      const arrivalsRef = collection(
        db,
        `hotels/${hotelUid}/arrivalsDetailedPackages`
      );
      const arrivalsQuery = query(arrivalsRef, orderBy("__name__"));
      const arrivalsSnapshot = await getDocs(arrivalsQuery);
      console.info("ArrivalConverter: Loaded arrival date documents.", {
        total: arrivalsSnapshot.size,
      });
      const totals = new Map();

      await Promise.all(
        arrivalsSnapshot.docs.map(async (arrivalDoc) => {
          const arrivalDateKey = arrivalDoc.id;
          const arrivalDateFromKey = parseArrivalDate(arrivalDateKey);
          if (
            !arrivalDateFromKey ||
            arrivalDateFromKey < rangeStart ||
            arrivalDateFromKey > rangeEnd
          ) {
            console.info("ArrivalConverter: Skipping arrival date.", {
              arrivalDateKey,
              arrivalDateFromKey,
            });
            return;
          }

          console.info("ArrivalConverter: Using arrival date.", {
            arrivalDateKey,
            arrivalDateFromKey,
          });
          console.info("ArrivalConverter: Fetching reservations.", {
            arrivalDateKey,
          });
          const reservationsRef = collection(
            db,
            `hotels/${hotelUid}/arrivalsDetailedPackages`,
            arrivalDateKey,
            "reservations"
          );
          const reservationsSnapshot = await getDocs(reservationsRef);
          console.info("ArrivalConverter: Reservations loaded.", {
            arrivalDateKey,
            count: reservationsSnapshot.size,
          });
          let includedReservations = 0;
          let excludedReservations = 0;
          let productsCounted = 0;
          reservationsSnapshot.forEach((reservationDoc) => {
            const data = reservationDoc.data();
            const arrivalDateValue = parseArrivalDate(data.arrivalDate);
            if (!arrivalDateValue || arrivalDateValue < rangeStart || arrivalDateValue > rangeEnd) {
              excludedReservations += 1;
              console.info("ArrivalConverter: Skipping reservation.", {
                arrivalDateKey,
                reservationId: reservationDoc.id,
                arrivalDateValue,
              });
              return;
            }

            includedReservations += 1;
            (data.products || []).forEach((product) => {
              const label = String(product || "").trim();
              if (!label) return;
              totals.set(label, (totals.get(label) || 0) + 1);
              productsCounted += 1;
            });
          });
          console.info("ArrivalConverter: Reservations processed.", {
            arrivalDateKey,
            includedReservations,
            excludedReservations,
            productsCounted,
          });
        })
      );

      const summaryItems = Array.from(totals.entries())
        .map(([product, count]) => ({ product, count }))
        .sort((a, b) => b.count - a.count);

      console.info("ArrivalConverter: Product summary built.", {
        items: summaryItems.length,
        totals: summaryItems,
      });
      setProductSummary(summaryItems);
      setSearchStatus({
        type: "success",
        message: "Overzicht geladen.",
      });
    } catch (error) {
      console.error(error);
      setSearchStatus({
        type: "error",
        message: "Het ophalen van het overzicht is mislukt.",
      });
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
            BILL_TO_ADDRESS meerdere regels bevat en slaan de data op per reservatie.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Bestand uploaden</h2>
              <p className="text-sm text-gray-600">
                Kies het originele exportbestand (tab-gescheiden). Na upload wordt het opgeslagen.
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

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Productoverzicht</h2>
            <p className="text-sm text-gray-600">
              Kies een periode om alle producten te tellen op basis van de arrivalDate.
              Vertrekdagen worden niet meegeteld.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex flex-col text-sm text-gray-600">
              Begindatum
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>
            <label className="flex flex-col text-sm text-gray-600">
              Einddatum
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-gray-900"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSearch}
                className="px-4 py-2 rounded-md bg-[#b41f1f] text-white font-semibold hover:bg-[#9c1a1a]"
              >
                Search
              </button>
            </div>
          </div>

          {searchStatus.type !== "idle" && (
            <div
              className={`text-sm rounded-md px-3 py-2 border ${
                searchStatus.type === "error"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : searchStatus.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              {searchStatus.message}
            </div>
          )}

          {productSummary.length ? (
            <div className="overflow-hidden border border-gray-200 rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Product</th>
                    <th className="text-right px-4 py-2 font-semibold">Aantal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productSummary.map((item) => (
                    <tr key={item.product}>
                      <td className="px-4 py-2 text-gray-900">{item.product}</td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {item.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            searchStatus.type === "success" && (
              <div className="text-sm text-gray-600">
                Geen producten gevonden binnen deze periode.
              </div>
            )
          )}
        </div>
      </PageContainer>
    </div>
  );
}
