import { useEffect, useState } from "react";
import { useHotelContext } from "contexts/HotelContext";
import { useNavigate } from "react-router-dom";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { logout } from "../../services/firebaseAuth";
import { getOrders } from "../orders/orderService";
import { getInvoices, createInvoice } from "./invoiceService";

export default function InvoicesPage() {
  const { hotelName, hotelUid } = useHotelContext();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState({});

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelUid]);

  async function fetchData() {
    if (!hotelUid) return;
    const ords = await getOrders(hotelUid);
    const invs = await getInvoices(hotelUid);
    setInvoices(invs);
    const invoicedIds = new Set(invs.flatMap(inv => inv.orders?.map(o => o.id) || []));
    setOrders(ords.filter(o => !invoicedIds.has(o.id)));
  }

  function toggle(id) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleCreate() {
    const selOrders = orders.filter(o => selected[o.id]);
    await createInvoice(hotelUid, selOrders);
    setSelected({});
    fetchData();
  }

  function calcTotal(order) {
    return order.articles
      ? order.articles.reduce((sum, prod) => {
          const qty = order.status === "received" ? Number(prod.received || 0) : Number(prod.quantity || 0);
          return sum + qty * Number(prod.price || 0);
        }, 0)
      : 0;
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  function formatDate(date) {
    return date ? new Date(date).toLocaleDateString("en-GB") : "";
  }

  function handleLogout() {
    logout().then(() => navigate("/login"));
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} today={new Date().toLocaleDateString("nl-BE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} onLogout={handleLogout} />
      <PageContainer className="max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Invoices</h1>
        {orders.length ? (
          <div className="mb-4">
            <table className="min-w-full divide-y divide-gray-200 mb-2">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Supplier</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Delivery Date</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={!!selected[order.id]} onChange={() => toggle(order.id)} />
                    </td>
                    <td className="px-4 py-2">{order.supplier}</td>
                    <td className="px-4 py-2">{formatDate(order.deliveryDate)}</td>
                    <td className="px-4 py-2 text-right">€{calcTotal(order).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="bg-marriott text-white px-4 py-2 rounded disabled:opacity-50"
              onClick={handleCreate}
              disabled={!selectedCount}
            >
              Create Invoice
            </button>
          </div>
        ) : (
          <div className="text-gray-500 mb-4">No orders available.</div>
        )}

        <h2 className="text-xl font-bold mt-8 mb-2">Existing Invoices</h2>
        {invoices.length ? (
          invoices.map(inv => (
            <div key={inv.id} className="border rounded p-4 mb-4">
              <div className="font-semibold mb-2">Invoice {inv.id}</div>
              {inv.orders?.map(order => (
                <div key={order.id} className="mb-2">
                  <div className="font-medium">{order.supplier}</div>
                  <ul className="ml-4 list-disc">
                    {inv.items?.filter(item => item.orderId === order.id).map((item, idx) => (
                      <li key={idx}>{item.name} ({item.quantity})</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="text-gray-500">No invoices yet.</div>
        )}
      </PageContainer>
    </>
  );
}
