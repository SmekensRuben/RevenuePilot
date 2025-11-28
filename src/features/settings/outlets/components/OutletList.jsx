import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

function SortableHeader({ label, field, sortField, sortDir, onSort, align = "left" }) {
  const isActive = sortField === field;
  const icon = isActive
    ? sortDir === "asc"
      ? <ChevronUp size={16} className="inline h-4 w-4 -mt-0.5" />
      : <ChevronDown size={16} className="inline h-4 w-4 -mt-0.5" />
    : <span className="inline-block w-4" />;
  const alignmentClass = align === "right" ? "text-right" : "text-left";
  const contentAlignment = align === "right" ? "justify-end" : "justify-start";

  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 select-none ${
        onSort ? "cursor-pointer transition hover:bg-gray-100" : ""
      } ${alignmentClass}`}
      onClick={() => onSort && onSort(field)}
      onKeyDown={event => {
        if (!onSort) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSort(field);
        }
      }}
      tabIndex={onSort ? 0 : undefined}
      aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className={`flex items-center gap-1 ${contentAlignment}`}>
        {label}
        {icon}
      </span>
    </th>
  );
}

export default function OutletList({
  outlets = [],
  onSelect,
  sortField = "name",
  sortDir = "asc",
  onSort,
}) {
  const formatCount = value => {
    const number = Number.isFinite(value) ? value : Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return "0";
    return number.toLocaleString("nl-BE");
  };

  const renderCostCenters = outlet => {
    if (!Array.isArray(outlet?.costCenterIds) || outlet.costCenterIds.length === 0) {
      return "Geen";
    }
    if (outlet.costCenterIds.length === 1) {
      return outlet.costCenterIds[0];
    }
    return `${outlet.costCenterIds.length} IDs`;
  };

  return (
    <div className="mt-4">
      {/* Mobile */}
      <div className="md:hidden flex flex-col divide-y divide-gray-200 rounded-xl overflow-hidden border border-gray-200 bg-white">
        {outlets.length === 0 ? (
          <div className="py-6 text-center text-gray-500">Geen outlets</div>
        ) : (
          outlets.map(outlet => {
            const id = outlet.id || outlet.name;
            return (
              <button
                key={id}
                className="flex flex-col items-start gap-1 px-4 py-3 text-left hover:bg-gray-50 transition"
                onClick={() => onSelect && onSelect(outlet)}
                type="button"
              >
                <span className="font-semibold text-gray-900">{outlet.name}</span>
                <span className="text-sm text-gray-600">Afdeling: {outlet.department || "-"}</span>
                <span className="text-sm text-gray-600">Outlet ID: {outlet.outletId || "-"}</span>
                <span className="text-sm text-gray-600">Cost centers: {renderCostCenters(outlet)}</span>
                <span className="text-sm text-gray-600">Suboutlets: {formatCount(outlet.subOutlets?.length || 0)}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-hidden rounded-xl shadow border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader
                label="Naam"
                field="name"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Afdeling"
                field="department"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Outlet ID"
                field="outletId"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Cost centers"
                field="costCenterIds"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Suboutlets"
                field="subOutlets"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {outlets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Geen outlets
                </td>
              </tr>
            ) : (
              outlets.map(outlet => {
                const id = outlet.id || outlet.name;
                return (
                  <tr
                    key={id}
                    className="hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => onSelect && onSelect(outlet)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{outlet.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{outlet.department || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{outlet.outletId || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{renderCostCenters(outlet)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {formatCount(outlet.subOutlets?.length || 0)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
