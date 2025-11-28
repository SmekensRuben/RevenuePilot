// src/features/orders/ProductLine.jsx
import React, { useState } from "react";
import { AlertCircle, Settings } from "lucide-react";

export default function ProductLine({
  prod,
  imageUrl,
  showReceived,
  canEditPrice = false,
  onEditPrice,
  canEditInvoicedPrice = false,
  onEditInvoicedPrice,
  index,
}) {
  const qty = Number(prod.quantity) || 0;
  const unitPrice = Number(
    prod.invoicedPricePerPurchaseUnit
    ?? prod.price
    ?? prod.pricePerPurchaseUnit
    ?? 0
  );
  const received = Number(prod.received) || 0;
  const usedQty = showReceived ? received : qty;
  const total = usedQty * unitPrice;

  const [menuOpen, setMenuOpen] = useState(false);

  const gridClass = `relative grid grid-cols-5 ${showReceived ? "sm:grid-cols-8" : "sm:grid-cols-7"} gap-2 items-center text-sm px-4 py-3 odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors`;

  return (
    <div className={gridClass}>
      <div className="sm:col-span-2 flex items-center gap-2">
        {imageUrl && (
          <img src={imageUrl} alt={prod.name} className="w-8 h-8 object-contain" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{prod.name}</span>
            {prod.custom && <span className="badge-new">NEW</span>}
          </div>
          {prod.articleNumber && (
            <div className="text-xs text-gray-500">Art.nr: {prod.articleNumber}</div>
          )}
          {prod.unitsPerPurchaseUnit && prod.stockUnit && prod.purchaseUnit && (
            <div className="text-xs text-gray-500">
              / {prod.unitsPerPurchaseUnit} {prod.stockUnit} per {prod.purchaseUnit}
            </div>
          )}
        </div>
      </div>
      <div>{prod.brand}</div>
      <div>{prod.outlet}</div>
      <div>{qty}</div>
      <div className="hidden sm:block">€{unitPrice.toFixed(2)}</div>
      {showReceived && (
        <div className="hidden sm:block">{received.toFixed(2)}</div>
      )}
      <div className="font-semibold text-marriott">
        €{total.toFixed(2)}
        {usedQty > 1 && (
          <span className="text-xs text-gray-500 ml-1">({usedQty}×)</span>
        )}
      </div>
      {(canEditPrice || canEditInvoicedPrice) && (
        <div className="absolute right-2 top-1 text-gray-400">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="hover:text-gray-600"
          >
            <Settings className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 bg-white border rounded shadow z-10">
              {canEditPrice && (
                <button
                  type="button"
                  className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-100"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onEditPrice) onEditPrice(index);
                  }}
                >
                  Prijs aanpassen
                </button>
              )}
              {canEditInvoicedPrice && (
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left px-3 py-1 text-sm hover:bg-gray-100 text-red-600"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onEditInvoicedPrice) onEditInvoicedPrice(index);
                  }}
                >
                  <AlertCircle className="w-4 h-4" />
                  Factuurprijs
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
