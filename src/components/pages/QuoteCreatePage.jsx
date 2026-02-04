import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { addQuote } from "../../services/firebaseQuotes";
import { getSettings } from "../../services/firebaseSettings";

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function QuoteCreatePage() {
  const navigate = useNavigate();
  const { hotelUid } = useHotelContext();
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rooms, setRooms] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [quoteDate, setQuoteDate] = useState(formatDateInput());
  const [breakfastIncluded, setBreakfastIncluded] = useState(false);
  const [breakfastPrice, setBreakfastPrice] = useState(0);
  const [roomVatPercent, setRoomVatPercent] = useState(0);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!hotelUid) return;
    const loadSettings = async () => {
      const settings = await getSettings(hotelUid);
      setBreakfastPrice(Number(settings?.breakfastPrice) || 0);
      setRoomVatPercent(Number(settings?.roomVatPercent) || 0);
    };
    loadSettings();
  }, [hotelUid]);

  const quotedNetRate = useMemo(() => {
    const priceValue = Number(quotedPrice) || 0;
    const breakfastValue = breakfastIncluded ? breakfastPrice : 0;
    const taxableRoomPrice = Math.max(priceValue - breakfastValue, 0);
    const vatMultiplier = 1 + (Number(roomVatPercent) || 0) / 100;
    if (!vatMultiplier) return 0;
    return taxableRoomPrice / vatMultiplier;
  }, [quotedPrice, breakfastIncluded, breakfastPrice, roomVatPercent]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!hotelUid) return;
    await addQuote(hotelUid, {
      company: company.trim(),
      startDate,
      endDate,
      rooms: Number(rooms) || 0,
      quotedPrice: Number(quotedPrice) || 0,
      breakfastIncluded,
      quoteDate,
    });
    navigate("/quotes");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">Quotes</p>
          <h1 className="text-2xl sm:text-3xl font-bold">Nieuwe quote</h1>
          <p className="text-gray-600 mt-1">
            Vul de velden in om een nieuwe quote aan te maken.
          </p>
        </div>

        <Card>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Company name
              <input
                type="text"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Quoted price
              <input
                type="number"
                min="0"
                step="0.01"
                value={quotedPrice}
                onChange={(event) => setQuotedPrice(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              End date
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Total rooms
              <input
                type="number"
                min="0"
                value={rooms}
                onChange={(event) => setRooms(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Quote date
              <input
                type="date"
                value={quoteDate}
                onChange={(event) => setQuoteDate(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={breakfastIncluded}
                onChange={(event) => setBreakfastIncluded(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Breakfast Included
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700 sm:col-span-2">
              Quoted Net Rate
              <input
                type="text"
                value={quotedNetRate.toFixed(2)}
                readOnly
                className="rounded border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700"
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                className="bg-[#b41f1f] text-white px-4 py-2 rounded font-semibold shadow hover:bg-[#961919] transition-colors"
              >
                Quote opslaan
              </button>
              <button
                type="button"
                onClick={() => navigate("/quotes")}
                className="bg-gray-100 text-gray-800 px-4 py-2 rounded font-semibold border border-gray-300 hover:bg-gray-200"
              >
                Annuleren
              </button>
            </div>
          </form>
        </Card>
      </PageContainer>
    </div>
  );
}
