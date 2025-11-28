import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import {
  addStaffMember,
  deleteStaffMember,
  getStaffContractTypes,
  getStaffMember,
} from "services/firebaseSettings";
import { formatDateKey, getScheduleForDate } from "services/firebaseSchedule";
import { getSalesPromoTickets, updateSalesPromoTicket } from "services/firebaseSalesPromo";
import {
  getIncompleteTicketsForStaff,
  getTicketChecklistStats,
  getStaffIdentifiers,
  normalizeTicketChecklist,
} from "utils/staff";
import PasswordPromptModal from "components/layout/PasswordPromptModal";
import { verifyCurrentUserPassword } from "services/firebaseAuth";
import { auth } from "@/firebaseConfig";
import { fetchUserProfile } from "services/firebaseUsers";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Dialog } from "@headlessui/react";

const todayLabel = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const validateEmail = email => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const formatContractHours = hours => {
  if (hours === null || hours === undefined || hours === "") return "-";
  const numeric = typeof hours === "number" ? hours : Number.parseFloat(hours);
  if (Number.isNaN(numeric)) return "-";
  return `${numeric.toLocaleString("nl-BE", {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} u/week`;
};

const formatHourlyWage = value => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(numeric)) return "-";
  return `€ ${numeric.toLocaleString("nl-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const parseDateValue = value => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "number") {
    const assumedMilliseconds = value > 1e12 ? value : value * 1000;
    const parsed = new Date(assumedMilliseconds);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      return parseDateValue(value.toDate());
    }

    if (typeof value.seconds === "number") {
      const milliseconds = value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
      return parseDateValue(new Date(milliseconds));
    }
  }

  return null;
};

const getTicketDate = ticket => {
  if (!ticket || typeof ticket !== "object") {
    return null;
  }

  const candidates = [
    ticket.date,
    ticket.dateKey,
    ticket.day,
    ticket.dayKey,
    ticket.createdAt,
    ticket.finalizedAt,
    ticket.timestamp,
  ];

  for (const candidate of candidates) {
    const parsed = parseDateValue(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

const getTicketDateRange = tickets => {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return null;
  }

  const dates = tickets
    .map(getTicketDate)
    .filter(date => date instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) {
    return null;
  }

  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
};

const formatTicketDateRange = range => {
  if (!range) {
    return "";
  }

  const startLabel = formatDate(range.start);
  const endLabel = formatDate(range.end);

  if (!startLabel || startLabel === "-" || !endLabel || endLabel === "-") {
    return "";
  }

  if (startLabel === endLabel) {
    return startLabel;
  }

  return `${startLabel} - ${endLabel}`;
};

const escapeHtml = value => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatDate = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTimeValue = value => {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString("nl-BE", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return trimmed;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toLocaleTimeString("nl-BE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (typeof value === "number") {
    const assumedMilliseconds = value > 1e12 ? value : value * 1000;
    const parsed = new Date(assumedMilliseconds);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString("nl-BE", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "";
  }

  if (typeof value === "object") {
    if (typeof value?.toDate === "function") {
      return formatTimeValue(value.toDate());
    }

    if (typeof value?.seconds === "number") {
      return formatTimeValue(new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1e6));
    }
  }

  return "";
};

const formatTicketTime = ticket => {
  if (!ticket || typeof ticket !== "object") return "-";

  const candidates = [
    ticket.time,
    ticket.hour,
    ticket.hours,
    ticket.startTime,
    ticket.timestamp,
    ticket.createdAt,
    ticket.finalizedAt,
  ];

  for (const candidate of candidates) {
    const formatted = formatTimeValue(candidate);
    if (formatted) {
      return formatted;
    }
  }

  return "-";
};

const SCHEDULE_LOOKAHEAD_DAYS = 14;

const TOTAL_MINUTES_IN_DAY = 24 * 60;

const parseTimeToMinutes = (timeString = "") => {
  if (typeof timeString !== "string") return 0;
  const [hours = "0", minutes = "0"] = timeString.split(":");
  const parsedHours = Number.parseInt(hours, 10);
  const parsedMinutes = Number.parseInt(minutes, 10);
  if (Number.isNaN(parsedHours) || Number.isNaN(parsedMinutes)) return 0;
  return Math.min(Math.max(parsedHours * 60 + parsedMinutes, 0), TOTAL_MINUTES_IN_DAY);
};

const calculateEntryHours = entry => {
  const minutes = calculateShiftDurationMinutes(entry?.startTime, entry?.endTime);
  return minutes / 60;
};

const calculateShiftDurationMinutes = (startTime = "", endTime = "") => {
  if (!startTime || !endTime) return 0;
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === end) return 0;
  let diff = end - start;
  if (diff < 0) {
    diff += TOTAL_MINUTES_IN_DAY;
  }
  return Math.max(Math.min(diff, TOTAL_MINUTES_IN_DAY), 0);
};

const normalizeAssignments = (assignments = {}) => {
  const normalized = {};
  Object.entries(assignments).forEach(([key, entries]) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const cleaned = entries
      .filter(Boolean)
      .map(entry => ({
        ...entry,
        outletKey: entry.outletKey || key,
      }))
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    if (cleaned.length > 0) {
      normalized[key] = cleaned;
    }
  });
  return normalized;
};

const formatHours = value => {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(numeric)) return "0";
  return numeric.toLocaleString("nl-BE", {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

export default function StaffMemberDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const normalizedId = decodeURIComponent(params.staffId || "");
  const { hotelName, roles, hotelUid } = useHotelContext();
  const isAdmin = Array.isArray(roles) && roles.includes("admin");

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    job: "",
    department: "",
    email: "",
    contractType: "",
    contractHours: "",
    hourlyWage: "",
    aapiId: "",
    outletId: "",
  });
  const [deleting, setDeleting] = useState(false);
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [incompleteTickets, setIncompleteTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState("");
  const [templateOwnerName, setTemplateOwnerName] = useState("");
  const [showCorrectedTickets, setShowCorrectedTickets] = useState(false);
  const [ticketUpdateError, setTicketUpdateError] = useState("");
  const [updatingTickets, setUpdatingTickets] = useState({});
  const [correctedPromptOpen, setCorrectedPromptOpen] = useState(false);
  const [pendingTicketsActionType, setPendingTicketsActionType] = useState(null);
  const [contractTypes, setContractTypes] = useState([]);
  const contractTypeFieldId = useId();
  const [sensitiveUnlocked, setSensitiveUnlocked] = useState(false);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordVerifying, setPasswordVerifying] = useState(false);
  const pendingTicketsActionRef = useRef(null);
  const scheduleDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("nl-BE", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    []
  );
  const totalScheduledHours = useMemo(
    () =>
      scheduleEntries.reduce((sum, entry) => {
        const hours = Number.isFinite(entry.hours) ? entry.hours : Number.parseFloat(entry.hours) || 0;
        return sum + hours;
      }, 0),
    [scheduleEntries]
  );
  const visibleTickets = useMemo(
    () =>
      showCorrectedTickets
        ? incompleteTickets
        : incompleteTickets.filter(ticket => !ticket?.corrected),
    [incompleteTickets, showCorrectedTickets]
  );
  const contractTypeOptions = useMemo(
    () =>
      (Array.isArray(contractTypes) ? contractTypes : [])
        .filter(type => type && type.name)
        .map(type => ({ ...type, normalized: type.name.trim().toLowerCase() })),
    [contractTypes]
  );
  const contractTypeMap = useMemo(() => {
    const map = new Map();
    contractTypeOptions.forEach(type => {
      map.set(type.normalized, type);
    });
    return map;
  }, [contractTypeOptions]);
  const { hourlyCost, contractCoefficient } = useMemo(() => {
    if (!isAdmin) {
      return { hourlyCost: null, contractCoefficient: null };
    }
    const wageRaw = member?.hourlyWage;
    const wage =
      wageRaw === null || wageRaw === undefined || wageRaw === ""
        ? null
        : typeof wageRaw === "number"
        ? wageRaw
        : Number.parseFloat(wageRaw);
    if (!Number.isFinite(wage)) {
      return { hourlyCost: null, contractCoefficient: null };
    }
    const normalizedContract = String(member?.contractType || "").trim().toLowerCase();
    const contractType = contractTypeMap.get(normalizedContract);
    const coefficientRaw = contractType?.coefficient;
    const coefficient = Number.isFinite(coefficientRaw) ? coefficientRaw : null;
    const multiplier = coefficient ?? 1;
    const cost = wage * multiplier;
    return {
      hourlyCost: Number.isFinite(cost) ? cost : null,
      contractCoefficient: coefficient,
    };
  }, [contractTypeMap, isAdmin, member]);

  useEffect(() => {
    let isCancelled = false;

    const loadTemplateOwner = async () => {
      try {
        const uid = auth.currentUser?.uid;

        if (!uid) {
          if (!isCancelled) {
            setTemplateOwnerName("");
          }
          return;
        }

        const profile = await fetchUserProfile(uid);
        if (isCancelled) return;

        if (!profile) {
          setTemplateOwnerName("");
          return;
        }

        const fullName = [profile.firstName, profile.lastName]
          .map(value => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
          .join(" ");

        setTemplateOwnerName(fullName);
      } catch (err) {
        console.error(
          "Fout bij ophalen van de ingelogde gebruiker voor e-mailtemplate:",
          err
        );
        if (!isCancelled) {
          setTemplateOwnerName("");
        }
      }
    };

    loadTemplateOwner();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    setSensitiveUnlocked(false);
    setPasswordPromptOpen(false);
    setPasswordError("");
  }, [normalizedId, isAdmin]);

  const handleRequestSensitiveAccess = useCallback(() => {
    if (sensitiveUnlocked || !isAdmin) {
      return;
    }
    setPasswordError("");
    setPasswordPromptOpen(true);
  }, [isAdmin, sensitiveUnlocked]);

  const handleConfirmPassword = useCallback(
    async password => {
      if (passwordVerifying) return;
      setPasswordVerifying(true);
      setPasswordError("");
      try {
        await verifyCurrentUserPassword(password);
        setSensitiveUnlocked(true);
        setPasswordPromptOpen(false);
      } catch (err) {
        const message =
          err?.code === "auth/wrong-password"
            ? "Onjuist wachtwoord. Probeer het opnieuw."
            : err?.message || "Verifiëren mislukt. Probeer het opnieuw.";
        setPasswordError(message);
      } finally {
        setPasswordVerifying(false);
      }
    },
    [passwordVerifying]
  );

  const handleCancelPasswordPrompt = useCallback(() => {
    if (passwordVerifying) return;
    setPasswordPromptOpen(false);
    setPasswordError("");
  }, [passwordVerifying]);
  const contractTypeSuggestions = useMemo(() => {
    const base = contractTypeOptions.map(option => ({ id: option.id, name: option.name }));
    const currentName = String(form.contractType || member?.contractType || "").trim();
    if (
      currentName &&
      !base.some(option => option.name && option.name.trim().toLowerCase() === currentName.toLowerCase())
    ) {
      base.push({ id: "current-contract-type", name: currentName });
    }
    return base;
  }, [contractTypeOptions, form.contractType, member?.contractType]);

  useEffect(() => {
    if (!member || !hotelUid) {
      setScheduleEntries([]);
      return;
    }
    let isMounted = true;
    const identifiers = new Set(getStaffIdentifiers(member, normalizedId));
    if (identifiers.size === 0) {
      setScheduleEntries([]);
      return;
    }
    setScheduleLoading(true);
    setScheduleError("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateEntries = Array.from({ length: SCHEDULE_LOOKAHEAD_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const key = formatDateKey(date);
      return { date, key };
    }).filter(item => item.key);

    if (dateEntries.length === 0) {
      setScheduleEntries([]);
      setScheduleLoading(false);
      return;
    }

    Promise.all(
      dateEntries.map(({ key }) =>
        getScheduleForDate(hotelUid, key)
          .then(data => ({ key, assignments: normalizeAssignments(data?.assignments || {}) }))
          .catch(error => {
            console.error("Failed to load schedule for", key, error);
            return { key, assignments: {} };
          })
      )
    )
      .then(results => {
        if (!isMounted) return;
        const collected = [];
        results.forEach(({ key, assignments }) => {
          const dayInfo = dateEntries.find(entry => entry.key === key);
          if (!dayInfo) return;
          Object.values(assignments || {}).forEach(entries => {
            entries.forEach(entry => {
              const entryIdentifiers = [entry.staffId, entry.staffKey, entry.staffName]
                .map(value => (value ? `${value}`.trim().toLowerCase() : ""))
                .filter(Boolean);
              const matches = entryIdentifiers.some(identifier => identifiers.has(identifier));
              if (!matches) return;
              collected.push({
                id: entry.id || `${key}-${entry.startTime}-${entry.endTime}`,
                date: dayInfo.date,
                dateKey: key,
                outlet:
                  entry.outletLabel || entry.outletName || entry.outletKey || "Onbekend",
                startTime: entry.startTime || "",
                endTime: entry.endTime || "",
                hours: calculateEntryHours(entry),
              });
            });
          });
        });
        collected.sort((a, b) => {
          const diff = a.date.getTime() - b.date.getTime();
          if (diff !== 0) return diff;
          return (a.startTime || "").localeCompare(b.startTime || "");
        });
        setScheduleEntries(collected);
      })
      .catch(error => {
        console.error("Failed to collect schedule entries", error);
        if (!isMounted) return;
        setScheduleError("Kon de planning niet laden.");
        setScheduleEntries([]);
      })
      .finally(() => {
        if (isMounted) {
          setScheduleLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [member, hotelUid, normalizedId]);

  useEffect(() => {
    if (!member || !hotelUid) {
      setIncompleteTickets([]);
      return;
    }
    let isMounted = true;
    setTicketsLoading(true);
    setTicketsError("");
    getSalesPromoTickets(hotelUid)
      .then(tickets => {
        if (!isMounted) return;
        const relevant = getIncompleteTicketsForStaff(member, tickets || [], normalizedId);
        relevant.sort((a, b) => {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;
        });
        setTicketUpdateError("");
        setIncompleteTickets(relevant);
      })
      .catch(error => {
        console.error("Failed to load sales & promo tickets", error);
        if (!isMounted) return;
        setTicketsError("Kon sales & promo tickets niet laden.");
        setIncompleteTickets([]);
        setTicketUpdateError("");
      })
      .finally(() => {
        if (isMounted) {
          setTicketsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [member, hotelUid, normalizedId]);

  useEffect(() => {
    let isMounted = true;
    if (!hotelUid) {
      setContractTypes([]);
      return undefined;
    }
    (async () => {
      try {
        const types = await getStaffContractTypes(hotelUid);
        if (isMounted) {
          setContractTypes(types);
        }
      } catch (error) {
        console.error("Failed to load staff contract types", error);
        if (isMounted) {
          setContractTypes([]);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [hotelUid]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      const staffMember = await getStaffMember(normalizedId);
      if (isMounted) {
        setMember(staffMember);
        if (staffMember) {
          setForm({
            name: staffMember.name || "",
            job: staffMember.job || "",
            department: staffMember.department || "",
            email: staffMember.email || "",
            contractType: staffMember.contractType || "",
            contractHours:
              staffMember.contractHours === null || staffMember.contractHours === undefined
                ? ""
                : String(staffMember.contractHours),
            hourlyWage:
              staffMember.hourlyWage === null || staffMember.hourlyWage === undefined
                ? ""
                : String(staffMember.hourlyWage),
            aapiId: staffMember.aapiId || "",
            outletId: staffMember.outletId || "",
          });
        }
        setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [normalizedId]);

  const handleLogout = async () => {
    if (window.confirm("Wil je uitloggen?")) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const handleToggleTicketCorrected = async (ticket, checked) => {
    if (!ticket?.id || !hotelUid) {
      return;
    }
    setTicketUpdateError("");
    setIncompleteTickets(prev =>
      prev.map(current =>
        current.id === ticket.id
          ? {
              ...current,
              corrected: checked,
            }
          : current
      )
    );
    setUpdatingTickets(prev => ({ ...prev, [ticket.id]: true }));
    try {
      await updateSalesPromoTicket(hotelUid, ticket.id, { corrected: checked });
    } catch (error) {
      console.error("Failed to update ticket corrected status", error);
      setTicketUpdateError("Kon de corrected-status niet opslaan.");
      setIncompleteTickets(prev =>
        prev.map(current =>
          current.id === ticket.id
            ? {
                ...current,
                corrected: !checked,
              }
            : current
        )
      );
    } finally {
      setUpdatingTickets(prev => {
        const next = { ...prev };
        delete next[ticket.id];
        return next;
      });
    }
  };

  const markAllVisibleTicketsAsCorrected = useCallback(async () => {
    if (!hotelUid || !Array.isArray(visibleTickets) || visibleTickets.length === 0) {
      return;
    }

    const ticketsToUpdate = visibleTickets.filter(ticket => ticket?.id && !ticket.corrected);
    if (ticketsToUpdate.length === 0) {
      return;
    }

    const ticketIds = new Set(ticketsToUpdate.map(ticket => ticket.id));
    const previousStatuses = new Map(
      ticketsToUpdate.map(ticket => [ticket.id, Boolean(ticket.corrected)])
    );

    setTicketUpdateError("");
    setIncompleteTickets(prev =>
      prev.map(ticket =>
        ticketIds.has(ticket.id)
          ? {
              ...ticket,
              corrected: true,
            }
          : ticket
      )
    );
    setUpdatingTickets(prev => {
      const next = { ...prev };
      ticketsToUpdate.forEach(ticket => {
        next[ticket.id] = true;
      });
      return next;
    });

    try {
      await Promise.all(
        ticketsToUpdate.map(ticket => updateSalesPromoTicket(hotelUid, ticket.id, { corrected: true }))
      );
    } catch (error) {
      console.error("Failed to mark tickets as corrected", error);
      setTicketUpdateError("Kon de corrected-status niet opslaan.");
      setIncompleteTickets(prev =>
        prev.map(ticket =>
          ticketIds.has(ticket.id)
            ? {
                ...ticket,
                corrected: previousStatuses.get(ticket.id) ?? false,
              }
            : ticket
        )
      );
    } finally {
      setUpdatingTickets(prev => {
        const next = { ...prev };
        ticketsToUpdate.forEach(ticket => {
          delete next[ticket.id];
        });
        return next;
      });
    }
  }, [hotelUid, visibleTickets]);

  const getMistakesTemplateData = useCallback(() => {
    if (!visibleTickets || visibleTickets.length === 0) {
      return null;
    }

    const subjectParts = [];
    if (hotelName) {
      subjectParts.push(hotelName);
    }
    subjectParts.push("Sales & Promo tickets with mistakes");

    const rangeLabel = formatTicketDateRange(getTicketDateRange(visibleTickets));
    if (rangeLabel) {
      subjectParts.push(rangeLabel);
    }

    if (member?.name) {
      subjectParts.push(member.name);
    }
    const subject = subjectParts.join(" - ");

    const greetingTargetHtml = member?.name ? ` for ${escapeHtml(member.name)}` : "";
    const inlineStyles = {
      ticketWrapper: "width: 100%; border-collapse: separate; border-spacing: 0;",
      ticketWrapperCell: "padding: 0;",
      ticketCardTable: "width: 100%; border-collapse: separate; border-spacing: 0;",
      ticketCard:
        "border: 1px solid #000000; mso-border-alt: 1px solid #000000; border-radius: 8px; padding: 14px 16px; background-color: #ffffff; box-shadow: 0 6px 12px rgba(15, 23, 42, 0.08);",
      ticketHeader:
        "width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;",
      ticketIndex: "font-weight: 700; font-size: 16px; color: #0f172a; white-space: nowrap;",
      ticketPeriod: "font-size: 12px; color: #334155; text-align: right;",
      ticketInfo:
        "width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #d7dce4;",
      ticketDetailLabel:
        "width: 90px; font-weight: 600; color: #1e293b; padding: 0 8px 4px 0; vertical-align: top; font-size: 12px;",
      ticketDetailValue: "color: #0f172a; padding: 0 0 4px 0; font-size: 12px;",
      ticketChecklist: "width: 100%; border-collapse: separate; border-spacing: 0;",
      ticketChecklistHeading: "padding: 0 0 6px 0;",
      checklistItemChecked: "font-size: 12px; color: #16a34a; font-weight: 600;",
      checklistItemUnchecked: "font-size: 12px; color: #dc2626; font-weight: 600;",
      checklistItemEmpty: "font-size: 12px; font-style: italic; color: #475569;",
    };
    const ticketsHtml = visibleTickets
      .map((ticket, index) => {
        const formattedDate = formatDate(ticket?.date);
        const formattedTime = formatTicketTime(ticket);
        const outletLabel = ticket?.outlet ? ticket.outlet : "-";
        const typeLabel = ticket?.type ? ticket.type : "-";
        const receiptNumber = ticket?.receiptNumber ? `${ticket.receiptNumber}` : "";
        const checklistItems = normalizeTicketChecklist(ticket?.checklist);

        const periodParts = [];
        if (formattedDate && formattedDate !== "-") {
          periodParts.push(formattedDate);
        }
        if (formattedTime && formattedTime !== "-") {
          periodParts.push(formattedTime);
        }

        const infoRows = [
          { label: "Outlet", value: outletLabel },
          { label: "Type", value: typeLabel },
        ];

        if (receiptNumber) {
          infoRows.push({ label: "Receipt #", value: receiptNumber });
        }

        if (ticket?.reason) {
          infoRows.push({ label: "Remark", value: ticket.reason });
        }

        const infoRowsHtml = infoRows
          .map(row => {
            const formattedValue = escapeHtml(row.value).replace(/\r?\n/g, "<br />");
            return `
              <tr>
                <td class="ticket-detail-label" style="${inlineStyles.ticketDetailLabel}">${row.label}</td>
                <td class="ticket-detail-value" style="${inlineStyles.ticketDetailValue}">${formattedValue}</td>
              </tr>
            `;
          })
          .join("");

        const checklistItemsHtml =
          checklistItems.length > 0
            ? checklistItems
                .map(item => {
                  const statusClass = item.checked ? "checked" : "unchecked";
                  const label = escapeHtml(item.label || "Checklist item").replace(/\r?\n/g, "<br />");
                  const statusStyle =
                    statusClass === "checked"
                      ? inlineStyles.checklistItemChecked
                      : inlineStyles.checklistItemUnchecked;
                  return `<tr><td class="checklist-item ${statusClass}" style="${statusStyle}">${label}</td></tr>`;
                })
                .join("")
            : `<tr><td class="checklist-item empty" style="${inlineStyles.checklistItemEmpty}">No checklist items recorded.</td></tr>`;

        const periodLabel =
          periodParts.length > 0
            ? escapeHtml(periodParts.join(" · "))
            : "No date recorded";

        return `
          <div class="ticket-block">
            <table class="ticket-wrapper" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${inlineStyles.ticketWrapper}">
              <tr>
                <td class="ticket-wrapper-cell" style="${inlineStyles.ticketWrapperCell}">
                  <table class="ticket-card-table" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${inlineStyles.ticketCardTable}">
                    <tr>
                      <td class="ticket-card" style="${inlineStyles.ticketCard}">
                        <table class="ticket-header" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${inlineStyles.ticketHeader}">
                          <tr>
                            <td class="ticket-index" style="${inlineStyles.ticketIndex}">${index + 1}.</td>
                            <td class="ticket-period" style="${inlineStyles.ticketPeriod}">${periodLabel}</td>
                          </tr>
                        </table>
                        <table class="ticket-info" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${inlineStyles.ticketInfo}">
                          ${infoRowsHtml}
                        </table>
                        <table class="ticket-checklist" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${inlineStyles.ticketChecklist}">
                          <tr>
                            <td class="ticket-checklist-heading" style="${inlineStyles.ticketChecklistHeading}"><strong style="font-size: 14px; color: #1e293b;">Checklist</strong></td>
                          </tr>
                          ${checklistItemsHtml}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>
        `;
      })
      .join("");

    const periodHtml = rangeLabel
      ? `<p><strong>Date range:</strong> ${escapeHtml(rangeLabel)}</p>`
      : '<p><strong>Date range:</strong> n/a</p>';

    const senderNameHtml = templateOwnerName
      ? `<p>${escapeHtml(templateOwnerName)}</p>`
      : "";

    const styles = `
      body, .pdf-root {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 24px 12px;
        color: #000000;
        background-color: #ffffff;
      }
      .container {
        width: 100%;
        max-width: 560px;
        margin: 0 auto;
        padding: 0 0 24px;
      }
      .printable-header {
        margin-bottom: 18px;
      }
      h1 {
        font-size: 18px;
        margin: 0 0 12px;
      }
      p {
        line-height: 1.5;
        margin: 0 0 12px;
        font-size: 13px;
      }
      .summary {
        margin: 12px 0 0;
      }
      .summary p {
        margin: 0 0 6px;
        font-size: 12px;
      }
      .tickets {
        margin-top: 16px;
      }
      .ticket-block {
        margin-bottom: 12px;
      }
      .ticket-block:last-child {
        margin-bottom: 0;
      }
      .ticket-wrapper {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
      }
      .ticket-wrapper-cell {
        padding: 0;
      }
      .ticket-card-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
      }
      .ticket-card {
        border: 1px solid #000000 !important;
        mso-border-alt: 1px solid #000000;
        border-radius: 8px;
        padding: 14px 16px;
        background-color: #ffffff;
        box-shadow: 0 6px 12px rgba(15, 23, 42, 0.08);
      }
      .ticket-header {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e5e7eb;
      }
      .ticket-header td {
        padding: 0;
      }
      .ticket-index {
        font-weight: 700;
        font-size: 16px;
        color: #0f172a;
        white-space: nowrap;
      }
      .ticket-period {
        font-size: 12px;
        color: #334155;
        text-align: right;
      }
      .ticket-info {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px dashed #d7dce4;
      }
      .ticket-detail-label {
        width: 90px;
        font-weight: 600;
        color: #1e293b;
        padding: 0 8px 4px 0;
        vertical-align: top;
        font-size: 12px;
      }
      .ticket-detail-value {
        color: #0f172a;
        padding: 0 0 4px 0;
        font-size: 12px;
      }
      .ticket-checklist {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
      }
      .ticket-checklist-heading {
        padding: 0 0 6px 0;
      }
      .checklist-item {
        padding: 0 0 4px 0;
        font-size: 12px;
      }
      .checklist-item.checked {
        color: #16a34a;
        font-weight: 600;
      }
      .checklist-item.unchecked {
        color: #dc2626;
        font-weight: 600;
      }
      .checklist-item.empty {
        font-style: italic;
        color: #475569;
      }
      .printable-footer {
        margin-top: 20px;
      }
    `;

    const bodyContent = `
      <div class="pdf-root">
        <div class="container">
          <div class="printable-header">
            <h1>Sales &amp; Promo tickets with mistakes${greetingTargetHtml}</h1>
            <p>Hello,</p>
            <p>Please find below the Sales &amp; Promo tickets for this period, including their checklists.</p>
            <div class="summary">
              ${periodHtml}
              <p><strong>Tickets included:</strong> ${visibleTickets.length}</p>
            </div>
          </div>
          <div class="tickets">
            ${ticketsHtml}
          </div>
          <div class="printable-footer">
            <p>Kind regards,</p>
            ${senderNameHtml}
          </div>
        </div>
      </div>
    `;

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${styles}</style>
  </head>
  <body>
    ${bodyContent}
  </body>
</html>`;

    const printableContent = `<style>${styles}</style>${bodyContent}`;

    const normalizedName = (member?.name || "staff-member")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const recipientEmail = member?.email ? member.email.trim() : "";

    return {
      subject,
      htmlBody,
      printableContent,
      normalizedName,
      recipientEmail,
    };
  }, [visibleTickets, hotelName, member, templateOwnerName]);

  const executeDownloadMistakesEmail = useCallback(async () => {
    const template = getMistakesTemplateData();
    if (!template) {
      return;
    }

    const { subject, htmlBody, recipientEmail, normalizedName } = template;
    const newline = "\r\n";
    const normalizedBody = htmlBody.replace(/\r?\n/g, newline);
    const emailContent = [
      "X-Unsent: 1",
      `Subject: ${subject}`,
      `To: ${recipientEmail}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      normalizedBody,
    ].join(newline);

    const blob = new Blob([emailContent], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const filename = normalizedName
      ? `sales-promo-mistakes-${normalizedName}.eml`
      : "sales-promo-mistakes.eml";

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }, [getMistakesTemplateData]);

  const executeDownloadMistakesPdf = useCallback(async () => {
    const template = getMistakesTemplateData();
    if (!template) {
      return;
    }

    const { printableContent, normalizedName } = template;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 32;
    const marginY = 32;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxContentWidth = pageWidth - marginX * 2;

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = `${maxContentWidth}px`;
    container.style.backgroundColor = "#ffffff";
    container.innerHTML = printableContent;
    document.body.appendChild(container);

    try {
      await new Promise(resolve => {
        if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
          resolve();
          return;
        }
        window.requestAnimationFrame(() => resolve());
      });

      const devicePixelRatio =
        typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;

      const sections = [];
      const header = container.querySelector(".printable-header");
      if (header) {
        sections.push(header);
      }
      sections.push(...Array.from(container.querySelectorAll(".ticket-block")));
      const footer = container.querySelector(".printable-footer");
      if (footer) {
        sections.push(footer);
      }

      if (sections.length === 0) {
        console.warn("No printable sections found for Sales & Promo PDF export.");
        return;
      }

      let currentY = marginY;
      let hasContent = false;

      for (let index = 0; index < sections.length; index += 1) {
        const element = sections[index];
        const canvas = await html2canvas(element, {
          scale: Math.max(devicePixelRatio, 2),
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        if (!canvasWidth || !canvasHeight) {
          continue;
        }

        const imageData = canvas.toDataURL("image/png");
        const availableHeight = pageHeight - marginY * 2;
        const widthScale = maxContentWidth / canvasWidth;
        const heightScale = availableHeight / canvasHeight;
        const renderScale = Math.min(widthScale, heightScale, 1);
        const renderWidth = canvasWidth * renderScale;
        const renderHeight = canvasHeight * renderScale;

        if (currentY !== marginY && currentY + renderHeight > pageHeight - marginY) {
          doc.addPage();
          currentY = marginY;
        }

        const offsetX = marginX + (maxContentWidth - renderWidth) / 2;
        doc.addImage(imageData, "PNG", offsetX, currentY, renderWidth, renderHeight);
        hasContent = true;
        currentY += renderHeight;

        if (index < sections.length - 1) {
          currentY += 12;
        }
      }

      if (!hasContent) {
        console.warn("Failed to render any sections for Sales & Promo PDF export.");
        return;
      }

      const filename = normalizedName
        ? `sales-promo-mistakes-${normalizedName}.pdf`
        : "sales-promo-mistakes.pdf";
      doc.save(filename);
    } catch (error) {
      console.error("Failed to generate printable PDF", error);
    } finally {
      document.body.removeChild(container);
    }
  }, [getMistakesTemplateData]);

  const requestTicketsActionWithPrompt = useCallback(
    (action, type) => {
      if (!action) {
        return;
      }
      pendingTicketsActionRef.current = action;
      setPendingTicketsActionType(type || null);
      setCorrectedPromptOpen(true);
    },
    []
  );

  const handleCloseCorrectedPrompt = useCallback(() => {
    setCorrectedPromptOpen(false);
    setPendingTicketsActionType(null);
    pendingTicketsActionRef.current = null;
  }, []);

  const handleSkipMarkAllCorrected = useCallback(async () => {
    const action = pendingTicketsActionRef.current;
    pendingTicketsActionRef.current = null;
    setCorrectedPromptOpen(false);
    setPendingTicketsActionType(null);
    if (!action) {
      return;
    }
    try {
      await action();
    } catch (error) {
      console.error("Failed to execute ticket action", error);
    }
  }, []);

  const handleConfirmMarkAllCorrected = useCallback(async () => {
    const action = pendingTicketsActionRef.current;
    pendingTicketsActionRef.current = null;
    setCorrectedPromptOpen(false);
    setPendingTicketsActionType(null);
    try {
      await markAllVisibleTicketsAsCorrected();
    } catch (error) {
      console.error("Failed to update tickets", error);
    }
    if (!action) {
      return;
    }
    try {
      await action();
    } catch (error) {
      console.error("Failed to execute ticket action", error);
    }
  }, [markAllVisibleTicketsAsCorrected]);

  const handleDownloadMistakesEmail = useCallback(() => {
    requestTicketsActionWithPrompt(executeDownloadMistakesEmail, "email");
  }, [executeDownloadMistakesEmail, requestTicketsActionWithPrompt]);

  const handleDownloadMistakesPdf = useCallback(() => {
    requestTicketsActionWithPrompt(executeDownloadMistakesPdf, "pdf");
  }, [executeDownloadMistakesPdf, requestTicketsActionWithPrompt]);

  const continueWithoutCorrectingLabel =
    pendingTicketsActionType === "email"
      ? "Nee, alleen versturen"
      : pendingTicketsActionType === "pdf"
      ? "Nee, alleen downloaden"
      : "Nee, ga verder zonder";

  const confirmAndCorrectLabel =
    pendingTicketsActionType === "email"
      ? "Ja, markeer als corrected en verstuur"
      : pendingTicketsActionType === "pdf"
      ? "Ja, markeer als corrected en download"
      : "Ja, markeer als corrected";

  const handleStartEdit = () => {
    if (!member) return;
    setError("");
    setEditing(true);
    setForm({
      name: member.name || "",
      job: member.job || "",
      department: member.department || "",
      email: member.email || "",
      contractType: member.contractType || "",
      contractHours: member.contractHours === null || member.contractHours === undefined ? "" : String(member.contractHours),
      hourlyWage:
        member.hourlyWage === null || member.hourlyWage === undefined ? "" : String(member.hourlyWage),
      aapiId: member.aapiId || "",
      outletId: member.outletId || "",
    });
  };

  const handleCancelEdit = () => {
    if (!member) return;
    setEditing(false);
    setError("");
    setForm({
      name: member.name || "",
      job: member.job || "",
      department: member.department || "",
      email: member.email || "",
      contractType: member.contractType || "",
      contractHours: member.contractHours === null || member.contractHours === undefined ? "" : String(member.contractHours),
      hourlyWage:
        member.hourlyWage === null || member.hourlyWage === undefined ? "" : String(member.hourlyWage),
      aapiId: member.aapiId || "",
      outletId: member.outletId || "",
    });
  };

  const handleSave = async () => {
    if (!member) return;
    setError("");
    if (!form.name.trim()) {
      setError("Naam is verplicht.");
      return;
    }
    if (!validateEmail(form.email)) {
      setError("Geef een geldig e-mailadres op.");
      return;
    }
    const contractHoursNumber = form.contractHours === "" ? null : Number.parseFloat(form.contractHours);
    if (form.contractHours !== "" && Number.isNaN(contractHoursNumber)) {
      setError("Contracturen moeten een getal zijn.");
      return;
    }
    let hourlyWageNumber = null;
    if (form.hourlyWage !== "") {
      hourlyWageNumber = Number.parseFloat(form.hourlyWage);
      if (isAdmin && Number.isNaN(hourlyWageNumber)) {
        setError("Uurloon moet een getal zijn.");
        return;
      }
    }
    setSaving(true);
    try {
      const trimmedAapiId = form.aapiId.trim();
      const trimmedOutletId = form.outletId.trim();
      const updated = await addStaffMember({
        ...member,
        ...form,
        job: form.job.trim(),
        id: member.id || normalizedId,
        aapiId: trimmedAapiId,
        outletId: trimmedOutletId,
        contractHours: contractHoursNumber,
        hourlyWage: isAdmin ? (Number.isNaN(hourlyWageNumber) ? null : hourlyWageNumber) : member.hourlyWage ?? null,
      });
      setMember(updated);
      setEditing(false);
      setForm({
        name: updated.name || "",
        job: updated.job || "",
        department: updated.department || "",
        email: updated.email || "",
        contractType: updated.contractType || "",
        contractHours: updated.contractHours === null || updated.contractHours === undefined ? "" : String(updated.contractHours),
        hourlyWage:
          updated.hourlyWage === null || updated.hourlyWage === undefined ? "" : String(updated.hourlyWage),
        aapiId: updated.aapiId || "",
        outletId: updated.outletId || "",
      });
    } catch (err) {
      setError(err.message || "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!member) return;
    if (!window.confirm(`Wil je ${member.name} verwijderen?`)) return;
    setDeleting(true);
    try {
      await deleteStaffMember(member.id || normalizedId);
      navigate("/finance/staff");
    } catch (err) {
      setError(err.message || "Verwijderen mislukt.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <HeaderBar hotelName={hotelName} today={todayLabel} onLogout={handleLogout} />
      <PageContainer>
        <button
          type="button"
          onClick={() => navigate("/finance/staff")}
          className="mb-4 inline-flex items-center text-sm text-marriott hover:underline"
        >
          ← Terug
        </button>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500 shadow">Bezig met laden…</div>
        ) : !member ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-red-600 shadow">
            Personeelslid niet gevonden.
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold text-gray-900">{member.name}</h1>
                  <p className="text-gray-600">{member.job || "Geen functie"}</p>
                  <p className="text-gray-600">{member.department || "Geen afdeling"}</p>
                  <p className="text-gray-600">{member.email || "Geen e-mail"}</p>
                  <p className="text-gray-600">{member.aapiId ? `Aapi ID: ${member.aapiId}` : "Geen Aapi ID"}</p>
                  <p className="text-gray-600">
                    {member.outletId ? `Cost Center Id: ${member.outletId}` : "Geen Cost Center Id"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {saving ? "Opslaan…" : "Opslaan"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Annuleren
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Bewerk gegevens
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {deleting ? "Verwijderen…" : "Verwijderen"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {error && <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

              <div className={`mt-6 grid gap-4 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-500">Contracttype</p>
                  <p className="text-base text-gray-900">{member.contractType || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-500">Contracturen</p>
                  <p className="text-base text-gray-900">{formatContractHours(member.contractHours)}</p>
                </div>
                {isAdmin && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-500">Uurloon</p>
                    {sensitiveUnlocked ? (
                      <p className="text-base text-gray-900">{formatHourlyWage(member.hourlyWage)}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestSensitiveAccess}
                        className="relative block w-full text-left"
                      >
                        <span className="block text-base text-gray-900 blur-sm select-none">
                          {formatHourlyWage(member.hourlyWage)}
                        </span>
                        <span
                          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-white/80 text-sm font-semibold text-gray-600"
                          aria-hidden="true"
                        >
                          Klik om te ontgrendelen
                        </span>
                      </button>
                    )}
                  </div>
                )}
                {isAdmin && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-500">Uurkost</p>
                    {sensitiveUnlocked ? (
                      <>
                        <p className="text-base text-gray-900">
                          {hourlyCost !== null ? formatHourlyWage(hourlyCost) : "-"}
                        </p>
                        {Number.isFinite(contractCoefficient) && (
                          <p className="text-xs text-gray-500">
                            Coëfficiënt: {contractCoefficient.toLocaleString("nl-BE", {
                              minimumFractionDigits: contractCoefficient % 1 === 0 ? 0 : 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestSensitiveAccess}
                        className="relative block w-full text-left"
                      >
                        <span className="block text-base text-gray-900 blur-sm select-none">
                          {hourlyCost !== null ? formatHourlyWage(hourlyCost) : "-"}
                        </span>
                        <span
                          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-white/80 text-sm font-semibold text-gray-600"
                          aria-hidden="true"
                        >
                          Klik om te ontgrendelen
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {editing && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Naam</label>
                    <input
                      className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Functie</label>
                    <input
                      className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
                      value={form.job}
                      onChange={e => setForm(f => ({ ...f, job: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Afdeling</label>
                    <input
                      className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">E-mail</label>
                    <input
                      type="email"
                      className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Aapi ID</label>
                    <input
                      className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
                      value={form.aapiId}
                      onChange={e => setForm(f => ({ ...f, aapiId: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Cost Center Id</label>
                    <input
                      className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
                      value={form.outletId}
                      onChange={e => setForm(f => ({ ...f, outletId: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700" htmlFor={contractTypeFieldId}>
                      Contracttype
                    </label>
                    <select
                      id={contractTypeFieldId}
                      className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
                      value={form.contractType}
                      onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))}
                    >
                      <option value="">
                        {contractTypeSuggestions.length > 0
                          ? "Selecteer een contracttype"
                          : "Geen contracttypes beschikbaar"}
                      </option>
                      {contractTypeSuggestions.map(option => (
                        <option key={option.id} value={option.name}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Contracturen per week</label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
                      value={form.contractHours}
                      onChange={e => setForm(f => ({ ...f, contractHours: e.target.value }))}
                    />
                  </div>
                  {isAdmin && (
                    sensitiveUnlocked ? (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Uurloon</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
                          value={form.hourlyWage}
                          onChange={e => setForm(f => ({ ...f, hourlyWage: e.target.value }))}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Uurloon</label>
                        <button
                          type="button"
                          onClick={handleRequestSensitiveAccess}
                          className="rounded border border-dashed border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Ontgrendel om te bewerken
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Ingeplande uren</h2>
                  <p className="text-sm text-gray-600">
                    Geplande shiften voor de komende {SCHEDULE_LOOKAHEAD_DAYS} dagen.
                  </p>
                </div>
              </div>

              {scheduleLoading ? (
                <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-4 text-center text-gray-600">
                  Bezig met laden…
                </div>
              ) : scheduleError ? (
                <div className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-center text-red-600">{scheduleError}</div>
              ) : scheduleEntries.length === 0 ? (
                <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-4 text-center text-gray-600">
                  Geen ingeplande shiften in deze periode.
                </div>
              ) : (
                <>
                  <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Datum
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Tijd
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Outlet
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Uren
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {scheduleEntries.map(entry => (
                          <tr key={`${entry.dateKey}-${entry.startTime}-${entry.id}`}>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {entry.date ? scheduleDateFormatter.format(entry.date) : formatDate(entry.dateKey)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {entry.startTime && entry.endTime
                                ? `${entry.startTime} – ${entry.endTime}`
                                : "-"}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">{entry.outlet}</td>
                            <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                              {formatHours(entry.hours)} u
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    Totaal ingeplande uren: {" "}
                    <span className="font-semibold text-gray-900">
                      {formatHours(totalScheduledHours)} u
                    </span>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Sales & Promo tickets</h2>
                  <p className="text-sm text-gray-600">
                    Tickets waarvoor nog checklist-items ontbreken.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-marriott focus:ring-marriott disabled:cursor-not-allowed disabled:opacity-60"
                    checked={showCorrectedTickets}
                    onChange={event => setShowCorrectedTickets(event.target.checked)}
                    disabled={ticketsLoading || incompleteTickets.length === 0}
                  />
                  <span className="select-none text-sm text-gray-700">show corrected</span>
                </label>
              </div>

              {!ticketsLoading && !ticketsError && ticketUpdateError && (
                <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {ticketUpdateError}
                </div>
              )}

              {ticketsLoading ? (
                <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-4 text-center text-gray-600">
                  Bezig met laden…
                </div>
              ) : ticketsError ? (
                <div className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-center text-red-600">{ticketsError}</div>
              ) : visibleTickets.length === 0 ? (
                <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-4 text-center text-gray-600">
                  Geen openstaande Sales & Promo tickets.
                </div>
              ) : (
                <>
                  <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Datum
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Receipt #
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Type
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Outlet
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Checklist
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Opmerking
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Corrected
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {visibleTickets.map(ticket => {
                          const stats = getTicketChecklistStats(ticket);
                          const handleOpenTicket = () => {
                            if (ticket?.id) {
                              const fromPath = `${location.pathname}${location.search || ""}`;
                              navigate(`/salespromo/${ticket.id}`, { state: { from: fromPath } });
                            }
                          };
                          const handleKeyDown = event => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleOpenTicket();
                            }
                          };
                          return (
                            <tr
                              key={ticket.id}
                              className="cursor-pointer transition hover:bg-gray-50 focus-within:bg-gray-50"
                              onClick={handleOpenTicket}
                              onKeyDown={handleKeyDown}
                              role="button"
                              tabIndex={0}
                            >
                              <td className="px-4 py-2 text-sm text-gray-700">{formatDate(ticket.date)}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{ticket.receiptNumber || "-"}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{ticket.type || "-"}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{ticket.outlet || "-"}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {stats.total > 0 ? `${stats.checked}/${stats.total}` : "0/0"}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">{ticket.reason || "-"}</td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-marriott focus:ring-marriott disabled:cursor-not-allowed disabled:opacity-60"
                                  checked={Boolean(ticket.corrected)}
                                  onChange={event => {
                                    event.stopPropagation();
                                    handleToggleTicketCorrected(ticket, event.target.checked);
                                  }}
                                  onClick={event => event.stopPropagation()}
                                  onKeyDown={event => event.stopPropagation()}
                                  disabled={Boolean(updatingTickets[ticket.id])}
                                  aria-label="Mark as corrected"
                                  title="Mark as corrected"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadMistakesEmail}
                      className="inline-flex items-center justify-center rounded-lg bg-marriott px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marriott-dark disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={visibleTickets.length === 0}
                    >
                      Send mail with mistakes
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMistakesPdf}
                      className="inline-flex items-center justify-center rounded-lg border border-marriott bg-white px-4 py-2 text-sm font-semibold text-marriott shadow-sm transition hover:bg-marriott/10 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={visibleTickets.length === 0}
                    >
                      Download printable PDF
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </PageContainer>
      <Dialog open={correctedPromptOpen} onClose={handleCloseCorrectedPrompt} className="fixed inset-0 z-[60] overflow-hidden">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-gray-800">
              Tickets op corrected zetten?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-600">
              Wil je dat alle getoonde Sales & Promo tickets als corrected worden gemarkeerd?
            </Dialog.Description>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseCorrectedPrompt}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleSkipMarkAllCorrected}
                className="inline-flex items-center justify-center rounded-lg border border-marriott bg-white px-4 py-2 text-sm font-semibold text-marriott shadow-sm transition hover:bg-marriott/10"
              >
                {continueWithoutCorrectingLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirmMarkAllCorrected}
                className="inline-flex items-center justify-center rounded-lg bg-marriott px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marriott-dark"
              >
                {confirmAndCorrectLabel}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      <PasswordPromptModal
        open={passwordPromptOpen}
        onConfirm={handleConfirmPassword}
        onCancel={handleCancelPasswordPrompt}
        loading={passwordVerifying}
        error={passwordError}
      />
    </>
  );
}
