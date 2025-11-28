import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getProductCategories } from "services/firebaseSettings";
import { getReceiptItemSummaries } from "services/firebaseReceiptItemSummary";
import { getProductsIndexed } from "services/firebaseProducts";
import { getIngredients } from "services/firebaseIngredients";
import { getArticlesIndexed } from "services/firebaseArticles";
import { getRecipesIndexed } from "services/firebaseRecipes";
import { calculateCostAndFoodcost } from "../products/productHelpers";
import { ChevronUp, ChevronDown, Upload } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Papa from "papaparse";

const weekdayFilterOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const buildDailyData = (
  summaries,
  selectedIds,
  startDate,
  endDate,
  weekday
) => {
  if (selectedIds.length === 0 || !startDate || !endDate) return [];

  const totalsByDay = {};
  summaries.forEach((summary) => {
    const day = summary.day;
    if (!day) return;
    const items = summary.items || {};
    if (!totalsByDay[day]) totalsByDay[day] = {};
    selectedIds.forEach((id) => {
      const qty = Number(items[id]?.qty) || 0;
      if (!totalsByDay[day][id]) totalsByDay[day][id] = 0;
      totalsByDay[day][id] += qty;
    });
  });

  const parseDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start.getTime() > end.getTime()) return [];

  const data = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    if (weekday) {
      const weekdayIndex = weekdayFilterOrder.indexOf(weekday);
      if (weekdayIndex !== -1 && cursor.getDay() !== weekdayIndex) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
    }
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    const key = `${year}-${month}-${day}`;
    const displayDate = new Date(year, cursor.getMonth(), cursor.getDate());
    const entry = {
      date: key,
      label: displayDate.toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
      }),
    };
    selectedIds.forEach((id) => {
      entry[id] = totalsByDay[key]?.[id] || 0;
    });
    data.push(entry);
    cursor.setDate(cursor.getDate() + 1);
  }

  return data;
};

const formatDate = (date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const getRangeDates = (range, customStart, customEnd) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const end =
    range === "This month" || range === "Yesterday"
      ? formatDate(yesterday)
      : formatDate(today);

  if (range === "Custom") {
    return { start: customStart, end: customEnd };
  }
  if (range === "Yesterday") {
    const y = formatDate(yesterday);
    return { start: y, end: y };
  }
  if (range === "Last 7 days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start: formatDate(start), end };
  }
  if (range === "Last 30 days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { start: formatDate(start), end };
  }
  if (range === "Last month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: formatDate(start), end: formatDate(endDate) };
  }
  if (range === "YTD") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: formatDate(start), end };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { start: formatDate(start), end };
};

function SortableHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  align,
  className = "",
}) {
  const active = sortField === field;
  const icon = active
    ? sortDir === "asc"
      ? <ChevronUp size={16} />
      : <ChevronDown size={16} />
    : <span className="inline-block w-4" />;
  return (
    <div
      className={`text-xs font-semibold uppercase select-none cursor-pointer hover:bg-gray-100 transition ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
      onClick={() => onSort(field)}
    >
      <span className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        {icon}
      </span>
    </div>
  );
}

export default function SoldProductsPage() {
  const { hotelName, hotelUid } = useHotelContext();
  const { t } = useTranslation("soldproducts");
  const navigate = useNavigate();

  const todayHeader = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const initialRange = "This month";
  const initialRangeDates = getRangeDates(initialRange, "", "");

  const [range, setRange] = useState(initialRange);
  const [customStart, setCustomStart] = useState(initialRangeDates.start);
  const [customEnd, setCustomEnd] = useState(initialRangeDates.end);
  const [startDate, setStartDate] = useState(initialRangeDates.start);
  const [endDate, setEndDate] = useState(initialRangeDates.end);
  const [weekday, setWeekday] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [typeFilter, setTypeFilter] = useState("both");
  const [productCategories, setProductCategories] = useState({});
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [sortField, setSortField] = useState("revenue");
  const [sortDir, setSortDir] = useState("desc");
  const [parentCategoryFilter, setParentCategoryFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparisonRange, setComparisonRange] = useState("Custom");
  const [comparisonCustomStart, setComparisonCustomStart] = useState("");
  const [comparisonCustomEnd, setComparisonCustomEnd] = useState("");
  const [comparisonStartDate, setComparisonStartDate] = useState("");
  const [comparisonEndDate, setComparisonEndDate] = useState("");
  const [comparisonSummaries, setComparisonSummaries] = useState([]);
  const [selectedStatsProductId, setSelectedStatsProductId] = useState("");

  useEffect(() => {
    const bounds = getRangeDates(range, customStart, customEnd);
    setStartDate(bounds?.start || "");
    setEndDate(bounds?.end || "");
  }, [range, customStart, customEnd]);

  useEffect(() => {
    const bounds = getRangeDates(comparisonRange, comparisonCustomStart, comparisonCustomEnd);
    setComparisonStartDate(bounds?.start || "");
    setComparisonEndDate(bounds?.end || "");
  }, [comparisonRange, comparisonCustomStart, comparisonCustomEnd]);

  const rangeLabelMap = useMemo(
    () => ({
      Yesterday: t("range.yesterday", "Yesterday"),
      "Last 7 days": t("range.last7Days", "Last 7 Days"),
      "Last 30 days": t("range.last30Days", "Last 30 Days"),
      "This month": t("range.thisMonth", "This Month"),
      "Last month": t("range.lastMonth", "Last Month"),
      YTD: t("range.ytd", "YTD"),
      Custom: t("range.custom", "Custom"),
    }),
    [t]
  );

  const weekdayLabelMap = useMemo(
    () => ({
      "": t("weekday.all", "All weekdays"),
      Monday: t("weekday.monday", "Monday"),
      Tuesday: t("weekday.tuesday", "Tuesday"),
      Wednesday: t("weekday.wednesday", "Wednesday"),
      Thursday: t("weekday.thursday", "Thursday"),
      Friday: t("weekday.friday", "Friday"),
      Saturday: t("weekday.saturday", "Saturday"),
      Sunday: t("weekday.sunday", "Sunday"),
    }),
    [t]
  );

  useEffect(() => {
    if (!hotelUid) return;
    getProductsIndexed(hotelUid).then(setProducts);
    getIngredients(hotelUid).then(setIngredients);
    getArticlesIndexed(hotelUid).then(setArticles);
    getRecipesIndexed(hotelUid).then(setRecipes);
    getProductCategories().then(setProductCategories);
  }, [hotelUid]);

  useEffect(() => {
    if (!hotelUid || !startDate || !endDate) return;
    getReceiptItemSummaries(hotelUid, startDate, endDate).then(setSummaries);
  }, [hotelUid, startDate, endDate]);

  useEffect(() => {
    if (!hotelUid || !comparisonStartDate || !comparisonEndDate) {
      setComparisonSummaries([]);
      return;
    }

    let cancelled = false;
    getReceiptItemSummaries(hotelUid, comparisonStartDate, comparisonEndDate).then((data) => {
      if (!cancelled) setComparisonSummaries(data);
    });

    return () => {
      cancelled = true;
    };
  }, [hotelUid, comparisonStartDate, comparisonEndDate]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      if (p.lightspeedId !== undefined) {
        const key = String(p.lightspeedId).trim();
        if (key) map[key] = p;
      }
    });
    return map;
  }, [products]);

  const availableOutlets = useMemo(() => {
    const set = new Set();
    summaries.forEach((s) => {
      Object.values(s.items || {}).forEach((item) => {
        Object.keys(item.perOutlet || {}).forEach((o) => set.add(o));
      });
    });
    return Array.from(set).sort();
  }, [summaries]);

  useEffect(() => {
    if (selectedOutlet && !availableOutlets.includes(selectedOutlet)) {
      setSelectedOutlet("");
    }
  }, [availableOutlets, selectedOutlet]);

  const weekdayIndex = weekday ? weekdayFilterOrder.indexOf(weekday) : -1;

  const filteredSummaries = useMemo(() => {
    if (weekdayIndex === -1) return summaries;
    return summaries.filter((summary) => {
      if (!summary?.day) return false;
      const [year, month, day] = summary.day.split("-").map(Number);
      if (!year || !month || !day) return false;
      const date = new Date(year, month - 1, day);
      return date.getDay() === weekdayIndex;
    });
  }, [summaries, weekdayIndex]);

  const filteredComparisonSummaries = useMemo(() => {
    if (weekdayIndex === -1) return comparisonSummaries;
    return comparisonSummaries.filter((summary) => {
      if (!summary?.day) return false;
      const [year, month, day] = summary.day.split("-").map(Number);
      if (!year || !month || !day) return false;
      const date = new Date(year, month - 1, day);
      return date.getDay() === weekdayIndex;
    });
  }, [comparisonSummaries, weekdayIndex]);

  const parentCategoryOptions = useMemo(() => {
    const entries = Object.entries(productCategories || {});
    if (entries.length === 0) return [];

    const map = {};
    entries.forEach(([key, value]) => {
      map[key] = { key, ...value, childCount: 0 };
    });
    entries.forEach(([, value]) => {
      if (value.parentId && map[value.parentId]) {
        map[value.parentId].childCount += 1;
      }
    });

    return Object.values(map)
      .filter((cat) => !cat.parentId && cat.childCount > 0)
      .filter((cat) => typeFilter === "both" || cat.type === typeFilter)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [productCategories, typeFilter]);

  useEffect(() => {
    if (parentCategoryFilter && !parentCategoryOptions.some((cat) => cat.key === parentCategoryFilter)) {
      setParentCategoryFilter("");
    }
  }, [parentCategoryFilter, parentCategoryOptions]);

  const rows = useMemo(() => {
    if (filteredSummaries.length === 0) return [];
    const aggregated = {};
    filteredSummaries.forEach((s) => {
      Object.entries(s.items || {}).forEach(([pid, item]) => {
        if (!aggregated[pid]) {
          aggregated[pid] = {
            qty: 0,
            revenue: 0,
            totalTaxExclusivePrice: 0,
            perOutlet: {},
            soldItemName: "",
          };
        }
        const soldItemName =
          item?.description?.trim() || item?.name?.trim() || item?.productName?.trim() || "";
        if (soldItemName && !aggregated[pid].soldItemName) {
          aggregated[pid].soldItemName = soldItemName;
        }
        aggregated[pid].qty += Number(item.qty) || 0;
        aggregated[pid].revenue += Number(item.totalTaxInclusivePrice) || 0;
        aggregated[pid].totalTaxExclusivePrice += Number(item.totalTaxExclusivePrice) || 0;
        Object.entries(item.perOutlet || {}).forEach(([outlet, q]) => {
          aggregated[pid].perOutlet[outlet] =
            (aggregated[pid].perOutlet[outlet] || 0) + (Number(q) || 0);
        });
      });
    });

    const result = [];
    Object.entries(aggregated).forEach(([pid, agg]) => {
      const product = productMap[pid];
      const qtyPerOutlet = agg.perOutlet || {};
      const qty = selectedOutlet ? qtyPerOutlet[selectedOutlet] || 0 : agg.qty;
      if (qty <= 0) return;

      const pricePerUnit = agg.qty ? agg.revenue / agg.qty : 0;
      const revenue = pricePerUnit * qty;
      const { kostprijs } = product
        ? calculateCostAndFoodcost(product, ingredients, recipes, articles)
        : { kostprijs: 0 };
      const cost = kostprijs * qty;
      const type = product ? productCategories[product.category]?.type || "" : "";
      if (typeFilter !== "both" && type !== typeFilter) return;
      const parentCategoryId = product ? productCategories[product.category]?.parentId || "" : "";
      if (parentCategoryFilter && parentCategoryId !== parentCategoryFilter) return;
      const soldItemName = agg.soldItemName?.trim() || "";
      const taxExclusivePrice =
        agg.qty > 0 ? agg.totalTaxExclusivePrice / agg.qty : 0;

      result.push({
        id: pid,
        name: product?.name || soldItemName || pid,
        soldItemName,
        hasLinkedProduct: Boolean(product),
        qty,
        revenue,
        cost,
        net: revenue - cost,
        taxExclusivePrice,
      });
    });
    return result;
  }, [
    filteredSummaries,
    productMap,
    selectedOutlet,
    typeFilter,
    parentCategoryFilter,
    productCategories,
    ingredients,
    recipes,
    articles,
  ]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => rows.some((row) => row.id === id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [rows]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      if (sortField === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      return sortDir === "asc" ? a[sortField] - b[sortField] : b[sortField] - a[sortField];
    });
    return arr;
  }, [rows, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleExport = () => {
    const exportRows = sortedRows.map((row) => [
      row.name,
      row.qty,
      row.revenue.toFixed(2),
      row.cost.toFixed(2),
      row.net.toFixed(2),
    ]);

    const csv = Papa.unparse({
      fields: [
        t("product", "Product"),
        t("sold", "Sold"),
        t("revenue", "Revenue"),
        t("costPrice", "Cost price"),
        t("netProfit", "Net profit"),
      ],
      data: exportRows,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sold-products-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleCreateProduct = (row) => {
    if (row.hasLinkedProduct) return;
    const params = new URLSearchParams();
    const name = row.soldItemName || row.name || "";
    if (name) params.set("name", name);
    params.set("lightspeedId", row.id);
    if (Number.isFinite(row.taxExclusivePrice)) {
      params.set("price", Number(row.taxExclusivePrice).toFixed(2));
    }
    params.set("saleUnit", "portion");
    navigate(`/products/new?${params.toString()}`);
  };

  const rowMap = useMemo(() => {
    const map = {};
    rows.forEach((row) => {
      map[row.id] = row;
    });
    return map;
  }, [rows]);

  const selectedProducts = useMemo(
    () => selectedIds.map((id) => ({ id, name: rowMap[id]?.name || id })),
    [selectedIds, rowMap]
  );

  useEffect(() => {
    if (selectedProducts.length === 0) {
      setSelectedStatsProductId("");
      return;
    }
    if (!selectedStatsProductId || !selectedProducts.some((p) => p.id === selectedStatsProductId)) {
      setSelectedStatsProductId(selectedProducts[0].id);
    }
  }, [selectedProducts, selectedStatsProductId]);

  const selectedStatsProduct = useMemo(
    () => selectedProducts.find((p) => p.id === selectedStatsProductId),
    [selectedProducts, selectedStatsProductId]
  );

  const selectedDailyData = useMemo(
    () =>
      buildDailyData(
        filteredSummaries,
        selectedIds,
        startDate,
        endDate,
        weekday
      ),
    [filteredSummaries, selectedIds, startDate, endDate, weekday]
  );

  const comparisonDailyData = useMemo(
    () =>
      buildDailyData(
        filteredComparisonSummaries,
        selectedIds,
        comparisonStartDate,
        comparisonEndDate,
        weekday
      ),
    [
      filteredComparisonSummaries,
      selectedIds,
      comparisonStartDate,
      comparisonEndDate,
      weekday,
    ]
  );

  const selectedProductStats = useMemo(() => {
    if (!selectedStatsProduct || selectedDailyData.length === 0) return null;
    const values = selectedDailyData.map(
      (entry) => Number(entry[selectedStatsProduct.id]) || 0
    );
    if (values.length === 0) return null;
    const total = values.reduce((sum, value) => sum + value, 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = total / values.length;
    return { min, max, average, total };
  }, [selectedDailyData, selectedStatsProduct]);

  const comparisonProductStats = useMemo(() => {
    if (!selectedStatsProduct || comparisonDailyData.length === 0) return null;
    const values = comparisonDailyData.map(
      (entry) => Number(entry[selectedStatsProduct.id]) || 0
    );
    if (values.length === 0) return null;
    const total = values.reduce((sum, value) => sum + value, 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = total / values.length;
    return { min, max, average, total };
  }, [comparisonDailyData, selectedStatsProduct]);

  const colorPalette = useMemo(
    () => [
      "#A6192E",
      "#2563EB",
      "#F97316",
      "#16A34A",
      "#7C3AED",
      "#DB2777",
      "#0891B2",
      "#CA8A04",
      "#1D4ED8",
      "#DC2626",
    ],
    []
  );

  const getColorForIndex = (index) => colorPalette[index % colorPalette.length];

  const selectedCount = selectedIds.length;

  return (
    <>
      <HeaderBar hotelName={hotelName} today={todayHeader} />
      <PageContainer>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <button
            className="bg-marriott text-white p-2 rounded-lg hover:bg-marriott-dark shadow self-end sm:self-auto"
            onClick={handleExport}
            title={t("exportList", "Export list")}
          >
            <Upload className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-white rounded-xl shadow px-4 py-4 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <div className="flex flex-col">
              <label className="text-sm font-medium">{t("outlet", "Outlet")}</label>
              <select
                className="border rounded-md px-2 py-1"
                value={selectedOutlet}
                onChange={(e) => {
                  setSelectedOutlet(e.target.value);
                }}
              >
                <option value="">{t("allOutlets", "All outlets")}</option>
                {availableOutlets.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
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
            <div className="flex flex-col">
              <label className="text-sm font-medium">{t("parentCategory", "Category")}</label>
              <select
                className="border rounded-md px-2 py-1"
                value={parentCategoryFilter}
                onChange={(e) => setParentCategoryFilter(e.target.value)}
                disabled={parentCategoryOptions.length === 0}
              >
                <option value="">{t("allParentCategories", "All categories")}</option>
                {parentCategoryOptions.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium">{t("range.label", "Date range")}</label>
              <select
                className="border rounded-md px-2 py-1"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="Yesterday">{rangeLabelMap.Yesterday}</option>
                <option value="Last 7 days">{rangeLabelMap["Last 7 days"]}</option>
                <option value="Last 30 days">{rangeLabelMap["Last 30 days"]}</option>
                <option value="This month">{rangeLabelMap["This month"]}</option>
                <option value="Last month">{rangeLabelMap["Last month"]}</option>
                <option value="YTD">{rangeLabelMap.YTD}</option>
                <option value="Custom">{rangeLabelMap.Custom}</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium">{t("weekday.label", "Weekday")}</label>
              <select
                className="border rounded-md px-2 py-1"
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
              >
                <option value="">{weekdayLabelMap[""]}</option>
                <option value="Monday">{weekdayLabelMap.Monday}</option>
                <option value="Tuesday">{weekdayLabelMap.Tuesday}</option>
                <option value="Wednesday">{weekdayLabelMap.Wednesday}</option>
                <option value="Thursday">{weekdayLabelMap.Thursday}</option>
                <option value="Friday">{weekdayLabelMap.Friday}</option>
                <option value="Saturday">{weekdayLabelMap.Saturday}</option>
                <option value="Sunday">{weekdayLabelMap.Sunday}</option>
              </select>
            </div>
            {range === "Custom" && (
              <div className="flex flex-col md:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium">{t("from", "From")}</label>
                    <input
                      type="date"
                      className="border rounded-md px-2 py-1"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium">{t("to", "To")}</label>
                    <input
                      type="date"
                      className="border rounded-md px-2 py-1"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {selectedCount > 0 && selectedDailyData.length > 0 && (
          <div className="mb-6">
            <div className="bg-white border border-gray-200 rounded-xl shadow px-4 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
                <div className="flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold">
                      {t(
                        "selectedItemsChartTitle",
                        "Selected items sold per day"
                      )}
                    </h2>
                    <span className="text-sm text-gray-500">
                      {t("selectedCount", {
                        defaultValue: "{{count}} selected items",
                        count: selectedCount,
                      })}
                    </span>
                  </div>
                  <div className="h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedDailyData} margin={{ top: 10, right: 16, left: 8, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <Tooltip
                          formatter={(value, dataKey) => {
                            const product = selectedProducts.find((p) => p.id === dataKey);
                            return [value, product?.name || dataKey];
                          }}
                          labelFormatter={(label, payload) => {
                            const entry = payload?.[0]?.payload;
                            if (!entry?.date) return label;
                            const date = new Date(`${entry.date}T00:00:00`);
                            return date.toLocaleDateString("nl-NL", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            });
                          }}
                        />
                        {selectedProducts.map((product, index) => {
                          const color = getColorForIndex(index);
                          return (
                            <Line
                              key={product.id}
                              type="monotone"
                              dataKey={product.id}
                              name={product.name}
                              stroke={color}
                              strokeWidth={3}
                              dot={{ r: 3, stroke: color, fill: "white" }}
                              activeDot={{ r: 5 }}
                              isAnimationActive={false}
                            />
                          );
                        })}
                        <Legend
                          verticalAlign="bottom"
                          align="center"
                          wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="w-full lg:w-72 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-gray-900">
                        {t("statistics.title", "Statistics")}
                      </h3>
                    </div>
                    <label className="text-sm font-medium text-gray-700">
                      {t("statistics.selectedProduct", "Selected product")}
                    </label>
                    <select
                      className="border rounded-md px-2 py-1"
                      value={selectedStatsProductId}
                      onChange={(e) => setSelectedStatsProductId(e.target.value)}
                    >
                      {selectedProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    {selectedProductStats ? (
                      <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-gray-700">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {t("statistics.min", "Min")}
                          </p>
                          <p>{selectedProductStats.min}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {t("statistics.max", "Max")}
                          </p>
                          <p>{selectedProductStats.max}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {t("statistics.average", "Average")}
                          </p>
                          <p>{selectedProductStats.average.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {t("statistics.total", "Total")}
                          </p>
                          <p>{selectedProductStats.total}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {t("statistics.placeholder", "Select a product to view statistics")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-gray-200 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {t("comparisonRangeTitle", "Comparison range")}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t(
                        "comparisonRangeDescription",
                        "Choose a second date range to compare the selected products."
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                    <div className="flex flex-col">
                      <label className="text-sm font-medium">{t("range.label", "Date range")}</label>
                      <select
                        className="border rounded-md px-2 py-1"
                        value={comparisonRange}
                        onChange={(e) => setComparisonRange(e.target.value)}
                      >
                        <option value="Yesterday">{rangeLabelMap.Yesterday}</option>
                        <option value="Last 7 days">{rangeLabelMap["Last 7 days"]}</option>
                        <option value="Last 30 days">{rangeLabelMap["Last 30 days"]}</option>
                        <option value="This month">{rangeLabelMap["This month"]}</option>
                        <option value="Last month">{rangeLabelMap["Last month"]}</option>
                        <option value="YTD">{rangeLabelMap.YTD}</option>
                        <option value="Custom">{rangeLabelMap.Custom}</option>
                      </select>
                    </div>
                    {comparisonRange === "Custom" && (
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col">
                          <label className="text-sm font-medium">{t("from", "From")}</label>
                          <input
                            type="date"
                            className="border rounded-md px-2 py-1"
                            value={comparisonCustomStart}
                            onChange={(e) => setComparisonCustomStart(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm font-medium">{t("to", "To")}</label>
                          <input
                            type="date"
                            className="border rounded-md px-2 py-1"
                            value={comparisonCustomEnd}
                            onChange={(e) => setComparisonCustomEnd(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {comparisonStartDate && comparisonEndDate && (
                  comparisonDailyData.length > 0 ? (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6 mt-4">
                      <div className="flex-1">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={comparisonDailyData} margin={{ top: 10, right: 16, left: 8, bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#6b7280" />
                              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#6b7280" />
                              <Tooltip
                                formatter={(value, dataKey) => {
                                  const product = selectedProducts.find((p) => p.id === dataKey);
                                  return [value, product?.name || dataKey];
                                }}
                                labelFormatter={(label, payload) => {
                                  const entry = payload?.[0]?.payload;
                                  if (!entry?.date) return label;
                                  const date = new Date(`${entry.date}T00:00:00`);
                                  return date.toLocaleDateString("nl-NL", {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                  });
                                }}
                              />
                              {selectedProducts.map((product, index) => {
                                const color = getColorForIndex(index);
                                return (
                                  <Line
                                    key={product.id}
                                    type="monotone"
                                    dataKey={product.id}
                                    name={product.name}
                                    stroke={color}
                                    strokeWidth={3}
                                    dot={{ r: 3, stroke: color, fill: "white" }}
                                    activeDot={{ r: 5 }}
                                    isAnimationActive={false}
                                  />
                                );
                              })}
                              <Legend
                                verticalAlign="bottom"
                                align="center"
                                wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="w-full lg:w-72 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base font-semibold text-gray-900">
                              {t("statistics.title", "Statistics")}
                            </h3>
                          </div>
                          <label className="text-sm font-medium text-gray-700">
                            {t("statistics.selectedProduct", "Selected product")}
                          </label>
                          <select
                            className="border rounded-md px-2 py-1"
                            value={selectedStatsProductId}
                            onChange={(e) => setSelectedStatsProductId(e.target.value)}
                          >
                            {selectedProducts.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                          {comparisonProductStats ? (
                            <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-gray-700">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {t("statistics.min", "Min")}
                                </p>
                                <p>{comparisonProductStats.min}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {t("statistics.max", "Max")}
                                </p>
                                <p>{comparisonProductStats.max}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {t("statistics.average", "Average")}
                                </p>
                                <p>{comparisonProductStats.average.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {t("statistics.total", "Total")}
                                </p>
                                <p>{comparisonProductStats.total}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">
                              {t("statistics.placeholder", "Select a product to view statistics")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-4">
                      {t(
                        "comparisonNoData",
                        "No sales were found for the selected comparison range."
                      )}
                    </p>
                  )
                )}
              </div>
            </div>
          </div>
        )}
        <div className="hidden sm:block overflow-hidden rounded-xl shadow border border-gray-200 bg-white">
          <div className="grid grid-cols-8 gap-2 font-semibold text-marriott text-sm bg-gray-50 border-b border-gray-200 px-4 py-2">
            <div className="flex items-center justify-center">
              <span className="sr-only">{t("select", "Select")}</span>
            </div>
            <SortableHeader
              label={t("product", "Product")}
              field="name"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              className="sm:col-span-2"
            />
            <div className="text-xs font-semibold uppercase select-none">
              {t("actions", "Actions")}
            </div>
            <SortableHeader
              label={t("sold", "Sold")}
              field="qty"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label={t("revenue", "Revenue")}
              field="revenue"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label={t("costPrice", "Cost price")}
              field="cost"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label={t("netProfit", "Net profit")}
              field="net"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              align="right"
            />
          </div>
          <div className="divide-y divide-gray-100">
            {sortedRows.map((row) => (
              <div
                key={row.id}
                className={`grid grid-cols-8 gap-2 items-center text-sm px-4 py-3 transition-colors ${
                  selectedIds.includes(row.id)
                    ? "bg-marriott/10"
                    : "odd:bg-white even:bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    aria-label={t("selectProduct", { defaultValue: "Select {{name}}", name: row.name })}
                    className="h-4 w-4 rounded border-gray-300 text-marriott focus:ring-marriott"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleSelection(row.id)}
                  />
                </div>
                <div className="sm:col-span-2">{row.name}</div>
                <div className="flex items-center">
                  {!row.hasLinkedProduct ? (
                    <button
                      type="button"
                      className="px-3 py-1 text-xs font-semibold text-white bg-marriott rounded-md hover:bg-marriott/90"
                      onClick={() => handleCreateProduct(row)}
                    >
                      {t("createProduct", "Create product")}
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </div>
                <div className="text-right">{row.qty}</div>
                <div className="text-right">€{row.revenue.toFixed(2)}</div>
                <div className="text-right">€{row.cost.toFixed(2)}</div>
                <div className="text-right font-semibold text-marriott">€{row.net.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:hidden mt-2">
          {sortedRows.map((row) => (
            <div
              key={row.id}
              className={`rounded-2xl px-4 py-3 flex flex-col gap-2 ${
                selectedIds.includes(row.id)
                  ? "bg-marriott/10 border border-marriott/40"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-bold text-base text-gray-900">{row.name}</div>
                <input
                  type="checkbox"
                  aria-label={t("selectProduct", { defaultValue: "Select {{name}}", name: row.name })}
                  className="h-4 w-4 mt-1 rounded border-gray-300 text-marriott focus:ring-marriott"
                  checked={selectedIds.includes(row.id)}
                  onChange={() => toggleSelection(row.id)}
                />
              </div>
              {!row.hasLinkedProduct && (
                <button
                  type="button"
                  className="self-start px-3 py-1 text-xs font-semibold text-white bg-marriott rounded-md hover:bg-marriott/90"
                  onClick={() => handleCreateProduct(row)}
                >
                  {t("createProduct", "Create product")}
                </button>
              )}
              <div className="flex flex-wrap gap-2 text-sm mt-1">
                <span className="text-gray-500">{t("sold", "Sold")}:</span>
                <span className="font-semibold">{row.qty}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="text-gray-500">{t("revenue", "Revenue")}:</span>
                <span>€{row.revenue.toFixed(2)}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="text-gray-500">{t("costPrice", "Cost price")}:</span>
                <span>€{row.cost.toFixed(2)}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="text-gray-500">{t("netProfit", "Net profit")}:</span>
                <span className="font-semibold text-marriott">€{row.net.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </PageContainer>
    </>
  );
}

