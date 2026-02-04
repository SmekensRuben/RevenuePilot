import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";

const STORAGE_KEY = "revenue-pilot-room-types";

function loadRoomTypes() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function RoomTypeCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [operaCode, setOperaCode] = useState("");
  const [marshaCode, setMarshaCode] = useState("");
  const [rooms, setRooms] = useState("");

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

  const handleSubmit = (event) => {
    event.preventDefault();
    const roomTypes = loadRoomTypes();
    const newRoomType = {
      id: window.crypto?.randomUUID?.() || `${Date.now()}`,
      name: name.trim(),
      operaCode: operaCode.trim(),
      marshaCode: marshaCode.trim(),
      rooms,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([newRoomType, ...roomTypes]));
    navigate("/settings/room-types");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">Room Types</p>
          <h1 className="text-2xl sm:text-3xl font-bold">Nieuw room type</h1>
          <p className="text-gray-600 mt-1">
            Vul de velden in om een nieuw room type aan te maken.
          </p>
        </div>

        <Card>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Room Type Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Opera Code
              <input
                type="text"
                value={operaCode}
                onChange={(event) => setOperaCode(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Marsha Code
              <input
                type="text"
                value={marshaCode}
                onChange={(event) => setMarshaCode(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Amount of rooms
              <input
                type="number"
                min="0"
                value={rooms}
                onChange={(event) => setRooms(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                className="bg-[#b41f1f] text-white px-4 py-2 rounded font-semibold shadow hover:bg-[#961919] transition-colors"
              >
                Room type opslaan
              </button>
              <button
                type="button"
                onClick={() => navigate("/settings/room-types")}
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
