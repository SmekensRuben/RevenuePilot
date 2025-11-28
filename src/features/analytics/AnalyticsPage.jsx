import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import {
  getOutlets,
  getProductCategories,
  getCategories,
} from "services/firebaseSettings";
import {
  getSoldProductsTotal,
  getBoughtItemsTotal,
} from "./analyticsService";
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

export default function AnalyticsPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { t } = useTranslation("analytics");

  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const formatDate = (date) => {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  };
  const today = new Date();
  const todayISO = formatDate(today);
  const firstOfMonth = formatDate(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayISO);
  const [typeFilter, setTypeFilter] = useState("both");
  const [productCategories, setProductCategories] = useState({});
  const [categories, setCategories] = useState({});
  const [historyRows, setHistoryRows] = useState([]); // [{date, purchased, revenue}]
  const [loadingHistory, setLoadingHistory] = useState(false);

  const typeToService = (v) =>
    v === "food" ? "Food" : v === "beverage" ? "Beverage" : "Both";

  // Fetch initial data
  useEffect(() => {
    if (!hotelUid) return;
    getOutlets(hotelUid).then((res) => setOutlets(res || []));
    getProductCategories().then(setProductCategories);
    getCategories().then(setCategories);
  }, [hotelUid]);

  const dateRange = (from, to) => {
    const days = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      days.push(dt.toISOString().slice(0, 10));
    }
    return days;
  };

  const fetchHistory = async (from, to) => {
    if (!hotelUid) return;
    setLoadingHistory(true);
    const days = dateRange(from, to);
    const type = typeToService(typeFilter);
    const soldPromises = days.map((d) =>
      getSoldProductsTotal(hotelUid, d, d, {
        selectedOutlet,
        dataType: type,
        productCategories,
        categories,
      })
    );
    const boughtPromises = days.map((d) =>
      getBoughtItemsTotal(hotelUid, d, d, {
        selectedOutlet,
        dataType: type,
        categories,
      })
    );
    const sold = await Promise.all(soldPromises);
    const bought = await Promise.all(boughtPromises);
    setHistoryRows(
      days.map((d, idx) => ({
        date: d,
        revenue: sold[idx] || 0,
        purchased: bought[idx] || 0,
      }))
    );
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (
      !hotelUid ||
      !Object.keys(productCategories).length ||
      !Object.keys(categories).length
    )
      return;
    fetchHistory(startDate, endDate);
  }, [
    hotelUid,
    startDate,
    endDate,
    selectedOutlet,
    typeFilter,
    productCategories,
    categories,
  ]);

  const chartData = useMemo(
    () =>
      historyRows.map((r) => ({
        date: r.date.slice(5),
        [t("purchased", "Purchased")]: r.purchased,
        [t("revenue", "Revenue")]: r.revenue,
      })),
    [historyRows, t]
  );

  return (
    <>
      <HeaderBar hotelName={hotelName} />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-6">
          {t("title", "Reporting & Analytics")}
        </h1>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="text-sm font-medium">
              {t("outlet", "Outlet")}
            </label>
            <select
              className="border rounded-md px-2 py-1"
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
            >
              <option value="">{t("allOutlets", "All outlets")}</option>
              {outlets.map((ot) => (
                <option key={ot.id || ot.name} value={ot.id || ot.name}>
                  {ot.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">
              {t("type", "Type")}
            </label>
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
            <label className="text-sm font-medium">
              {t("from", "From")}
            </label>
            <input
              type="date"
              className="border rounded-md px-2 py-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              {t("to", "To")}
            </label>
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
          <h3 className="text-base font-semibold mb-3">
            {t("trend", "Trend")}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={t("purchased", "Purchased")}
                  stroke="#16a34a"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey={t("revenue", "Revenue")}
                  stroke="#2563eb"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey={t("purchased", "Purchased")}
                  fill="#16a34a"
                />
                <Bar dataKey={t("revenue", "Revenue")} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overview */}
        <AccordionCard title={t("overview", "Overview")} defaultOpen={false}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              {t("overview", "Overview")}
            </h2>
            <button
              className="text-sm underline"
              onClick={() => fetchHistory(startDate, endDate)}
              disabled={loadingHistory}
            >
              {loadingHistory
                ? t("loading", "Loading…")
                : t("refresh", "Refresh")}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-2 px-2">{t("date", "Date")}</th>
                  <th className="py-2 px-2 text-right">
                    {t("totalPurchased", "Total Purchased")}
                  </th>
                  <th className="py-2 px-2 text-right">
                    {t("totalRevenue", "Total Revenue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.date} className="border-t">
                    <td className="py-2 px-2 font-medium">{row.date}</td>
                    <td className="py-2 px-2 text-right">
                      {row.purchased.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {row.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AccordionCard>
      </PageContainer>
    </>
  );
}

