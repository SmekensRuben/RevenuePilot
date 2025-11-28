import React from "react";
import { useTranslation } from "react-i18next";

export default function ArticleCard({ article, onClick, getLastPriceUpdateColor }) {
  const { t } = useTranslation("articles");
  const isActive = article.active !== false;

  // Bereken status badge tekst & kleur
  let statusLabel = isActive ? t("activeLabel") : t("inactiveLabel");
  let statusClass = isActive
    ? "bg-emerald-100 text-emerald-700"
    : "bg-orange-100 text-orange-600 border border-orange-300";

  // Bereken prijs-update badge
  let priceUpdateText = t("neverUpdated");
  let priceUpdateClass = "bg-gray-100 text-gray-500";
  if (article.lastPriceUpdate) {
    const msOld = Date.now() - article.lastPriceUpdate;
    if (msOld < 7776000000) { // < 3 maand
      priceUpdateText = t("recentlyUpdated");
      priceUpdateClass = "bg-emerald-100 text-emerald-700";
    } else if (msOld < 15552000000) { // 3-6 maand
      priceUpdateText = t("threeToSixMonths");
      priceUpdateClass = "bg-orange-100 text-orange-600";
    } else {
      priceUpdateText = t("olderThanSixMonths");
      priceUpdateClass = "bg-red-100 text-red-600";
    }
  }

  return (
    <div
      className="flex flex-col bg-white rounded-2xl shadow-md px-4 py-4 mb-2 min-w-0 cursor-pointer transition hover:shadow-lg"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="font-bold text-base text-gray-900">
          {article.name}
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-xs px-2 py-0.5 rounded font-semibold mb-1 ${statusClass}`}>
            {statusLabel}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${priceUpdateClass}`}>
            {priceUpdateText}
          </span>
        </div>
      </div>
      <div className="text-gray-500 text-sm truncate mb-1">{article.brand}</div>
      <div className="text-xs mb-1 text-gray-700">
        {article.unitsPerPurchaseUnit} {article.stockUnit} <span className="text-gray-400">{t("per")}</span> {article.purchaseUnit}
      </div>
      <div className="text-xl font-bold text-gray-900 mb-1">
        €{article.pricePerPurchaseUnit ? article.pricePerPurchaseUnit.toFixed(2) : "-"}
      </div>
      <div className="text-gray-500 text-sm">{article.supplier}</div>
    </div>
  );
}
