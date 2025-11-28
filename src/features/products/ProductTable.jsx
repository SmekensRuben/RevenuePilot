import React from "react";
import { calculateCostAndFoodcost } from "./productHelpers";
import ProductCard from "./ProductCard";
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

export default function ProductTable({
  products,
  ingredients,
  recipes = [],
  articles = [],
  categories: productCategories,
  handleShowDetails,
  handleEdit,
  canEdit,
  sortField,
  sortDir,
  onSort,
}) {
  const { t } = useTranslation("products");
  const sorted = products;

  return (
    <>
      {/* Mobile: cards */}
      <div className="md:hidden flex flex-col gap-2">
        {sorted.length === 0 ? (
          <div className="text-center text-gray-400 py-8">{t("noResults")}</div>
        ) : (
          sorted.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              ingredients={ingredients}
              recipes={recipes}
              articles={articles}
              categories={productCategories}
              onClick={() => handleShowDetails(product)}
            />
          ))
        )}
      </div>
      {/* Desktop: table */}
      <div className="overflow-hidden rounded-xl shadow border border-gray-200 hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableTh label={t("table.name")} field="name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("table.saleUnit")} field="saleUnit" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("table.price")} field="price" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
              <SortableTh label={t("table.cost")} field="cost" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
              <SortableTh label={t("table.foodcost")} field="foodcost" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
              <SortableTh label={t("table.outlets")} field="outlets" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("table.category")} field="category" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("table.active")} field="active" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <th />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sorted.map(product => {
              const { kostprijs: cost, foodcostPct } = calculateCostAndFoodcost(
                product,
                ingredients,
                recipes,
                articles
              );
              return (
                <tr key={product.id}
                  className="hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => handleShowDetails(product)}
                >
                  <td className="px-4 py-2 font-medium text-gray-900">{product.name}</td>
                  <td className="px-4 py-2">{product.saleUnit}</td>
                  <td className="px-4 py-2">€{product.price?.toFixed(2)}</td>
                  <td className="px-4 py-2">€{cost.toFixed(2)}</td>
                  <td className="px-4 py-2">{foodcostPct.toFixed(1)}%</td>
                  <td className="px-4 py-2">
                    {product.outlets && product.outlets.length
                      ? product.outlets.join(", ")
                      : <span className="text-gray-400 text-xs italic">-</span>}
                  </td>
                  <td className="px-4 py-2">
                    {productCategories[product.category]?.label || <span className="text-gray-400 italic">-</span>}
                  </td>
                  <td className="px-4 py-2">{product.active !== false ? "✅" : "❌"}</td>
                  <td className="px-4 py-2">
                    {canEdit && (
                      <button
                        className="bg-black text-white px-2 py-1 text-xs rounded"
                        onClick={e => { e.stopPropagation(); handleEdit(product); }}
                      >{t("table.edit")}</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400">{t("noResults")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
