import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { subscribeRoomTypes } from "../../services/firebaseRoomTypes";
import { addRoomClass } from "../../services/firebaseRoomClasses";

export default function RoomClassCreatePage() {
  const navigate = useNavigate();
  const { hotelUid } = useHotelContext();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [rooms, setRooms] = useState("");
  const [selectedRoomTypes, setSelectedRoomTypes] = useState([]);
  const [availableRoomTypes, setAvailableRoomTypes] = useState([]);
  const [roomTypeToAdd, setRoomTypeToAdd] = useState("");

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!hotelUid) return;
    await addRoomClass(hotelUid, {
      code: code.trim(),
      description: description.trim(),
      rooms: Number(rooms) || 0,
      roomTypes: selectedRoomTypes,
    });
    navigate("/settings/room-classes");
  };

  useEffect(() => {
    if (!hotelUid) {
      setAvailableRoomTypes([]);
      return undefined;
    }
    const unsubscribe = subscribeRoomTypes(hotelUid, setAvailableRoomTypes);
    return () => unsubscribe();
  }, [hotelUid]);

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
            <div className="flex flex-col gap-3 sm:col-span-2">
              <div className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                Gekoppelde room types
                {selectedRoomTypes.length === 0 ? (
                  <p className="text-sm text-gray-500 font-normal">
                    Nog geen room types gekoppeld.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {selectedRoomTypes.map((roomType) => (
                      <li
                        key={roomType}
                        className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                      >
                        <span>{roomType}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedRoomTypes((current) =>
                              current.filter((item) => item !== roomType)
                            )
                          }
                          className="text-gray-500 hover:text-gray-700"
                          aria-label={`Verwijder ${roomType}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                Room type toevoegen
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={roomTypeToAdd}
                    onChange={(event) => setRoomTypeToAdd(event.target.value)}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selecteer een room type</option>
                    {availableRoomTypes
                      .map((roomType) => roomType.name || roomType.id)
                      .filter(Boolean)
                      .filter((name) => !selectedRoomTypes.includes(name))
                      .map((roomTypeName) => (
                        <option key={roomTypeName} value={roomTypeName}>
                          {roomTypeName}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!roomTypeToAdd) return;
                      setSelectedRoomTypes((current) => [...current, roomTypeToAdd]);
                      setRoomTypeToAdd("");
                    }}
                    className="bg-gray-100 text-gray-800 px-4 py-2 rounded font-semibold border border-gray-300 hover:bg-gray-200"
                  >
                    Toevoegen
                  </button>
                </div>
              </label>
            </div>
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
