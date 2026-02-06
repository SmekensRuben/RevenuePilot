import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";

export default function RoomClassCreatePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [rooms, setRooms] = useState("");
  const [roomTypes, setRoomTypes] = useState("");

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
    navigate("/settings/room-classes");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">
            Room Classes
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold">Nieuwe room class</h1>
          <p className="text-gray-600 mt-1">
            Vul de velden in om een nieuwe room class aan te maken.
          </p>
        </div>

        <Card>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Room Class Code
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Description
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Number of Rooms
              <input
                type="number"
                min="0"
                value={rooms}
                onChange={(event) => setRooms(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700 sm:col-span-2">
              Room Types (comma separated)
              <input
                type="text"
                value={roomTypes}
                onChange={(event) => setRoomTypes(event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Classic King, Deluxe Queen"
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                className="bg-[#b41f1f] text-white px-4 py-2 rounded font-semibold shadow hover:bg-[#961919] transition-colors"
              >
                Room class opslaan
              </button>
              <button
                type="button"
                onClick={() => navigate("/settings/room-classes")}
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
