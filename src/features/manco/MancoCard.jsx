import React from "react";

export default function MancoCard({ manco }) {
  // Prijsberekening
  const totaalprijs =
    typeof manco.pricePerPurchaseUnit === "number" || typeof manco.pricePerPurchaseUnit === "string"
      ? (Number(manco.quantity) * Number(manco.pricePerPurchaseUnit)).toFixed(2)
      : "-";

  return (
    <div className="bg-white rounded-2xl shadow-md px-5 py-4 mb-3 flex flex-col min-w-0">
      <div className="flex justify-between items-center mb-1">
        <div className="font-semibold text-base text-gray-900">
          {manco.product}
        </div>
        <span className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5">
          {manco.supplier}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-1">
        <span>Leverdatum:</span>
        <span className="text-gray-800 font-medium">{manco.date}</span>
        <span>Art. nr:</span>
        <span>{manco.artikelnummer || manco.articleNumber || "-"}</span>
      </div>
      <div className="flex items-center gap-2 text-sm mb-1">
        <span>Eenheid:</span>
        <span className="font-semibold">
          {(manco.unitsPerPurchaseUnit || "-") + " " + (manco.stockUnit || "")}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm mb-1">
        <span className="text-gray-500">Manco:</span>
        <span className="font-semibold text-orange-600">{manco.quantity}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Totaalprijs:</span>
        <span className="font-semibold text-marriott">
          {totaalprijs !== "-" ? `€${totaalprijs}` : "-"}
        </span>
      </div>
    </div>
  );
}
