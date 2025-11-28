import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export const getTicketTotal = ticket =>
  (ticket?.subOutlets || []).reduce((total, subOutlet) => {
    const amount = parseFloat(subOutlet?.amount || 0);
    return total + (Number.isNaN(amount) ? 0 : amount);
  }, 0);

export const hasIncompleteChecklist = ticket => {
  const items = Array.isArray(ticket?.checklist) ? ticket.checklist : [];
  const normalized = items
    .map(item => {
      if (!item) return null;
      if (typeof item === "object") {
        return { checked: !!item.checked };
      }
      if (typeof item === "boolean") {
        return { checked: item };
      }
      return { checked: false };
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    return false;
  }

  return normalized.some(item => !item.checked);
};

export default function SalesPromoTicketsTable({
  tickets = [],
  onRowClick,
  t,
  sortField,
  sortDir,
  onSort,
}) {
  const getRowStatusClasses = ticket => {
    if (hasIncompleteChecklist(ticket)) {
      return "bg-red-50 hover:bg-red-100";
    }

    return "bg-green-50 hover:bg-green-100";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <SortableTh
              label={t("date", "Date")}
              field="date"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("receiptNumber", "Receipt #")}
              field="receiptNumber"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("cashier", "Cashier")}
              field="cashier"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("type", "Type")}
              field="type"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("outlet", "Outlet")}
              field="outlet"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("totalAmount", "Total Amount")}
              field="totalAmount"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {tickets.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-gray-400">
                {t("noResults")}
              </td>
            </tr>
          ) : (
            tickets.map(ticket => (
              <tr
                key={ticket.id}
                className={`${getRowStatusClasses(ticket)} cursor-pointer transition`}
                onClick={() => onRowClick && onRowClick(ticket.id)}
              >
                <td className="px-4 py-2">{ticket.date}</td>
                <td className="px-4 py-2">{ticket.receiptNumber}</td>
                <td className="px-4 py-2">{ticket.cashier}</td>
                <td className="px-4 py-2">{ticket.type}</td>
                <td className="px-4 py-2">{ticket.outlet}</td>
                <td className="px-4 py-2 text-right">€ {getTicketTotal(ticket).toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const sortIcon = (active, dir) =>
  active ? (
    dir === "asc" ? (
      <ChevronUp size={16} className="inline ml-1 -mt-1" />
    ) : (
      <ChevronDown size={16} className="inline ml-1 -mt-1" />
    )
  ) : (
    <span className="inline-block w-4" />
  );

function SortableTh({ label, field, sortField, sortDir, onSort, align }) {
  const active = sortField === field;
  const handleClick = () => {
    if (onSort) {
      onSort(field);
    }
  };

  return (
    <th
      className={`px-4 py-2 text-xs font-semibold uppercase select-none cursor-pointer hover:bg-gray-100 transition ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={handleClick}
      scope="col"
    >
      <span className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        {sortIcon(active, sortDir)}
      </span>
    </th>
  );
}

