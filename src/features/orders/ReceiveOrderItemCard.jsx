import React from "react";
import { ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ReceiveOrderItemCard({
  item,
  idx,
  onChange,
  onChangeArticle,
}) {
  const { t } = useTranslation("orders");
  const qty = Number(item.quantity) || 0;
  const received = Number(item.received) || 0;
  const units = Number(item.unitsPerPurchaseUnit) || 0;
  const orderedKg = qty * units;
  const receivedWeight = Number(item.receivedWeight) || 0;
  const shortage = item.isWeighed
    ? Math.max(0, orderedKg - receivedWeight)
    : Math.max(0, qty - received);

  const besteldLabel = item.isWeighed
    ? t("receive.card.orderedWeight")
    : t("receive.card.ordered");
  const besteldText = item.isWeighed
    ? `${orderedKg.toFixed(2)} kg`
    : `${item.quantity}${item.purchaseUnit ? " / " + item.purchaseUnit : ""}`;

  return (
    <div className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1 mb-2 relative">
      {onChangeArticle && (
        <button
          type="button"
          className="absolute top-2 right-2 text-gray-500 hover:text-marriott"
          onClick={() => onChangeArticle(idx)}
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
      )}
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-16 h-16 object-contain mb-1"
        />
      )}
      <div className="font-bold text-base text-gray-900 flex flex-wrap items-center gap-2">
        <span>{item.name}</span>
        {item.custom && <span className="badge-new">{t("labels.newBadge")}</span>}
      </div>
      <div className="text-xs text-gray-600">{item.brand}</div>
      {item.articleNumber && (
        <div className="text-xs text-gray-600">{t("labels.articleNumber")} {item.articleNumber}</div>
      )}
      {item.outlet && (
        <div className="text-xs text-gray-600">{item.outlet}</div>
      )}
      <div className="flex flex-wrap gap-2 items-center text-sm mt-1">
        <span className="text-gray-500">{besteldLabel}</span>
        <span className="font-semibold">{besteldText}</span>
      </div>

      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="text-gray-500">{t("receive.card.received")}</span>
        {item.isWeighed ? (
          <input
            type="number"
            min={0}
            step="0.01"
            value={item.receivedWeight || ""}
            onChange={e => onChange(idx, "receivedWeight", e.target.value)}
            placeholder={t("receive.card.weightPlaceholder")}
            className="border rounded px-2 py-1 w-24"
          />
        ) : (
          <input
            type="number"
            min={0}
            max={qty}
            step="0.01"
            value={received}
            onChange={e => onChange(idx, "received", e.target.value)}
            className="border rounded px-2 py-1 w-16"
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="text-gray-500">{t("receive.card.shortage")}</span>
        <span className="font-semibold text-orange-600">
          {item.isWeighed ? `${shortage.toFixed(2)} kg` : shortage}
        </span>
      </div>
    </div>
  );
}
