// src/features/stockcount/StockCountDashboardPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import StockCountHistoryList from "./StockCountHistoryList";
import StockCountStartModal from "./StockCountStartModal";
import ActiveStockCount from "./ActiveStockCount";
import { useHotelContext } from "contexts/HotelContext";
import { auth, signOut } from "../../firebaseConfig";
import { usePermission } from "../../hooks/usePermission";
import {
  getActiveStockCountId,
  getStockCountHistory
} from "./stockCountService";

export default function StockCountDashboardPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const [activeTellingId, setActiveTellingId] = useState(undefined);
  const [showStartModal, setShowStartModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const canCountStock =
    usePermission("stockcounts", "count") ||
    usePermission("stockcounts", "edit") ||
    usePermission("stockcounts", "create");

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  // Haal actieve telling op
  useEffect(() => {
    const fetchActive = async () => {
      setLoading(true);
      if (!hotelUid) return;
      const id = await getActiveStockCountId(hotelUid);
      setActiveTellingId(id);
      setLoading(false);
    };
    fetchActive();
  }, [hotelUid]);

  // Haal history van afgesloten tellingen op
  useEffect(() => {
    const fetchHistory = async () => {
      if (!hotelUid) return;
      const h = await getStockCountHistory(hotelUid);
      setHistory(h);
    };
    fetchHistory();
  }, [hotelUid, activeTellingId]);

  const handleTellingClosed = () => {
    setActiveTellingId(null);
  };

  const handleSelectReport = (tellingId) => {
    navigate(`/stockcount/report/${encodeURIComponent(tellingId)}`);
  };

  if (loading) {
    return (
      <>
        <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
        <PageContainer className="max-w-5xl px-2 py-8">
          <h1 className="text-2xl font-bold mb-4">Drank Stocktelling</h1>
          <div className="text-center text-gray-400 py-8">Telling wordt geladen...</div>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer className="max-w-5xl px-2 py-8">
        <h1 className="text-2xl font-bold mb-4">Drank Stocktelling</h1>
        {activeTellingId ? (
          <ActiveStockCount
            tellingId={activeTellingId}
            onClosed={handleTellingClosed}
            canManage={canCountStock}
          />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-center mb-6">
            <p className="mb-3 text-lg font-medium">Er is geen actieve telling. Start een nieuwe!</p>
            <button
              className="bg-marriott text-white px-6 py-2 rounded-xl font-semibold shadow"
              onClick={() => canCountStock && setShowStartModal(true)}
              disabled={!canCountStock}
              title={!canCountStock ? "Je hebt geen rechten om een telling te starten." : undefined}
            >
              Nieuwe telling starten
            </button>
          </div>
        )}
        <StockCountHistoryList
          history={history}
          onSelect={handleSelectReport}
        />
        {showStartModal && canCountStock && (
          <StockCountStartModal
            onSuccess={newTellingId => {
              setActiveTellingId(newTellingId);
              setShowStartModal(false);
            }}
            onClose={() => setShowStartModal(false)}
          />
        )}
      </PageContainer>
    </>
  );
}
