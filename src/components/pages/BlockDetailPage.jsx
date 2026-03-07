import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, db, doc, getDoc, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";

export default function BlockDetailPage() {
  const navigate = useNavigate();
  const { blockId } = useParams();
  const { hotelUid } = useHotelContext();
  const [block, setBlock] = useState(null);
  const [loading, setLoading] = useState(true);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    const load = async () => {
      if (!hotelUid || !blockId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const snap = await getDoc(doc(db, `hotels/${hotelUid}/blocks`, blockId));
      setBlock(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    };
    load();
  }, [hotelUid, blockId]);

  const changes = useMemo(() => {
    const arr = Array.isArray(block?.changes) ? [...block.changes] : [];
    return arr.sort((a, b) =>
      String(b.insertDate || b.beginDate || "").localeCompare(String(a.insertDate || a.beginDate || ""))
    );
  }, [block]);

  return (
    <>
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 space-y-6">
          <Card>
            <div className="p-5 sm:p-6 space-y-3">
              <button
                onClick={() => navigate("/groups-me/blocks")}
                className="text-sm text-[#b41f1f] font-semibold"
              >
                ← Terug naar blocks
              </button>
              {loading ? (
                <p className="text-sm text-gray-500">Block laden...</p>
              ) : !block ? (
                <p className="text-sm text-gray-500">Block niet gevonden.</p>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900">{block.blockName || block.id}</h1>
                  <p className="text-sm text-gray-600">Block ID: {block.id}</p>
                </>
              )}
            </div>
          </Card>

          {!!block && (
            <Card>
              <div className="p-5 sm:p-6">
                <h2 className="text-lg font-semibold mb-3">Changes</h2>
                {!changes.length ? (
                  <p className="text-sm text-gray-500">Geen changes gevonden.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-600">
                          <th className="py-2 pr-4">Insert date</th>
                          <th className="py-2 pr-4">Begin date</th>
                          <th className="py-2 pr-4">End date</th>
                          <th className="py-2 pr-4">Room status</th>
                          <th className="py-2 pr-4">Room nights</th>
                          <th className="py-2 pr-4">Room revenue</th>
                          <th className="py-2 pr-4">Catering status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((change, index) => (
                          <tr key={`${change.insertDate || "no-date"}-${index}`} className="border-b last:border-b-0">
                            <td className="py-2 pr-4">{change.insertDate || "-"}</td>
                            <td className="py-2 pr-4">{change.beginDate || "-"}</td>
                            <td className="py-2 pr-4">{change.endDate || "-"}</td>
                            <td className="py-2 pr-4">{change.roomStatus || "-"}</td>
                            <td className="py-2 pr-4">{change.roomNights || "-"}</td>
                            <td className="py-2 pr-4">{change.roomRevenue || "-"}</td>
                            <td className="py-2 pr-4">{change.cateringStatus || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </PageContainer>
    </>
  );
}
