import React, { useEffect, useMemo, useRef, useState } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { getOutlets } from "services/firebaseSettings";
import { getRevenue, setRevenue } from "services/firebaseRevenue";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import AccordionCard from "../settings/cards/AccordionCard";
import * as XLSX from "xlsx";
import { parseLocalizedNumber } from "utils/numberUtils";
import { usePermission } from "../../hooks/usePermission";

/**
 * RevenueCenterPage
 * - Linkerzijde: Overzicht laatste 14 dagen (status + totals) + kleine trendcharts
 * - Rechterzijde: Dagelijkse invoer per suboutlet (bedrag)
*/
export default function RevenueCenterPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { t } = useTranslation("revenuecenter");

  const canCreateRevenue = usePermission("revenuecenter", "create");
  const canEditRevenue = usePermission("revenuecenter", "edit");
  const canDeleteRevenue = usePermission("revenuecenter", "delete");
  const canModifyRevenue = canCreateRevenue || canEditRevenue || canDeleteRevenue;

  const [outlets, setOutlets] = useState([]);
  const subOutlets = useMemo(
    () =>
      outlets.flatMap((o) =>
        (o.subOutlets || []).map((s) => ({ ...s, outlet: o.name }))
      ),
    [outlets]
  );
  // Format Date to YYYY-MM-DD in local time
  const ymd = (d) => {
    const date = new Date(d);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  };
  const [date, setDate] = useState(() => ymd(new Date()));
  const [revenues, setRevenues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [historyRows, setHistoryRows] = useState([]); // [{date, status, totalFood, totalBeverage, data}]
  const [loadingHistory, setLoadingHistory] = useState(false);
  const todayISO = ymd(new Date());
  const firstOfMonth = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayISO);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [selectedSubOutlet, setSelectedSubOutlet] = useState("");
  const [typeFilter, setTypeFilter] = useState("both");
  const fileInputRef = useRef(null);

  // Pretty "today" label for HeaderBar (English, long form)
  const todayHeader = useMemo(() => new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }), []);

  // Fetch outlets once
  useEffect(() => {
    let mounted = true;
    getOutlets(hotelUid).then((res) => {
      if (!mounted) return;
      const outs = (res || []).filter(
        (o) => o.department && o.department.toUpperCase() === "F&B"
      );
      setOutlets(outs);
    });
    return () => {
      mounted = false;
    };
  }, [hotelUid]);

  // Fetch current-day revenue (form)
  useEffect(() => {
    let mounted = true;
    getRevenue(hotelUid, date).then(data => mounted && setRevenues(data || {}));
    return () => { mounted = false; };
  }, [hotelUid, date]);

  // Fetch overview whenever parameters change
  useEffect(() => {
    if (!hotelUid) return;
    fetchHistory(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelUid, subOutlets.length, startDate, endDate]);

  // Helpers
  const dateRange = (from, to) => {
    const days = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      days.push(ymd(dt));
    }
    return days;
  };

  const subOutletTypeMap = useMemo(() => {
    const map = {};
    subOutlets.forEach((s) => {
      map[s.name] = s.type;
    });
    return map;
  }, [subOutlets]);

  const subOutletNames = useMemo(() => subOutlets.map((o) => o.name), [subOutlets]);

  const computeTotals = (revObj) => {
    let totalFood = 0;
    let totalBeverage = 0;
    if (revObj && typeof revObj === "object") {
      Object.entries(revObj).forEach(([name, value]) => {
        const num = Number(value || 0);
        if (Number.isNaN(num)) return;
        const t = subOutletTypeMap[name];
        if (t === "food") totalFood += num;
        if (t === "beverage") totalBeverage += num;
      });
    }
    return { totalFood, totalBeverage };
  };

  const computeStatus = (revObj) => {
    if (!revObj || Object.keys(revObj).length === 0) return "empty"; // ❌
    let hasAny = false;
    let allZero = true;
    Object.values(revObj).forEach((val) => {
      const n = Number(val || 0);
      if (n > 0) {
        hasAny = true;
        allZero = false;
      }
    });
    if (!hasAny && allZero) return "empty";
    const completeForAll =
      subOutletNames.length > 0 && subOutletNames.every((name) => revObj[name] !== undefined);
    return completeForAll ? "filled" : "partial";
  };

  const fetchHistory = async (from, to) => {
    setLoadingHistory(true);
    const days = dateRange(from, to);
    const results = await Promise.all(days.map(d => getRevenue(hotelUid, d)));
    const rows = days.map((d, idx) => {
      const rev = results[idx] || {};
      const { totalFood, totalBeverage } = computeTotals(rev);
      const status = computeStatus(rev);
      return { date: d, status, totalFood, totalBeverage, data: rev };
    });
    setHistoryRows(rows);
    setLoadingHistory(false);
  };

  // Form handlers
  const handleChange = (subName, value) => {
    if (!canModifyRevenue) return;
    setRevenues((prev) => ({
      ...prev,
      [subName]: value,
    }));
  };

  const handleSave = async () => {
    if (!canModifyRevenue) return;
    setSaving(true);
    setSaveOk(false);
    await setRevenue(hotelUid, date, revenues);
    setSaving(false);
    setSaveOk(true);
    fetchHistory(startDate, endDate); // refresh overview
  };

  const handleImport = async (e) => {
    if (!canModifyRevenue) {
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    console.debug("Starting import for file", file.name);
    setSaving(true);
    setSaveOk(false);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets["Income Journal"];
      if (!sheet) {
        throw new Error('Sheet "Income Journal" not found');
      }
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      console.debug("Parsed", rows.length, "rows from file");
      const imported = {};
      rows.forEach((row, idx) => {
        const code = row[0];
        const amount = parseLocalizedNumber(row[4]);
        if (!code || Number.isNaN(amount)) {
          console.warn("Skipping row", idx, "invalid code or amount", row);
          return;
        }
        const match = subOutlets.find((s) => s.a3MappingCode === code);
        if (match) {
          imported[match.name] = amount;
        } else {
          console.warn("No suboutlet matched for code", code);
        }
      });
      console.debug("Imported data", imported);
      const merged = { ...revenues, ...imported };
      setRevenues(merged);
      await setRevenue(hotelUid, date, merged);
      console.debug("setRevenue called", { hotelUid, date, merged });
      setSaveOk(true);
      fetchHistory(startDate, endDate);
    } catch (err) {
      console.error("Error during revenue import", err);
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  };

  const outletSubOutletNames = useMemo(() => {
    const map = {};
    outlets.forEach((o) => {
      map[o.name] = (o.subOutlets || []).map((s) => s.name);
    });
    return map;
  }, [outlets]);

  // Derived chart data based on filters
  const chartData = useMemo(
    () =>
      historyRows.map((r) => {
        let f = 0;
        let b = 0;
        if (selectedSubOutlet) {
          const val = Number(r.data?.[selectedSubOutlet] || 0);
          const t = subOutletTypeMap[selectedSubOutlet];
          if (t === "food") f = val;
          if (t === "beverage") b = val;
        } else if (selectedOutlet) {
          const subs = outletSubOutletNames[selectedOutlet] || [];
          subs.forEach((name) => {
            const val = Number(r.data?.[name] || 0);
            const t = subOutletTypeMap[name];
            if (t === "food") f += val;
            if (t === "beverage") b += val;
          });
        } else {
          f = r.totalFood;
          b = r.totalBeverage;
        }
        const obj = { date: r.date.slice(5) };
        if (typeFilter !== "beverage") obj.Food = f;
        if (typeFilter !== "food") obj.Beverage = b;
        return obj;
      }),
    [
      historyRows,
      selectedOutlet,
      selectedSubOutlet,
      typeFilter,
      subOutletTypeMap,
      outletSubOutletNames,
    ]
  );

  return (
    <>
      <HeaderBar hotelName={hotelName} today={todayHeader} />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
          {t("title", "Revenue Center")}
        </h1>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="text-sm font-medium">{t("outlet", "Outlet")}</label>
            <select
              className="border rounded-md px-2 py-1"
              value={selectedOutlet}
              onChange={(e) => {
                setSelectedOutlet(e.target.value);
                setSelectedSubOutlet("");
              }}
            >
              <option value="">{t("allOutlets", "All outlets")}</option>
              {outlets.map((ot) => (
                <option key={ot.name} value={ot.name}>
                  {ot.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">{t("subOutlet", "Suboutlet")}</label>
            <select
              className="border rounded-md px-2 py-1"
              value={selectedSubOutlet}
              onChange={(e) => setSelectedSubOutlet(e.target.value)}
              disabled={!selectedOutlet}
            >
              <option value="">{t("allSubOutlets", "All suboutlets")}</option>
              {(outlets.find((o) => o.name === selectedOutlet)?.subOutlets || []).map(
                (s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">{t("type", "Type")}</label>
            <select
              className="border rounded-md px-2 py-1"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="both">{t("foodAndBeverage", "Food & Beverage")}</option>
              <option value="food">{t("food", "Food")}</option>
              <option value="beverage">{t("beverage", "Beverage")}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">{t("from", "From")}</label>
            <input
              type="date"
              className="border rounded-md px-2 py-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("to", "To")}</label>
            <input
              type="date"
              className="border rounded-md px-2 py-1"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Charts */}
        <div className="rounded-2xl border shadow-sm p-4 mb-6">
          <h3 className="text-base font-semibold mb-3">{t("trend", "Trend")}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {typeFilter !== "beverage" && <Line type="monotone" dataKey="Food" stroke="#dc2626" strokeWidth={2} />}
                {typeFilter !== "food" && <Line type="monotone" dataKey="Beverage" stroke="#2563eb" strokeWidth={2} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {typeFilter !== "beverage" && <Bar dataKey="Food" fill="#dc2626" />}
                {typeFilter !== "food" && <Bar dataKey="Beverage" fill="#2563eb" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overview */}
        <AccordionCard title={t("overview", "Overview")} defaultOpen={false}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{t("overview", "Overview")}</h2>
            <button
              className="text-sm underline"
              onClick={() => fetchHistory(startDate, endDate)}
              disabled={loadingHistory}
            >
              {loadingHistory ? t("loading", "Loading…") : t("refresh", "Refresh")}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-2 px-2">{t("date", "Date")}</th>
                  <th className="py-2 px-2">{t("status", "Status")}</th>
                  <th className="py-2 px-2 text-right">{t("totalFood", "Total Food")}</th>
                  <th className="py-2 px-2 text-right">{t("totalBeverage", "Total Beverage")}</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.date} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setDate(row.date)}>
                    <td className="py-2 px-2 font-medium">{row.date}</td>
                    <td className="py-2 px-2">
                      {row.status === "filled" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs">✅ {t("filled", "Filled")}</span>
                      )}
                      {row.status === "partial" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs">⚠️ {t("partial", "Partial")}</span>
                      )}
                      {row.status === "empty" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-xs">❌ {t("empty", "Empty")}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">{row.totalFood}</td>
                    <td className="py-2 px-2 text-right">{row.totalBeverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AccordionCard>

        {/* Input form */}
        <AccordionCard title={t("input", "Input")} defaultOpen={false}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">{t("inputFor", "Input for")} <span className="font-mono">{date}</span></h2>
              <p className="text-sm text-gray-500">{t("hint", "Click a date in the overview to load it here.")}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm" htmlFor="rev-date">{t("date", "Date")}</label>
              <input
                id="rev-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border rounded-md px-2 py-1"
              />
              <input
                type="file"
                accept=".xlsx,.xls"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImport}
                disabled={!canModifyRevenue}
              />
              <button
                className="ml-2 bg-gray-200 px-3 py-1.5 rounded-md disabled:opacity-60"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving || !canModifyRevenue}
                title={!canModifyRevenue ? t("permissionDenied", "You do not have permission to import revenue.") : undefined}
              >
                {t("import", "Import")}
              </button>
              <button
                className="ml-2 bg-marriott text-white px-3 py-1.5 rounded-md disabled:opacity-60"
                onClick={handleSave}
                disabled={saving || !canModifyRevenue}
                title={!canModifyRevenue ? t("permissionDenied", "You do not have permission to modify revenue.") : undefined}
              >
                {saving ? t("saving", "Saving…") : t("save", "Save")}
              </button>
            </div>
          </div>

          {saveOk && (
            <div className="mb-4 rounded-md bg-green-50 border border-green-200 text-green-800 px-3 py-2 text-sm">
              {t("savedOk", "Revenue saved successfully.")}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-2 px-2 w-1/2">{t("outlet", "Outlet")}</th>
                  <th className="py-2 px-2 w-1/2">{t("amount", "Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {outlets.map((ot) => (
                  <React.Fragment key={ot.name}>
                    <tr className="border-t bg-gray-50">
                      <td className="py-2 px-2 font-semibold" colSpan={2}>
                        {ot.name}
                      </td>
                    </tr>
                    {(ot.subOutlets || []).map((s) => (
                      <tr key={s.id || s.name} className="border-t">
                        <td className="py-2 px-2 font-medium">{s.name}</td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            className="border rounded-md px-2 py-1 w-full"
                            value={revenues[s.name] ?? ""}
                            onChange={(e) =>
                              handleChange(
                                s.name,
                                e.target.value === "" ? "" : Number(e.target.value)
                              )
                            }
                            disabled={!canModifyRevenue}
                          />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals for selected day */}
          <SelectedDayTotals revenues={revenues} t={t} typeMap={subOutletTypeMap} />
        </AccordionCard>
      </PageContainer>
    </>
  );
}

function SelectedDayTotals({ revenues, t, typeMap }) {
  const totals = useMemo(() => {
    let f = 0,
      b = 0;
    Object.entries(revenues || {}).forEach(([name, value]) => {
      const n = Number(value || 0);
      if (Number.isNaN(n)) return;
      if (typeMap[name] === "food") f += n;
      if (typeMap[name] === "beverage") b += n;
    });
    return { f, b };
  }, [revenues, typeMap]);

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border p-3">
        <div className="text-xs text-gray-500">{t("totalFood", "Total Food")}</div>
        <div className="text-2xl font-semibold">{totals.f}</div>
      </div>
      <div className="rounded-xl border p-3">
        <div className="text-xs text-gray-500">{t("totalBeverage", "Total Beverage")}</div>
        <div className="text-2xl font-semibold">{totals.b}</div>
      </div>
    </div>
  );
}
