import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export default function ReceiveTransferProductCard({
  prod,
  ingredient,
  articles = [],
  idx,
  onChange,
  onArticleChange,
}) {
  const { t } = useTranslation("transfers");
  const [showSelect, setShowSelect] = useState(false);
  const qty = Number(prod.quantity) || 0;
  const received = Number(prod.received) || 0;
  const articleOptions = Array.isArray(ingredient?.articles)
    ? articles.filter(a => ingredient.articles.includes(a.id))
    : [];
  const selected = articleOptions.find(a => a.id === prod.id) || prod;
  return (
    <div className="bg-gray-50 rounded-2xl px-4 py-3 flex gap-4 mb-2">
      {selected.imageUrl && (
        <img
          src={selected.imageUrl}
          alt={selected.name}
          className="w-16 h-16 object-cover rounded"
        />
      )}
      <div className="flex-1 flex flex-col gap-1">
        <div className="font-bold text-base text-gray-900">{selected.name}</div>
        {selected.brand ? (
          <div className="text-xs text-gray-600 flex items-center gap-2">
            {selected.brand}
            {articleOptions.length > 1 && !showSelect && (
              <button
                type="button"
                className="text-marriott underline"
                onClick={() => setShowSelect(true)}
              >
                {t("other")}
              </button>
            )}
          </div>
        ) : (
          articleOptions.length > 1 && !showSelect && (
            <button
              type="button"
              className="text-xs text-marriott underline self-start"
              onClick={() => setShowSelect(true)}
            >
              {t("other")}
            </button>
          )
        )}
        {showSelect && articleOptions.length > 1 && (
          <select
            className="border rounded-xl px-2 py-1 text-sm mb-1"
            value={selected.id}
            onChange={e => {
              const art = articleOptions.find(a => a.id === e.target.value);
              if (art && onArticleChange) {
                onArticleChange(idx, art);
                setShowSelect(false);
              }
            }}
          >
            {articleOptions.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} {a.brand ? `(${a.brand})` : ""}
              </option>
            ))}
          </select>
        )}
        <div className="flex flex-wrap gap-2 items-center text-sm mt-1">
          <span className="text-gray-500">{t("quantity")}: </span>
          <span className="font-semibold">{qty}</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-gray-500">{t("received")}: </span>
          <input
            type="number"
            min={0}
            max={qty}
            value={received}
            onChange={e => onChange(idx, e.target.value)}
            className="border rounded px-2 py-1 w-16"
          />
        </div>
      </div>
    </div>
  );
}
