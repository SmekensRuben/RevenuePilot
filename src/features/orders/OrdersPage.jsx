// src/features/orders/OrdersPage.jsx
import { useEffect, useState } from "react";
import OrderList from "./OrderList";
import OrderModal from "./OrderModal";
import { useHotelContext } from "contexts/HotelContext";
import { useNavigate } from "react-router-dom";
import OrderFilters from "./OrderFilters";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { logout } from "../../services/firebaseAuth";
import { getOrders } from "./orderService";
import { exportOrdersToExcel } from "./exportOrders";
import { usePermission } from "../../hooks/usePermission";
import { useTranslation } from "react-i18next";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { hotelName, hotelUid } = useHotelContext();
  const [filter, setFilter] = useState({
    status: "",
    orderDateFrom: getDateNDaysAgo(7),
    orderDateTo: new Date().toISOString().slice(0, 10),
    deliveryDateFrom: "",
    deliveryDateTo: "",
  });
  const [sortField, setSortField] = useState("deliveryDate");
  const [sortDir, setSortDir] = useState("desc");

  const navigate = useNavigate();
  const canCreateOrder = usePermission("orders", "create");
  const { t } = useTranslation("orders");

  async function fetchOrders() {
    setLoading(true);
    const arr = await getOrders(hotelUid);
    setOrders(arr);
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line
  }, [hotelUid]);

  const filteredOrders = orders.filter(order => {
    if (filter.status && order.status !== filter.status) return false;
    if (filter.orderDateFrom && order.orderDate < filter.orderDateFrom) return false;
    if (filter.orderDateTo && order.orderDate > filter.orderDateTo) return false;
    if (filter.deliveryDateFrom && order.deliveryDate < filter.deliveryDateFrom) return false;
    if (filter.deliveryDateTo && order.deliveryDate > filter.deliveryDateTo) return false;
    return true;
  });

  function getDateNDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function formatToday() {
    const d = new Date();
    return d.toLocaleDateString("nl-BE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function handleLogout() {
    logout().then(() => {
      navigate("/login");
    });
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
      <HeaderBar hotelName={hotelName} today={formatToday()} onLogout={handleLogout} />
      <PageContainer className="max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:justify-between items-center mb-4">
          <h1 className="text-2xl font-bold mb-2 sm:mb-0">{t("list.title")}</h1>
          <div className="flex gap-2">
            <button
              className="btn bg-marriott text-white px-4 py-2 rounded"
              onClick={() =>
                exportOrdersToExcel(filteredOrders, {
                  fileName: `orders_${filter.orderDateFrom || "all"}_${filter.orderDateTo || "all"}`,
                })
              }
            >
              {t("list.export")}
            </button>
            {canCreateOrder && (
              <button
                className="bg-marriott text-white px-4 py-2 rounded-2xl shadow hover:bg-marriott-dark transition font-semibold"
                onClick={() => navigate("/neworder")}
              >
                {t("list.newOrder")}
              </button>
            )}
          </div>
        </div>
        <OrderFilters filter={filter} setFilter={setFilter} />
        {loading ? (
          <div className="text-center text-gray-500">{t("list.loading")}</div>
        ) : (
          <OrderList
            orders={filteredOrders}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}
        <OrderModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onOrderAdded={fetchOrders}
          hotelUid={hotelUid}
        />
      </PageContainer>
    </>
  );
}
