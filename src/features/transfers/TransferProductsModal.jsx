import React from "react";
import { Dialog } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import TransferProductCard from "./TransferProductCard";

export default function TransferProductsModal({
  open,
  products = [],
  outlets = [],
  onClose,
  onQuantityChange,
  onRemove,
  onConfirm,
  saving = false,
  error = "",
}) {
  const { t } = useTranslation("transfers");
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
    >
      <div className="fixed inset-0 bg-black/40 z-40" aria-hidden="true" />
      <Dialog.Panel className="relative z-50 bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl mx-auto max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold mb-4">{t("addedProducts")}</Dialog.Title>
          {products.length === 0 ? (
            <div className="text-gray-500">{t("noProducts")}</div>
          ) : (
            <div className="flex flex-col gap-3">
              {products.map((prod, idx) => (
                <TransferProductCard
                  key={idx}
                  prod={prod}
                  idx={idx}
                  outlets={outlets}
                  onQuantityChange={onQuantityChange}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="bg-gray-200 px-4 py-2 rounded-2xl"
              onClick={onClose}
            >
              {t("close")}
            </button>
            {onConfirm && (
              <button
                type="button"
                className="bg-marriott text-white px-6 py-2 rounded-2xl font-semibold hover:bg-marriott-dark"
                onClick={onConfirm}
                disabled={saving}
              >
                {saving ? t("saving") : t("saveTransfer")}
              </button>
            )}
          </div>
        </Dialog.Panel>
    </Dialog>
  );
}
