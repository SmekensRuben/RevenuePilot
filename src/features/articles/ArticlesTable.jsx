import React from "react";
import { useTranslation } from "react-i18next";
import ArticleCard from "./ArticleCard";
import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * ArticlesTable met mobile cards & desktop table + sorteerbare header
 */
export default function ArticlesTable({
  articles,
  loading = false,
  onSelect,
  getLastPriceUpdateColor,
  categories = {},
  sortField,
  sortDir,
  onSort,
}) {
  const { t } = useTranslation("articles");
  return (
    <>
      {/* Mobile: Cards */}
      <div className="md:hidden flex flex-col gap-2 mt-4">
        {loading ? (
          <div className="text-center text-gray-400 py-8">{t("loading")}</div>
        ) : articles.length === 0 ? (
          <div className="text-center text-gray-400 py-8">{t("noResults")}</div>
        ) : (
          articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              getLastPriceUpdateColor={getLastPriceUpdateColor}
              onClick={() => onSelect && onSelect(article)}
            />
          ))
        )}
      </div>
      {/* Desktop: Table */}
      <div className="overflow-hidden rounded-xl shadow border border-gray-200 hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableTh label={t("name")} field="name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("packageSize")} field="purchaseUnit" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("brand")} field="brand" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("price")} field="pricePerPurchaseUnit" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
              <SortableTh label={t("lastUpdatedPrice")} field="lastPriceUpdate" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("supplier")} field="supplier" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("activeLabel")} field="active" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  {t("loading")}
                </td>
              </tr>
            ) : articles.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  {t("noResults")}
                </td>
              </tr>
            ) : (
              articles.map((article) => (
                <tr
                  key={article.id}
                  onClick={() => onSelect && onSelect(article)}
                  className="hover:bg-gray-50 cursor-pointer transition"
                >
                  <td className="px-4 py-2 font-medium text-gray-900">{article.name}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {article.unitsPerPurchaseUnit} {article.stockUnit}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{article.brand || "-"}</td>
                  <td className="px-4 py-2 text-gray-700 text-right">
                    €{article.pricePerPurchaseUnit ? article.pricePerPurchaseUnit.toFixed(2) : "-"}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {article.lastPriceUpdate
                      ? new Date(article.lastPriceUpdate).toLocaleDateString("nl-BE")
                      : "-"}
                    {article.lastPriceUpdate && (
                      <span className={`ml-2 ${getLastPriceUpdateColor ? getLastPriceUpdateColor(article.lastPriceUpdate) : ""}`}>
                        ●
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{article.supplier}</td>
                  <td className="px-4 py-2">{article.active ? "✅" : "❌"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Sorteericoontje (zelfde als Inventory)
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

// Sorteerbare Table Header
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
      <span className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        {sortIcon(active, sortDir)}
      </span>
    </th>
  );
}
