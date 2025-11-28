// src/features/lightspeed/LightspeedDayDetails.jsx
import React from "react";

export default function LightspeedDayDetails({ dayObj, expanded, setExpandedDay }) {
  if (!expanded) return null;

  return (
    <tr className="bg-gray-50 border-b">
      <td colSpan={5} className="px-6 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          <div>
            <h4 className="font-medium text-green-700 mb-1">Gekoppelde producten</h4>
            <ul className="list-disc pl-6 text-sm">
              {dayObj.foundList.length > 0
                ? dayObj.foundList.map(prod => (
                  <li key={prod.productId} className="flex items-center gap-2">
                    <span>
                      {prod.name}{" "}
                      <span className="text-xs text-gray-400">({prod.productId})</span>
                    </span>
                    {prod.priceMismatch && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-200">
                        €{Number(prod.taxInclusivePrice).toFixed(2)} ≠ €{Number(prod.systemPrice).toFixed(2)}
                      </span>
                    )}
                  </li>
                ))
                : <li className="text-gray-400 italic">Geen</li>
              }
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-red-700 mb-1">Niet gevonden producten</h4>
            <ul className="list-disc pl-6 text-sm">
              {dayObj.notFoundList.length > 0
                ? dayObj.notFoundList.map(prod => (
                  <li key={prod.productId}>
                    {prod.name} <span className="text-xs text-gray-400">({prod.productId})</span>
                  </li>
                ))
                : <li className="text-gray-400 italic">Geen</li>
              }
            </ul>
          </div>
        </div>
      </td>
    </tr>
  );
}
