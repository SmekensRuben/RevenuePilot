import React from "react";

export default function ReturnFilters({ filter, setFilter }) {
  return (
    <div className="flex flex-wrap gap-2 items-end mb-4 bg-gray-50 p-3 rounded-xl border">
      <div>
        <label className="block text-xs mb-1">Status</label>
        <select
          className="border rounded-xl px-2 py-1"
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
        >
          <option value="">Alle</option>
          <option value="created">Aangemaakt</option>
          <option value="pickedup">Opgehaald</option>
          <option value="creditnota">Creditnota ontvangen</option>
        </select>
      </div>
      <div>
        <label className="block text-xs mb-1">Datum van</label>
        <input
          type="date"
          className="border rounded-xl px-2 py-1"
          value={filter.dateFrom}
          onChange={e => setFilter(f => ({ ...f, dateFrom: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-xs mb-1">Datum tot</label>
        <input
          type="date"
          className="border rounded-xl px-2 py-1"
          value={filter.dateTo}
          onChange={e => setFilter(f => ({ ...f, dateTo: e.target.value }))}
        />
      </div>
      <button
        className="ml-2 px-4 py-1 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
        type="button"
        onClick={() => setFilter({ status: "", dateFrom: "", dateTo: "" })}
      >
        Reset filters
      </button>
    </div>
  );
}
