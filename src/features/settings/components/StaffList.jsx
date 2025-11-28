import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

function formatContractHours(hours) {
  if (hours === null || hours === undefined || hours === "") return "-";
  const numeric = typeof hours === "number" ? hours : Number.parseFloat(hours);
  if (Number.isNaN(numeric)) return "-";
  return `${numeric.toLocaleString("nl-BE", {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} u`;
}

export default function StaffList({
  staff = [],
  onSelect,
  sortField = "name",
  sortDir = "asc",
  onSort,
}) {
  const formatRemarks = member => {
    const count = Number.isFinite(member?.remarksCount) ? member.remarksCount : 0;
    return count.toLocaleString("nl-BE");
  };

  return (
    <div className="mt-4">
      {/* Mobile */}
      <div className="md:hidden flex flex-col divide-y divide-gray-200 rounded-xl overflow-hidden border border-gray-200 bg-white">
        {staff.length === 0 ? (
          <div className="py-6 text-center text-gray-500">Geen personeel</div>
        ) : (
          staff.map(member => {
            const remarksCount = Number.isFinite(member?.remarksCount) ? member.remarksCount : 0;
            const hasOpenTickets = remarksCount > 0;
            const containerClasses = hasOpenTickets
              ? "flex flex-col items-start gap-1 px-4 py-3 text-left transition bg-red-50 text-red-700 hover:bg-red-100"
              : "flex flex-col items-start gap-1 px-4 py-3 text-left hover:bg-gray-50 transition";
            const nameClasses = hasOpenTickets ? "font-semibold text-red-800" : "font-semibold text-gray-900";
            const detailsClasses = hasOpenTickets ? "text-sm text-red-700" : "text-sm text-gray-600";

            return (
              <button
                key={member.id || member.key || member.name}
                className={containerClasses}
                onClick={() => onSelect && onSelect(member)}
                type="button"
              >
                <span className={nameClasses}>{member.name}</span>
                <span className={detailsClasses}>{member.job || "Geen functie"}</span>
                <span className={detailsClasses}>{member.department || "-"}</span>
                <span className={detailsClasses}>
                  {member.contractType ? `${member.contractType}` : "Contracttype onbekend"}
                </span>
                <span className={detailsClasses}>Contracturen: {formatContractHours(member.contractHours)}</span>
                <span className={detailsClasses}>Open tickets: {formatRemarks(member)}</span>
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
                label="Employee"
                field="name"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Job"
                field="job"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Department"
                field="department"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Contract type"
                field="contractType"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Contract hours"
                field="contractHours"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortableHeader
                label="Open tickets"
                field="remarksCount"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Geen personeel
                </td>
              </tr>
            ) : (
              staff.map(member => {
                const remarksCount = Number.isFinite(member?.remarksCount) ? member.remarksCount : 0;
                const hasOpenTickets = remarksCount > 0;
                const rowClasses = hasOpenTickets
                  ? "cursor-pointer transition bg-red-50 hover:bg-red-100"
                  : "hover:bg-gray-50 cursor-pointer transition";
                const nameClasses = hasOpenTickets
                  ? "px-4 py-3 text-sm font-medium text-red-800"
                  : "px-4 py-3 text-sm font-medium text-gray-900";
                const detailClasses = hasOpenTickets
                  ? "px-4 py-3 text-sm text-red-700"
                  : "px-4 py-3 text-sm text-gray-700";
                return (
                  <tr
                    key={member.id || member.key || member.name}
                    className={rowClasses}
                    onClick={() => onSelect && onSelect(member)}
                  >
                    <td className={nameClasses}>{member.name}</td>
                    <td className={detailClasses}>{member.job || "-"}</td>
                    <td className={detailClasses}>{member.department || "-"}</td>
                    <td className={detailClasses}>{member.contractType || "-"}</td>
                    <td className={`${detailClasses} text-right`}>{formatContractHours(member.contractHours)}</td>
                    <td className={detailClasses}>{formatRemarks(member)}</td>
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
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 select-none ${alignmentClass} ${
        onSort ? "cursor-pointer transition hover:bg-gray-100" : ""
      }`}
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
