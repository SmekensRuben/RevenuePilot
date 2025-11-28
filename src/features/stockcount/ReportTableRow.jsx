// src/features/stockcount/ReportTableRow.jsx

import React from "react";

function percentClass(percent) {
  if (percent > 0.5) return "text-green-700 font-bold";
  if (percent < -0.5) return "text-red-700 font-bold";
  return "text-gray-700";
}

export default function ReportTableRow({ row }) {
  let borderClass = "";
  if (row.valueDiff > 0) borderClass = "border-l-4 border-green-600";
  else if (row.valueDiff < 0) borderClass = "border-l-4 border-red-600";

  return (
    <tr className={`${borderClass}`}>
      <td className="p-3 max-w-[250px]">{row.name}</td>
      <td className="p-3 text-right">{row.stockUnit}</td>
      <td className="p-3 text-right">€ {row.countedPrice.toFixed(2)}</td>
<td className="p-3 text-right">{row.nowAmount.toFixed(2)}</td>
<td className="p-3 text-right">{row.diff > 0 ? "+" : ""}{row.diff.toFixed(2)}</td>     
      <td className="p-3 text-right">{row.valueDiff >= 0 ? "+" : ""}€ {row.valueDiff.toFixed(2)}</td>
      <td className="p-3 text-right">€ {row.value.toFixed(2)}</td>
      <td className="p-3">{row.category}</td>
    </tr>
  );
}
