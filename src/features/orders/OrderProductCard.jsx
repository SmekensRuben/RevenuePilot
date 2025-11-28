import React from "react";
import { useTranslation } from "react-i18next";

export default function OrderProductCard({
  prod,
  idx,
  editable,
  outlets = [],
  onQuantityChange,
  onOutletChange,
  onRemove,
  canChangeArticle = false,
  onChangeArticle,
}) {
  const { t } = useTranslation("orders");
  const qtyNum = Number(prod.quantity) || 0;
  const unitPrice = Number(
    prod.invoicedPricePerPurchaseUnit
    ?? prod.price
    ?? prod.pricePerPurchaseUnit
    ?? 0
  );
  const total = qtyNum * unitPrice;
  const displayName = prod.label || prod.name || "";
  const imageAlt = displayName || prod.articleNumber || "product";

  return (
    <div className="flex gap-4 bg-white rounded-2xl shadow-md border px-5 py-4 mb-3 min-w-0 relative">
      {prod.imageUrl && (
        <img
          src={prod.imageUrl}
          alt={imageAlt}
          className="w-16 h-16 object-cover rounded"
        />
      )}
      <div className="flex-1">
        <div className="font-bold text-lg text-gray-900 flex flex-wrap items-center gap-2">
          <span>{displayName}</span>
          {prod.custom && <span className="badge-new">{t("labels.newBadge")}</span>}
        </div>
        {prod.supplier && (
          <div className="inline-block text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5 my-1">
            {prod.supplier}
          </div>
        )}
        {prod.articleNumber && (
          <div className="text-xs text-gray-500">{t("labels.articleNumber")} {prod.articleNumber}</div>
        )}
        {canChangeArticle && editable && (
          <button
            type="button"
            className="ml-2 text-xs text-marriott underline"
            onClick={() => onChangeArticle(idx)}
          >
            {t("productCard.changeArticle")}
          </button>
        )}
        {prod.contentPerStockUnit && prod.recipeUnit && prod.stockUnit && (
          <div className="text-xs text-gray-500">
            {prod.contentPerStockUnit} {prod.recipeUnit}/{prod.stockUnit}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm mt-2">
          <div className="flex items-center">
            <span className="text-gray-500">{t("productCard.quantity")}:</span>
            <input
              type="number"
              min={1}
              value={prod.quantity ?? ""}
              onChange={e => onQuantityChange(idx, e.target.value)}
              className="w-16 border rounded-xl px-2 py-1 text-center ml-1"
              required
              disabled={!editable}
            />
            {prod.unitsPerPurchaseUnit && prod.stockUnit && (
              <span className="ml-2 text-xs text-gray-500">
                / {prod.unitsPerPurchaseUnit} {prod.stockUnit}
              </span>
            )}
          </div>
          <div className="flex items-center">
            <span className="text-gray-500">{t("productCard.price")}:</span>
            <span className="font-semibold ml-1">€{unitPrice.toFixed(2)}</span>
            {qtyNum > 1 && (
              <span className="text-xs text-gray-500 ml-1">({qtyNum}×)</span>
            )}
          </div>
          {outlets.length > 0 && (
            <div className="flex items-center col-span-2 sm:col-span-1">
              <span className="text-gray-500">{`${t("productCard.outlet")}:`}</span>
              <select
                className="border rounded-xl px-2 py-1 ml-1"
                value={prod.outlet || ""}
                onChange={e => onOutletChange(idx, e.target.value)}
                disabled={!editable}
              >
                <option value="">{t("productsModal.selectOutlet")}</option>
                {outlets.map(o => (
                  <option key={o.id || o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center">
            <span className="text-gray-500">{t("productCard.total")}:</span>
            <span className="font-semibold text-marriott ml-1">€{total.toFixed(2)}</span>
          </div>
        </div>

        {editable && (
          <button
            type="button"
            className="w-full sm:w-auto sm:absolute sm:right-4 sm:top-4 mt-4 sm:mt-0 bg-gray-100 text-gray-700 rounded-xl py-2 px-4 font-semibold hover:bg-red-100 hover:text-red-700 transition"
            onClick={() => onRemove(idx)}
          >
            {t("productCard.remove")}
          </button>
        )}
      </div>
    </div>
  );
}
