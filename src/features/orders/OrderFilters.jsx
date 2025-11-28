// src/features/orders/OrderFilters.jsx
import React from "react";
import { useTranslation } from "react-i18next";

export default function OrderFilters({ filter, setFilter }) {
  const { t } = useTranslation("orders");
  return (
    <div className="flex flex-wrap gap-2 items-end mb-4 bg-gray-50 p-3 rounded-xl border">
      {/* Status filter */}
      <div>
        <label className="block text-xs mb-1">{t("filters.status")}</label>
        <select
          className="border rounded-xl px-2 py-1"
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
        >
          <option value="">{t("filters.all")}</option>
          <option value="created">{t("filters.created")}</option>
          <option value="ordered">{t("filters.ordered")}</option>
          <option value="received">{t("filters.received")}</option>
          <option value="checked">{t("filters.checked")}</option>
          <option value="completed">{t("filters.completed")}</option>
          <option value="cancelled">{t("filters.cancelled")}</option>
        </select>
      </div>
      {/* Order date range */}
      <div>
        <label className="block text-xs mb-1">{t("filters.orderDateFrom")}</label>
        <input
          type="date"
          className="border rounded-xl px-2 py-1"
          value={filter.orderDateFrom}
          onChange={e => setFilter(f => ({ ...f, orderDateFrom: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-xs mb-1">{t("filters.orderDateTo")}</label>
        <input
          type="date"
          className="border rounded-xl px-2 py-1"
          value={filter.orderDateTo}
          onChange={e => setFilter(f => ({ ...f, orderDateTo: e.target.value }))}
        />
      </div>
      {/* Delivery date range */}
      <div>
        <label className="block text-xs mb-1">{t("filters.deliveryDateFrom")}</label>
        <input
          type="date"
          className="border rounded-xl px-2 py-1"
          value={filter.deliveryDateFrom}
          onChange={e => setFilter(f => ({ ...f, deliveryDateFrom: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-xs mb-1">{t("filters.deliveryDateTo")}</label>
        <input
          type="date"
          className="border rounded-xl px-2 py-1"
          value={filter.deliveryDateTo}
          onChange={e => setFilter(f => ({ ...f, deliveryDateTo: e.target.value }))}
        />
      </div>
      {/* Reset knop */}
      <button
        className="ml-2 px-4 py-1 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
        type="button"
        onClick={() =>
          setFilter({
            status: "",
            orderDateFrom: "",
            orderDateTo: "",
            deliveryDateFrom: "",
            deliveryDateTo: "",
          })
        }
      >
        {t("filters.reset")}
      </button>
    </div>
  );
}
