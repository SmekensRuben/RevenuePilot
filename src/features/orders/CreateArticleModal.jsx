import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "@headlessui/react";
import { Combobox } from "components/ui/combobox";
import { useTranslation } from "react-i18next";

const initialState = {
  name: "",
  brand: "",
  supplier: "",
  articleNumber: "",
  pricePerPurchaseUnit: "",
  quantity: 1,
};

export default function CreateArticleModal({
  open,
  onCancel,
  onCreate,
  suppliers = [],
}) {
  const { t } = useTranslation("orders");
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(initialState);
      setErrors({});
    }
  }, [open]);

  const supplierOptions = useMemo(() => {
    return suppliers
      .filter(s => s && typeof s.name === "string")
      .map(s => ({
        value: s.name,
        label: s.customerNr ? `${s.name} (${s.customerNr})` : s.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [suppliers]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const selectedSupplier = useMemo(
    () => supplierOptions.find(option => option.value === form.supplier),
    [form.supplier, supplierOptions],
  );

  const handleSubmit = e => {
    e.preventDefault();
    const validationErrors = {};
    const trimmedName = form.name.trim();
    const trimmedSupplier = form.supplier.trim();
    const price = Number(form.pricePerPurchaseUnit);
    const quantity = Number(form.quantity);

    if (!trimmedName) {
      validationErrors.name = t("createArticle.errors.nameRequired");
    }
    if (!trimmedSupplier) {
      validationErrors.supplier = t("createArticle.errors.supplierRequired");
    }
    if (!price || Number.isNaN(price) || price <= 0) {
      validationErrors.pricePerPurchaseUnit = t("createArticle.errors.priceRequired");
    }
    if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
      validationErrors.quantity = t("createArticle.errors.quantityRequired");
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const articleNumber = form.articleNumber.trim();

    const newArticle = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      label: trimmedName,
      brand: form.brand.trim(),
      supplier: trimmedSupplier,
      articleNumber: articleNumber || undefined,
      price: price,
      pricePerPurchaseUnit: price,
      quantity,
      outlet: "",
      custom: true,
    };

    onCreate?.(newArticle);
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="fixed inset-0 bg-black/40 z-40" aria-hidden="true" />
      <Dialog.Panel className="relative z-50 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <Dialog.Title className="text-lg font-semibold mb-4">
          {t("createArticle.title")}
        </Dialog.Title>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="new-article-name">
              {t("createArticle.name")}
            </label>
            <input
              id="new-article-name"
              type="text"
              className="w-full border rounded-xl px-3 py-2"
              value={form.name}
              onChange={e => handleChange("name", e.target.value)}
              required
            />
            {errors.name && (
              <p className="text-red-600 text-xs mt-1">{errors.name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="new-article-brand">
              {t("createArticle.brandOptional")}
            </label>
            <input
              id="new-article-brand"
              type="text"
              className="w-full border rounded-xl px-3 py-2"
              value={form.brand}
              onChange={e => handleChange("brand", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="new-article-supplier">
              {t("createArticle.supplier")}
            </label>
            <Combobox
              id="new-article-supplier"
              value={selectedSupplier || null}
              onChange={option => handleChange("supplier", option?.value || "")}
              options={supplierOptions}
              displayValue={option => option.label}
              getOptionValue={option => option.value}
              placeholder={t("createArticle.selectSupplier")}
              required
              className="w-full border rounded-xl px-3 py-2"
            />
            {errors.supplier && (
              <p className="text-red-600 text-xs mt-1">{errors.supplier}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="new-article-quantity">
                {t("createArticle.quantity")}
              </label>
              <input
                id="new-article-quantity"
                type="number"
                min="1"
                className="w-full border rounded-xl px-3 py-2"
                value={form.quantity}
                onChange={e => handleChange("quantity", e.target.value)}
                required
              />
              {errors.quantity && (
                <p className="text-red-600 text-xs mt-1">{errors.quantity}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="new-article-article-number">
              {t("createArticle.articleNumber")}
            </label>
            <input
              id="new-article-article-number"
              type="text"
              className="w-full border rounded-xl px-3 py-2"
              value={form.articleNumber}
              onChange={e => handleChange("articleNumber", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="new-article-price">
              {t("createArticle.price")}
            </label>
            <input
              id="new-article-price"
              type="number"
              min="0"
              step="0.01"
              className="w-full border rounded-xl px-3 py-2"
              value={form.pricePerPurchaseUnit}
              onChange={e => handleChange("pricePerPurchaseUnit", e.target.value)}
              required
            />
            {errors.pricePerPurchaseUnit && (
              <p className="text-red-600 text-xs mt-1">
                {errors.pricePerPurchaseUnit}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="bg-gray-200 px-4 py-2 rounded-2xl"
              onClick={onCancel}
            >
              {t("createArticle.cancel")}
            </button>
            <button
              type="submit"
              className="bg-marriott text-white px-4 py-2 rounded-2xl font-semibold hover:bg-marriott-dark"
            >
              {t("createArticle.addToCart")}
            </button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
