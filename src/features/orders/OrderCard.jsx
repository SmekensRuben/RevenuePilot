import React, { useState } from "react";
import ProductLine from "./ProductLine";
import { useNavigate } from "react-router-dom";
import { setOrderStatus, updateOrder } from "./orderService";
import { usePermission } from "hooks/usePermission";

export default function OrderCard({ order }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const canApproveOrder = usePermission("orders", "approve");
  const canReceiveOrder = usePermission("orders", "receive");

  const statusColors = {
    created: "bg-orange-50 text-orange-700 border border-orange-200",
    ordered: "bg-yellow-50 text-yellow-700 border border-yellow-200",
    received: "bg-green-50 text-green-700 border border-green-200",
    checked: "bg-sky-50 text-sky-700 border border-sky-200",
    completed: "bg-emerald-700 text-white border border-emerald-800",
    cancelled: "bg-red-50 text-red-700 border border-red-200",
    canceled: "bg-red-50 text-red-700 border border-red-200"
  };

  const showReceived = ["received", "checked", "completed"].includes(order.status);
  const getUnitPrice = art => Number(
    art.invoicedPricePerPurchaseUnit
    ?? art.price
    ?? art.pricePerPurchaseUnit
    ?? 0
  );
  const orderTotal = order.articles
    ? order.articles.reduce((sum, art) => {
        const qty = showReceived
          ? Number(art.received) || 0
          : Number(art.quantity) || 0;
        return sum + qty * getUnitPrice(art);
      }, 0)
    : 0;

  const handleConfirm = async () => {
    if (!canApproveOrder) return;
    await setOrderStatus(order.hotelUid || "hotel_001", order.id, "ordered");
    window.location.reload();
  };

  const handleCancel = async () => {
    await setOrderStatus(order.hotelUid || "hotel_001", order.id, "cancelled");
    window.location.reload();
  };

  return (
    <div className="rounded-2xl shadow p-4 bg-white border flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{order.supplier}</div>
          <div className="text-xs text-gray-500">Order date: {order.orderDate}</div>
          <div className="text-xs text-gray-500">Delivery: {order.deliveryDate}</div>
          {order.note && (
            <div className="text-xs mt-1 text-gray-600">{order.note}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${statusColors[order.status] || "bg-gray-100 text-gray-600"}`}
            style={{ minWidth: 90, textAlign: "center", letterSpacing: 1 }}
            title={order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          >
            {order.status}
          </span>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-marriott underline text-sm hover:text-marriott-dark"
          >
            {open ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-2">
          {/* Mobiel: kaarten */}
          <div className="flex flex-col gap-3 sm:hidden mt-2">
            {order.articles.map((art, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1">
                <div className="font-bold text-base text-gray-900">{art.name}</div>
                <div className="text-xs text-gray-600">{art.brand}</div>
                {art.outlet && (
                  <div className="text-xs text-gray-600">{art.outlet}</div>
                )}
                <div className="flex flex-wrap gap-2 text-sm mt-1">
                  <span className="text-gray-500">Aantal:</span>
                  <span className="font-semibold">{art.quantity}</span>
                  {art.unitsPerPurchaseUnit && art.stockUnit && (
                    <span className="ml-2 text-xs text-gray-500">
                      / {art.unitsPerPurchaseUnit} {art.stockUnit}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-gray-500">Prijs:</span>
                  <span>€{getUnitPrice(art).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-gray-500">Totaal:</span>
                  <span className="font-semibold text-marriott">
                    €
                    {(
                      (showReceived
                        ? Number(art.received) || 0
                        : Number(art.quantity) || 0) * getUnitPrice(art)
                    ).toFixed(2)}
                  </span>
                </div>
                {art.shortage !== undefined && (
                  <div className="text-xs text-orange-600">
                    Tekort: {art.shortage}
                  </div>
                )}
                {art.received !== undefined && (
                  <div className="text-xs text-emerald-600">
                    Ontvangen: {Number(art.received).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: kolomindeling zoals vroeger */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 font-semibold text-marriott text-sm mb-1">
              <div>Article</div>
              <div>Brand</div>
              <div>Outlet</div>
              <div>Qty</div>
              <div className="hidden sm:block">Price</div>
              <div className="hidden sm:block">Received</div>
              <div className="hidden sm:block">Shortage</div>
              <div className="font-semibold">Totaal</div>
            </div>
            {order.articles.map((art, i) => (
              <ProductLine key={i} prod={art} showReceived={showReceived} />
            ))}
          </div>

          <div className="mt-4 text-right font-bold text-lg text-marriott border-t pt-3">
            Totaal bestelling: €{orderTotal.toFixed(2)}
          </div>

          {/* Actieknoppen */}
          {(order.status === "created" || order.status === "ordered") && (
            <div className="flex flex-col items-center gap-2 my-4">
              <div className="flex gap-2">
                {order.status === "created" && (
                  <>
                    {/* Edit order */}
                    <button
                      onClick={() => navigate(`/orders/${order.id}/edit`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-marriott border border-marriott/40 shadow-sm hover:bg-marriott hover:text-white transition font-semibold"
                    >
                      {/* Pencil */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6-6m2.121-2.121a3 3 0 114.243 4.243l-12 12H3v-3.343l12-12z" />
                      </svg>
                      Edit
                    </button>
                    {/* Confirm & Order */}
                    {canApproveOrder && (
                      <button
                        onClick={handleConfirm}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-marriott text-white shadow-sm hover:bg-marriott-dark transition font-semibold"
                      >
                        {/* Check */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Confirm
                      </button>
                    )}
                  </>
                )}
                {order.status === "ordered" && canReceiveOrder && (
                  <button
                    onClick={() => navigate(`/orders/${order.id}/receive`)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-marriott text-white shadow-sm hover:bg-marriott-dark transition font-semibold"
                  >
                    Ontvangst
                  </button>
                )}
                {(order.status === "created" || order.status === "ordered") && (
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 border border-gray-300 shadow-sm hover:bg-gray-200 transition font-semibold"
                  >
                    {/* Trash icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h14" />
                    </svg>
                    Cancel
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-400 mt-1">
                {order.status === "created" && "Je kan bewerken, bevestigen of annuleren zolang de order in \"Created\" status staat."}
                {order.status === "ordered" && "Annuleer of ontvang goederen wanneer de order op \"Ordered\" staat."}
                {order.status === "checked" && "Rond de finale controle af of keer terug naar Received indien nodig."}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
