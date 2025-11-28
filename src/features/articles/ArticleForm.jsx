import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Combobox } from "components/ui/combobox";
import IngredientMiniCard from "./IngredientMiniCard";
import { useHotelContext } from "contexts/HotelContext";

export default function ArticleForm({
  form,
  setForm,
  categories,
  suppliers,
  ingredients = [],
  onSubmit,
  loading = false,
  submitLabel,
  onCancel,
}) {
  const { t } = useTranslation("articles");
  const { language } = useHotelContext();
  const submitText = submitLabel || t("save");
  const [ingredientInput, setIngredientInput] = useState(null);

  const handleAliasChange = (lang, value) => {
    setForm(prev => ({
      ...prev,
      aliases: {
        ...(prev.aliases || {}),
        [lang]: value,
      },
    }));
  };

  const handleAddIngredient = ing => {
    if (!ing) return;
    setForm(prev => {
      const ids = prev.ingredientIds || [];
      if (ids.includes(ing.id)) return prev;
      return { ...prev, ingredientIds: [...ids, ing.id] };
    });
    setIngredientInput(null);
  };

  const handleRemoveIngredient = id => {
    setForm(prev => ({
      ...prev,
      ingredientIds: (prev.ingredientIds || []).filter(i => i !== id),
    }));
  };
  // Optioneel: helper om prijs per stockeenheid te tonen
  const calcPricePerStockUnit = () => {
    if (form.isWeighed) {
      const price = parseFloat(form.pricePerKg || 0);
      if (!price || isNaN(price)) return "-";
      return `€${price.toFixed(4)}`;
    }
    const price = parseFloat(form.pricePerPurchaseUnit || 0);
    const units = parseFloat(form.unitsPerPurchaseUnit || 1);
    if (!units || isNaN(units) || !price || isNaN(price)) return "-";
    return `€${(price / units).toFixed(4)}`;
  };

  // Change handler: veldnaam en waarde
  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === "isWeighed" && value) {
        const price = parseFloat(updated.pricePerKg || 0);
        const units = parseFloat(updated.unitsPerPurchaseUnit || 0);
        updated.pricePerPurchaseUnit = price && units ? (price * units).toFixed(4) : "";
      }
      if (updated.isWeighed && (field === "pricePerKg" || field === "unitsPerPurchaseUnit")) {
        const price = parseFloat(updated.pricePerKg || 0);
        const units = parseFloat(updated.unitsPerPurchaseUnit || 0);
        updated.pricePerPurchaseUnit = price && units ? (price * units).toFixed(4) : "";
      }
      return updated;
    });
  };

  const parentCategoryOptions = useMemo(() => {
    const list = Object.entries(categories).map(([key, val]) => ({ key, ...val }));
    const map = {};
    list.forEach(cat => { map[cat.key] = { ...cat, childCount: 0 }; });
    list.forEach(cat => {
      if (cat.parentId && map[cat.parentId]) {
        map[cat.parentId].childCount += 1;
      }
    });
    return Object.values(map)
      .filter(cat => !cat.parentId && cat.childCount > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  const childCategoryOptions = useMemo(() => {
    return Object.entries(categories)
      .filter(([key, val]) => val.parentId === form.parentCategory)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories, form.parentCategory]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit && onSubmit();
      }}
      className="space-y-6 mt-4"
    >
      {/* Details Card */}
      <div className="bg-white rounded-2xl shadow p-4 space-y-4">
        <h2 className="font-semibold">{t("details")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label htmlFor="name" className="text-sm mb-1">
              {t("name")}
            </label>
            <input
              id="name"
              type="text"
              placeholder={t("name")}
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="border px-3 py-2 w-full"
              required
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="alias_nl" className="text-sm mb-1">
              {t("aliasNl")}
            </label>
            <input
              id="alias_nl"
              type="text"
              placeholder={t("aliasNl")}
              value={form.aliases?.nl || ""}
              onChange={(e) => handleAliasChange("nl", e.target.value)}
              className="border px-3 py-2 w-full"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="alias_fr" className="text-sm mb-1">
              {t("aliasFr")}
            </label>
            <input
              id="alias_fr"
              type="text"
              placeholder={t("aliasFr")}
              value={form.aliases?.fr || ""}
              onChange={(e) => handleAliasChange("fr", e.target.value)}
              className="border px-3 py-2 w-full"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="alias_en" className="text-sm mb-1">
              {t("aliasEn")}
            </label>
            <input
              id="alias_en"
              type="text"
              placeholder={t("aliasEn")}
              value={form.aliases?.en || ""}
              onChange={(e) => handleAliasChange("en", e.target.value)}
              className="border px-3 py-2 w-full"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="brand" className="text-sm mb-1">
              {t("brand")}
            </label>
            <input
              id="brand"
              type="text"
              placeholder={t("brand")}
              value={form.brand}
              onChange={(e) => handleChange("brand", e.target.value)}
              className="border px-3 py-2 w-full"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="supplier" className="text-sm mb-1">
              {t("selectSupplier")}
            </label>
            <select
              id="supplier"
              value={form.supplier}
              onChange={(e) => handleChange("supplier", e.target.value)}
              className="border px-3 py-2 w-full"
              required
            >
              <option value="">{t("selectSupplier")}</option>
              {suppliers.map((s, idx) => (
                <option key={s.key || idx} value={s.name}>
                  {s.name}
                  {s.customerNr ? ` (${s.customerNr})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="articleNumber" className="text-sm mb-1">
              {t("articleNumber")}
            </label>
            <input
              id="articleNumber"
              type="text"
              placeholder={t("articleNumber")}
              value={form.articleNumber}
              onChange={(e) => handleChange("articleNumber", e.target.value)}
              className="border px-3 py-2 w-full"
              required
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="ean" className="text-sm mb-1">
              {t("ean")}
            </label>
            <input
              id="ean"
              type="text"
              placeholder={t("ean")}
              value={form.ean || ""}
              onChange={(e) => handleChange("ean", e.target.value)}
              className="border px-3 py-2 w-full"
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="frozen"
              type="checkbox"
              checked={!!form.frozen}
              onChange={(e) => handleChange("frozen", e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="frozen" className="text-sm">
              {t("frozen")}
            </label>
          </div>
          <div className="flex flex-col">
            <label htmlFor="parentCategory" className="text-sm mb-1">
              {t("selectParentCategory")}
            </label>
            <select
              id="parentCategory"
              value={form.parentCategory}
              onChange={(e) => {
                handleChange("parentCategory", e.target.value);
                handleChange("category", "");
              }}
              className="border px-3 py-2 w-full"
            >
              <option value="">{t("selectParentCategory")}</option>
              {parentCategoryOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="category" className="text-sm mb-1">
              {t("selectSubcategory")}
            </label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => handleChange("category", e.target.value)}
              className="border px-3 py-2 w-full"
              required
              disabled={!form.parentCategory}
            >
              <option value="">{t("selectSubcategory")}</option>
              {childCategoryOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col md:col-span-2">
            <label htmlFor="imageUrl" className="text-sm mb-1">
              {t("imageUrl")}
            </label>
            <input
              id="imageUrl"
              type="text"
              placeholder={t("imageUrl")}
              value={form.imageUrl || ""}
              onChange={(e) => handleChange("imageUrl", e.target.value)}
              className="border px-3 py-2 w-full"
            />
          </div>
          <div className="flex flex-col md:col-span-2">
            <span className="text-sm mb-1">{t("ingredients")}</span>
            <Combobox
              value={ingredientInput}
              onChange={handleAddIngredient}
              options={ingredients.filter(i => !(form.ingredientIds || []).includes(i.id))}
              displayValue={i => i?.aliases?.[language] || i?.name || ""}
              getOptionValue={i => i.id}
              placeholder={t("ingredients")}
            />
            {(form.ingredientIds || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {(form.ingredientIds || []).map(id => {
                  const ing = ingredients.find(i => i.id === id);
                  return (
                    <IngredientMiniCard key={id} ingredient={ing} onRemove={handleRemoveIngredient} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Card */}
      <div className="bg-white rounded-2xl shadow p-4 space-y-4">
        <h2 className="font-semibold">{t("pricing")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="isWeighed"
              type="checkbox"
              checked={!!form.isWeighed}
              onChange={(e) => handleChange("isWeighed", e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="isWeighed" className="text-sm">
              {t("isWeighed")}
            </label>
          </div>
          {form.isWeighed ? (
            <>
              <div className="flex flex-col">
                <label htmlFor="pricePerKg" className="text-sm mb-1">
                  {t("pricePerKg")}
                </label>
                <input
                  id="pricePerKg"
                  type="number"
                  step="0.01"
                  placeholder={t("pricePerKg")}
                  value={form.pricePerKg || ""}
                  onChange={(e) => handleChange("pricePerKg", e.target.value)}
                  className="border px-3 py-2 w-full"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm mb-1">
                  {t("pricePerPurchaseUnit")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.pricePerPurchaseUnit || ""}
                  readOnly
                  className="border px-3 py-2 w-full bg-gray-100"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col">
              <label htmlFor="pricePerPurchaseUnit" className="text-sm mb-1">
                {t("pricePerPurchaseUnit")}
              </label>
              <input
                id="pricePerPurchaseUnit"
                type="number"
                step="0.01"
                placeholder={t("pricePerPurchaseUnit")}
                value={form.pricePerPurchaseUnit}
                onChange={(e) => handleChange("pricePerPurchaseUnit", e.target.value)}
                className="border px-3 py-2 w-full"
              />
            </div>
          )}
          <div className="flex flex-col">
            <label htmlFor="vat" className="text-sm mb-1">
              {t("vat")}
            </label>
            <select
              id="vat"
              value={form.vat}
              onChange={(e) => handleChange("vat", e.target.value)}
              className="border px-3 py-2 w-full"
            >
              <option value="0">0%</option>
              <option value="6">6%</option>
              <option value="12">12%</option>
              <option value="21">21%</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1 text-gray-700">
              {t("pricePerStockUnitLabel", { unit: form.stockUnit || t("stockUnit") })}
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded text-gray-700">
              {calcPricePerStockUnit()}
            </div>
          </div>
        </div>
      </div>

      {/* Units Card */}
      <div className="bg-white rounded-2xl shadow p-4 space-y-4">
        <h2 className="font-semibold">{t("units")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label htmlFor="purchaseUnit" className="text-sm mb-1">
              {t("purchaseUnit")}
            </label>
            <input
              id="purchaseUnit"
              type="text"
              placeholder={t("purchaseUnit")}
              value={form.purchaseUnit}
              onChange={(e) => handleChange("purchaseUnit", e.target.value)}
              className="border px-3 py-2 w-full"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="stockUnit" className="text-sm mb-1">
              {t("stockUnit")}
            </label>
            <input
              id="stockUnit"
              type="text"
              placeholder={t("stockUnit")}
              value={form.stockUnit}
              onChange={(e) => handleChange("stockUnit", e.target.value)}
              className="border px-3 py-2 w-full"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="unitsPerPurchaseUnit" className="text-sm mb-1">
              {form.isWeighed ? t("kgPerPurchaseUnit") : t("unitsPerPurchaseUnit")}
            </label>
            <input
              id="unitsPerPurchaseUnit"
              type="number"
              step="0.0001"
              placeholder={form.isWeighed ? t("kgPerPurchaseUnit") : t("unitsPerPurchaseUnit")}
              value={form.unitsPerPurchaseUnit}
              onChange={(e) => handleChange("unitsPerPurchaseUnit", e.target.value)}
              className="border px-3 py-2 w-full"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="recipeUnit" className="text-sm mb-1">
              {t("recipeUnit")}
            </label>
            <input
              id="recipeUnit"
              type="text"
              placeholder={t("recipeUnit")}
              value={form.recipeUnit || ""}
              onChange={(e) => handleChange("recipeUnit", e.target.value)}
              className="border px-3 py-2 w-full"
              required
            />
          </div>
          <div className="flex flex-col md:col-span-2">
            <label htmlFor="contentPerStockUnit" className="text-sm mb-1">
              {t("contentPerStockUnit")}
            </label>
            <input
              id="contentPerStockUnit"
              type="number"
              placeholder={t("contentPerStockUnit")}
              value={form.contentPerStockUnit || ""}
              onChange={(e) => handleChange("contentPerStockUnit", e.target.value)}
              className="border px-3 py-2 w-full"
              min="0"
              step="any"
              required
            />
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-2xl shadow p-4 space-y-4">
        <h2 className="font-semibold">{t("status")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center">
            <input
              id="active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => handleChange("active", e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="active">{t("active")}</label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="submit"
          className="bg-black text-white px-4 py-2"
          disabled={loading}
        >
          {submitText}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-200 text-gray-800 px-4 py-2"
          >
            {t("cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
