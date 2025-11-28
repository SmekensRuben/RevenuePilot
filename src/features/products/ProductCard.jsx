import React from "react";
import { calculateCostAndFoodcost } from "./productHelpers";
import { useTranslation } from "react-i18next";

export default function ProductCard({
  product,
  ingredients,
  recipes = [],
  articles = [],
  categories: productCategories,
  onClick,
}) {
  const { t } = useTranslation("products");
  const { kostprijs: cost, foodcostPct } = calculateCostAndFoodcost(
    product,
    ingredients,
    recipes,
    articles
  );

  // Badge kleur op foodcost
  let fcColor = "bg-green-100 text-green-700";
  if (foodcostPct >= 32) fcColor = "bg-orange-100 text-orange-700";
  if (foodcostPct >= 35) fcColor = "bg-red-100 text-red-700";

  const isActive = product.active !== false;

  return (
    <div
      className="bg-white rounded-2xl shadow border border-gray-200 px-4 py-4 mb-3 cursor-pointer hover:shadow-lg transition relative"
      onClick={onClick}
      tabIndex={0}
    >
      {/* Actief badge rechtsboven */}
      <div className="absolute top-3 right-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shadow-sm
          ${isActive ? "bg-emerald-200 text-emerald-700" : "bg-gray-200 text-gray-400 border"}
        `}>
          {isActive ? t("status.active") : t("status.inactive")}
        </span>
      </div>
      {/* Naam + eenheid */}
      <div className="font-bold text-lg text-gray-900 mb-1">{product.name}</div>
      <div className="text-gray-500 text-base mb-2">{product.saleUnit}</div>
      {/* Prijs prominent */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-base font-bold px-3 py-1 rounded bg-gray-100 text-gray-700">
          €{product.price?.toFixed(2)}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${fcColor}`}>
          {t("card.foodcost", { value: foodcostPct.toFixed(1) })}
        </span>
      </div>
      <div className="flex flex-col gap-1 mb-2 text-sm">
        <div>
          <span className="font-semibold text-gray-500">{t("card.cost")} </span>
          €{cost.toFixed(2)}
        </div>
        {/* Outlets */}
        {product.outlets && product.outlets.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="font-semibold text-gray-500">{t("card.outlets")}</span>
            {product.outlets.map((outlet, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs"
              >{outlet}</span>
            ))}
          </div>
        )}
        {/* Categorie */}
        {productCategories[product.category]?.label && (
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="font-semibold text-gray-500">{t("card.category")}</span>
            <span className="px-2 py-0.5 rounded bg-gray-50 text-gray-700 text-xs">
              {productCategories[product.category].label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
