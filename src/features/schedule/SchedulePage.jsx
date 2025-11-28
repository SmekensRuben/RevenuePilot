import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { usePermission } from "../../hooks/usePermission";
import {
  getOutlets,
  getStaff,
  getStaffContractTypes,
} from "services/firebaseSettings";
import {
  formatDateKey,
  getScheduleForDate,
  saveScheduleAssignments,
} from "services/firebaseSchedule";
import { Dialog } from "@headlessui/react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Combobox } from "components/ui/combobox";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const TOTAL_MINUTES_IN_DAY = 24 * 60;
const VIEW_MODES = {
  DAILY: "daily",
  WEEKLY: "weekly",
};

const SECTIONS = {
  SCHEDULE: "schedule",
  STAFF_COSTS: "staffCosts",
};

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

function getStaffHourlyCost(
  staffMember = {},
  contractTypeMap = new Map()
) {
  const wage = getStaffHourlyWage(staffMember);
  if (!Number.isFinite(wage)) {
    return null;
  }
  const normalizedContract = String(staffMember?.contractType || "")
    .trim()
    .toLowerCase();
  const contractType = contractTypeMap.get(normalizedContract);
  const coefficientRaw = contractType?.coefficient;
  const coefficient = Number.isFinite(coefficientRaw) ? coefficientRaw : 1;
  const cost = wage * coefficient;
  return Number.isFinite(cost) ? cost : wage;
}

function getStaffIdentifier(staffMember = {}) {
  return staffMember.id || staffMember.key || staffMember.name || "";
}

function getEntryStaffIdentifier(entry = {}) {
  return entry.staffId || entry.staffKey || entry.staffName || "";
}

function getLocaleFromLanguage(language) {
  switch (language) {
    case "nl":
      return "nl-NL";
    case "fr":
      return "fr-FR";
    default:
      return "en-GB";
  }
}

function normalizeAssignments(assignments = {}) {
  const normalized = {};
  Object.entries(assignments).forEach(([key, entries]) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const cleaned = entries
      .filter(Boolean)
      .map((entry) => ({
        ...entry,
        outletKey: entry.outletKey || key,
      }))
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    if (cleaned.length > 0) {
      normalized[key] = cleaned;
    }
  });
  return normalized;
}

function getStartOfWeek(date) {
  const reference = new Date(date);
  reference.setHours(0, 0, 0, 0);
  const day = reference.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Start the week on Monday
  reference.setDate(reference.getDate() + diff);
  return reference;
}

function AddShiftModal({
  open,
  onClose,
  onSave,
  staffOptions,
  outletOptions,
  defaultOutletKey,
  t,
  saving,
  initialShift,
}) {
  const [outletKey, setOutletKey] = useState(defaultOutletKey || "");
  const [staffId, setStaffId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const initialStaffId = useMemo(() => (initialShift ? getEntryStaffIdentifier(initialShift) : ""), [initialShift]);

  const normalizedOutletOptions = useMemo(() => {
    const options = Array.isArray(outletOptions) ? [...outletOptions] : [];
    if (
      (initialShift?.outletKey || defaultOutletKey) &&
      !options.some((option) => option.key === (initialShift?.outletKey || defaultOutletKey))
    ) {
      options.push({
        key: initialShift?.outletKey || defaultOutletKey,
        label: initialShift?.outletName || initialShift?.outletLabel || defaultOutletKey,
        outletName: initialShift?.outletName || defaultOutletKey,
        subOutletName: null,
      });
    }
    return options;
  }, [outletOptions, defaultOutletKey, initialShift]);

  const normalizedStaffOptions = useMemo(() => {
    const options = Array.isArray(staffOptions) ? [...staffOptions] : [];
    if (initialStaffId && !options.some((member) => getStaffIdentifier(member) === initialStaffId)) {
      options.push({
        id: initialStaffId,
        name: initialShift?.staffName || initialStaffId,
        job: initialShift?.staffJob || "",
      });
    }
    return options;
  }, [staffOptions, initialStaffId, initialShift]);

  useEffect(() => {
    if (!open) return;
    setOutletKey(initialShift?.outletKey || defaultOutletKey || normalizedOutletOptions?.[0]?.key || "");
    setStaffId(initialStaffId || "");
    setStartTime(initialShift?.startTime || "");
    setEndTime(initialShift?.endTime || "");
    setError("");
  }, [open, defaultOutletKey, normalizedOutletOptions, initialShift, initialStaffId]);

  const selectedStaffMember = useMemo(
    () => normalizedStaffOptions.find((member) => getStaffIdentifier(member) === staffId) || null,
    [normalizedStaffOptions, staffId]
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!staffId) {
      setError(t("scheduleStaffRequired"));
      return;
    }
    if (!outletKey) {
      setError(t("scheduleOutletRequired"));
      return;
    }
    const duration = calculateShiftDurationMinutes(startTime, endTime);
    if (duration <= 0) {
      setError(t("scheduleInvalidTimes"));
      return;
    }
    const staffMember = normalizedStaffOptions.find((member) => {
      const identifier = getStaffIdentifier(member);
      return identifier === staffId;
    });
    if (!staffMember) {
      setError(t("scheduleStaffRequired"));
      return;
    }
    const outlet = normalizedOutletOptions.find((option) => option.key === outletKey);
    onSave({
      outletKey,
      outletLabel: outlet?.label || outletKey,
      outletName: outlet?.outletName || outlet?.label || outletKey,
      subOutletName: outlet?.subOutletName || null,
      staffId,
      staffName: staffMember.name,
      staffJob: (staffMember.job || staffMember.staffJob || "").trim(),
      staffKey: staffId,
      startTime,
      endTime,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-4 py-8">
          <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {t("scheduleAddShiftTitle")}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-gray-500">
              {t("scheduleAddShiftSubtitle")}
          </Dialog.Description>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="outlet">
                {t("scheduleOutlet")}
              </label>
              <select
                id="outlet"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={outletKey}
                onChange={(event) => setOutletKey(event.target.value)}
                disabled={saving}
              >
                {normalizedOutletOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="staff">
                {t("scheduleStaff")}
              </label>
              <Combobox
                id="staff"
                name="staff"
                value={selectedStaffMember}
                onChange={(member) => {
                  if (!member) {
                    setStaffId("");
                    return;
                  }
                  setStaffId(getStaffIdentifier(member));
                }}
                options={normalizedStaffOptions}
                displayValue={(member) => {
                  if (!member) return "";
                  return member.job ? `${member.name} – ${member.job}` : member.name;
                }}
                getOptionValue={(member) => getStaffIdentifier(member)}
                placeholder={t("scheduleSelectStaff")}
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="start">
                  {t("scheduleStart")}
                </label>
                <input
                  id="start"
                  type="time"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="end">
                  {t("scheduleEnd")}
                </label>
                <input
                  id="end"
                  type="time"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={onClose}
                disabled={saving}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-blue-300"
                disabled={saving}
              >
                <Plus className="h-4 w-4" />
                {saving ? t("scheduleSaving") : t("scheduleSave")}
              </button>
            </div>
          </form>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}

export default function SchedulePage() {
  const { hotelName, hotelUid, language, roles } = useHotelContext();
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  const { t } = useTranslation("hoteldashboard");
  const canView = usePermission("schedule", "view");
  const canEdit = usePermission("schedule", "edit");

  const [outlets, setOutlets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [weeklyAssignments, setWeeklyAssignments] = useState({});
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [loadingBaseData, setLoadingBaseData] = useState(false);
  const [loadingDailySchedule, setLoadingDailySchedule] = useState(false);
  const [loadingWeeklySchedule, setLoadingWeeklySchedule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [viewMode, setViewMode] = useState(VIEW_MODES.DAILY);
  const [activeSection, setActiveSection] = useState(SECTIONS.SCHEDULE);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalOutletKey, setModalOutletKey] = useState("");
  const [editingShift, setEditingShift] = useState(null);
  const [staffSearchTerm, setStaffSearchTerm] = useState("");
  const [contractTypes, setContractTypes] = useState([]);

  useEffect(() => {
    if (!isAdmin && activeSection !== SECTIONS.SCHEDULE) {
      setActiveSection(SECTIONS.SCHEDULE);
    }
  }, [isAdmin, activeSection]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const selectedDateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  const locale = useMemo(() => getLocaleFromLanguage(language), [language]);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale]
  );
  const hoursFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale]
  );

  const normalizedStaffSearchTerm = useMemo(
    () => staffSearchTerm.trim().toLowerCase(),
    [staffSearchTerm]
  );

  const formattedSelectedDate = useMemo(
    () =>
      selectedDate.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [selectedDate, locale]
  );

  useEffect(() => {
    if (!hotelUid) return;
    let active = true;
    setLoadingBaseData(true);
    setLoadError("");
    Promise.all([
      getOutlets(hotelUid),
      getStaff(),
      getStaffContractTypes(hotelUid),
    ])
      .then(([
        fetchedOutlets = [],
        fetchedStaff = [],
        fetchedContractTypes = [],
      ]) => {
        if (!active) return;
        setOutlets(fetchedOutlets);
        setStaff(fetchedStaff);
        setContractTypes(fetchedContractTypes);
      })
      .catch((error) => {
        console.error("Failed to load schedule dependencies", error);
        if (!active) return;
        setLoadError(t("scheduleLoadError"));
      })
      .finally(() => {
        if (active) {
          setLoadingBaseData(false);
        }
      });
    return () => {
      active = false;
    };
  }, [hotelUid, t]);

  useEffect(() => {
    if (!hotelUid || !selectedDateKey) return;
    let active = true;
    setLoadingDailySchedule(true);
    setLoadError("");
    getScheduleForDate(hotelUid, selectedDateKey)
      .then((data) => {
        if (!active) return;
        setAssignments(normalizeAssignments(data.assignments));
      })
      .catch((error) => {
        console.error("Failed to load schedule", error);
        if (!active) return;
        setLoadError(t("scheduleLoadError"));
        setAssignments({});
      })
      .finally(() => {
        if (active) {
          setLoadingDailySchedule(false);
        }
      });
    return () => {
      active = false;
    };
  }, [hotelUid, selectedDateKey, t]);

  const weekDates = useMemo(() => {
    const startOfWeek = getStartOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);
      const key = formatDateKey(date);
      return {
        date,
        key,
        weekdayShort: date.toLocaleDateString(locale, { weekday: "short" }),
        dayLabel: date.toLocaleDateString(locale, { day: "numeric" }),
        monthShort: date.toLocaleDateString(locale, { month: "short" }),
      };
    });
  }, [selectedDate, locale]);

  const weeklyRangeLabel = useMemo(() => {
    if (weekDates.length === 0) return "";
    const firstDay = weekDates[0].date;
    const lastDay = weekDates[weekDates.length - 1].date;
    const startLabel = firstDay.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
    });
    const endLabel = lastDay.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
    });
    return `${startLabel} – ${endLabel}`;
  }, [weekDates, locale]);

  useEffect(() => {
    if (!hotelUid || viewMode !== VIEW_MODES.WEEKLY) return;
    let active = true;
    setLoadingWeeklySchedule(true);
    setLoadError("");
    Promise.all(
      weekDates.map(async ({ key }) => {
        if (!key) return { key, assignments: {} };
        const data = await getScheduleForDate(hotelUid, key);
        return { key, assignments: normalizeAssignments(data.assignments) };
      })
    )
      .then((results) => {
        if (!active) return;
        const collected = {};
        results.forEach(({ key, assignments: dayAssignments }) => {
          if (!key) return;
          collected[key] = dayAssignments || {};
        });
        setWeeklyAssignments(collected);
      })
      .catch((error) => {
        console.error("Failed to load weekly schedule", error);
        if (!active) return;
        setLoadError(t("scheduleLoadError"));
        setWeeklyAssignments({});
      })
      .finally(() => {
        if (active) {
          setLoadingWeeklySchedule(false);
        }
      });
    return () => {
      active = false;
    };
  }, [hotelUid, viewMode, weekDates, t]);

  const outletOptions = useMemo(() => {
    if (!Array.isArray(outlets)) return [];
    return outlets
      .map((outlet, outletIndex) => {
        const key = outlet.id || outlet.key || outlet.name || `outlet-${outletIndex}`;
        const department = String(
          outlet?.department || outlet?.outletDepartment || ""
        )
          .trim()
          .toUpperCase();
        if (department !== "F&B") {
          return null;
        }
        return {
          key: String(key),
          label: outlet.name || String(key),
          outletName: outlet.name || String(key),
          subOutletName: null,
        };
      })
      .filter(Boolean);
  }, [outlets]);

  const staffById = useMemo(() => {
    const map = new Map();
    (staff || []).forEach((member) => {
      const identifier = getStaffIdentifier(member);
      if (!identifier) return;
      map.set(identifier, member);
    });
    return map;
  }, [staff]);

  const contractTypeMap = useMemo(() => {
    const map = new Map();
    (contractTypes || []).forEach((type) => {
      const key = String(type?.name || "")
        .trim()
        .toLowerCase();
      if (!key) return;
      map.set(key, type);
    });
    return map;
  }, [contractTypes]);

  const outletOptionsMap = useMemo(() => {
    const map = new Map();
    (outletOptions || []).forEach((option) => {
      if (!option?.key) return;
      map.set(String(option.key), option);
    });
    return map;
  }, [outletOptions]);

  const scheduleSections = useMemo(() => {
    const sections = [];
    Object.entries(assignments || {}).forEach(([rawOutletKey, outletEntries = []]) => {
      if (!Array.isArray(outletEntries) || outletEntries.length === 0) return;
      const outletKey = String(rawOutletKey);
      const staffMap = new Map();
      outletEntries.forEach((entry) => {
        if (!entry) return;
        const staffKey = getEntryStaffIdentifier(entry);
        if (!staffKey) return;
        const staffMember = staffById.get(staffKey);
        const current = staffMap.get(staffKey) || {
          id: staffKey,
          name: staffMember?.name || entry.staffName || staffKey,
          job: staffMember?.job || entry.staffJob || "",
          entries: [],
        };
        current.entries.push(entry);
        staffMap.set(staffKey, current);
      });
      const rows = Array.from(staffMap.values())
        .map((row) => ({
          ...row,
          entries: [...row.entries].sort((a, b) =>
            (a.startTime || "").localeCompare(b.startTime || "")
          ),
        }))
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      const filteredRows = normalizedStaffSearchTerm
        ? rows.filter((row) =>
            row.name.toLowerCase().includes(normalizedStaffSearchTerm)
          )
        : rows;
      if (filteredRows.length === 0) return;
      const option = outletOptionsMap.get(outletKey);
      const label =
        option?.label ||
        outletEntries[0]?.outletName ||
        outletEntries[0]?.outletLabel ||
        outletKey;
      const subLabel =
        option?.subOutletName || outletEntries[0]?.subOutletName || "";
      sections.push({
        outletKey,
        label,
        subLabel: subLabel || "",
        rows: filteredRows,
      });
    });
    sections.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
    return sections;
  }, [assignments, outletOptionsMap, staffById, normalizedStaffSearchTerm]);

  const weeklySections = useMemo(() => {
    if (!weekDates.length) return [];
    const sectionsMap = new Map();
    weekDates.forEach(({ key }) => {
      const dayAssignments = weeklyAssignments[key] || {};
      Object.entries(dayAssignments).forEach(([outletKeyRaw, outletEntries = []]) => {
        if (!Array.isArray(outletEntries) || outletEntries.length === 0) return;
        const outletKey = String(outletKeyRaw);
        const option = outletOptionsMap.get(outletKey);
        const baseSection =
          sectionsMap.get(outletKey) ||
          {
            outletKey,
            label:
              option?.label ||
              outletEntries[0]?.outletName ||
              outletEntries[0]?.outletLabel ||
              outletKey,
            subLabel: option?.subOutletName || outletEntries[0]?.subOutletName || "",
            rows: new Map(),
          };
        outletEntries.forEach((entry) => {
          if (!entry) return;
          const staffKey = getEntryStaffIdentifier(entry);
          if (!staffKey) return;
          const staffMember = staffById.get(staffKey);
          const baseRow =
            baseSection.rows.get(staffKey) ||
            {
              id: staffKey,
              name: staffMember?.name || entry.staffName || staffKey,
              job: staffMember?.job || entry.staffJob || "",
              days: new Map(),
            };
          const existing = baseRow.days.get(key) || [];
          existing.push(entry);
          baseRow.days.set(key, existing);
          baseSection.rows.set(staffKey, baseRow);
        });
        sectionsMap.set(outletKey, baseSection);
      });
    });

    const sections = Array.from(sectionsMap.values())
      .map((section) => {
        const rows = Array.from(section.rows.values())
          .map((row) => {
            const cells = weekDates.map(({ key }) => {
              const entriesForDay = [...(row.days.get(key) || [])].sort((a, b) =>
                (a.startTime || "").localeCompare(b.startTime || "")
              );
              if (entriesForDay.length === 0) return "";
              return entriesForDay
                .map((entry) => `${entry.startTime} – ${entry.endTime}`)
                .join("\n");
            });
            return {
              ...row,
              cells,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

        const filteredRows = normalizedStaffSearchTerm
          ? rows.filter((row) =>
              row.name.toLowerCase().includes(normalizedStaffSearchTerm)
            )
          : rows;

        return {
          ...section,
          rows: filteredRows,
        };
      })
      .filter((section) => section.rows.length > 0);

    sections.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
    return sections;
  }, [
    weekDates,
    weeklyAssignments,
    outletOptionsMap,
    staffById,
    normalizedStaffSearchTerm,
  ]);

  const staffCostDailySections = useMemo(() => {
    const sections = [];
    Object.entries(assignments || {}).forEach(([rawOutletKey, outletEntries = []]) => {
      if (!Array.isArray(outletEntries) || outletEntries.length === 0) return;
      const outletKey = String(rawOutletKey);
      const staffMap = new Map();
      outletEntries.forEach((entry) => {
        if (!entry) return;
        const staffKey = getEntryStaffIdentifier(entry);
        if (!staffKey) return;
        const staffMember = staffById.get(staffKey);
        const hours = calculateEntryHours(entry);
        const hourlyWage = getStaffHourlyWage(staffMember);
        const hourlyCost = getStaffHourlyCost(staffMember, contractTypeMap);
        const effectiveHourlyCost =
          Number.isFinite(hourlyCost) && hourlyCost !== null
            ? hourlyCost
            : hourlyWage;
        const cost = hours * (effectiveHourlyCost ?? 0);
        const current = staffMap.get(staffKey) || {
          id: staffKey,
          name: staffMember?.name || entry.staffName || staffKey,
          job: staffMember?.job || entry.staffJob || "",
          totalHours: 0,
          totalCost: 0,
          hourlyCost: null,
        };
        current.totalHours += hours;
        current.totalCost += cost;
        current.hourlyCost = effectiveHourlyCost ?? null;
        staffMap.set(staffKey, current);
      });
      const rows = Array.from(staffMap.values())
        .map((row) => ({ ...row }))
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      const filteredRows = normalizedStaffSearchTerm
        ? rows.filter((row) =>
            row.name.toLowerCase().includes(normalizedStaffSearchTerm)
          )
        : rows;
      if (filteredRows.length === 0) return;
      const option = outletOptionsMap.get(outletKey);
      const fallbackEntry = outletEntries[0];
      const label =
        option?.label ||
        fallbackEntry?.outletName ||
        fallbackEntry?.outletLabel ||
        outletKey;
      const subLabel = option?.subOutletName || fallbackEntry?.subOutletName || "";
      const totalHours = filteredRows.reduce(
        (sum, row) => sum + row.totalHours,
        0
      );
      const totalCost = filteredRows.reduce(
        (sum, row) => sum + row.totalCost,
        0
      );
      sections.push({
        outletKey,
        label,
        subLabel: subLabel || "",
        rows: filteredRows,
        totalHours,
        totalCost,
      });
    });
    sections.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
    return sections;
  }, [
    assignments,
    outletOptionsMap,
    staffById,
    normalizedStaffSearchTerm,
    contractTypeMap,
  ]);

  const staffCostWeeklySections = useMemo(() => {
    if (!weekDates.length) return [];
    const sectionsMap = new Map();
    weekDates.forEach(({ key }) => {
      const dayAssignments = weeklyAssignments[key] || {};
      Object.entries(dayAssignments).forEach(([outletKeyRaw, outletEntries = []]) => {
        if (!Array.isArray(outletEntries) || outletEntries.length === 0) return;
        const outletKey = String(outletKeyRaw);
        const option = outletOptionsMap.get(outletKey);
        const baseSection =
          sectionsMap.get(outletKey) ||
          {
            outletKey,
            label:
              option?.label ||
              outletEntries[0]?.outletName ||
              outletEntries[0]?.outletLabel ||
              outletKey,
            subLabel: option?.subOutletName || outletEntries[0]?.subOutletName || "",
            rows: new Map(),
          };
        outletEntries.forEach((entry) => {
          if (!entry) return;
          const staffKey = getEntryStaffIdentifier(entry);
          if (!staffKey) return;
          const staffMember = staffById.get(staffKey);
          const hours = calculateEntryHours(entry);
          const hourlyWage = getStaffHourlyWage(staffMember);
          const hourlyCost = getStaffHourlyCost(staffMember, contractTypeMap);
          const effectiveHourlyCost =
            Number.isFinite(hourlyCost) && hourlyCost !== null
              ? hourlyCost
              : hourlyWage;
          const cost = hours * (effectiveHourlyCost ?? 0);
          const baseRow =
            baseSection.rows.get(staffKey) ||
            {
              id: staffKey,
              name: staffMember?.name || entry.staffName || staffKey,
              job: staffMember?.job || entry.staffJob || "",
              hourlyCost: null,
              dayHours: new Map(),
              dayCosts: new Map(),
              totalHours: 0,
              totalCost: 0,
            };
          baseRow.hourlyCost = effectiveHourlyCost ?? null;
          baseRow.dayHours.set(key, (baseRow.dayHours.get(key) || 0) + hours);
          baseRow.dayCosts.set(key, (baseRow.dayCosts.get(key) || 0) + cost);
          baseRow.totalHours += hours;
          baseRow.totalCost += cost;
          baseSection.rows.set(staffKey, baseRow);
        });
        sectionsMap.set(outletKey, baseSection);
      });
    });
    const sections = Array.from(sectionsMap.values())
      .map((section) => {
        const rows = Array.from(section.rows.values())
          .map((row) => {
            const cells = weekDates.map(({ key }) => ({
              hours: row.dayHours.get(key) || 0,
              cost: row.dayCosts.get(key) || 0,
            }));
            return {
              ...row,
              cells,
            };
          })
          .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          );
        const filteredRows = normalizedStaffSearchTerm
          ? rows.filter((row) =>
              row.name.toLowerCase().includes(normalizedStaffSearchTerm)
            )
          : rows;
        if (filteredRows.length === 0) {
          return null;
        }
        const totalsByDay = weekDates.map((_, index) =>
          filteredRows.reduce(
            (acc, row) => {
              const cell = row.cells[index] || { hours: 0, cost: 0 };
              return {
                hours: acc.hours + cell.hours,
                cost: acc.cost + cell.cost,
              };
            },
            { hours: 0, cost: 0 }
          )
        );
        const totalHours = filteredRows.reduce(
          (sum, row) => sum + row.totalHours,
          0
        );
        const totalCost = filteredRows.reduce(
          (sum, row) => sum + row.totalCost,
          0
        );
        return {
          outletKey: section.outletKey,
          label: section.label,
          subLabel: section.subLabel || "",
          rows: filteredRows,
          totalsByDay,
          totalHours,
          totalCost,
        };
      })
      .filter(Boolean)
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
      );
    return sections;
  }, [
    weekDates,
    weeklyAssignments,
    outletOptionsMap,
    staffById,
    normalizedStaffSearchTerm,
    contractTypeMap,
  ]);

  const handleOpenModal = (outletKey = "", shift = null) => {
    const defaultKey = shift?.outletKey || outletKey || outletOptions[0]?.key || "";
    setModalOutletKey(defaultKey);
    setEditingShift(shift);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    if (saving) return;
    setShowAddModal(false);
    setModalOutletKey("");
    setEditingShift(null);
  };

  const handleSaveAssignments = async (nextAssignments) => {
    if (!hotelUid || !selectedDateKey) return;
    setSaving(true);
    setSaveError("");
    try {
      await saveScheduleAssignments(hotelUid, selectedDateKey, nextAssignments);
    } catch (error) {
      console.error("Failed to save schedule", error);
      setSaveError(t("scheduleSaveError"));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleAddShift = async (payload) => {
    const newEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...payload,
    };
    const previous = assignments;
    const next = normalizeAssignments({
      ...previous,
      [newEntry.outletKey]: [...(previous[newEntry.outletKey] || []), newEntry],
    });
    setAssignments(next);
    try {
      await handleSaveAssignments(next);
      handleCloseModal();
    } catch (error) {
      setAssignments(previous);
    }
  };

  const handleUpdateShift = async (payload) => {
    if (!editingShift) return;
    const previous = assignments;
    const normalizedPrevious = normalizeAssignments(previous);
    const oldOutletKey = editingShift.outletKey;
    const updatedEntry = {
      ...editingShift,
      ...payload,
      id: editingShift.id,
    };
    const withoutOld = { ...normalizedPrevious };
    if (oldOutletKey) {
      const remaining = (withoutOld[oldOutletKey] || []).filter((entry) => entry.id !== editingShift.id);
      if (remaining.length > 0) {
        withoutOld[oldOutletKey] = remaining;
      } else {
        delete withoutOld[oldOutletKey];
      }
    }
    const targetKey = updatedEntry.outletKey;
    const nextAssignments = normalizeAssignments({
      ...withoutOld,
      [targetKey]: [...(withoutOld[targetKey] || []), updatedEntry],
    });
    setAssignments(nextAssignments);
    try {
      await handleSaveAssignments(nextAssignments);
      handleCloseModal();
    } catch (error) {
      setAssignments(previous);
    }
  };

  const handleSubmitShift = async (payload) => {
    if (editingShift) {
      await handleUpdateShift(payload);
    } else {
      await handleAddShift(payload);
    }
  };

  const handleRemoveShift = async (outletKey, shiftId) => {
    const previous = assignments;
    const filtered = { ...previous };
    const updatedEntries = (filtered[outletKey] || []).filter((entry) => entry.id !== shiftId);
    if (updatedEntries.length > 0) {
      filtered[outletKey] = updatedEntries;
    } else {
      delete filtered[outletKey];
    }
    const next = normalizeAssignments(filtered);
    setAssignments(next);
    try {
      await handleSaveAssignments(next);
    } catch (error) {
      setAssignments(previous);
    }
  };

  const goToPreviousDay = () => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + (viewMode === VIEW_MODES.WEEKLY ? -7 : -1));
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  const goToNextDay = () => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + (viewMode === VIEW_MODES.WEEKLY ? 7 : 1));
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  const goToToday = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setSelectedDate(now);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = "/login";
  };

  if (!canView) return <div>{t("noAccessModule")}</div>;

  const staffCostSections =
    viewMode === VIEW_MODES.WEEKLY ? staffCostWeeklySections : staffCostDailySections;

  const isLoading =
    loadingBaseData ||
    (viewMode === VIEW_MODES.WEEKLY ? loadingWeeklySchedule : loadingDailySchedule);

  const previousLabel =
    viewMode === VIEW_MODES.WEEKLY
      ? t("schedulePreviousWeek")
      : t("schedulePreviousDay");
  const currentLabel =
    viewMode === VIEW_MODES.WEEKLY ? t("scheduleThisWeek") : t("scheduleToday");
  const nextLabel =
    viewMode === VIEW_MODES.WEEKLY ? t("scheduleNextWeek") : t("scheduleNextDay");

  const isStaffCostsSection = activeSection === SECTIONS.STAFF_COSTS;
  const headerTitle = isStaffCostsSection
    ? viewMode === VIEW_MODES.WEEKLY
      ? t("scheduleStaffCostsWeeklyTitle")
      : t("scheduleStaffCostsDailyTitle")
    : viewMode === VIEW_MODES.WEEKLY
    ? t("scheduleWeeklyTitle")
    : t("scheduleDailyTitle");
  const headerSubtitle = isStaffCostsSection
    ? viewMode === VIEW_MODES.WEEKLY
      ? t("scheduleStaffCostsWeeklySubtitle", { range: weeklyRangeLabel })
      : t("scheduleStaffCostsDailySubtitle", { date: formattedSelectedDate })
    : viewMode === VIEW_MODES.WEEKLY
    ? t("scheduleWeeklySubtitle", { range: weeklyRangeLabel })
    : t("scheduleDailySubtitle", { date: formattedSelectedDate });

  const hasOutletOptions = outletOptions.length > 0;
  const weeklyAssignmentsEmpty = Object.values(weeklyAssignments || {}).every(
    (value) => Object.keys(value || {}).length === 0
  );
  const shouldShowNoOutlets =
    !isLoading &&
    !loadError &&
    !saveError &&
    !hasOutletOptions &&
    (viewMode === VIEW_MODES.WEEKLY
      ? weeklyAssignmentsEmpty
      : Object.keys(assignments || {}).length === 0);

  const shouldShowNoStaff =
    !isLoading &&
    !loadError &&
    !saveError &&
    !shouldShowNoOutlets &&
    (viewMode === VIEW_MODES.WEEKLY
      ? weeklySections.length === 0
      : scheduleSections.length === 0);

  const shouldShowNoStaffCosts =
    !isLoading &&
    !loadError &&
    !saveError &&
    !shouldShowNoOutlets &&
    staffCostSections.length === 0;

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("scheduleTitle")}</h1>
            <p className="text-gray-600">{t("scheduleSubtitle")}</p>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                  activeSection === SECTIONS.SCHEDULE
                    ? "bg-blue-600 text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => setActiveSection(SECTIONS.SCHEDULE)}
              >
                {t("scheduleSectionSchedule")}
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                  activeSection === SECTIONS.STAFF_COSTS
                    ? "bg-blue-600 text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => setActiveSection(SECTIONS.STAFF_COSTS)}
                disabled={!isAdmin}
              >
                {t("scheduleSectionStaffCosts")}
              </button>
            </div>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {headerTitle}
                </h2>
                <p className="text-sm text-gray-500">
                  {headerSubtitle}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:ml-auto sm:items-end">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={goToPreviousDay}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {previousLabel}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={goToToday}
                  >
                    <CalendarDays className="h-4 w-4" />
                    {currentLabel}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={goToNextDay}
                  >
                    {nextLabel}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <div className="w-full min-w-[220px] sm:w-auto">
                    <label className="sr-only" htmlFor="schedule-staff-search">
                      {t("scheduleSearchStaffLabel")}
                    </label>
                    <input
                      id="schedule-staff-search"
                      type="search"
                      value={staffSearchTerm}
                      onChange={(event) => setStaffSearchTerm(event.target.value)}
                      placeholder={t("scheduleSearchStaffPlaceholder")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="inline-flex rounded-full border border-gray-200 bg-gray-100 p-1 text-sm font-medium text-gray-600">
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 transition ${
                        viewMode === VIEW_MODES.DAILY
                          ? "bg-white text-gray-900 shadow"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                      onClick={() => setViewMode(VIEW_MODES.DAILY)}
                    >
                      {t("scheduleViewDaily")}
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 transition ${
                        viewMode === VIEW_MODES.WEEKLY
                          ? "bg-white text-gray-900 shadow"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                      onClick={() => setViewMode(VIEW_MODES.WEEKLY)}
                    >
                      {t("scheduleViewWeekly")}
                    </button>
                  </div>
                  {!isStaffCostsSection && canEdit && outletOptions.length > 0 && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-blue-300"
                      onClick={() => handleOpenModal(outletOptions[0]?.key || "")}
                      disabled={saving || staff.length === 0 || outletOptions.length === 0}
                    >
                      <Plus className="h-4 w-4" />
                      {t("scheduleAdd")}
                    </button>
                  )}
                </div>
              </div>
            </header>

            <div className="px-6 py-4">
              {(loadError || saveError) && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {loadError || saveError}
                </div>
              )}

              {isLoading ? (
                <div className="flex h-32 items-center justify-center text-sm text-gray-500">
                  {t("scheduleLoading")}
                </div>
              ) : shouldShowNoOutlets ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
                  {t("scheduleNoOutlets")}
                </div>
              ) : isStaffCostsSection ? (
                shouldShowNoStaffCosts ? (
                  <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
                    {t("scheduleStaffCostsNoData")}
                  </div>
                ) : (
                  <div className="space-y-8">
                    {viewMode === VIEW_MODES.WEEKLY
                      ? staffCostSections.map((section) => (
                          <div
                            key={`${section.outletKey}-weekly-costs`}
                            className="rounded-xl border border-gray-200 bg-white shadow-sm"
                          >
                            <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h3 className="text-base font-semibold text-gray-900">{section.label}</h3>
                                {section.subLabel ? (
                                  <p className="text-sm text-gray-500">{section.subLabel}</p>
                                ) : null}
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="w-48 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                      {t("scheduleStaffColumn")}
                                    </th>
                                    {weekDates.map((day) => (
                                      <th
                                        key={`${section.outletKey}-${day.key}-cost`}
                                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                                      >
                                        <div className="flex flex-col">
                                          <span className="text-sm font-semibold text-gray-900">{day.weekdayShort}</span>
                                          <span className="text-xs text-gray-500">{day.dayLabel} {day.monthShort}</span>
                                        </div>
                                      </th>
                                    ))}
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                      {t("scheduleStaffCostsTotalColumn")}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                  {section.rows.map((row) => (
                                    <tr key={`${section.outletKey}-${row.id}-cost`}>
                                      <td className="whitespace-nowrap px-4 py-3 align-top">
                                        <div className="text-sm font-medium text-gray-900">{row.name}</div>
                                        {row.job && <div className="text-xs text-gray-500">{row.job}</div>}
                                        {row.hourlyCost !== null && (
                                          <div className="text-xs text-gray-400">
                                            {t("scheduleStaffCostsHourlyWageShort", {
                                              value: currencyFormatter.format(row.hourlyCost ?? 0),
                                            })}
                                          </div>
                                        )}
                                      </td>
                                      {row.cells.map((cell, index) => (
                                        <td
                                          key={`${section.outletKey}-${row.id}-${weekDates[index]?.key || index}-cost`}
                                          className="px-4 py-3 align-top"
                                        >
                                          {cell.hours > 0 || cell.cost > 0 ? (
                                            <div className="flex flex-col gap-1">
                                              <span className="text-sm font-medium text-gray-900">
                                                {hoursFormatter.format(cell.hours || 0)} {t("scheduleStaffCostsHoursUnit")}
                                              </span>
                                              <span className="text-xs text-gray-500">
                                                {currencyFormatter.format(cell.cost || 0)}
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="text-sm text-gray-400">—</div>
                                          )}
                                        </td>
                                      ))}
                                      <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col gap-1">
                                          <span className="text-sm font-semibold text-gray-900">
                                            {hoursFormatter.format(row.totalHours || 0)} {t("scheduleStaffCostsHoursUnit")}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {currencyFormatter.format(row.totalCost || 0)}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                      {t("scheduleStaffCostsTotalLabel")}
                                    </th>
                                    {section.totalsByDay.map((total, index) => (
                                      <th
                                        key={`${section.outletKey}-totals-${weekDates[index]?.key || index}`}
                                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                                      >
                                        {total.hours > 0 || total.cost > 0 ? (
                                          <div className="flex flex-col gap-1">
                                            <span className="text-sm font-semibold text-gray-900">
                                              {hoursFormatter.format(total.hours || 0)} {t("scheduleStaffCostsHoursUnit")}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              {currencyFormatter.format(total.cost || 0)}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-sm text-gray-400">—</span>
                                        )}
                                      </th>
                                    ))}
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                      <div className="flex flex-col gap-1">
                                        <span className="text-sm font-semibold text-gray-900">
                                          {hoursFormatter.format(section.totalHours || 0)} {t("scheduleStaffCostsHoursUnit")}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {currencyFormatter.format(section.totalCost || 0)}
                                        </span>
                                      </div>
                                    </th>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        ))
                      : staffCostSections.map((section) => (
                          <div
                            key={`${section.outletKey}-daily-costs`}
                            className="rounded-xl border border-gray-200 bg-white shadow-sm"
                          >
                            <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h3 className="text-base font-semibold text-gray-900">{section.label}</h3>
                                {section.subLabel ? (
                                  <p className="text-sm text-gray-500">{section.subLabel}</p>
                                ) : null}
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="w-64 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                      {t("scheduleStaffColumn")}
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                      {t("scheduleStaffCostsHoursColumn")}
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                      {t("scheduleStaffCostsHourlyWageColumn")}
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                      {t("scheduleStaffCostsCostColumn")}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                  {section.rows.map((row) => (
                                    <tr key={`${section.outletKey}-${row.id}-daily`}>
                                      <td className="px-4 py-3 align-top">
                                        <div className="text-sm font-medium text-gray-900">{row.name}</div>
                                        {row.job && <div className="text-xs text-gray-500">{row.job}</div>}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                        {hoursFormatter.format(row.totalHours || 0)} {t("scheduleStaffCostsHoursUnit")}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                        {row.hourlyCost === null
                                          ? "—"
                                          : currencyFormatter.format(row.hourlyCost)}
                                      </td>
                                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                        {currencyFormatter.format(row.totalCost || 0)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                      {t("scheduleStaffCostsTotalLabel")}
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                                      {hoursFormatter.format(section.totalHours || 0)} {t("scheduleStaffCostsHoursUnit")}
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">—</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                                      {currencyFormatter.format(section.totalCost || 0)}
                                    </th>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        ))}
                  </div>
                )
              ) : shouldShowNoStaff ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
                  {t("scheduleNoStaff")}
                </div>
              ) : (
                <div className="space-y-8">
                  {viewMode === VIEW_MODES.WEEKLY
                    ? weeklySections.map((section) => (
                        <div
                          key={`${section.outletKey}-weekly`}
                          className="rounded-xl border border-gray-200 bg-white shadow-sm"
                        >
                          <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">
                                {section.label}
                              </h3>
                              {section.subLabel ? (
                                <p className="text-sm text-gray-500">{section.subLabel}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="w-48 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    {t("scheduleStaffColumn")}
                                  </th>
                                  {weekDates.map((day) => (
                                    <th
                                      key={`${section.outletKey}-${day.key}`}
                                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                                    >
                                      <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-900">
                                          {day.weekdayShort}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {day.dayLabel} {day.monthShort}
                                        </span>
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                {section.rows.map((row) => (
                                  <tr key={`${section.outletKey}-${row.id}`}>
                                    <td className="whitespace-nowrap px-4 py-3 align-top">
                                      <div className="text-sm font-medium text-gray-900">
                                        {row.name}
                                      </div>
                                      {row.job && (
                                        <div className="text-xs text-gray-500">{row.job}</div>
                                      )}
                                    </td>
                                    {row.cells.map((cell, index) => (
                                      <td
                                        key={`${section.outletKey}-${row.id}-${weekDates[index]?.key || index}`}
                                        className="px-4 py-3 align-top"
                                      >
                                        {cell ? (
                                          <div className="whitespace-pre-line rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 shadow-sm ring-1 ring-blue-100">
                                            {cell}
                                          </div>
                                        ) : (
                                          <div className="text-sm text-gray-400">—</div>
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    : scheduleSections.map((section) => (
                        <div
                          key={section.outletKey}
                          className="rounded-xl border border-gray-200 bg-white shadow-sm"
                        >
                          <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">
                                {section.label}
                              </h3>
                              {section.subLabel ? (
                                <p className="text-sm text-gray-500">{section.subLabel}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <div className="min-w-[880px]">
                              <div className="grid grid-cols-[200px_1fr]">
                                <div className="border-b border-gray-200 bg-white px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  {t("scheduleStaffColumn")}
                                </div>
                                <div className="border-b border-gray-200 bg-white">
                                  <div className="flex">
                                    {HOURS.map((hour) => (
                                      <div
                                        key={`hour-${section.outletKey}-${hour}`}
                                        className="flex-1 min-w-[60px] border-l border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-500 first:border-l-0"
                                      >
                                        {`${String(hour).padStart(2, "0")}:00`}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {section.rows.map((row) => (
                                  <React.Fragment key={`${section.outletKey}-${row.id}`}>
                                    <div className="border-b border-gray-200 bg-white px-3 py-3">
                                      <div className="text-sm font-medium text-gray-900">
                                        {row.name}
                                      </div>
                                      {row.job && (
                                        <div className="text-xs text-gray-500">{row.job}</div>
                                      )}
                                    </div>
                                    <div className="relative border-b border-gray-200 bg-gradient-to-b from-white to-gray-50 py-3">
                                      <div className="pointer-events-none absolute inset-0">
                                        <div className="flex h-full">
                                          {HOURS.map((hour) => (
                                            <div
                                              key={`grid-${section.outletKey}-${row.id}-${hour}`}
                                              className="flex-1 border-l border-gray-100 first:border-l-0 last:border-r"
                                            />
                                          ))}
                                        </div>
                                      </div>
                                      <div className="relative h-12 md:h-14">
                                        {row.entries.map((entry) => {
                                          const start = parseTimeToMinutes(entry.startTime);
                                          const duration = calculateShiftDurationMinutes(
                                            entry.startTime,
                                            entry.endTime
                                          );
                                          const boundedStart = Math.min(start, TOTAL_MINUTES_IN_DAY);
                                          const maxDuration = Math.min(
                                            duration,
                                            Math.max(TOTAL_MINUTES_IN_DAY - boundedStart, 0)
                                          );
                                          if (maxDuration <= 0) return null;
                                          const left = (boundedStart / TOTAL_MINUTES_IN_DAY) * 100;
                                          const width = (maxDuration / TOTAL_MINUTES_IN_DAY) * 100;
                                          return (
                                            <div
                                              key={entry.id}
                                              className={`absolute top-1.5 bottom-1.5 flex min-w-[48px] items-center gap-3 overflow-hidden rounded-lg border border-blue-400/50 bg-gradient-to-r from-blue-500 to-blue-600 px-3 text-xs font-medium text-white shadow-md ${
                                                canEdit ? "cursor-pointer" : ""
                                              }`}
                                              style={{
                                                left: `${left}%`,
                                                width: `${Math.max(width, 3)}%`,
                                              }}
                                              onClick={() => {
                                                if (canEdit) {
                                                  handleOpenModal(entry.outletKey, entry);
                                                }
                                              }}
                                            >
                                              <div className="flex min-w-0 flex-col gap-0.5">
                                                <span className="truncate text-xs font-semibold">
                                                  {entry.outletName || entry.outletLabel || entry.outletKey}
                                                </span>
                                                <span className="text-[11px] font-normal text-white/80">
                                                  {entry.startTime} – {entry.endTime}
                                                </span>
                                              </div>
                                              {canEdit && (
                                                <button
                                                  type="button"
                                                  className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-white/80 hover:text-white focus:outline-none"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleRemoveShift(entry.outletKey, entry.id);
                                                  }}
                                                  disabled={saving}
                                                >
                                                  {t("scheduleRemove")}
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              )}
            </div>
          </section>
        </div>
        <AddShiftModal
          open={showAddModal}
          onClose={handleCloseModal}
          onSave={handleSubmitShift}
          staffOptions={staff}
          outletOptions={outletOptions}
          defaultOutletKey={modalOutletKey}
          t={t}
          saving={saving}
          initialShift={editingShift}
        />
      </PageContainer>
    </>
  );
}
