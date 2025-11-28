// src/features/orders/OrderList.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  return (
    <th
      className={`px-4 py-2 text-xs font-semibold uppercase select-none cursor-pointer hover:bg-gray-100 transition ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => onSort(field)}
      scope="col"
    >
      <span className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>{label}{sortIcon(active, sortDir)}</span>
    </th>
  );
}

export default function OrderList({ orders, sortField, sortDir, onSort }) {
  const navigate = useNavigate();
  const { t } = useTranslation("orders");

  const statusColors = {
    created: "bg-orange-50",
    ordered: "bg-yellow-50",
    received: "bg-green-50",
    checked: "bg-sky-50",
    completed: "bg-emerald-700 text-white hover:bg-emerald-700/90",
    cancelled: "bg-red-50",
    canceled: "bg-red-50",
  };

  const formatDate = date =>
    date ? new Date(date).toLocaleDateString("en-GB") : "";
  const getUnitPrice = art => Number(
    art.invoicedPricePerPurchaseUnit
    ?? art.price
    ?? art.pricePerPurchaseUnit
    ?? 0
  );
  const calcTotal = order =>
    order.articles
      ? order.articles.reduce((sum, art) => {
          const qty =
            ["received", "checked", "completed"].includes(order.status)
              ? Number(art.received || 0)
              : Number(art.quantity || 0);
          return sum + qty * getUnitPrice(art);
        }, 0)
      : 0;

  const sortedOrders = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = ord => {
      switch (sortField) {
        case "supplier":
          return ord.supplier || "";
        case "orderDate":
          return ord.orderDate || "";
        case "deliveryDate":
          return ord.deliveryDate || "";
        case "status":
          return ord.status || "";
        case "total":
          return calcTotal(ord);
        default:
          return ord.deliveryDate || ord.orderDate || "";
      }
    };
    return [...orders].sort((a, b) => {
      const valA = getVal(a);
      const valB = getVal(b);
      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * dir;
      }
      return String(valA).localeCompare(String(valB), undefined, { sensitivity: "base" }) * dir;
    });
  }, [orders, sortField, sortDir]);

  if (!sortedOrders.length) {
    return <div className="text-center text-gray-500 mt-8">{t("list.empty")}</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl shadow border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <SortableTh
              label={t("list.table.supplier")}
              field="supplier"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("list.table.orderDate")}
              field="orderDate"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("list.table.deliveryDate")}
              field="deliveryDate"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("list.table.status")}
              field="status"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label={t("list.table.total")}
              field="total"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sortedOrders.map(order => {
            const statusClass = statusColors[order.status] || "";
            const hoverClass = statusClass.includes("hover:")
              ? ""
              : "hover:bg-gray-50";
            const isCompleted = order.status === "completed";
            return (
              <tr
                key={order.id}
                className={`cursor-pointer transition ${hoverClass} ${statusClass}`}
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <td
                  className={`px-4 py-2 font-medium ${
                    isCompleted ? "text-white" : "text-gray-900"
                  }`}
                >
                  {order.supplier}
                </td>
                <td className="px-4 py-2">{formatDate(order.orderDate)}</td>
                <td className="px-4 py-2">{formatDate(order.deliveryDate)}</td>
                <td className="px-4 py-2">{t(`filters.${order.status}`, { defaultValue: order.status })}</td>
                <td className="px-4 py-2 text-right font-semibold">
                  €{calcTotal(order).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
