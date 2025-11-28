import React from "react";
import { FaTrash } from "react-icons/fa";

// Helper voor timestamp weergave
function formatTimestamp(ts) {
  if (!ts) return "-";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

// --- Card stijl voor mobiel (linksonder stijl) ---
function StockCountCard({ item, onRemove, canManage }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl shadow-md px-5 py-4 gap-3 mb-2">
      <div className="flex flex-col gap-1 flex-grow min-w-0">
        <div className="font-bold text-lg text-gray-900">
          {item.name}
        </div>
        <div className="text-gray-500 text-sm truncate">
          {item.brand}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-gray-500">Geteld</span>
          <span className="bg-emerald-400 text-white font-bold rounded-lg px-3 py-1 text-base shadow-sm">
            {item.quantity} {item.stockUnit}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Laatst geteld: {formatTimestamp(item.timestamp)}
        </div>
      </div>
      {canManage && (
        <button
          type="button"
          className="flex items-center justify-center ml-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-3 transition"
          style={{ fontSize: 24 }}
          onClick={() => {
            onRemove(item.articleId);
          }}
          title="Verwijderen"
        >
          <FaTrash />
        </button>
      )}
    </div>
  );
}

// --- Hoofdcomponent ---
export default function StockCountTable({
  lines,
  sortKey,
  sortDir,
  onSort,
  onRemove,
  canManage = true,
}) {
  // Direct sorteren hier (optioneel)
  // Nieuwste eerst: sorteer op timestamp (aflopend)
const sortedLines = [...lines].sort((a, b) => {
  const ta = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime()) : 0;
  const tb = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime()) : 0;
  // Nieuwste bovenaan (tb - ta)
  return tb - ta;
});


  return (
    <>
      {/* Mobile: Cards */}
      <div className="md:hidden flex flex-col gap-3 mt-6">
        {sortedLines.map(item => (
          <StockCountCard
            key={item.articleId}
            item={item}
            onRemove={onRemove}
            canManage={canManage}
          />
        ))}
      </div>
      {/* Desktop: Table */}
      <div className="overflow-x-auto mt-8">
        <table className="hidden md:table w-full text-left rounded overflow-hidden bg-white">
          <thead>
            <tr>
              <th
                className="p-2 cursor-pointer"
                onClick={() => onSort("name")}
              >
                Naam {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="p-2">Merk</th>
              <th className="p-2">Eenheid</th>
              <th className="p-2">Aantal</th>
              <th className="p-2">Laatst geteld</th>
              {canManage && <th className="p-2"></th>}
            </tr>
          </thead>
          <tbody>
            {sortedLines.map(item => (
              <tr key={item.articleId} className="align-middle">
                <td className="p-2 font-semibold">{item.name}</td>
                <td className="p-2">{item.brand}</td>
                <td className="p-2">{item.stockUnit}</td>
                <td className="p-2">{item.quantity}</td>
                <td className="p-2 text-xs text-gray-500">{formatTimestamp(item.timestamp)}</td>
                {canManage && (
                  <td className="p-2">
                    <button
                      type="button"
                      className="flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-3 transition"
                      style={{ fontSize: 24 }}
                      onClick={() => onRemove(item.articleId)}
                      title="Verwijderen"
                    >
                      <FaTrash />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
