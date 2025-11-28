import React, { useState, useEffect } from "react";
import { useHotelContext } from "contexts/HotelContext";
import { getReturns, updateReturn } from "./returnsService";
import ReturnFilters from "./ReturnFilters";
import ReturnList from "./ReturnList";
import { useNavigate } from "react-router-dom";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { usePermission } from "../../hooks/usePermission";

export default function ReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const { hotelUid, hotelName } = useHotelContext();
  const navigate = useNavigate();
  const canCreateReturn = usePermission("retours", "create");

  useEffect(() => {
    async function fetchReturns() {
      setLoading(true);
      const data = await getReturns(hotelUid);
      setReturns(data);
      setLoading(false);
    }
    fetchReturns();
  }, [hotelUid]);

  // Filter returns in UI
  const filteredReturns = returns.filter(ret => {
    if (filter.status && ret.status !== filter.status) return false;
    if (filter.dateFrom && ret.dateCreated && new Date(ret.dateCreated).toISOString().slice(0, 10) < filter.dateFrom) return false;
    if (filter.dateTo && ret.dateCreated && new Date(ret.dateCreated).toISOString().slice(0, 10) > filter.dateTo) return false;
    return true;
  });

  // Status update handler
  async function handleStatusUpdate(retourId, currentStatus) {
    let nextStatus, updateFields;
    if (currentStatus === "created") {
      nextStatus = "pickedup";
      updateFields = { status: nextStatus, datePickedUp: Date.now() };
    } else if (currentStatus === "pickedup") {
      nextStatus = "creditnota";
      updateFields = { status: nextStatus, dateCreditnotaReceived: Date.now() };
    } else {
      return;
    }
    await updateReturn(hotelUid, retourId, updateFields);
    setReturns(returns =>
      returns.map(r =>
        r.id === retourId ? { ...r, ...updateFields } : r
      )
    );
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} />
      <PageContainer>
        <div className="flex flex-col sm:flex-row sm:justify-between items-center mb-4">
          <h1 className="text-2xl font-bold mb-2 sm:mb-0">Retouren</h1>
          {canCreateReturn && (
            <button
              className="bg-marriott text-white px-4 py-2 rounded-2xl shadow hover:bg-marriott-dark transition font-semibold"
              onClick={() => navigate("/newreturn")}
            >
              + Nieuwe retour
            </button>
          )}
        </div>
        <ReturnFilters filter={filter} setFilter={setFilter} />
        {loading ? (
          <div className="text-center text-gray-500">Laden...</div>
        ) : (
          <ReturnList returns={filteredReturns} onStatusUpdate={handleStatusUpdate} />
        )}
      </PageContainer>
    </>
  );
}
