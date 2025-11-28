// src/features/stockcount/StockCountHistoryList.jsx
import React from "react";

export default function StockCountHistoryList({ history, onSelect }) {
  if (!history.length)
    return (
      <div className="mt-8 text-gray-400 text-center italic">
        Geen afgesloten tellingen gevonden.
      </div>
    );

  return (
    <div className="mt-10">
      <h2 className="text-2xl font-semibold mb-6 tracking-tight">Historiek</h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {history.map((row) => (
          <div
            key={row.tellingId}
            className="rounded-2xl shadow-lg bg-white p-6 flex flex-col border border-gray-100 transition hover:shadow-xl hover:border-marriott"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="block font-bold text-lg text-gray-900">
                {row.date
                  ? new Date(row.date).toLocaleString()
                  : row.startedAt
                  ? new Date(row.startedAt).toLocaleString()
                  : "-"}
              </span>
              {row.status === "Closed" && (
                <span className="ml-auto px-3 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold shadow-sm border border-green-200">
                  Afgesloten
                </span>
              )}
              {row.status !== "Closed" && (
                <span className="ml-auto px-3 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold shadow-sm border border-yellow-200">
                  {row.status}
                </span>
              )}
            </div>
            <div className="text-gray-500 text-sm mb-4">
              {row.closedAt && (
                <>
                  Afgesloten op:{" "}
                  <span className="text-gray-700 font-medium">
                    {new Date(row.closedAt).toLocaleString()}
                  </span>
                </>
              )}
            </div>
            <button
              className="mt-auto inline-block bg-marriott text-white text-sm font-bold py-2 px-4 rounded-xl hover:bg-[#941a1a] transition"
              onClick={() => onSelect(row.tellingId)}
            >
              Bekijk rapport
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
