// src/features/dashboard/HotelDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, signOut } from "../../firebaseConfig";
import DashboardHeader from "./DashboardHeader";
import MobileSidebar from "./MobileSidebar";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { useNavigationSections } from "../../hooks/useNavigationSections";
import { RevenueLineChart, SalesMixDonut, HorizontalBarChart, WeekdayRevenuePie } from "./KpiChart";
import {
  getOutlets,
  getCategories,
  getProductCategories,
  getStaff,
  getSettings,
  getStaffContractTypes,
} from "../../services/firebaseSettings";
import { getBoughtItemsTotal } from "../analytics/analyticsService";
import { getRevenue } from "../../services/firebaseRevenue";
import { getProductSalesRange } from "../../services/firebaseSalesSnapshot";
import { getProductsIndexed } from "../../services/firebaseProducts";
import { dateRange } from "../lightspeed/lightspeedHelpers";
import { useNavigate } from "react-router-dom";
import { getScheduleForDate } from "../../services/firebaseSchedule";
import { getSalesPromoTickets } from "../../services/firebaseSalesPromo";

const TOTAL_MINUTES_IN_DAY = 24 * 60;

function parseTimeToMinutes(timeString = "") {
  if (typeof timeString !== "string") return 0;
  const [hours = "0", minutes = "0"] = timeString.split(":");
  const parsedHours = Number.parseInt(hours, 10);
  const parsedMinutes = Number.parseInt(minutes, 10);
  if (Number.isNaN(parsedHours) || Number.isNaN(parsedMinutes)) return 0;
  const total = parsedHours * 60 + parsedMinutes;
  return Math.min(Math.max(total, 0), TOTAL_MINUTES_IN_DAY);
}

function calculateEntryHours(entry = {}) {
  const minutes = calculateShiftDurationMinutes(entry?.startTime, entry?.endTime);
  return minutes / 60;
}

function calculateShiftDurationMinutes(startTime = "", endTime = "") {
  if (!startTime || !endTime) return 0;
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === end) return 0;
  let diff = end - start;
  if (diff < 0) {
    diff += TOTAL_MINUTES_IN_DAY;
  }
  return Math.max(Math.min(diff, TOTAL_MINUTES_IN_DAY), 0);
}

function getStaffHourlyWage(staffMember = {}) {
  if (!staffMember) return null;
  const { hourlyWage } = staffMember;
  if (typeof hourlyWage === "number" && !Number.isNaN(hourlyWage)) {
    return hourlyWage;
  }
  if (typeof hourlyWage === "string") {
    const parsed = Number.parseFloat(hourlyWage);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getStaffHourlyCost(staffMember = {}, contractTypeMap = new Map()) {
  const wage = getStaffHourlyWage(staffMember);
  if (!Number.isFinite(wage)) {
    return null;
  }
  const normalizedContract = String(staffMember?.contractType || "").trim().toLowerCase();
  const contractType = contractTypeMap.get(normalizedContract);
  const coefficientRaw = contractType?.coefficient;
  const coefficient = Number.isFinite(coefficientRaw) ? coefficientRaw : 1;
  const cost = wage * coefficient;
  return Number.isFinite(cost) ? cost : wage;
}

function getEntryStaffIdentifier(entry = {}) {
  return entry?.staffId || entry?.staffKey || entry?.staffName || "";
}

export default function HotelDashboard() {
  const { hotelName, hotelUid } = useHotelContext();
  const { t } = useTranslation("hoteldashboard");
  const [languageLoaded, setLanguageLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const sections = useNavigationSections();
  const formattedHotelName = hotelName.replace(/\b\w/g, (l) => l.toUpperCase());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => setLanguageLoaded(true));
    return () => unsubscribe();
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  // ----------------- FILTERS & DATA -----------------
  const [outlet, setOutlet] = useState("");
  const [outlets, setOutlets] = useState([]);
  const [range, setRange] = useState("This month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [weekday, setWeekday] = useState("");
  const [categories, setCategories] = useState({});
  const [productCategories, setProductCategories] = useState({});
  const [products, setProducts] = useState([]);
  const [revenue, setRevenue] = useState(0);
  const [foodCostPct, setFoodCostPct] = useState(0);
  const [bevCostPct, setBevCostPct] = useState(0);
  const [foodCostTotal, setFoodCostTotal] = useState(0);
  const [bevCostTotal, setBevCostTotal] = useState(0);
  const [staffMembers, setStaffMembers] = useState([]);
  const [contractTypes, setContractTypes] = useState([]);
  const [labels, setLabels] = useState([]);
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [purchaseSeries, setPurchaseSeries] = useState([]);
  const [avgRevenuePerDay, setAvgRevenuePerDay] = useState(0);
  const [avgPurchasePerDay, setAvgPurchasePerDay] = useState(0);
  const [weekdayRevenue, setWeekdayRevenue] = useState({});
  const [typeFilter, setTypeFilter] = useState("Food & Beverage");
  const [salesMix, setSalesMix] = useState({ Food: 0, Beverage: 0, Other: 0 });
  const [topFood, setTopFood] = useState([]);
  const [topBeverage, setTopBeverage] = useState([]);
  const [worstFood, setWorstFood] = useState([]);
  const [worstBeverage, setWorstBeverage] = useState([]);
  const [useCostOverride, setUseCostOverride] = useState(false);
  const [foodCostOverride, setFoodCostOverride] = useState(0);
  const [beverageCostOverride, setBeverageCostOverride] = useState(0);
  const [staffCostTotal, setStaffCostTotal] = useState(0);
  const [staffCostLoading, setStaffCostLoading] = useState(false);
  const [salesPromoTickets, setSalesPromoTickets] = useState([]);
  const [salesPromoCostSeries, setSalesPromoCostSeries] = useState([]);
  const [staffCostSeries, setStaffCostSeries] = useState([]);
  const [staffCostByDay, setStaffCostByDay] = useState({});
  const [profitSeries, setProfitSeries] = useState([]);
  const [profitTotal, setProfitTotal] = useState(0);
  const [avgProfitPerDay, setAvgProfitPerDay] = useState(0);

  const typeFilterLabelMap = {
    "Food & Beverage": t("filters.type.options.foodAndBeverage"),
    Food: t("filters.type.options.food"),
    Beverage: t("filters.type.options.beverage"),
  };
  const rangeLabelMap = {
    Yesterday: t("filters.range.options.yesterday"),
    "Last 7 days": t("filters.range.options.last7Days"),
    "Last 30 days": t("filters.range.options.last30Days"),
    "This month": t("filters.range.options.thisMonth"),
    "Last month": t("filters.range.options.lastMonth"),
    YTD: t("filters.range.options.ytd"),
    Custom: t("filters.range.options.custom"),
  };
  const weekdayFilterOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekdayLabelMap = {
    "": t("filters.weekday.options.all"),
    Monday: t("filters.weekday.options.monday"),
    Tuesday: t("filters.weekday.options.tuesday"),
    Wednesday: t("filters.weekday.options.wednesday"),
    Thursday: t("filters.weekday.options.thursday"),
    Friday: t("filters.weekday.options.friday"),
    Saturday: t("filters.weekday.options.saturday"),
    Sunday: t("filters.weekday.options.sunday"),
  };
  const weekdayChartOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const salesMixLabelMap = {
    Food: t("charts.salesMix.labels.food"),
    Beverage: t("charts.salesMix.labels.beverage"),
    Other: t("charts.salesMix.labels.other"),
  };
  const rangeDisplayLabel = rangeLabelMap[range] ?? range;

  const totalFBCost = foodCostTotal + bevCostTotal;
  const totalFBRevenue = salesMix.Food + salesMix.Beverage;
  const fbCostPct = totalFBRevenue ? (totalFBCost / totalFBRevenue) * 100 : 0;

  useEffect(() => {
    if (!hotelUid) {
      setOutlets([]);
      setCategories({});
      setProductCategories({});
      setProducts([]);
      setStaffMembers([]);
      setContractTypes([]);
      return;
    }
    getOutlets(hotelUid).then((res) => setOutlets(res || []));
    getCategories().then(setCategories);
    getProductCategories().then(setProductCategories);
    getProductsIndexed(hotelUid).then(setProducts);
    getStaff()
      .then(setStaffMembers)
      .catch((error) => {
        console.error("Failed to load staff members", error);
        setStaffMembers([]);
      });
    getStaffContractTypes(hotelUid)
      .then((types) => {
        setContractTypes(Array.isArray(types) ? types : []);
      })
      .catch((error) => {
        console.error("Failed to load staff contract types", error);
        setContractTypes([]);
      });
  }, [hotelUid]);

  useEffect(() => {
    if (!hotelUid) {
      setUseCostOverride(false);
      setFoodCostOverride(0);
      setBeverageCostOverride(0);
      return;
    }

    let isActive = true;
    getSettings(hotelUid)
      .then((settings) => {
        if (!isActive) return;
        const useOverride = Boolean(settings?.useCostPercentageOverride);
        const foodOverrideValue = Number.parseFloat(settings?.foodCostPercentage);
        const beverageOverrideValue = Number.parseFloat(settings?.beverageCostPercentage);
        setUseCostOverride(useOverride);
        setFoodCostOverride(
          Number.isFinite(foodOverrideValue) ? foodOverrideValue : 0
        );
        setBeverageCostOverride(
          Number.isFinite(beverageOverrideValue) ? beverageOverrideValue : 0
        );
      })
      .catch((error) => {
        console.error("Failed to load reporting settings", error);
        if (!isActive) return;
        setUseCostOverride(false);
        setFoodCostOverride(0);
        setBeverageCostOverride(0);
      });

    return () => {
      isActive = false;
    };
  }, [hotelUid]);

  useEffect(() => {
    if (!hotelUid) {
      setSalesPromoTickets([]);
      return;
    }
    let active = true;
    getSalesPromoTickets(hotelUid)
      .then((tickets) => {
        if (!active) return;
        setSalesPromoTickets(Array.isArray(tickets) ? tickets : []);
      })
      .catch((error) => {
        console.error("Failed to load Sales & Promo tickets", error);
        if (active) {
          setSalesPromoTickets([]);
        }
      });
    return () => {
      active = false;
    };
  }, [hotelUid]);

  const formatDate = (date) => {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  };

  const getRangeDates = (r) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const end = r === "This month" || r === "Yesterday" ? formatDate(yesterday) : formatDate(today);
    if (r === "Custom") {
      return { start: customStart, end: customEnd };
    }
    if (r === "Yesterday") {
      const y = formatDate(yesterday);
      return { start: y, end: y };
    }
    if (r === "Last 7 days") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: formatDate(start), end };
    }
    if (r === "Last 30 days") {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { start: formatDate(start), end };
    }
    if (r === "Last month") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(start), end: formatDate(endDate) };
    }
    if (r === "YTD") {
      const start = new Date(today.getFullYear(), 0, 1);
      return { start: formatDate(start), end };
    }
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: formatDate(start), end };
  };

  const rangeBounds = useMemo(() => getRangeDates(range), [range, customStart, customEnd]);
  const rangeStart = rangeBounds?.start;
  const rangeEnd = rangeBounds?.end;

  const selectedDays = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    let days = dateRange(rangeStart, rangeEnd);
    if (!Array.isArray(days) || days.length === 0) return [];
    if (weekday) {
      const idx = weekdayFilterOrder.indexOf(weekday);
      if (idx !== -1) {
        days = days.filter((d) => new Date(d).getDay() === idx);
      }
    }
    return days;
  }, [rangeStart, rangeEnd, weekday]);

  const contractTypeMap = useMemo(() => {
    const map = new Map();
    (contractTypes || []).forEach((type) => {
      if (!type) return;
      const normalized = String(type?.name || "").trim().toLowerCase();
      if (!normalized) return;
      const coefficientRaw = type?.coefficient;
      const coefficient = Number.isFinite(coefficientRaw) ? coefficientRaw : 1;
      map.set(normalized, { ...type, coefficient });
    });
    return map;
  }, [contractTypes]);

  const staffMap = useMemo(() => {
    const map = new Map();
    (staffMembers || []).forEach((member) => {
      if (!member) return;
      const identifier = member.id || member.key || member.name;
      if (!identifier) return;
      map.set(String(identifier), member);
    });
    return map;
  }, [staffMembers]);

  const outletKeyToName = useMemo(() => {
    const map = new Map();
    (outlets || []).forEach((ot, index) => {
      if (!ot) return;
      const key = ot.id || ot.key || ot.name || `outlet-${index}`;
      if (!key) return;
      const name = ot.name || String(key);
      map.set(String(key), name);
    });
    return map;
  }, [outlets]);

  useEffect(() => {
    if (!hotelUid) {
      setStaffCostTotal(0);
      setStaffCostLoading(false);
      return;
    }

    const start = rangeStart;
    const end = rangeEnd;
    if (!start || !end) {
      setStaffCostTotal(0);
      setStaffCostByDay({});
      setStaffCostLoading(false);
      return;
    }

    if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
      setStaffCostTotal(0);
      setStaffCostByDay({});
      setStaffCostLoading(false);
      return;
    }

    let active = true;
    setStaffCostLoading(true);

    Promise.all(
      selectedDays.map((day) =>
        getScheduleForDate(hotelUid, day)
          .then((data) => ({ day, assignments: data?.assignments || {} }))
          .catch((error) => {
            console.error("Failed to load schedule for staff cost", error);
            return { day, assignments: {} };
          })
      )
    )
      .then((results) => {
        if (!active) return;
        let total = 0;
        const perDay = {};
        results.forEach(({ day, assignments }) => {
          let dayTotal = 0;
          Object.entries(assignments || {}).forEach(([outletKey, entries]) => {
            if (!Array.isArray(entries) || entries.length === 0) return;
            const outletName = outletKeyToName.get(String(outletKey)) || String(outletKey);
            if (outlet && outletName !== outlet) return;
            entries.forEach((entry) => {
              if (!entry) return;
              const staffKey = getEntryStaffIdentifier(entry);
              if (!staffKey) return;
              const staffMember = staffMap.get(String(staffKey)) || staffMap.get(staffKey);
              const hours = calculateEntryHours(entry);
              const hourlyCost = getStaffHourlyCost(staffMember, contractTypeMap);
              dayTotal += hours * (hourlyCost ?? 0);
            });
          });
          perDay[day] = dayTotal;
          total += dayTotal;
        });
        setStaffCostTotal(total);
        setStaffCostByDay(perDay);
      })
      .catch((error) => {
        console.error("Failed to calculate staff cost", error);
        if (active) {
          setStaffCostTotal(0);
          setStaffCostByDay({});
        }
      })
      .finally(() => {
        if (active) {
          setStaffCostLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [hotelUid, rangeStart, rangeEnd, outlet, staffMap, outletKeyToName, selectedDays, contractTypeMap]);

  const salesPromoTotal = useMemo(() => {
    if (!rangeStart || !rangeEnd) {
      return 0;
    }
    return (salesPromoTickets || []).reduce((sum, ticket) => {
      if (!ticket || !ticket.date) return sum;
      if (ticket.date < rangeStart || ticket.date > rangeEnd) return sum;
      if (outlet && ticket.outlet !== outlet) return sum;
      const subOutlets = Array.isArray(ticket.subOutlets) ? ticket.subOutlets : [];
      const ticketTotal = subOutlets.reduce((subtotal, subOutlet) => {
        if (!subOutlet) return subtotal;
        const amount = Number.parseFloat(subOutlet.amount ?? 0);
        return subtotal + (Number.isNaN(amount) ? 0 : amount);
      }, 0);
      return sum + ticketTotal;
    }, 0);
  }, [salesPromoTickets, rangeStart, rangeEnd, outlet]);

  useEffect(() => {
    if (!hotelUid || !outlets.length || !Object.keys(categories).length) {
      return;
    }
    const start = rangeStart;
    const end = rangeEnd;
    if (range === "Custom" && (!start || !end)) return;
    if (!start || !end) return;
    if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
      setLabels([]);
      setRevenueSeries([]);
      setPurchaseSeries([]);
      setSalesPromoCostSeries([]);
      setStaffCostSeries([]);
      setProfitSeries([]);
      setProfitTotal(0);
      setAvgRevenuePerDay(0);
      setAvgPurchasePerDay(0);
      setAvgProfitPerDay(0);
      setWeekdayRevenue({});
      return;
    }
    (async () => {
      const days = selectedDays;
      const revenueDocs = await Promise.all(days.map((d) => getRevenue(hotelUid, d)));
      const typeMap = {};
      const parentMap = {};
      outlets.forEach((o) => {
        (o.subOutlets || []).forEach((s) => {
          typeMap[s.name] = s.type;
          parentMap[s.name] = o.name;
        });
      });

      const revenuePerDay = [];
      let rev = 0;
      let foodRev = 0;
      let bevRev = 0;
      let otherRev = 0;
      const weekdayTotals = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
        Sunday: 0,
      };
      const weekdayCounts = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
        Sunday: 0,
      };
      days.forEach((day, idx) => {
        const doc = revenueDocs[idx] || {};
        let dayTotal = 0;
        Object.entries(doc).forEach(([name, value]) => {
          if (outlet && parentMap[name] !== outlet) return;
          const n = Number(value) || 0;
          const t = typeMap[name];
          if (typeFilter === "Food" && t !== "food") return;
          if (typeFilter === "Beverage" && t !== "beverage") return;
          if (typeFilter === "Food & Beverage" && t !== "food" && t !== "beverage") return;
          dayTotal += n;
          rev += n;
          if (t === "food") foodRev += n;
          else if (t === "beverage") bevRev += n;
          else otherRev += n;
        });
        revenuePerDay.push(dayTotal);
        const wd = new Date(day).toLocaleDateString("en-US", { weekday: "long" });
        weekdayTotals[wd] += dayTotal;
        weekdayCounts[wd] += 1;
      });

      const purchasePromises = days.map(async (d) => {
        if (typeFilter === "Food & Beverage") {
          const [f, b] = await Promise.all([
            getBoughtItemsTotal(hotelUid, d, d, {
              selectedOutlet: outlet,
              dataType: "Food",
              categories,
            }),
            getBoughtItemsTotal(hotelUid, d, d, {
              selectedOutlet: outlet,
              dataType: "Beverage",
              categories,
            }),
          ]);
          return f + b;
        }
        return getBoughtItemsTotal(hotelUid, d, d, {
          selectedOutlet: outlet,
          dataType: typeFilter === "Food" ? "Food" : "Beverage",
          categories,
        });
      });
      const rawPurchasesPerDay = await Promise.all(purchasePromises);

      const selectedDaySet = new Set(days);
      const salesPromoCostByDayCalc = {};
      (salesPromoTickets || []).forEach((ticket) => {
        if (!ticket || !ticket.date || !selectedDaySet.has(ticket.date)) return;
        if (outlet && ticket.outlet !== outlet) return;
        const subOutlets = Array.isArray(ticket.subOutlets) ? ticket.subOutlets : [];
        subOutlets.forEach((subOutlet) => {
          if (!subOutlet) return;
          const amount = Number.parseFloat(subOutlet.amount ?? 0);
          if (!Number.isFinite(amount)) return;
          const type = typeMap[subOutlet.name];
          if (!type) return;
          if (typeFilter === "Food" && type !== "food") return;
          if (typeFilter === "Beverage" && type !== "beverage") return;
          if (typeFilter === "Food & Beverage" && type !== "food" && type !== "beverage") return;
          let multiplier = 0;
          if (type === "food") multiplier = 0.24;
          else if (type === "beverage") multiplier = 0.18;
          if (multiplier === 0) return;
          const day = ticket.date;
          const normalizedAmount = Math.abs(amount);
          salesPromoCostByDayCalc[day] = (salesPromoCostByDayCalc[day] || 0) + normalizedAmount * multiplier;
        });
      });
      const salesPromoCostSeriesValues = days.map((day) => salesPromoCostByDayCalc[day] || 0);
      const staffSeries = days.map((day) => staffCostByDay?.[day] || 0);

      const [foodCost, bevCost] = await Promise.all([
        getBoughtItemsTotal(hotelUid, start, end, {
          selectedOutlet: outlet,
          dataType: "Food",
          categories,
        }),
        getBoughtItemsTotal(hotelUid, start, end, {
          selectedOutlet: outlet,
          dataType: "Beverage",
          categories,
        }),
      ]);

      setLabels(days.map(d => {
        const dt = new Date(d);
        return `${dt.getDate()}/${dt.getMonth() + 1}`;
      }));
      setRevenueSeries(revenuePerDay);
      setSalesPromoCostSeries(salesPromoCostSeriesValues);
      setStaffCostSeries(staffSeries);
      setRevenue(rev);
      let computedFoodCost = foodCost;
      let computedBevCost = bevCost;
      if (useCostOverride) {
        const foodOverrideRatio = Number.isFinite(foodCostOverride)
          ? foodCostOverride / 100
          : 0;
        const beverageOverrideRatio = Number.isFinite(beverageCostOverride)
          ? beverageCostOverride / 100
          : 0;
        computedFoodCost = foodRev * foodOverrideRatio;
        computedBevCost = bevRev * beverageOverrideRatio;
      }

      const costNumerator =
        typeFilter === "Food"
          ? computedFoodCost
          : typeFilter === "Beverage"
          ? computedBevCost
          : computedFoodCost + computedBevCost;
      const costDenominator =
        typeFilter === "Food"
          ? foodRev
          : typeFilter === "Beverage"
          ? bevRev
          : foodRev + bevRev;
      const selectedCostRatio = costDenominator ? costNumerator / costDenominator : 0;
      const purchasesPerDay = revenuePerDay.map((value) => value * selectedCostRatio);

      const fbCostPerDayRaw = useCostOverride ? purchasesPerDay : rawPurchasesPerDay;
      const fbCostPerDay = fbCostPerDayRaw.map((value) =>
        Number.isFinite(value) ? value : 0
      );
      const totalFbCostForAverage = fbCostPerDay.reduce((sum, value) => sum + value, 0);
      const dailyProfit = revenuePerDay.map((dayRevenue, idx) => {
        const fbCost = fbCostPerDay[idx] || 0;
        const promoCost = salesPromoCostSeriesValues[idx] || 0;
        const staffCost = staffSeries[idx] || 0;
        const baseProfit = dayRevenue - fbCost - staffCost;
        return useCostOverride ? baseProfit : baseProfit + promoCost;
      });
      const totalProfit = dailyProfit.reduce((sum, value) => sum + value, 0);

      setPurchaseSeries(fbCostPerDay);
      setFoodCostTotal(computedFoodCost);
      setBevCostTotal(computedBevCost);
      setFoodCostPct(foodRev ? (computedFoodCost / foodRev) * 100 : 0);
      setBevCostPct(bevRev ? (computedBevCost / bevRev) * 100 : 0);
      setSalesMix({ Food: foodRev, Beverage: bevRev, Other: otherRev });
      setAvgRevenuePerDay(days.length ? rev / days.length : 0);
      setAvgPurchasePerDay(days.length ? totalFbCostForAverage / days.length : 0);
      setProfitSeries(dailyProfit);
      setProfitTotal(totalProfit);
      setAvgProfitPerDay(days.length ? totalProfit / days.length : 0);
      const weekdayAvg = Object.fromEntries(
        Object.keys(weekdayTotals).map((wd) => [
          wd,
          weekdayCounts[wd] ? weekdayTotals[wd] / weekdayCounts[wd] : 0,
        ])
      );
      setWeekdayRevenue(weekdayAvg);

      // ----- Top & Worst Sellers -----
      const productTotals = await getProductSalesRange(
        hotelUid,
        start,
        end,
        outlet
      );
      const lsMap = {};
      products.forEach(p => {
        if (p.lightspeedId !== undefined) {
          lsMap[String(p.lightspeedId).trim()] = p;
        }
      });
      const food = [];
      const beverage = [];
      Object.entries(productTotals).forEach(([pid, data]) => {
        const prod = lsMap[pid];
        if (!prod) return;
        const type = productCategories[prod.category]?.type;
        if (type === "food") {
          food.push({ name: prod.name, qty: data.qty, revenue: data.total });
        } else if (type === "beverage") {
          beverage.push({ name: prod.name, qty: data.qty, revenue: data.total });
        }
      });
      food.sort((a, b) => b.revenue - a.revenue);
      beverage.sort((a, b) => b.revenue - a.revenue);
      setTopFood(food.slice(0, 5));
      setWorstFood(
        [...food]
          .filter((item) => item.revenue > 0)
          .sort((a, b) => a.revenue - b.revenue)
          .slice(0, 5)
      );
      setTopBeverage(beverage.slice(0, 5));
      setWorstBeverage(
        [...beverage]
          .filter((item) => item.revenue > 0)
          .sort((a, b) => a.revenue - b.revenue)
          .slice(0, 5)
      );
    })();
  }, [hotelUid, range, rangeStart, rangeEnd, outlet, categories, productCategories, outlets, typeFilter, products, weekday, selectedDays, salesPromoTickets, staffCostByDay, useCostOverride, foodCostOverride, beverageCostOverride]);

  if (!languageLoaded) return null;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <DashboardHeader
        hotelName={formattedHotelName}
        today={today}
        onLogout={handleLogout}
        onMenuToggle={() => setMobileMenuOpen(true)}
        sections={sections}
      />
      <MobileSidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} sections={sections} />

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* FILTER BAR */}
        <div className="bg-white rounded-xl shadow px-4 py-3 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{t("filters.outlet.label")}</span>
              <select
                value={outlet}
                onChange={(e) => setOutlet(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm"
              >
                <option value="">{t("filters.outlet.all")}</option>
                {outlets.map(ot => (
                  <option key={ot.id || ot.name} value={ot.name}>
                    {ot.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{t("filters.type.label")}</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm"
              >
                <option value="Food & Beverage">{typeFilterLabelMap["Food & Beverage"]}</option>
                <option value="Food">{typeFilterLabelMap.Food}</option>
                <option value="Beverage">{typeFilterLabelMap.Beverage}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{t("filters.range.label")}</span>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm"
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

            {range === "Custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-500">{t("filters.range.to")}</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{t("filters.weekday.label")}</span>
              <select
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm"
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

            <div className="md:ml-auto">
              <button className="bg-[#b41f1f] text-white text-sm px-3 py-1.5 rounded-md hover:brightness-95">
                {t("filters.apply")}
              </button>
            </div>
          </div>
        </div>

        {/* KPI TILES */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div
            className="rounded-xl shadow bg-white px-4 py-4 cursor-pointer hover:bg-gray-50"
            onClick={() => navigate("/revenue-center")}
          >
            <div className="text-gray-500 text-xs mb-1">{t("kpis.revenue")}</div>
            <div className="text-xl font-bold">
              € {revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="rounded-xl shadow bg-white px-4 py-4">
            <div className="text-gray-500 text-xs mb-1">
              {typeFilter === "Food & Beverage"
                ? t("kpis.costPercentage.fb")
                : typeFilter === "Food"
                ? t("kpis.costPercentage.food")
                : t("kpis.costPercentage.beverage")}
            </div>
            <div className="text-xl font-bold">
              {(
                typeFilter === "Food"
                  ? foodCostPct
                  : typeFilter === "Beverage"
                  ? bevCostPct
                  : fbCostPct
              ).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              €
              {" "}
              {(
                typeFilter === "Food"
                  ? foodCostTotal
                  : typeFilter === "Beverage"
                  ? bevCostTotal
                  : totalFBCost
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="rounded-xl shadow bg-white px-4 py-4">
            <div className="text-gray-500 text-xs mb-1">{t("kpis.staffCost")}</div>
            {staffCostLoading ? (
              <div className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                {t("loading")}
              </div>
            ) : (
              <div className="text-xl font-bold">
                € {staffCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
          <div
            className="rounded-xl shadow bg-white px-4 py-4 cursor-pointer hover:bg-gray-50"
            onClick={() => navigate("/salespromo")}
          >
            <div className="text-gray-500 text-xs mb-1">{t("kpis.salesPromo")}</div>
            <div className="text-xl font-bold">
              € {salesPromoTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="rounded-xl shadow bg-white px-4 py-4">
            <div className="text-gray-500 text-xs mb-1">{t("kpis.netProfit")}</div>
            {staffCostLoading ? (
              <div className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                {t("loading")}
              </div>
            ) : (
              <div className="text-xl font-bold">
                € {profitTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* CHARTS LAYER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Grote line chart (links, 2/3) */}
          <div className="md:col-span-2 bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">{t("charts.revenueTitle")}</h3>
              <span className="text-xs text-gray-400">{rangeDisplayLabel}</span>
            </div>
            <RevenueLineChart
              labels={labels}
              revenueValues={revenueSeries}
              purchaseValues={purchaseSeries}
              salesPromoCostValues={salesPromoCostSeries}
              staffCostValues={staffCostSeries}
              profitValues={profitSeries}
            />
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs text-gray-600">
              <div className="bg-gray-50 rounded-md p-2 text-center">
                <div className="font-medium">{t("charts.avgRevenuePerDay")}</div>
                <div>€ {avgRevenuePerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2 text-center">
                <div className="font-medium">{t("charts.avgPurchasePerDay")}</div>
                <div>€ {avgPurchasePerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2 text-center">
                <div className="font-medium">{t("charts.grossProfitPerDay")}</div>
                {staffCostLoading ? (
                  <div className="text-gray-400">{t("loading")}</div>
                ) : (
                  <div>
                    € {avgProfitPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-md p-2 text-center">
                <div className="font-medium">{t("charts.budgetMtd")}</div>
                <div className="text-gray-400">{t("charts.comingSoon")}</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2 text-center">
                <div className="font-medium">{t("charts.target")}</div>
                <div className="text-gray-400">{t("charts.comingSoon")}</div>
              </div>
            </div>
          </div>

          {/* Rechter kolom met 2 kaarten */}
          <div className="flex flex-col gap-6">
            {/* Revenue by weekday pie */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{t("charts.averageRevenueByWeekday")}</h3>
              </div>
              <WeekdayRevenuePie
                labels={weekdayChartOrder.map((day) => weekdayLabelMap[day])}
                values={weekdayChartOrder.map((day) => weekdayRevenue[day] || 0)}
              />
            </div>

            {/* Sales mix donut */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{t("charts.salesMixTitle")}</h3>
                <span className="text-xs text-gray-400">{t("charts.salesMixSubtitle")}</span>
              </div>
              <SalesMixDonut
                labels={Object.keys(salesMix).map((key) => salesMixLabelMap[key] || key)}
                values={Object.values(salesMix)}
              />
              <div className="mt-3 grid grid-cols-3 text-center text-xs">
                {Object.entries(salesMix).map(([k, v]) => {
                  const color =
                    k === "Food" ? "text-[#8B4513]" :
                    k === "Beverage" ? "text-[#3B82F6]" :
                    "text-gray-500";
                  const displayLabel = salesMixLabelMap[k] || k;
                  return (
                    <div key={k} className={color}>
                      <span className="font-semibold">{displayLabel}</span><br/>€ {v.toLocaleString()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RANKINGS: Best & Worst Sellers */}
        <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Best Sellers */}
          <div
            className="bg-white rounded-xl shadow p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => navigate("/sold-products")}
          >
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("rankings.bestSellers")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">{t("rankings.food")}</h4>
                <HorizontalBarChart
                  labels={topFood.map(i => i.name)}
                  values={topFood.map(i => i.revenue)}
                  color="#16a34a"
                />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">{t("rankings.beverage")}</h4>
                <HorizontalBarChart
                  labels={topBeverage.map(i => i.name)}
                  values={topBeverage.map(i => i.revenue)}
                  color="#3b82f6"
                />
              </div>
            </div>
          </div>

          {/* Worst Sellers */}
          <div
            className="bg-white rounded-xl shadow p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => navigate("/sold-products")}
          >
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("rankings.worstSellers")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">{t("rankings.food")}</h4>
                <HorizontalBarChart
                  labels={worstFood.map(i => i.name)}
                  values={worstFood.map(i => i.revenue)}
                  color="#dc2626"
                />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">{t("rankings.beverage")}</h4>
                <HorizontalBarChart
                  labels={worstBeverage.map(i => i.name)}
                  values={worstBeverage.map(i => i.revenue)}
                  color="#f97316"
                />
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
