import React from "react";
import { Dialog } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import OrderProductCard from "./OrderProductCard";

export default function OrderProductsModal({
  open,
  articles = [],
  products = [],
  outlets = [],
  bulkOutlet = "",
  onClose,
  onQuantityChange,
  onOutletChange,
  onBulkOutletChange,
  onRemove,
  onConfirm,
  saving = false,
  error = "",
  editable = true,
}) {
  const { t } = useTranslation("orders");
  const items = articles && articles.length > 0 ? articles : products;
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
    >
      <div className="fixed inset-0 bg-black/40 z-40" aria-hidden="true" />
      <Dialog.Panel className="relative z-50 bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl mx-auto max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold mb-4">{t("productsModal.title")}</Dialog.Title>
          {outlets.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
              <span className="text-sm text-gray-700">{t("productsModal.selectOutlet")}</span>
              <select
                className="border rounded-xl px-2 py-1"
                value={bulkOutlet}
                onChange={e => onBulkOutletChange?.(e.target.value)}
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
          {items.length === 0 ? (
            <div className="text-gray-500">{t("productsModal.empty")}</div>
          ) : (
            <>
              {/* Mobile: card layout */}
              <div className="flex flex-col gap-3 sm:hidden">
                {items.map((prod, idx) => (
                  <OrderProductCard
                    key={idx}
                    prod={prod}
                    idx={idx}
                    editable={editable}
                    outlets={outlets}
                    onQuantityChange={onQuantityChange}
                    onOutletChange={onOutletChange}
                    onRemove={onRemove}
                  />
                ))}
              </div>
              {/* Desktop: row layout */}
              <div className="hidden sm:flex flex-col gap-2">
                {items.map((prod, idx) => {
                  const qtyNum = Number(prod.quantity) || 0;
                  const unitPrice = Number(
                    prod.invoicedPricePerPurchaseUnit
                    ?? prod.price
                    ?? prod.pricePerPurchaseUnit
                    ?? 0
                  );
                  const total = qtyNum * unitPrice;
                  const displayName = prod.label || prod.name || "";
                  return (
                    <div
                      key={idx}
                      className="flex gap-3 items-center border rounded-xl px-3 py-1 bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {displayName}
                          </span>
                          {prod.custom && <span className="badge-new">{t("labels.newBadge")}</span>}
                          {prod.supplier && (
                            <span className="inline-flex items-center text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                              {prod.supplier}
                            </span>
                          )}
                        </div>
                        {(prod.unitsPerPurchaseUnit && prod.stockUnit) || prod.purchaseUnit ? (
                          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
                            {prod.unitsPerPurchaseUnit && prod.stockUnit && (
                              <span>
                                / {prod.unitsPerPurchaseUnit} {prod.stockUnit}
                              </span>
                            )}
                            {!prod.unitsPerPurchaseUnit && prod.purchaseUnit && (
                              <span>/ {prod.purchaseUnit}</span>
                            )}
                          </div>
                        ) : null}
                        {prod.articleNumber && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {t("labels.articleNumber")} {prod.articleNumber}
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={prod.quantity ?? ""}
                        onChange={e => onQuantityChange(idx, e.target.value)}
                        className="w-16 border rounded-xl px-2 py-1 text-center"
                        required
                        disabled={!editable}
                      />
                      {outlets.length > 0 && (
                        <select
                          className="border rounded-xl px-2 py-1"
                          value={prod.outlet || ''}
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
                      )}
                      <div>
                        €{unitPrice.toFixed(2)}
                        {qtyNum > 1 && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({qtyNum}×)
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-marriott">
                        €{total.toFixed(2)}
                      </div>
                      {editable && (
                        <button
                          type="button"
                          className="text-marriott text-xs underline ml-2 hover:text-marriott-dark"
                          onClick={() => onRemove(idx)}
                        >
                          {t("productsModal.remove")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="bg-gray-200 px-4 py-2 rounded-2xl"
              onClick={onClose}
            >
              {t("productsModal.close")}
            </button>
            {onConfirm && (
              <button
                type="button"
                className="bg-marriott text-white px-6 py-2 rounded-2xl font-semibold hover:bg-marriott-dark"
                onClick={onConfirm}
                disabled={saving}
              >
                {saving ? t("productsModal.saving") : t("productsModal.save")}
              </button>
            )}
          </div>
        </Dialog.Panel>
    </Dialog>
  );
}
