import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useHotelContext } from "contexts/HotelContext";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { getTransfers } from "./transferService";
import { getOutlets } from "../../services/firebaseSettings";
import TransferList from "./TransferList";
import TransferFilters from "./TransferFilters";
import { usePermission } from "../../hooks/usePermission";
import { useTranslation } from "react-i18next";

export default function TransfersPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { t } = useTranslation("transfers");
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [outlets, setOutlets] = useState([]);
  const [filter, setFilter] = useState({
    status: "",
    dateFrom: getDateNDaysAgo(7),
    dateTo: new Date().toISOString().slice(0, 10),
    fromOutlet: "",
    toOutlet: "",
  });
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const navigate = useNavigate();
  const canCreate = usePermission("transfers", "create");

  useEffect(() => {
    async function fetchTransfers() {
      setLoading(true);
      const data = await getTransfers(hotelUid);
      setTransfers(data);
      setLoading(false);
    }
    fetchTransfers();
  }, [hotelUid]);

  useEffect(() => {
    getOutlets(hotelUid).then(res => setOutlets(res || []));
  }, [hotelUid]);

  const filtered = transfers.filter(tr => {
    const firstProd = tr.products?.[0] || {};
    const from = tr.fromOutlet || firstProd.fromOutlet;
    const to = tr.toOutlet || firstProd.toOutlet;
    if (filter.status && tr.status !== filter.status) return false;
    if (filter.dateFrom && tr.date < filter.dateFrom) return false;
    if (filter.dateTo && tr.date > filter.dateTo) return false;
    if (filter.fromOutlet && from !== filter.fromOutlet) return false;
    if (filter.toOutlet && to !== filter.toOutlet) return false;
    return true;
  });

  function getDateNDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  const handleSort = field => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <>
      <HeaderBar hotelName={hotelName} />
      <PageContainer>
        <div className="flex flex-col sm:flex-row sm:justify-between items-center mb-4">
          <h1 className="text-2xl font-bold mb-2 sm:mb-0">{t("title")}</h1>
          {canCreate && (
            <button
              className="bg-marriott text-white px-4 py-2 rounded-2xl shadow hover:bg-marriott-dark transition font-semibold"
              onClick={() => navigate("/newtransfer")}
            >
              + {t("newTransfer")}
            </button>
          )}
        </div>
        <TransferFilters filter={filter} setFilter={setFilter} outlets={outlets} />
        {loading ? (
          <div className="text-center text-gray-500">{t("loading")}</div>
        ) : (
          <TransferList
            transfers={filtered}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}
      </PageContainer>
    </>
  );
}
