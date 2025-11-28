import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { useTranslation } from "react-i18next";

export default function AddProductModal({
  open,
  ingredient,
  articles = [],
  onConfirm,
  onCancel,
}) {
  const [qty, setQty] = useState(1);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showSelect, setShowSelect] = useState(false);
  const { t } = useTranslation("transfers");

  useEffect(() => {
    if (open) setQty(1);
  }, [open, ingredient]);

  useEffect(() => {
    if (!open || !ingredient) return;
    const ids = Array.isArray(ingredient.articles) ? ingredient.articles : [];
    const linked = articles.filter(a => ids.includes(a.id));
    if (linked.length > 0) {
      let cheapest = linked[0];
      const getUnitPrice = art => {
        const pricePerStock = parseFloat(art.pricePerStockUnit);
        const contentPerStock = parseFloat(art.contentPerStockUnit);
        if (
          !isNaN(pricePerStock) &&
          !isNaN(contentPerStock) &&
          Number(contentPerStock) > 0
        ) {
          return pricePerStock / contentPerStock;
        }
        return Infinity;
      };
      linked.forEach(a => {
        const p = getUnitPrice(a);
        const cp = getUnitPrice(cheapest);
        if (p < cp) {
          cheapest = a;
        }
      });
      setSelectedArticle(cheapest);
    } else {
      setSelectedArticle(null);
    }
    setShowSelect(false);
  }, [open, ingredient, articles]);

  if (!open || !ingredient) return null;

  const articleOptions = Array.isArray(ingredient.articles)
    ? articles.filter(a => ingredient.articles.includes(a.id))
    : [];

  return (
    <Dialog open={open} onClose={onCancel} className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 z-40" aria-hidden="true" />
      <Dialog.Panel className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full mx-4 z-50">
        <Dialog.Title className="text-lg font-semibold mb-4">
          {ingredient.name}
        </Dialog.Title>
        {selectedArticle && (
          <div className="flex items-start gap-2 mb-4">
            {selectedArticle.imageUrl && (
              <img
                src={selectedArticle.imageUrl}
                alt={selectedArticle.name}
                className="w-16 h-16 object-cover rounded"
              />
            )}
            <div className="flex-1 text-sm">
              <div className="font-medium">{selectedArticle.brand}</div>
              {selectedArticle.supplier && (
                <div className="text-gray-500 text-xs">{selectedArticle.supplier}</div>
              )}
              <div>
                €{Number(selectedArticle.pricePerPurchaseUnit || 0).toFixed(2)} per {selectedArticle.purchaseUnit}
              </div>
              {selectedArticle.unitsPerPurchaseUnit && selectedArticle.stockUnit && (
                <div className="text-xs">
                  {selectedArticle.unitsPerPurchaseUnit} {selectedArticle.stockUnit} per {selectedArticle.purchaseUnit}
                </div>
              )}
              {selectedArticle.contentPerStockUnit && selectedArticle.recipeUnit && selectedArticle.stockUnit && (
                <div className="text-xs">
                  {selectedArticle.contentPerStockUnit} {selectedArticle.recipeUnit}/{selectedArticle.stockUnit}
                </div>
              )}
            </div>
            {articleOptions.length > 1 && (
              <button
                type="button"
                className="text-xs text-marriott underline"
                onClick={() => setShowSelect(s => !s)}
              >
                {t("other")}
              </button>
            )}
          </div>
        )}
        {showSelect && (
          <select
            className="border rounded-xl px-2 py-1 w-full mb-4"
            value={selectedArticle?.id || ""}
            onChange={e => {
              const art = articleOptions.find(a => a.id === e.target.value);
              if (art) setSelectedArticle(art);
            }}
          >
            {articleOptions.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} {a.brand ? `(${a.brand})` : ""} - €{Number(a.pricePerPurchaseUnit || 0).toFixed(2)}
                {a.unitsPerPurchaseUnit && a.stockUnit && (
                  ` - ${a.unitsPerPurchaseUnit} ${a.stockUnit} per ${a.purchaseUnit}`
                )}
                {a.contentPerStockUnit && a.recipeUnit && a.stockUnit && (
                  ` - ${a.contentPerStockUnit} ${a.recipeUnit}/${a.stockUnit}`
                )}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center justify-center mb-4">
          <button
            type="button"
            className="px-2 py-1 border rounded-l-xl hover:bg-gray-100"
            onClick={() =>
              setQty(q => Math.max(1, Number(q || 0) - 1))
            }
          >
            -
          </button>
          <input
            type="number"
            min={1}
            className="border-t border-b px-3 w-16 text-center"
            value={qty}
            onChange={e => setQty(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="px-2 py-1 border rounded-r-xl hover:bg-gray-100"
            onClick={() =>
              setQty(q => Number(q || 0) + 1)
            }
          >
            +
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="bg-gray-200 px-4 py-2 rounded-2xl"
            onClick={onCancel}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className="bg-marriott text-white px-4 py-2 rounded-2xl font-semibold hover:bg-marriott-dark"
            onClick={() => onConfirm(Number(qty), selectedArticle)}
          >
            {t("add")}
          </button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
