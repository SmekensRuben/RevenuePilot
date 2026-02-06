import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";

const columns = [
  { key: "code", label: "Room Class Code", isNumeric: false },
  { key: "description", label: "Description", isNumeric: false },
  { key: "rooms", label: "Number of Rooms", isNumeric: true },
  { key: "roomTypes", label: "Room Types", isNumeric: false },
];

export default function RoomClassesPage() {
  const navigate = useNavigate();
  const [roomClasses, setRoomClasses] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "code", direction: "asc" });

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
    setRoomClasses([]);
  }, []);

  const sortedRoomClasses = useMemo(() => {
    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
    const sorted = [...roomClasses].sort((a, b) => {
      const aValue = a?.[sortConfig.key];
      const bValue = b?.[sortConfig.key];
      const numericValue = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };
      const aNumeric = numericValue(aValue);
      const bNumeric = numericValue(bValue);

      if (aNumeric !== null && bNumeric !== null) {
        return (aNumeric - bNumeric) * directionMultiplier;
      }

      return (
        String(aValue || "").localeCompare(String(bValue || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * directionMultiplier
      );
    });
    return sorted;
  }, [roomClasses, sortConfig]);

  const handleSort = (columnKey) => {
    setSortConfig((current) => {
      if (current.key === columnKey) {
        return {
          key: columnKey,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">
              Room Classes
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold">Room Classes overzicht</h1>
            <p className="text-gray-600 mt-1">
              Bekijk en beheer alle aangemaakte room classes.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={() => navigate("/settings/room-classes/new")}
              className="bg-[#b41f1f] text-white px-3 py-2 rounded-full shadow hover:bg-[#961919] transition-colors"
              aria-label="Nieuw room class aanmaken"
              title="Nieuw room class aanmaken"
            >
              <Plus className="h-5 w-5" />
              <span className="sr-only">Nieuw room class aanmaken</span>
            </button>
          </div>
        </div>

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Room Classes</h2>
              <p className="text-sm text-gray-600">
                {roomClasses.length} room class{roomClasses.length === 1 ? "" : "es"} gevonden
              </p>
            </div>
          </div>
          {roomClasses.length === 0 ? (
            <p className="text-gray-600">Nog geen room classes aangemaakt.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((column) => {
                      const isActiveSort = sortConfig.key === column.key;
                      const sortIndicator = isActiveSort
                        ? sortConfig.direction === "asc"
                          ? "▲"
                          : "▼"
                        : "⇅";
                      return (
                        <th
                          key={column.key}
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(column.key)}
                            className="inline-flex items-center gap-2 focus:outline-none"
                          >
                            <span>{column.label}</span>
                            <span className="text-gray-400 text-[10px]">{sortIndicator}</span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {sortedRoomClasses.map((roomClass) => (
                    <tr key={roomClass.id}>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {roomClass.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {roomClass.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {roomClass.rooms || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {roomClass.roomTypes?.length
                          ? roomClass.roomTypes.join(", ")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}
