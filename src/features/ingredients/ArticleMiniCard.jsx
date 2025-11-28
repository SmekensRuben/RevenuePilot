import React from "react";
import { useTranslation } from "react-i18next";

export default function ArticleMiniCard({ article, onRemove, actionSlot }) {
  const { t } = useTranslation("ingredients");
  if (!article) return null;
  const pricePerRecipeUnit =
    article.pricePerStockUnit && article.contentPerStockUnit
      ?
          Number(article.contentPerStockUnit) !== 0
          ? Number(article.pricePerStockUnit) /
            Number(article.contentPerStockUnit)
          : null
      : null;
  return (
    <div className="flex items-start gap-3 bg-white border rounded shadow p-2 max-w-full overflow-hidden">
      {article.imageUrl && (
        <img
          src={article.imageUrl}
          alt={article.name}
          className="w-16 h-16 object-cover rounded"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start w-full">
          <span className="flex-1 font-semibold text-sm text-gray-800 truncate">
            {article.name}
          </span>
          {onRemove && (
            <button
              type="button"
              className="text-red-500 hover:text-red-700 ml-2"
              onClick={() => onRemove(article.id)}
            >
              ✕
            </button>
          )}
        </div>
        {article.brand && (
          <div className="text-xs text-gray-500 truncate">{article.brand}</div>
        )}
        {article.supplier && (
          <div className="text-xs text-gray-500 truncate">{article.supplier}</div>
        )}
        <div className="text-xs text-gray-700">
          {article.unitsPerPurchaseUnit} {article.stockUnit}{" "}
          <span className="text-gray-400">{t("per")}</span> {article.purchaseUnit}
        </div>
        <div className="text-xs text-gray-700">
          {article.contentPerStockUnit} {article.recipeUnit}{" "}
          <span className="text-gray-400">{t("per")}</span> {article.stockUnit}
        </div>
        <div className="text-xs text-gray-700 font-semibold">
          €
          {article.pricePerPurchaseUnit
            ? article.pricePerPurchaseUnit.toFixed(2)
            : "-"}{" "}
          <span className="text-gray-400">{t("per")}</span> {article.purchaseUnit}
        </div>
        {pricePerRecipeUnit !== null && (
          <div className="text-xs text-gray-700 font-semibold">
            €{pricePerRecipeUnit.toFixed(4)} {" "}
            <span className="text-gray-400">{t("per")}</span> {article.recipeUnit}
          </div>
        )}
      </div>
      {actionSlot && (
        <div className="flex-shrink-0 flex items-start">{actionSlot}</div>
      )}
    </div>
  );
}
