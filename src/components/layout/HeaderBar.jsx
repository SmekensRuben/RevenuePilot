import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useHotelContext } from "contexts/HotelContext";
import { db, doc, getDoc } from "../../firebaseConfig";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Settings2,
  LineChart,
  FileSpreadsheet,
  FileText,
  Quote,
  BedDouble,
} from "lucide-react";

export default function HeaderBar({ today, onLogout }) {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "reservations"]);
  const { hotelUid, hotelUids = [], selectHotel } = useHotelContext();
  const [hotels, setHotels] = useState([]);
  const [isReservationsOpen, setIsReservationsOpen] = useState(false);
  const [isQuotesOpen, setIsQuotesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isForecastOpen, setIsForecastOpen] = useState(false);
  const reservationsMenuRef = useRef(null);
  const quotesMenuRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const calendarMenuRef = useRef(null);
  const forecastMenuRef = useRef(null);

  const reservationMenuItems = [
    {
      label: t("header.madeReservationsLabel", { ns: "reservations" }),
      action: () => navigate("/reservations/made"),
      icon: ClipboardList,
    },
  ];

  const quotesMenuItems = [
    {
      label: "Quotes overzicht",
      action: () => navigate("/quotes"),
      icon: Quote,
    },
  ];

  const settingsMenuItems = [
    {
      label: "General Settings",
      action: () => navigate("/settings/general"),
      icon: Settings2,
    },
    {
      label: "Segmentation Mapping",
      action: () => navigate("/settings/segmentation-mapping"),
      icon: Settings2,
    },
    {
      label: "Room Types",
      action: () => navigate("/settings/room-types"),
      icon: BedDouble,
    },
    {
      label: "Compset",
      action: () => navigate("/settings/compset"),
      icon: Building2,
    },
    {
      label: "Arrival converter",
      action: () => navigate("/tools/arrival-converter"),
      icon: FileText,
    },
  ];

  const calendarMenuItems = [
    {
      label: t("calendar.local"),
      action: () => navigate("/calendar/local"),
      icon: CalendarDays,
    },
  ];

  const forecastMenuItems = [
    {
      label: "Forecast overzicht",
      action: () => navigate("/forecast"),
      icon: LineChart,
    },
    {
      label: "Weekly Forecast Tool",
      action: () => navigate("/forecast/weekly"),
      icon: FileSpreadsheet,
    },
    {
      label: "Historical Forecast Pace",
      action: () => navigate("/forecast/historical-pace"),
      icon: FileSpreadsheet,
    },
  ];

  useEffect(() => {
    async function fetchHotels() {
      const results = await Promise.all(
        hotelUids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, `hotels/${uid}/settings`, uid));
            const data = snap.exists() ? snap.data() : {};
            return { uid, name: data.hotelName || uid };
          } catch {
            return { uid, name: uid };
          }
        })
      );
      setHotels(results);
    }
    if (hotelUids.length) {
      fetchHotels();
    }
  }, [hotelUids]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        reservationsMenuRef.current &&
        !reservationsMenuRef.current.contains(event.target)
      ) {
        setIsReservationsOpen(false);
      }

      if (quotesMenuRef.current && !quotesMenuRef.current.contains(event.target)) {
        setIsQuotesOpen(false);
      }

      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
      }

      if (calendarMenuRef.current && !calendarMenuRef.current.contains(event.target)) {
        setIsCalendarOpen(false);
      }

      if (forecastMenuRef.current && !forecastMenuRef.current.contains(event.target)) {
        setIsForecastOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-[#b41f1f] text-white shadow sticky top-0 z-20 px-2 py-2 mb-4">
      <div className="max-w-6xl mx-auto flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div
            className="flex flex-row items-center justify-center sm:justify-start gap-2 sm:gap-4 w-full sm:w-auto cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <img
              src="/assets/breakfast_pilot_logo_black_circle.png"
              alt="Revenue Pilot Logo"
              className="h-10 sm:h-16"
            />
            <h1 className="text-lg sm:text-2xl font-bold tracking-wide text-center flex-1">
              Revenue Pilot
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center w-full sm:w-auto gap-2 sm:gap-3">
            <div className="flex flex-row sm:flex-col gap-2 sm:gap-0 sm:mr-4 text-sm sm:text-base text-right w-full sm:w-auto">
              <select
                value={hotelUid || ""}
                onChange={(e) => selectHotel && selectHotel(e.target.value)}
                className="bg-white text-[#b41f1f] px-2 py-1 rounded font-semibold"
              >
                {hotels.map((hotel) => (
                  <option key={hotel.uid} value={hotel.uid}>
                    {hotel.name}
                  </option>
                ))}
              </select>
              <div className="text-white text-opacity-80">{today}</div>
            </div>
            <div className="flex flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => navigate("/dashboard")}
                className="bg-white text-[#b41f1f] px-3 py-2 rounded font-semibold w-1/2 sm:w-auto hover:bg-gray-100 text-sm"
                style={{ minHeight: 44 }}
              >
                ← {t("backToDashboard")}
              </button>
              <button
                onClick={onLogout}
                className="bg-white text-[#b41f1f] px-3 py-2 rounded font-semibold w-1/2 sm:w-auto hover:bg-gray-100 text-sm"
                style={{ minHeight: 44 }}
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div ref={forecastMenuRef} className="flex justify-end w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => {
                  setIsForecastOpen((prev) => !prev);
                  setIsCalendarOpen(false);
                  setIsReservationsOpen(false);
                  setIsQuotesOpen(false);
                  setIsSettingsOpen(false);
                }}
                className="bg-transparent text-white px-4 py-2 rounded font-semibold w-full sm:w-auto text-sm flex items-center justify-between shadow-sm"
                style={{ minHeight: 44 }}
              >
                <div className="flex items-center gap-2">
                  <LineChart className="h-4 w-4" />
                  <span className="uppercase tracking-wide">Forecast</span>
                </div>
                <span className="ml-3 text-base">▾</span>
              </button>
              {isForecastOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-lg shadow-xl ring-1 ring-black/5 z-30 overflow-hidden bg-white text-gray-900">
                  <div className="py-2">
                    {forecastMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            item.action();
                            setIsForecastOpen(false);
                          }}
                          className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
                        >
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                            {Icon && <Icon className="h-4 w-4" />}
                          </span>
                          <span className="text-sm font-semibold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={calendarMenuRef} className="flex justify-end w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => {
                  setIsCalendarOpen((prev) => !prev);
                  setIsReservationsOpen(false);
                  setIsQuotesOpen(false);
                  setIsSettingsOpen(false);
                }}
                className="bg-transparent text-white px-4 py-2 rounded font-semibold w-full sm:w-auto text-sm flex items-center justify-between shadow-sm"
                style={{ minHeight: 44 }}
              >
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wide">{t("calendar.label")}</span>
                </div>
                <span className="ml-3 text-base">▾</span>
              </button>
              {isCalendarOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-lg shadow-xl ring-1 ring-black/5 z-30 overflow-hidden bg-white text-gray-900">
                  <div className="py-2">
                    {calendarMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            item.action();
                            setIsCalendarOpen(false);
                          }}
                          className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
                        >
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                            {Icon && <Icon className="h-4 w-4" />}
                          </span>
                          <span className="text-sm font-semibold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={reservationsMenuRef} className="flex justify-end w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => {
                  setIsReservationsOpen((prev) => !prev);
                  setIsQuotesOpen(false);
                  setIsSettingsOpen(false);
                  setIsCalendarOpen(false);
                }}
                className="bg-transparent text-white px-4 py-2 rounded font-semibold w-full sm:w-auto text-sm flex items-center justify-between shadow-sm"
                style={{ minHeight: 44 }}
              >
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wide">
                    {t("header.menuButton", { ns: "reservations" })}
                  </span>
                </div>
                <span className="ml-3 text-base">▾</span>
              </button>
              {isReservationsOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-lg shadow-xl ring-1 ring-black/5 z-30 overflow-hidden bg-white text-gray-900">
                  <div className="py-2">
                    {reservationMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            item.action();
                            setIsReservationsOpen(false);
                          }}
                          className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
                        >
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                            {Icon && <Icon className="h-4 w-4" />}
                          </span>
                          <span className="text-sm font-semibold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={quotesMenuRef} className="flex justify-end w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => {
                  setIsQuotesOpen((prev) => !prev);
                  setIsSettingsOpen(false);
                  setIsReservationsOpen(false);
                  setIsCalendarOpen(false);
                }}
                className="bg-transparent text-white px-4 py-2 rounded font-semibold w-full sm:w-auto text-sm flex items-center justify-between shadow-sm"
                style={{ minHeight: 44 }}
              >
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wide">Quotes</span>
                </div>
                <span className="ml-3 text-base">▾</span>
              </button>
              {isQuotesOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-lg shadow-xl ring-1 ring-black/5 z-30 overflow-hidden bg-white text-gray-900">
                  <div className="py-2">
                    {quotesMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            item.action();
                            setIsQuotesOpen(false);
                          }}
                          className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
                        >
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                            {Icon && <Icon className="h-4 w-4" />}
                          </span>
                          <span className="text-sm font-semibold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={settingsMenuRef} className="flex justify-end w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => {
                  setIsSettingsOpen((prev) => !prev);
                  setIsQuotesOpen(false);
                  setIsReservationsOpen(false);
                  setIsCalendarOpen(false);
                }}
                className="bg-transparent text-white px-4 py-2 rounded font-semibold w-full sm:w-auto text-sm flex items-center justify-between shadow-sm"
                style={{ minHeight: 44 }}
              >
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wide">Settings</span>
                </div>
                <span className="ml-3 text-base">▾</span>
              </button>
              {isSettingsOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-lg shadow-xl ring-1 ring-black/5 z-30 overflow-hidden bg-white text-gray-900">
                  <div className="py-2">
                    {settingsMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            item.action();
                            setIsSettingsOpen(false);
                          }}
                          className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
                        >
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                            {Icon && <Icon className="h-4 w-4" />}
                          </span>
                          <span className="text-sm font-semibold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
