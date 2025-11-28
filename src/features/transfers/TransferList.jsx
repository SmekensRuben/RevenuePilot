import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown } from "lucide-react";

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

function SortableTh({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <th
      className="px-4 py-2 text-left text-xs font-semibold uppercase select-none cursor-pointer hover:bg-gray-100 transition"
      onClick={() => onSort(field)}
      scope="col"
    >
      <span className="flex items-center gap-1">
        {label}
        {sortIcon(active, sortDir)}
      </span>
    </th>
  );
}

export default function TransferList({ transfers, sortField, sortDir, onSort }) {
  const { t } = useTranslation("transfers");
  const navigate = useNavigate();

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = tr => {
      const firstProd = tr.products?.[0] || {};
      switch (sortField) {
        case "from":
          return tr.fromOutlet || firstProd.fromOutlet || "";
        case "to":
          return tr.toOutlet || firstProd.toOutlet || "";
        case "requester":
          return tr.requester || "";
        case "status":
          return tr.status || "";
        default:
          return tr.date || "";
      }
    };
    return [...transfers].sort((a, b) => {
      const valA = getVal(a);
      const valB = getVal(b);
      return String(valA).localeCompare(String(valB), undefined, { sensitivity: "base" }) * dir;
    });
  }, [transfers, sortField, sortDir]);

  if (!sorted.length) {
    return <div className="text-center text-gray-500 mt-8">{t("noResults")}</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl shadow border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <SortableTh
              label={t("date")}
              field="date"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("from")}
              field="from"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("to")}
              field="to"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("requester")}
              field="requester"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label="Status"
              field="status"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sorted.map(tr => {
            const firstProd = tr.products?.[0] || {};
            const from = tr.fromOutlet || firstProd.fromOutlet;
            const to = tr.toOutlet || firstProd.toOutlet;
            return (
              <tr
                key={tr.id}
                className="hover:bg-gray-50 cursor-pointer transition"
                onClick={() => navigate(`/transfers/${tr.id}`)}
              >
                <td className="px-4 py-2">{tr.date}</td>
                <td className="px-4 py-2">{from}</td>
                <td className="px-4 py-2">{to}</td>
                <td className="px-4 py-2">{tr.requester}</td>
                <td className="px-4 py-2">{tr.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
