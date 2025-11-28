import React from "react";
import { useTranslation } from "react-i18next";

export default function TransferFilters({ filter, setFilter, outlets = [] }) {
  const { t } = useTranslation("transfers");
  return (
    <div className="flex flex-wrap gap-2 items-end mb-4 bg-gray-50 p-3 rounded-xl border">
      <div>
        <label className="block text-xs mb-1">Status</label>
        <select
          className="border rounded-xl px-2 py-1"
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
        >
          <option value="">All</option>
          <option value="created">Created</option>
          <option value="confirmed">Confirmed</option>
          <option value="received">Received</option>
        </select>
      </div>
      <div>
        <label className="block text-xs mb-1">{t("date")} from</label>
        <input
          type="date"
          className="border rounded-xl px-2 py-1"
          value={filter.dateFrom}
          onChange={e => setFilter(f => ({ ...f, dateFrom: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-xs mb-1">{t("date")} to</label>
        <input
          type="date"
          className="border rounded-xl px-2 py-1"
          value={filter.dateTo}
          onChange={e => setFilter(f => ({ ...f, dateTo: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-xs mb-1">{t("fromOutlet")}</label>
        <select
          className="border rounded-xl px-2 py-1"
          value={filter.fromOutlet}
          onChange={e => setFilter(f => ({ ...f, fromOutlet: e.target.value }))}
        >
          <option value="">{t("allOutlets")}</option>
          {outlets.map(o => (
            <option key={o.id || o.name} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs mb-1">{t("toOutlet")}</label>
        <select
          className="border rounded-xl px-2 py-1"
          value={filter.toOutlet}
          onChange={e => setFilter(f => ({ ...f, toOutlet: e.target.value }))}
        >
          <option value="">{t("allOutlets")}</option>
          {outlets.map(o => (
            <option key={o.id || o.name} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <button
        className="ml-2 px-4 py-1 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
        type="button"
        onClick={() =>
          setFilter({ status: "", dateFrom: "", dateTo: "", fromOutlet: "", toOutlet: "" })
        }
      >
        Reset filters
      </button>
    </div>
  );
}
