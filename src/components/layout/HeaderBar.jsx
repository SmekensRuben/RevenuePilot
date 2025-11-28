import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useHotelContext } from "contexts/HotelContext";
import { db, doc, getDoc } from "../../firebaseConfig";

export default function HeaderBar({ today, onLogout }) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
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
    <header className="bg-[#b41f1f] text-white shadow sticky top-0 z-20 px-2 py-2 mb-4">
      <div className="max-w-6xl mx-auto flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div
            className="flex flex-row items-center justify-center sm:justify-start gap-2 sm:gap-4 w-full sm:w-auto cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <img
              src="/assets/breakfast_pilot_logo_black_circle.png"
              alt="Kitchen Pilot Logo"
              className="h-10 sm:h-16"
            />
            <h1 className="text-lg sm:text-2xl font-bold tracking-wide text-center flex-1">
              Kitchen Pilot
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center w-full sm:w-auto gap-2 sm:gap-3 mt-2 sm:mt-0">
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
      </div>
    </header>
  );
}
