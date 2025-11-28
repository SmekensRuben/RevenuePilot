// src/features/stockcount/ReportProductCard.jsx

import React from "react";

function percentClass(percent) {
  if (percent > 0.5) return "text-green-700 font-bold";
  if (percent < -0.5) return "text-red-700 font-bold";
  return "text-gray-700";
}

export default function ReportProductCard({ row }) {
  let borderClass = "";
  if (row.valueDiff > 0) borderClass = "border-green-600";
  else if (row.valueDiff < 0) borderClass = "border-red-600";

  return (
    <div className={`rounded-xl border-2 ${borderClass ? borderClass : "border-gray-200"} bg-white p-4 mb-4`}>
      <div className="font-bold text-lg mb-1">{row.name}</div>
      <div className="text-sm mb-1"><b>Eenheidsprijs:</b> € {row.countedPrice.toFixed(2)}</div>
      <div className="flex flex-wrap gap-3 text-sm mb-1">
        <span><b>Verwacht:</b> {row.expectedAmount.toFixed(2)}</span>
<span><b>Nu:</b> {row.nowAmount.toFixed(2)}</span>
<span><b>Verschil:</b> {row.diff > 0 ? "+" : ""}{row.diff.toFixed(2)}</span>

        <span className={percentClass(row.percent)}>
  <b>%:</b> {row.percent ? row.percent.toFixed(1) : "0"}%
</span>
      </div>
      <div className="flex flex-wrap gap-3 text-sm mb-1">
        <span><b>Verschil (€):</b> {row.valueDiff >= 0 ? "+" : ""}€ {row.valueDiff.toFixed(2)}</span>
        <span><b>Totale waarde:</b> € {row.value.toFixed(2)}</span>
        <span><b>Eenheid:</b> {row.unit}</span>
        <span><b>Categorie:</b> {row.category}</span>
      </div>
    </div>
  );
}
