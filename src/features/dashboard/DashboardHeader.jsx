// src/features/dashboard/DashboardHeader.jsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { DashboardDropdown, DashboardMenuItem } from "./DashboardDropdown";
import { useHotelContext } from "contexts/HotelContext";
import { db, doc, getDoc } from "../../firebaseConfig";

export default function DashboardHeader({ today, onLogout, onMenuToggle, sections = [] }) {
  const { t } = useTranslation("hoteldashboard");
  const { hotelUid, hotelUids = [], selectHotel } = useHotelContext();
  const [hotels, setHotels] = useState([]);

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

  return (
    <header className="bg-[#b41f1f] text-white shadow sticky top-0 z-10 px-6 py-2 mb-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              className="md:hidden"
              aria-label="Open menu"
              onClick={onMenuToggle}
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
            <img
              src="/assets/breakfast_pilot_logo_black_circle.png"
              alt="Marriott Logo"
              className="h-20 sm:h-16"
            />
            <h1 className="text-xl sm:text-2xl font-bold tracking-wide">Kitchen Pilot</h1>
          </div>
          <div className="text-right text-sm sm:text-base leading-tight">
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
            <div className="mt-1 flex justify-end">
              <button
                onClick={onLogout}
                className="bg-white text-[#b41f1f] px-3 py-1 rounded hover:bg-gray-100 text-sm"
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>
        {sections.length > 0 && (
          <nav className="hidden md:flex flex-wrap gap-4">
            {sections.map(section => (
              <DashboardDropdown key={section.title} title={section.title}>
                {section.items.map(item => {
                  if (item.type === "label") {
                    if (item.canView === false) return null;

                    return (
                      <div
                        key={`${section.title}-${item.title}`}
                        className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 border-t border-gray-100"
                      >
                        {item.title}
                      </div>
                    );
                  }

                  return (
                    <DashboardMenuItem
                      key={item.title}
                      icon={item.icon}
                      title={item.title}
                      onClick={item.canView ? item.onClick : undefined}
                      disabled={!item.canView}
                    />
                  );
                })}
              </DashboardDropdown>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
