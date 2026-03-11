import React, { useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
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
  getDoc,
  setDoc,
} from "../../firebaseConfig";

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

const subtractDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() - days);
  return nextDate;
};

const enumerateDateKeys = (startKey, endKey) => {
  const startDate = parseIsoDate(startKey);
  const endDate = parseIsoDate(endKey);
  if (!startDate || !endDate) return [];

  const [from, to] =
    startDate.getTime() <= endDate.getTime()
      ? [startDate, endDate]
      : [endDate, startDate];

  const keys = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
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

const parseAddedPackageEntry = (value) => {
  const rawValue = String(value || "").trim();
  const offsetMatch = rawValue.match(/^-(\d+)\*(.+)$/);
  if (!offsetMatch) {
    return { normalizedName: normalizePackageName(rawValue), adultOffset: 0 };
  }

  return {
    normalizedName: normalizePackageName(offsetMatch[2]),
    adultOffset: Number(offsetMatch[1]) || 0,
  };
};

export default function BreakfastTrackerPage() {
  const { hotelUid } = useHotelContext();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [trackedPackages, setTrackedPackages] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [pendingRange, setPendingRange] = useState({ start: "", end: "" });
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
    if (!hotelUid || !dateKey) return [];
    const stayDateCollectionRef = collection(
      db,
      `hotels/${hotelUid}/arrivalsDetailed/arrivalsDetailedPerStayDate/${dateKey}`,
    );
    const snapshot = await getDocs(stayDateCollectionRef);
    return snapshot.docs.map((docSnap) => ({
      id: `${dateKey}-${docSnap.id}`,
      stayDateKey: dateKey,
      ...docSnap.data(),
    }));
  };

  const findMostRecentDateWithReservations = async (
    startDate,
    maxDaysToCheck = 365,
  ) => {
    for (let daysBack = 0; daysBack <= maxDaysToCheck; daysBack += 1) {
      const candidateDate = subtractDays(startDate, daysBack);
      const candidateDateKey = formatDateKey(candidateDate);
      const candidateRows = await fetchRowsForDate(candidateDateKey);
      if (candidateRows.length) {
        return candidateDateKey;
      }
    }
    return null;
  };

  const loadRowsForRange = async (startKey, endKey) => {
    const keys = enumerateDateKeys(startKey, endKey);
    if (!keys.length) {
      setRows([]);
      return;
    }

    const rowsPerDate = await Promise.all(keys.map((key) => fetchRowsForDate(key)));
    const mergedRows = rowsPerDate
      .flat()
      .sort((a, b) => String(a.reservationNumber || "").localeCompare(String(b.reservationNumber || "")));
    setRows(mergedRows);
  };

  const loadSettingsAndInitialRows = async () => {
    if (!hotelUid) {
      setRows([]);
      setDateRange({ start: "", end: "" });
      setPendingRange({ start: "", end: "" });
      setTrackedPackages([]);
      return;
    }

    const settingsRef = doc(db, `hotels/${hotelUid}/settings`, hotelUid);
    const settingsSnap = await getDoc(settingsRef);
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const storedPackages = Array.isArray(settings?.breakfastTrackerTrackedPackages)
      ? settings.breakfastTrackerTrackedPackages
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

    const recentDate = await findMostRecentDateWithReservations(parseIsoDate(todayKey) || new Date());
    const selectedDate = recentDate || todayKey;
    const initialRange = { start: selectedDate, end: selectedDate };
    setDateRange(initialRange);
    setPendingRange(initialRange);
    await loadRowsForRange(selectedDate, selectedDate);
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
      { breakfastTrackerTrackedPackages: payload },
      { merge: true },
    );
  };

  const updateTrackedPackages = (updater) => {
    setTrackedPackages((prev) => {
      const nextPackages = typeof updater === "function" ? updater(prev) : updater;
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
    loadSettingsAndInitialRows().catch((error) => {
      console.error(error);
      setStatus({ type: "error", message: "Laden van data is mislukt." });
    });
  }, [hotelUid, todayKey]);

  const todayOverview = useMemo(() => ({ totalReservations: rows.length }), [rows]);

  const trackedPackageTotals = useMemo(() => {
    return trackedPackages
      .map((pkg) => {
        const normalizedName = normalizePackageName(pkg.name);
        if (!normalizedName) return null;
        const unitPrice = Number(pkg.price) || 0;

        const totalIncludedVat = rows.reduce((sum, row) => {
          const rowPackages = Array.isArray(row.addedPackages) ? row.addedPackages : [];
          const adults = Number.isFinite(Number(row.adults)) ? Number(row.adults) : 0;

          const matchingEntries = rowPackages
            .map((item) => parseAddedPackageEntry(item))
            .filter((entry) => entry.normalizedName === normalizedName);

          if (!matchingEntries.length) return sum;

          if (pkg.type === "perReservation") return sum + unitPrice;

          const effectiveAdultOffset = Math.max(
            ...matchingEntries.map((entry) => entry.adultOffset),
          );
          const packageUnits = Math.max(adults - effectiveAdultOffset, 0);

          return sum + unitPrice * packageUnits;
        }, 0);

        return { ...pkg, totalIncludedVat };
      })
      .filter(Boolean);
  }, [trackedPackages, rows]);

  const sortedRows = useMemo(() => {
    const getSortValue = (row) => {
      if (sortConfig.key === "adults") return Number(row.adults) || 0;
      if (sortConfig.key === "fullName") return String(row.fullName || "").toLowerCase();
      if (sortConfig.key === "stayDateKey") return parseIsoDate(row.stayDateKey)?.getTime() || 0;
      if (sortConfig.key === "dateOfArrival" || sortConfig.key === "dateOfDeparture") {
        return parseIsoDate(row[sortConfig.key])?.getTime() || 0;
      }
      if (sortConfig.key === "addedPackages") {
        return (Array.isArray(row.addedPackages) ? row.addedPackages : []).join(", ").toLowerCase();
      }
      return String(row[sortConfig.key] || row.id || "").toLowerCase();
    };

    return [...rows].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((previous) =>
      previous.key === key
        ? { key, direction: previous.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const applyDateRangeFilter = async () => {
    if (!pendingRange.start || !pendingRange.end) {
      setStatus({ type: "error", message: "Selecteer een start- en einddatum." });
      return;
    }

    const nextRange = { start: pendingRange.start, end: pendingRange.end };
    setDateRange(nextRange);
    setIsRangePickerOpen(false);
    await loadRowsForRange(nextRange.start, nextRange.end);
  };

  return (
    <>
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer title="Breakfast Tracker">
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Today's Overview</h2>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-700">
                  <p>
                    Reservations: <span className="font-semibold">{todayOverview.totalReservations}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Open package settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1 text-sm text-gray-700">
              {trackedPackageTotals.length ? (
                trackedPackageTotals.map((pkg) => (
                  <p key={pkg.id || pkg.name}>
                    {pkg.name} Total Included Vat: <span className="font-semibold">€ {pkg.totalIncludedVat.toFixed(2)}</span>
                  </p>
                ))
              ) : (
                <p className="text-gray-500">Geen package tracking ingesteld.</p>
              )}
            </div>
          </div>

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600">Overzicht voor</p>
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setIsRangePickerOpen((prev) => !prev)}
              >
                {dateRange.start && dateRange.end
                  ? `${dateRange.start} t.e.m. ${dateRange.end}`
                  : "Selecteer range"}
              </button>
            </div>
            {isRangePickerOpen ? (
              <div className="absolute left-0 top-10 z-20 w-full max-w-md rounded border border-gray-200 bg-white p-3 shadow-lg">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-gray-700">
                    Van
                    <input
                      type="date"
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      value={pendingRange.start}
                      onChange={(event) =>
                        setPendingRange((prev) => ({ ...prev, start: event.target.value }))
                      }
                    />
                  </label>
                  <label className="text-sm text-gray-700">
                    Tot
                    <input
                      type="date"
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      value={pendingRange.end}
                      onChange={(event) =>
                        setPendingRange((prev) => ({ ...prev, end: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsRangePickerOpen(false)}
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    className="rounded bg-[#b41f1f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#991919]"
                    onClick={applyDateRangeFilter}
                  >
                    Filter
                  </button>
                </div>
              </div>
            ) : null}
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { label: "Stay Date", key: "stayDateKey" },
                      { label: "Reservation Number", key: "reservationNumber" },
                      { label: "Name", key: "fullName" },
                      { label: "Market Code", key: "marketCode" },
                      { label: "Adults", key: "adults" },
                      { label: "Arrival", key: "dateOfArrival" },
                      { label: "Departure", key: "dateOfDeparture" },
                      { label: "Packages", key: "addedPackages" },
                    ].map((column) => (
                      <th key={column.key} className="px-4 py-3 text-left font-semibold text-gray-700">
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
                  {sortedRows.length ? (
                    sortedRows.map((row) => {
                      const packages = Array.isArray(row.addedPackages) ? row.addedPackages : [];
                      return (
                        <tr key={row.id} className="border-t border-gray-100">
                          <td className="px-4 py-3">{row.stayDateKey || "-"}</td>
                          <td className="px-4 py-3">{row.reservationNumber || row.id}</td>
                          <td className="px-4 py-3">{row.fullName || "-"}</td>
                          <td className="px-4 py-3">{row.marketCode || "-"}</td>
                          <td className="px-4 py-3">{row.adults ?? 0}</td>
                          <td className="px-4 py-3">{row.dateOfArrival || "-"}</td>
                          <td className="px-4 py-3">{row.dateOfDeparture || "-"}</td>
                          <td className="px-4 py-3">{packages.join(", ") || "-"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={8}>
                        Geen reservaties gevonden voor de geselecteerde range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {isSettingsOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-2xl rounded bg-white p-4 shadow-lg">
                <h3 className="text-base font-semibold text-gray-900">Package tracking settings</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Definieer welke packages je wil tracken voor VAT en kies prijs per adult of per reservatie.
                </p>

                <div className="mt-4 space-y-3">
                  {trackedPackages.length ? (
                    trackedPackages.map((pkg) => (
                      <div key={pkg.id} className="grid gap-2 rounded border border-gray-200 p-3 md:grid-cols-12">
                        <input
                          type="text"
                          placeholder="Package naam"
                          className="rounded border border-gray-300 px-3 py-2 text-sm md:col-span-4"
                          value={pkg.name}
                          onChange={(event) =>
                            updateTrackedPackages((prev) =>
                              prev.map((item) =>
                                item.id === pkg.id ? { ...item, name: event.target.value } : item,
                              ),
                            )
                          }
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Prijs"
                          className="rounded border border-gray-300 px-3 py-2 text-sm md:col-span-3"
                          value={pkg.price}
                          onChange={(event) =>
                            updateTrackedPackages((prev) =>
                              prev.map((item) =>
                                item.id === pkg.id ? { ...item, price: event.target.value } : item,
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
                                item.id === pkg.id ? { ...item, type: event.target.value } : item,
                              ),
                            )
                          }
                        >
                          <option value="perAdult">Per adult</option>
                          <option value="perReservation">Per reservatie</option>
                        </select>
                        <button
                          type="button"
                          className="rounded border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 md:col-span-2"
                          onClick={() =>
                            updateTrackedPackages((prev) => prev.filter((item) => item.id !== pkg.id))
                          }
                        >
                          Verwijder
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Nog geen packages ingesteld.</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    onClick={() => updateTrackedPackages((prev) => [...prev, createTrackedPackage()])}
                  >
                    Package toevoegen
                  </button>
                  <button
                    type="button"
                    className="rounded bg-[#b41f1f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#991919]"
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
