import React from "react";
import { useTranslation } from "react-i18next";

export default function TransferProductCard({
  prod,
  idx,
  outlets = [],
  onQuantityChange,
  onFromChange,
  onToChange,
  onRemove,
}) {
  const { t } = useTranslation("transfers");
  const qty = Number(prod.quantity) || 0;
  return (
    <div className="flex gap-4 bg-white rounded-2xl shadow-md px-5 py-4 mb-3 min-w-0 relative">
      {prod.imageUrl && (
        <img
          src={prod.imageUrl}
          alt={prod.name}
          className="w-16 h-16 object-cover rounded"
        />
      )}
      <div className="flex-1 flex flex-col">
        <div className="font-semibold text-sm text-gray-900">{prod.name}</div>
        <div className="text-sm text-gray-500">
          {prod.contentPerStockUnit} {prod.recipeUnit}
          {prod.brand && <span className="ml-1">- {prod.brand}</span>}
        </div>
        <div className="mt-2 text-sm flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">{t("quantity")}:</span>
            <div className="flex items-center border rounded-xl overflow-hidden">
            <button
              type="button"
              className="px-2 py-1 hover:bg-gray-100"
              onClick={() => onQuantityChange(idx, Math.max(0, qty - 1))}
            >
              -
            </button>
            <div className="px-3 select-none text-center min-w-[2rem]">
              {qty}
            </div>
            <button
              type="button"
              className="px-2 py-1 hover:bg-gray-100"
              onClick={() => onQuantityChange(idx, qty + 1)}
            >
              +
            </button>
          </div>
        </div>
        {onFromChange && (
          <div>
            <span className="text-gray-500">{t("from")}: </span>
            <select
              className="border rounded-xl px-2 py-1 ml-1"
              value={prod.fromOutlet || ""}
              onChange={e => onFromChange(idx, e.target.value)}
            >
              <option value="">{t("selectOutlet")}</option>
              {outlets.map(o => (
                <option key={o.id || o.name} value={o.name}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
        {onToChange && (
          <div>
            <span className="text-gray-500">{t("to")}: </span>
            <select
              className="border rounded-xl px-2 py-1 ml-1"
              value={prod.toOutlet || ""}
              onChange={e => onToChange(idx, e.target.value)}
            >
              <option value="">{t("selectOutlet")}</option>
              {outlets.map(o => (
                <option key={o.id || o.name} value={o.name}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          className="self-start mt-2 bg-gray-100 text-gray-700 rounded-xl px-2 py-1 text-xs font-semibold hover:bg-red-100 hover:text-red-700 transition"
          onClick={() => onRemove(idx)}
        >
          {t("remove")}
        </button>
      )}
    </div>
  );
}
