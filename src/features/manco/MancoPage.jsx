// src/features/manco/MancoPage.jsx
import React, { useState, useEffect } from "react";
import { getAllMancos, getSupplyStatsPerSupplier } from "./mancoService";
import { getSuppliers } from "services/firebaseSettings";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import MancoCard from "./MancoCard";

function parseISODate(dateStr) {
  return dateStr ? dateStr.slice(0, 10) : "";
}

export default function MancoPage() {
  const { hotelName, hotelUid } = useHotelContext();
  const [mancos, setMancos] = useState([]); // NOOIT undefined
  const [stats, setStats] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    getAllMancos(hotelUid).then(data => setMancos(Array.isArray(data) ? data : []));
    getSuppliers().then(setSuppliers);
    getSupplyStatsPerSupplier(hotelUid).then(data => setStats(Array.isArray(data) ? data : []));
  }, [hotelUid]);

  // Filtering: product search, supplier, datum-range
  const filtered = (mancos || [])
    .filter(manco => !productSearch ||
      (manco.product || "").toLowerCase().includes(productSearch.toLowerCase())
    )
    .filter(manco => !supplierFilter || manco.supplier === supplierFilter)
    .filter(manco => {
      if (!startDate && !endDate) return true;
      const mancoDate = parseISODate(manco.date);
      if (startDate && mancoDate < startDate) return false;
      if (endDate && mancoDate > endDate) return false;
      return true;
    })
    .sort((a, b) => parseISODate(b.date).localeCompare(parseISODate(a.date))); // Nieuw naar oud

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} />
      <PageContainer className="max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-4">Manco's Overzicht</h1>

        {/* SUPPLIER OVERVIEW CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {(stats || []).sort((a, b) => b.percentSupplied - a.percentSupplied)
            .map(({ supplier, percentSupplied, totalSupplied, totalOrdered }) => (
              <div key={supplier} className="bg-white rounded-xl shadow flex flex-col items-center p-4 border border-gray-100">
                <div className="text-lg font-bold">{supplier}</div>
                <div className={`text-2xl font-extrabold ${percentSupplied < 90 ? "text-red-600" : percentSupplied < 95 ? "text-yellow-500" : "text-green-600"}`}>
                  {percentSupplied.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  {totalSupplied} geleverd op {totalOrdered} besteld
                </div>
              </div>
            ))}
        </div>

        {/* FILTERS */}
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <input
            type="text"
            className="border px-3 py-2 rounded w-full sm:w-64"
            placeholder="Zoek product"
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
          />
          <select
            className="border px-3 py-2 rounded w-full sm:w-60"
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
          >
            <option value="">Alle leveranciers</option>
            {(suppliers || []).map((s, idx) => (
              <option key={s.key || idx} value={s.name}>
                {s.name}{s.customerNr ? ` (${s.customerNr})` : ""}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="border px-3 py-2 rounded w-full sm:w-48"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            max={endDate || new Date().toISOString().split("T")[0]}
            placeholder="Startdatum"
          />
          <input
            type="date"
            className="border px-3 py-2 rounded w-full sm:w-48"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={startDate}
            max={new Date().toISOString().split("T")[0]}
            placeholder="Einddatum"
          />
        </div>

        {/* MANCO TABEL */}
        {/* Mobile: Cards */}
<div className="md:hidden flex flex-col gap-2 mb-6">
  {filtered.length > 0 ? (
    filtered.map((manco, idx) => (
      <MancoCard key={manco.id || idx} manco={manco} />
    ))
  ) : (
    <div className="py-8 text-center text-gray-400">
      Geen manco's gevonden.
    </div>
  )}
</div>
{/* Desktop: Table */}
<div className="overflow-x-auto rounded-xl shadow border border-gray-200 bg-white hidden md:block">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Leverdatum</th>
        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Leverancier</th>
        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Artikelnummer</th>
        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Eenheid</th>
        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Manco</th>
        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Totaalprijs</th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-100 text-sm">
      {filtered.length > 0 ? (
        filtered.map((manco, idx) => (
          <tr key={manco.id || idx}>
            <td className="px-4 py-2 whitespace-nowrap">{manco.date}</td>
            <td className="px-4 py-2 whitespace-nowrap">{manco.supplier}</td>
            <td className="px-4 py-2 whitespace-nowrap">{manco.artikelnummer || manco.articleNumber || "-"}</td>
            <td className="px-4 py-2">{manco.product}</td>
            <td className="px-4 py-2">
              {(manco.unitsPerPurchaseUnit || "-") + " " + (manco.stockUnit || "")}
            </td>
            <td className="px-4 py-2">{manco.quantity}</td>
            <td className="px-4 py-2">
              {typeof manco.pricePerPurchaseUnit === "number" || typeof manco.pricePerPurchaseUnit === "string"
                ? `€${(Number(manco.quantity) * Number(manco.pricePerPurchaseUnit)).toFixed(2)}`
                : "-"}
            </td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={7} className="py-8 text-center text-gray-400">
            Geen manco's gevonden.
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>

      </PageContainer>
    </>
  );
}
