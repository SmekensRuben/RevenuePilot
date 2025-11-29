import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, List as ListIcon, Calendar as CalendarIcon, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "react-toastify";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { useNavigate } from "react-router-dom";
import { addLocalEvent, subscribeToLocalEvents } from "../../services/firebaseLocalEvents";
import { useHotelContext } from "../../contexts/HotelContext";
import { signOut, auth } from "../../firebaseConfig";

const VIEW_TYPES = ["week", "month", "year", "list"];

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate();
  }
  return new Date(value);
}

function formatDisplayDate(value) {
  const date = toDate(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return value || "";
  }
  return date.toLocaleDateString();
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDateLabel(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isSameDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function eventOccursOnDate(event, date) {
  const start = toDate(event.startDate);
  const end = event.endDate ? toDate(event.endDate) : start;
  if (!start) return false;
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const normalizedStart = new Date(start);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = end ? new Date(end) : normalizedStart;
  normalizedEnd.setHours(0, 0, 0, 0);

  return normalizedStart <= target && target <= normalizedEnd;
}

export default function LocalCalendarPage() {
  const { t } = useTranslation("calendar");
  const { hotelName, hotelUid } = useHotelContext();
  const navigate = useNavigate();
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [events, setEvents] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    estimatedVisitors: "",
    startDate: "",
    endDate: "",
  });

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  useEffect(() => {
    if (!hotelUid) return undefined;
    const unsubscribe = subscribeToLocalEvents(setEvents);
    return () => unsubscribe && unsubscribe();
  }, [hotelUid]);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const resetForm = () => {
    setFormData({ title: "", description: "", location: "", estimatedVisitors: "", startDate: "", endDate: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.startDate) {
      toast.error(t("form.validation"));
      return;
    }

    if (formData.endDate && formData.endDate < formData.startDate) {
      toast.error(t("form.invalidRange"));
      return;
    }

    const estimatedVisitors = formData.estimatedVisitors
      ? Number(formData.estimatedVisitors)
      : null;

    try {
      await addLocalEvent({ ...formData, estimatedVisitors });
      toast.success(t("toast.created"));
      resetForm();
      setIsFormOpen(false);
    } catch (error) {
      console.error("Failed to create event", error);
      toast.error(t("toast.error"));
    }
  };

  const navigateRange = (direction) => {
    const next = new Date(currentDate);
    if (view === "week") {
      next.setDate(next.getDate() + direction * 7);
    } else if (view === "month") {
      next.setMonth(next.getMonth() + direction, 1);
    } else if (view === "year") {
      next.setFullYear(next.getFullYear() + direction, 0, 1);
    }
    setCurrentDate(next);
  };

  const renderEventsForDate = (date) => {
    const dayEvents = events.filter((event) => eventOccursOnDate(event, date));
    if (!dayEvents.length) return null;
    return (
      <div className="mt-2 space-y-1">
        {dayEvents.map((event) => (
          <div
            key={event.id}
            className="rounded bg-[#b41f1f] bg-opacity-10 text-[#b41f1f] px-2 py-1 text-xs font-semibold truncate"
            title={`${event.title} (${event.location || t("labels.noLocation")})`}
            onClick={() => navigate(`/calendar/local/${event.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                navigate(`/calendar/local/${event.id}`);
              }
            }}
          >
            {event.title}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    const start = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {days.map((date) => (
          <Card key={date.toISOString()} className="p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-gray-500">
                  {date.toLocaleDateString(undefined, { weekday: "long" })}
                </p>
                <p className="text-lg font-semibold">{formatDateLabel(date)}</p>
              </div>
              {isSameDay(date, new Date()) && (
                <span className="text-xs font-bold text-[#b41f1f]">{t("labels.today")}</span>
              )}
            </div>
            {renderEventsForDate(date)}
          </Card>
        ))}
      </div>
    );
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const start = startOfWeek(firstDayOfMonth);
    const totalDays = daysInMonth(year, month);
    const weeks = [];
    let cursor = new Date(start);

    while (weeks.length < 6) {
      const week = Array.from({ length: 7 }, () => {
        const date = new Date(cursor);
        cursor.setDate(cursor.getDate() + 1);
        return date;
      });
      weeks.push(week);
      if (cursor.getMonth() > month && cursor.getDate() >= 7) {
        break;
      }
    }

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 text-xs font-semibold text-gray-500">
          {[...Array(7).keys()].map((i) => (
            <div key={i} className="p-2 text-center uppercase tracking-wide">
              {new Date(2024, 0, i + 1).toLocaleDateString(undefined, { weekday: "short" })}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weeks.flat().map((date) => {
            const inCurrentMonth = date.getMonth() === month;
            return (
              <div
                key={date.toISOString()}
                className={`min-h-[120px] rounded border p-2 text-sm transition ${
                  inCurrentMonth
                    ? "bg-white border-gray-200 shadow-sm"
                    : "bg-gray-50 border-gray-100 text-gray-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{date.getDate()}</span>
                  {isSameDay(date, new Date()) && (
                    <span className="text-[10px] font-bold text-[#b41f1f]">{t("labels.today")}</span>
                  )}
                </div>
                {renderEventsForDate(date)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, idx) => new Date(year, idx, 1));

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map((monthDate) => {
          const monthEvents = events.filter((event) => {
            if (!event.startDate) return false;
            const start = toDate(event.startDate);
            if (!start || Number.isNaN(start.getTime())) return false;
            return start.getFullYear() === monthDate.getFullYear() && start.getMonth() === monthDate.getMonth();
          });

          return (
            <Card key={monthDate.getMonth()} className="p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-lg font-semibold">
                  {monthDate.toLocaleDateString(undefined, { month: "long" })}
                </p>
                <span className="text-sm text-gray-500">
                  {t("labels.events", { count: monthEvents.length })}
                </span>
              </div>
              <div className="space-y-2">
                {monthEvents.slice(0, 4).map((event) => (
                  <div key={event.id} className="rounded bg-gray-50 px-3 py-2">
                    <p className="text-sm font-semibold">{event.title}</p>
                    <p className="text-xs text-gray-600">
                      {formatDisplayDate(event.startDate)}
                      {event.endDate && event.endDate !== event.startDate
                        ? ` - ${formatDisplayDate(event.endDate)}`
                        : ""}
                    </p>
                    {event.location && (
                      <p className="text-xs text-gray-500">{event.location}</p>
                    )}
                  </div>
                ))}
                {!monthEvents.length && (
                  <p className="text-sm text-gray-500">{t("labels.noEventsMonth")}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderListView = () => {
    if (!events.length) {
      return <p className="text-sm text-gray-500">{t("labels.noEvents")}</p>;
    }

    return (
      <div className="space-y-3">
        {events.map((event) => (
          <Card
            key={event.id}
            className="p-4 border border-gray-100 shadow-sm cursor-pointer hover:border-[#b41f1f]/30"
            onClick={() => navigate(`/calendar/local/${event.id}`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">{event.title}</p>
                <p className="text-sm text-gray-600">
                  {formatDisplayDate(event.startDate)}
                  {event.endDate && event.endDate !== event.startDate
                    ? ` - ${formatDisplayDate(event.endDate)}`
                    : ""}
                </p>
                  {event.location && (
                    <p className="text-sm text-gray-500">{event.location}</p>
                  )}
                  {(event.estimatedVisitors || event.estimatedVisitors === 0) && (
                    <p className="text-sm text-gray-500">{t("labels.estimatedVisitors", { count: event.estimatedVisitors })}</p>
                  )}
                  {event.description && (
                    <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                  )}
              </div>
              <span className="rounded-full bg-[#b41f1f] bg-opacity-10 text-[#b41f1f] px-3 py-1 text-xs font-semibold">
                {t("labels.local")}
              </span>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderView = () => {
    if (view === "week") return renderWeekView();
    if (view === "month") return renderMonthView();
    if (view === "year") return renderYearView();
    return renderListView();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">
              {t("labels.titlePrefix", { hotel: hotelName })}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold">{t("title")}</h1>
            <p className="text-gray-600 max-w-2xl">{t("description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-2 rounded bg-[#b41f1f] px-4 py-2 text-white shadow hover:bg-[#9c1c1c]"
            >
              <Plus className="h-4 w-4" />
              <span className="font-semibold text-sm">{t("actions.create")}</span>
            </button>
          </div>
        </div>

        <Card className="p-4 shadow-sm border border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {VIEW_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setView(type)}
                  className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold border transition ${
                    view === type
                      ? "bg-[#b41f1f] text-white border-[#b41f1f]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {type === "list" ? (
                    <ListIcon className="h-4 w-4" />
                  ) : (
                    <CalendarIcon className="h-4 w-4" />
                  )}
                  {t(`views.${type}`)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(new Date())}
                className="rounded border border-gray-200 bg-white px-3 py-2 text-sm font-semibold hover:border-gray-300"
              >
                {t("actions.today")}
              </button>
              <div className="flex items-center rounded border border-gray-200 bg-white overflow-hidden">
                <button
                  onClick={() => navigateRange(-1)}
                  className="px-3 py-2 text-sm hover:bg-gray-50 border-r border-gray-200"
                  aria-label={t("actions.previous")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigateRange(1)}
                  className="px-3 py-2 text-sm hover:bg-gray-50"
                  aria-label={t("actions.next")}
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="font-semibold">
                {currentDate.toLocaleDateString(undefined, {
                  month: view === "year" ? undefined : "long",
                  year: "numeric",
                  ...(view === "week" && { day: "numeric" }),
                })}
              </span>
              <span className="text-gray-400">•</span>
              <span>{t("labels.events", { count: events.length })}</span>
            </div>
            {renderView()}
          </div>
        </Card>
      </PageContainer>

      {isFormOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase text-[#b41f1f] font-semibold">{t("title")}</p>
                <h2 className="text-xl font-bold">{t("form.heading")}</h2>
              </div>
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700" htmlFor="title">
                  {t("form.title")}
                </label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700" htmlFor="description">
                  {t("form.description")}
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700" htmlFor="location">
                  {t("form.location")}
                </label>
                <input
                  id="location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700" htmlFor="estimatedVisitors">
                  {t("form.estimatedVisitors")}
                </label>
                <input
                  id="estimatedVisitors"
                  type="number"
                  min="0"
                  value={formData.estimatedVisitors}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, estimatedVisitors: e.target.value.replace(/[^0-9]/g, "") }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700" htmlFor="startDate">
                    {t("form.startDate")}
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700" htmlFor="endDate">
                    {t("form.endDate")}
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate || undefined}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    resetForm();
                  }}
                  className="rounded border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300"
                >
                  {t("form.cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded bg-[#b41f1f] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#9c1c1c]"
                >
                  {t("form.submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
