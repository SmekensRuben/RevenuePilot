import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { getRoomType, updateRoomType } from "../../services/firebaseRoomTypes";

export default function RoomTypeEditPage() {
  const navigate = useNavigate();
  const { roomTypeId } = useParams();
  const { hotelUid } = useHotelContext();
  const [name, setName] = useState("");
  const [operaCode, setOperaCode] = useState("");
  const [marshaCode, setMarshaCode] = useState("");
  const [rooms, setRooms] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
    if (!hotelUid || !roomTypeId) return;

    const loadRoomType = async () => {
      setLoading(true);
      const roomType = await getRoomType(hotelUid, roomTypeId);
      if (!roomType) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setName(roomType.name || "");
      setOperaCode(roomType.operaCode || "");
      setMarshaCode(roomType.marshaCode || "");
      setRooms(roomType.rooms ? String(roomType.rooms) : "");
      setLoading(false);
    };

    loadRoomType();
  }, [hotelUid, roomTypeId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!hotelUid || !roomTypeId) return;
    await updateRoomType(hotelUid, roomTypeId, {
      name: name.trim(),
      operaCode: operaCode.trim(),
      marshaCode: marshaCode.trim(),
      rooms: Number(rooms) || 0,
    });
    navigate("/settings/room-types");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <HeaderBar today={todayLabel} onLogout={handleLogout} />
        <PageContainer className="space-y-6">
          <p className="text-gray-600">Room type laden...</p>
        </PageContainer>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <HeaderBar today={todayLabel} onLogout={handleLogout} />
        <PageContainer className="space-y-6">
          <p className="text-gray-600">Dit room type bestaat niet (meer).</p>
          <button
            type="button"
            onClick={() => navigate("/settings/room-types")}
            className="bg-gray-100 text-gray-800 px-4 py-2 rounded font-semibold border border-gray-300 hover:bg-gray-200"
          >
            Terug naar room types
          </button>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">Room Types</p>
          <h1 className="text-2xl sm:text-3xl font-bold">Room type bewerken</h1>
          <p className="text-gray-600 mt-1">Pas het room type aan.</p>
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
