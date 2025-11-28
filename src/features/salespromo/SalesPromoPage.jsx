import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { getOutlets, getSalesPromoTypes } from "services/firebaseSettings";
import SalesPromoTicketsTable, {
  getTicketTotal as getTicketTotalAmount,
  hasIncompleteChecklist,
} from "./SalesPromoTicketsTable";
import { useSalesPromo } from "./SalesPromoContext";
import { useLocation, useNavigate } from "react-router-dom";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import {
  getLightspeedNegativeTicketTotal,
  getSalesPromoReconciliation,
  setSalesPromoReconciliation,
} from "services/firebaseSalesPromo";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const createDefaultFilters = () => {
  const today = new Date();
  const format = d => d.toLocaleDateString("en-CA");
  return {
    startDate: format(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: format(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    ticketType: "",
    outletType: "",
    subType: "",
    outlet: "",
    search: "",
    onlyWrongTickets: false,
    notInPosOnly: false,
  };
};

const areFiltersEqual = (a = {}, b = {}) => {
  const keys = [
    "startDate",
    "endDate",
    "ticketType",
    "outletType",
    "subType",
    "outlet",
    "search",
    "onlyWrongTickets",
    "notInPosOnly",
  ];
  return keys.every(key => a[key] === b[key]);
};

export default function SalesPromoPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { t } = useTranslation("salespromo");
  const navigate = useNavigate();
  const location = useLocation();
  const pageState = location.state?.salesPromoPageState;
  const { tickets } = useSalesPromo();
  const [outlets, setOutlets] = useState([]);
  const [salesPromoTypes, setSalesPromoTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightspeedAmounts, setLightspeedAmounts] = useState({});
  const [lightspeedLoading, setLightspeedLoading] = useState({});
  const [lightspeedErrors, setLightspeedErrors] = useState({});
  const [activeTab, setActiveTab] = useState(() => {
    if (pageState?.activeTab) return pageState.activeTab;
    return location.state?.initialTab === "reconciliation"
      ? "reconciliation"
      : "tickets";
  });
  const [filters, setFilters] = useState(
    () => ({ ...createDefaultFilters(), ...(pageState?.filters || {}) })
  );
  const [sortField, setSortField] = useState(() => pageState?.sortField || "date");
  const [sortDir, setSortDir] = useState(() => pageState?.sortDir || "desc");

  useEffect(() => {
    const currentState = location.state || {};
    const existingPageState = currentState.salesPromoPageState;
    const isActiveTabSame = existingPageState?.activeTab === activeTab;
    const isSortFieldSame = existingPageState?.sortField === sortField;
    const isSortDirSame = existingPageState?.sortDir === sortDir;
    const areFiltersSame = areFiltersEqual(existingPageState?.filters, filters);

    if (isActiveTabSame && isSortFieldSame && isSortDirSame && areFiltersSame) {
      return;
    }

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: {
        ...currentState,
        salesPromoPageState: { filters, sortField, sortDir, activeTab },
      },
    });
  }, [filters, sortField, sortDir, activeTab, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    let isCancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const [outs, types, reconciliation] = await Promise.all([
          getOutlets(hotelUid),
          getSalesPromoTypes(hotelUid),
          getSalesPromoReconciliation(hotelUid),
        ]);
        if (isCancelled) return;
        setOutlets(outs || []);
        setSalesPromoTypes(types || []);

        if (Array.isArray(reconciliation)) {
          const amountMap = {};
          reconciliation.forEach(entry => {
            if (!entry?.day) return;
            if (typeof entry.lightspeedAmount === "number") {
              amountMap[entry.day] = entry.lightspeedAmount;
            }
          });
          setLightspeedAmounts(amountMap);
        } else {
          setLightspeedAmounts({});
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to load Sales & Promo data", error);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }
    if (hotelUid) fetchData();
    return () => {
      isCancelled = true;
    };
  }, [hotelUid]);

  const handleRowClick = id => {
    if (!id) return;
    const fromState = {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state,
    };
    navigate(`/salespromo/${id}`, { state: { from: fromState } });
  };

  const handleFilterChange = e => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;
    setFilters(prev => {
      if (name === "outletType") {
        return { ...prev, outletType: nextValue, subType: "" };
      }
      return { ...prev, [name]: nextValue };
    });
  };

  const handleRangePreset = e => {
    const preset = e.target.value;
    const today = new Date();
    const format = d => d.toLocaleDateString("en-CA");
    let startDate = "";
    let endDate = "";
    switch (preset) {
      case "today":
        startDate = endDate = format(today);
        break;
      case "yesterday":
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        startDate = endDate = format(y);
        break;
      case "thisWeek":
        const d = new Date(today);
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1) - day; // Monday start
        const monday = new Date(d);
        monday.setDate(d.getDate() + diff);
        startDate = format(monday);
        endDate = format(today);
        break;
      case "thisMonth":
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDate = format(first);
        endDate = format(last);
        break;
      case "lastMonth":
        const firstPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastPrev = new Date(today.getFullYear(), today.getMonth(), 0);
        startDate = format(firstPrev);
        endDate = format(lastPrev);
        break;
      case "thisYear":
        const firstYear = new Date(today.getFullYear(), 0, 1);
        const lastYear = new Date(today.getFullYear(), 11, 31);
        startDate = format(firstYear);
        endDate = format(lastYear);
        break;
      default:
        startDate = "";
        endDate = "";
    }
    setFilters(prev => ({ ...prev, startDate, endDate }));
  };

  const { typeOptions, subTypesByType, subOutletLookup } = useMemo(() => {
    const typeSet = new Set();
    const subTypeMap = new Map();
    const lookup = {};

    outlets.forEach(outlet => {
      const mappedSubOutlets = {};
      (outlet.subOutlets || []).forEach(subOutlet => {
        if (subOutlet?.name) {
          mappedSubOutlets[subOutlet.name] = subOutlet;
        }
        if (subOutlet?.type) {
          typeSet.add(subOutlet.type);
          if (subOutlet.subType) {
            if (!subTypeMap.has(subOutlet.type)) {
              subTypeMap.set(subOutlet.type, new Set());
            }
            subTypeMap.get(subOutlet.type).add(subOutlet.subType);
          }
        }
      });
      lookup[outlet.name] = mappedSubOutlets;
    });

    const typeOptionsArr = Array.from(typeSet).sort((a, b) => a.localeCompare(b));
    const subTypeObj = {};
    subTypeMap.forEach((set, type) => {
      subTypeObj[type] = Array.from(set).sort((a, b) => a.localeCompare(b));
    });

    return {
      typeOptions: typeOptionsArr,
      subTypesByType: subTypeObj,
      subOutletLookup: lookup,
    };
  }, [outlets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (filters.startDate && t.date < filters.startDate) return false;
      if (filters.endDate && t.date > filters.endDate) return false;
      if (filters.ticketType && t.type !== filters.ticketType) return false;
      if (filters.notInPosOnly && !t.notInPos) return false;
      if (filters.onlyWrongTickets && !hasIncompleteChecklist(t)) return false;
      if (filters.outletType || filters.subType) {
        const subOutletDefinitions = subOutletLookup[t.outlet] || {};
        const matchesType = (t.subOutlets || []).some(subOutlet => {
          const definition = subOutletDefinitions[subOutlet.name];
          if (!definition) return false;
          if (filters.outletType && definition.type !== filters.outletType) {
            return false;
          }
          if (filters.subType && definition.subType !== filters.subType) {
            return false;
          }
          return true;
        });
        if (!matchesType) return false;
      }
      if (filters.outlet && t.outlet !== filters.outlet) return false;
      if (filters.search && !t.receiptNumber.includes(filters.search)) return false;
      return true;
    });
  }, [tickets, filters, subOutletLookup]);

  const sortedTickets = useMemo(() => {
    const getSortValue = (ticket, field) => {
      switch (field) {
        case "receiptNumber":
        case "cashier":
        case "type":
        case "outlet":
          return ticket[field] || "";
        case "totalAmount":
          return getTicketTotalAmount(ticket);
        case "date":
        default:
          return ticket.date || "";
      }
    };

    const comparator = (a, b) => {
      const aValue = getSortValue(a, sortField);
      const bValue = getSortValue(b, sortField);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return aValue - bValue;
      }

      return String(aValue).localeCompare(String(bValue), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    };

    const sorted = [...filteredTickets].sort(comparator);
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [filteredTickets, sortDir, sortField]);

  const handleSort = field => {
    setSortField(prevField => {
      if (prevField === field) {
        setSortDir(prevDir => (prevDir === "asc" ? "desc" : "asc"));
        return prevField;
      }
      setSortDir("asc");
      return field;
    });
  };

  const reconciliationTickets = useMemo(
    () => filteredTickets.filter(ticket => !ticket.notInPos),
    [filteredTickets]
  );

  const sumAmounts = t => {
    const subOutlets = t.subOutlets || [];
    if (!filters.outletType && !filters.subType) {
      return subOutlets.reduce(
        (sum, subOutlet) => sum + parseFloat(subOutlet.amount || 0),
        0
      );
    }

    const subOutletDefinitions = subOutletLookup[t.outlet] || {};

    return subOutlets.reduce((sum, subOutlet) => {
      const definition = subOutletDefinitions[subOutlet.name];
      if (!definition) return sum;
      if (filters.outletType && definition.type !== filters.outletType) {
        return sum;
      }
      if (filters.subType && definition.subType !== filters.subType) {
        return sum;
      }
      return sum + parseFloat(subOutlet.amount || 0);
    }, 0);
  };

  const totalAmount = filteredTickets.reduce(
    (sum, t) => sum + sumAmounts(t),
    0
  );
  const ticketCount = filteredTickets.length;

  const dailySummary = useMemo(() => {
    const map = {};
    reconciliationTickets.forEach(ticket => {
      if (!ticket.date) return;
      map[ticket.date] = (map[ticket.date] || 0) + sumAmounts(ticket);
    });
    return Object.entries(map)
      .map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => b.day.localeCompare(a.day));
  }, [reconciliationTickets]);

  const handleRefreshLightspeed = async day => {
    if (!hotelUid || !day) return;
    setLightspeedLoading(prev => ({ ...prev, [day]: true }));
    setLightspeedErrors(prev => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
    try {
      const { total, tickets } = await getLightspeedNegativeTicketTotal(
        hotelUid,
        day
      );
      setLightspeedAmounts(prev => ({ ...prev, [day]: total }));
      await setSalesPromoReconciliation(hotelUid, day, {
        lightspeedAmount: total,
        lightspeedTickets: tickets,
      });
    } catch (error) {
      console.error("Failed to refresh Lightspeed amount", error);
      setLightspeedErrors(prev => ({ ...prev, [day]: true }));
    } finally {
      setLightspeedLoading(prev => ({ ...prev, [day]: false }));
    }
  };

  const handleReconciliationRowClick = day => {
    navigate(`/salespromo/reconciliation/${day}`);
  };

  const handleExport = () => {
    if (!sortedTickets.length) {
      return;
    }

    const header = [
      t("exportHeaders.date", "Date"),
      t("exportHeaders.receiptNumber", "Receipt #"),
      t("exportHeaders.cashier", "Cashier"),
      t("exportHeaders.type", "Type"),
      t("exportHeaders.outlet", "Outlet"),
      t("exportHeaders.subOutlet", "Suboutlet"),
      t("exportHeaders.subOutletType", "Suboutlet type"),
      t("exportHeaders.subOutletSubtype", "Suboutlet subtype"),
      t("exportHeaders.amount", "Amount"),
      t("exportHeaders.notInPos", "Not in POS"),
      t("exportHeaders.reason", "Reason"),
    ];

    const rows = [];
    const summaryByOutletAndType = {};
    const subOutletTypeTotals = {};

    const shouldIncludeSubOutlet = definition => {
      if ((filters.outletType || filters.subType) && !definition) {
        return false;
      }
      if (filters.outletType && definition?.type !== filters.outletType) {
        return false;
      }
      if (filters.subType && definition?.subType !== filters.subType) {
        return false;
      }
      return true;
    };

    sortedTickets.forEach(ticket => {
      const baseValues = [
        ticket.date || "",
        ticket.receiptNumber || "",
        ticket.cashier || "",
        ticket.type || "",
        ticket.outlet || "",
      ];

      const subOutlets =
        Array.isArray(ticket.subOutlets) && ticket.subOutlets.length > 0
          ? ticket.subOutlets
          : [null];
      const subOutletDefinitions = subOutletLookup[ticket.outlet] || {};
      const outletKey =
        ticket.outlet || t("exportSummaryUnknownOutlet", "Unknown outlet");
      const typeKey =
        ticket.type || t("exportSummaryUnknownType", "Unknown type");
      let ticketTotal = 0;
      let hasIncludedSubOutlet = false;

      subOutlets.forEach(subOutlet => {
        const name = subOutlet?.name || "";
        const definition = subOutletDefinitions[name] || {};
        const parsedAmount =
          subOutlet && subOutlet.amount !== undefined
            ? Number.parseFloat(subOutlet.amount)
            : Number.NaN;
        const amountValue = Number.isFinite(parsedAmount)
          ? parsedAmount
          : subOutlet?.amount || "";

        if (Number.isFinite(parsedAmount) && shouldIncludeSubOutlet(definition)) {
          hasIncludedSubOutlet = true;
          ticketTotal += parsedAmount;
          const subOutletTypeKey = definition?.type
            ? definition.type
            : t(
                "exportSummaryUnknownSubOutletType",
                "Unknown suboutlet type"
              );
          subOutletTypeTotals[subOutletTypeKey] =
            (subOutletTypeTotals[subOutletTypeKey] || 0) + parsedAmount;
        }

        rows.push([
          ...baseValues,
          name,
          definition.type || "",
          definition.subType || "",
          amountValue,
          ticket.notInPos ? t("exportNotInPosYes", "Yes") : t("exportNotInPosNo", "No"),
          ticket.reason || "",
        ]);
      });

      if (hasIncludedSubOutlet) {
        if (!summaryByOutletAndType[outletKey]) {
          summaryByOutletAndType[outletKey] = {};
        }
        summaryByOutletAndType[outletKey][typeKey] =
          (summaryByOutletAndType[outletKey][typeKey] || 0) + ticketTotal;
      }
    });

    const worksheetData = [header, ...rows];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      t("exportSheetName", "Sales & Promo")
    );

    const summarySheetData = [];
    const outletAndTypeTitle = t(
      "exportSummaryOutletTypeTitle",
      "Totals by outlet and type"
    );
    summarySheetData.push([outletAndTypeTitle]);
    summarySheetData.push([
      t("exportSummaryOutletTypeHeaderOutlet", "Outlet"),
      t("exportSummaryOutletTypeHeaderType", "Type"),
      t("exportSummaryOutletTypeHeaderAmount", "Amount"),
    ]);

    Object.keys(summaryByOutletAndType)
      .sort((a, b) => a.localeCompare(b))
      .forEach(outletName => {
        const typeTotals = summaryByOutletAndType[outletName];
        Object.keys(typeTotals)
          .sort((a, b) => a.localeCompare(b))
          .forEach(typeName => {
            summarySheetData.push([outletName, typeName, typeTotals[typeName]]);
          });
      });

    summarySheetData.push([]);
    const subOutletTypeTitle = t(
      "exportSummarySubOutletTypeTitle",
      "Totals by suboutlet type"
    );
    summarySheetData.push([subOutletTypeTitle]);
    summarySheetData.push([
      t("exportSummarySubOutletTypeHeaderType", "Suboutlet type"),
      t("exportSummarySubOutletTypeHeaderAmount", "Amount"),
    ]);

    Object.keys(subOutletTypeTotals)
      .sort((a, b) => a.localeCompare(b))
      .forEach(typeName => {
        summarySheetData.push([typeName, subOutletTypeTotals[typeName]]);
      });

    const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData);
    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      t("exportSummarySheetName", "Overview")
    );
    XLSX.writeFile(workbook, t("exportFileName", "sales-promo-tickets.xlsx"));
  };

  const availableSubTypes =
    filters.outletType && subTypesByType[filters.outletType]
      ? subTypesByType[filters.outletType]
      : [];

  const amountByOutlet = {};
  const amountByType = {};
  filteredTickets.forEach(t => {
    const amt = sumAmounts(t);
    amountByOutlet[t.outlet] = (amountByOutlet[t.outlet] || 0) + amt;
    amountByType[t.type] = (amountByType[t.type] || 0) + amt;
  });

  const colors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#6B7280",
  ];

  const outletChartData = {
    labels: Object.keys(amountByOutlet),
    datasets: [
      {
        data: Object.values(amountByOutlet),
        backgroundColor: colors,
      },
    ],
  };

  const typeChartData = {
    labels: Object.keys(amountByType),
    datasets: [
      {
        data: Object.values(amountByType),
        backgroundColor: colors,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.label}: € ${ctx.raw.toFixed(2)}`,
        },
      },
    },
  };

  return (
    <>
      <HeaderBar hotelName={hotelName} />
      <PageContainer className="max-w-4xl">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="bg-marriott text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              <span>{t("export", "Export")}</span>
            </button>
            <button
              onClick={() =>
                navigate("/salespromo/new", {
                  state: {
                    from: {
                      pathname: location.pathname,
                      search: location.search,
                      hash: location.hash,
                      state: location.state,
                    },
                  },
                })
              }
              className="bg-marriott text-white px-4 py-2 rounded"
            >
              {t("add")}
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-center text-gray-500">{t("loading")}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:h-48 flex flex-col gap-4">
                <div className="bg-white rounded-lg shadow p-2 text-center flex-1 flex flex-col justify-center">
                  <div className="text-sm font-semibold">{t("totalAmount")}</div>
                  <div className="text-lg font-bold">€ {totalAmount.toFixed(2)}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-2 text-center flex-1 flex flex-col justify-center">
                  <div className="text-sm font-semibold">{t("ticketCount")}</div>
                  <div className="text-lg font-bold">{ticketCount}</div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-2 md:h-48 flex flex-col">
                <div className="text-sm font-semibold text-center mb-1">{t("byOutlet")}</div>
                <div className="flex-1">
                  <Pie data={outletChartData} options={pieOptions} />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-2 md:h-48 flex flex-col">
                <div className="text-sm font-semibold text-center mb-1">{t("byType")}</div>
                <div className="flex-1">
                  <Pie data={typeChartData} options={pieOptions} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="border rounded px-2 py-1 bg-white"
              />
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="border rounded px-2 py-1 bg-white"
              />
              <select
                onChange={handleRangePreset}
                className="border rounded px-2 py-1 bg-white"
              >
                <option value="">{t("range", "Range")}</option>
                <option value="today">{t("today")}</option>
                <option value="yesterday">{t("yesterday")}</option>
                <option value="thisWeek">{t("thisWeek")}</option>
                <option value="thisMonth">{t("thisMonth")}</option>
                <option value="lastMonth">{t("lastMonth")}</option>
                <option value="thisYear">{t("thisYear")}</option>
              </select>
              <select
                name="outletType"
                value={filters.outletType}
                onChange={handleFilterChange}
                className="border rounded px-2 py-1 bg-white"
              >
                <option value="">{t("type")}</option>
                {typeOptions.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {filters.outletType && availableSubTypes.length > 0 && (
                <select
                  name="subType"
                  value={filters.subType}
                  onChange={handleFilterChange}
                  className="border rounded px-2 py-1 bg-white"
                >
                  <option value="">{t("subType", "Subtype")}</option>
                  {availableSubTypes.map(subType => (
                    <option key={subType} value={subType}>
                      {subType}
                    </option>
                  ))}
                </select>
              )}
              <select
                name="ticketType"
                value={filters.ticketType}
                onChange={handleFilterChange}
                className="border rounded px-2 py-1 bg-white"
              >
                <option value="">{t("ticketType", "Ticket Type")}</option>
                {salesPromoTypes.map(type => (
                  <option key={type.name} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
              <select
                name="outlet"
                value={filters.outlet}
                onChange={handleFilterChange}
                className="border rounded px-2 py-1 bg-white"
              >
                <option value="">Outlet</option>
                {outlets.map(o => (
                  <option key={o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                className="border rounded px-2 py-1 bg-white"
                placeholder="Receipt #"
              />
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 ml-2">
                <input
                  type="checkbox"
                  name="onlyWrongTickets"
                  checked={filters.onlyWrongTickets}
                  onChange={handleFilterChange}
                  className="h-4 w-4 rounded border-gray-300 text-marriott focus:ring-marriott"
                />
                {t("onlyWrongTickets", "Only wrong tickets")}
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 ml-2">
                <input
                  type="checkbox"
                  name="notInPosOnly"
                  checked={filters.notInPosOnly}
                  onChange={handleFilterChange}
                  className="h-4 w-4 rounded border-gray-300 text-marriott focus:ring-marriott"
                />
                {t("notInPosOnly", "Not in POS")}
              </label>
            </div>
            <div className="flex border-b border-gray-200 mt-4 mb-4">
              {["tickets", "reconciliation"].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-marriott text-marriott"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "tickets"
                    ? t("tabTickets", "Sales & Promo")
                    : t("tabReconciliation", "Daily reconciliation")}
                </button>
              ))}
            </div>
            {activeTab === "tickets" ? (
              <SalesPromoTicketsTable
                tickets={sortedTickets}
                onRowClick={handleRowClick}
                t={t}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
            ) : (
              <div className="bg-white rounded-lg shadow">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h2 className="text-lg font-semibold">{t("comparisonTitle")}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {t("comparisonDescription")}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {t("date")}
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {t("comparisonRegistered")}
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {t("comparisonLightspeed")}
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {t("comparisonDifference")}
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {t("comparisonRefresh")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {dailySummary.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-4 text-sm text-gray-500"
                            colSpan={5}
                          >
                            {t("comparisonNoData")}
                          </td>
                        </tr>
                      ) : (
                        dailySummary.map(({ day, amount }) => {
                          const isLoading = lightspeedLoading[day];
                          const lightspeedAmount = lightspeedAmounts[day];
                          const hasError = lightspeedErrors[day];
                          const normalizedLightspeedAmount =
                            lightspeedAmount !== undefined
                              ? Math.abs(lightspeedAmount)
                              : undefined;
                          const difference =
                            normalizedLightspeedAmount !== undefined
                              ? amount - normalizedLightspeedAmount
                              : undefined;
                          const isDifferenceAcceptable =
                            difference !== undefined
                              ? Math.abs(difference) < 0.5
                              : false;
                          const rowClassName =
                            difference === undefined
                              ? "hover:bg-gray-50 cursor-pointer"
                              : isDifferenceAcceptable
                              ? "cursor-pointer bg-green-100 hover:bg-green-200"
                              : "cursor-pointer bg-red-100 hover:bg-red-200";
                          const displayedDifference =
                            difference !== undefined
                              ? isDifferenceAcceptable
                                ? 0
                                : difference
                              : undefined;
                          return (
                            <tr
                              key={day}
                              className={rowClassName}
                              onClick={() => handleReconciliationRowClick(day)}
                            >
                              <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                                {day}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700 text-right whitespace-nowrap">
                                € {amount.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700 text-right whitespace-nowrap">
                                {isLoading
                                  ? t("loading")
                                  : normalizedLightspeedAmount !== undefined
                                  ? `€ ${normalizedLightspeedAmount.toFixed(2)}`
                                  : "–"}
                                {hasError && (
                                  <div className="text-xs text-red-500 mt-1">
                                    {t("comparisonError")}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700 text-right whitespace-nowrap">
                                {displayedDifference !== undefined
                                  ? `€ ${displayedDifference.toFixed(2)}`
                                  : "–"}
                              </td>
                              <td className="px-4 py-2 text-sm text-right whitespace-nowrap">
                                <button
                                  onClick={event => {
                                    event.stopPropagation();
                                    handleRefreshLightspeed(day);
                                  }}
                                  disabled={isLoading}
                                  className="inline-flex items-center gap-2 rounded border border-marriott px-3 py-1 text-marriott hover:bg-marriott hover:text-white disabled:opacity-60"
                                >
                                  {isLoading ? t("loading") : t("comparisonRefresh")}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </PageContainer>
    </>
  );
}

