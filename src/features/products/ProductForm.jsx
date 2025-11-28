import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { Combobox } from "@headlessui/react";
import { useHotelContext } from "../../contexts/HotelContext";
import { useTranslation } from "react-i18next";
import {
  getSearchTokens,
  matchesSearchTokens,
  matchesSearchTokensAcross,
} from "utils/search";

export default function ProductForm({
  open,
  onClose,
  onSubmit,
  ingredients,
  outlets,
  categories: productCategories,
  editProduct,
  recipes = [],
  asPage = false,
  initialValues = {},
}) {
  // Form states
  const [name, setName] = useState("");
  const [saleUnit, setSaleUnit] = useState("");
  const [price, setPrice] = useState("");
  const [composition, setComposition] = useState([]);
  const [recipeComposition, setRecipeComposition] = useState([]);
  const [active, setActive] = useState(true);
  const [vat, setVat] = useState("");
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [category, setCategory] = useState("");
  const [lightspeedId, setLightspeedId] = useState("");
  const { language } = useHotelContext();
  const { t } = useTranslation("products");

  const vatOptions = [0, 6, 12, 21];

  useEffect(() => {
    if (editProduct) {
      setName(editProduct.name || "");
      setSaleUnit(editProduct.saleUnit || "");
      setPrice(editProduct.price || "");
      const normalizedComposition = (editProduct.composition || []).map(row => ({
        ingredientId: row.ingredientId || "",
        quantity:
          row.quantity !== undefined && row.quantity !== null
            ? String(row.quantity)
            : "",
        yield:
          row.yield !== undefined && row.yield !== null && row.yield !== ""
            ? String(row.yield)
            : "100",
      }));
      setComposition(normalizedComposition);
      setRecipeComposition(editProduct.recipes || []);
      setActive(editProduct.active !== false);
      setVat(editProduct.vat?.toString() || "");
      // CORRECT: outlets altijd als strings!
      const validOutlets = Array.isArray(editProduct.outlets)
        ? editProduct.outlets
            .map(o => (typeof o === "object" ? o.name : o))
            .filter(name => outlets.some(outlet => outlet.name === name))
        : [];
      setSelectedOutlets(validOutlets);
      setCategory(editProduct.category || "");
      setLightspeedId(editProduct.lightspeedId || "");
    } else {
      setName(initialValues.name || "");
      setSaleUnit(initialValues.saleUnit || "");
      setPrice(initialValues.price ? String(initialValues.price) : "");
      setComposition([]);
      setRecipeComposition([]);
      setActive(true);
      setVat(initialValues.vat ? String(initialValues.vat) : "");
      setSelectedOutlets(Array.isArray(initialValues.outlets) ? initialValues.outlets : []);
      setCategory(initialValues.category || "");
      setLightspeedId(initialValues.lightspeedId || "");
    }
  }, [editProduct, open, outlets, initialValues]);

  const handleAddIngredient = () => {
    setComposition([
      ...composition,
      { ingredientId: "", quantity: "", yield: "100" },
    ]);
  };
  const handleIngredientChange = (idx, field, value) => {
    setComposition(
      composition.map((row, i) =>
        i === idx ? { ...row, [field]: value } : row
      )
    );
  };
  const handleRemoveIngredient = idx => {
    setComposition(composition.filter((_, i) => i !== idx));
  };

  const handleAddRecipe = () => {
    setRecipeComposition([...recipeComposition, { recipeId: "", quantity: "" }]);
  };
  const handleRecipeChange = (idx, field, value) => {
    setRecipeComposition(
      recipeComposition.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };
  const handleRemoveRecipe = idx => {
    setRecipeComposition(recipeComposition.filter((_, i) => i !== idx));
  };

  function handleFormSubmit(e) {
    e.preventDefault();
    if (
      !name ||
      !saleUnit ||
      !price ||
      composition.some(row => {
        const yieldValue = parseFloat(row.yield);
        return (
          !row.ingredientId ||
          !row.quantity ||
          Number.isNaN(yieldValue) ||
          yieldValue <= 0
        );
      }) ||
      recipeComposition.some(row => !row.recipeId || !row.quantity) ||
      !vat
    ) {
      alert(t("form.validationError"));
      return;
    }
    onSubmit({
      name,
      saleUnit,
      price: parseFloat(price),
      composition: composition.map(row => {
        const qty = parseFloat(row.quantity);
        const yieldValue = parseFloat(row.yield);
        return {
          ingredientId: row.ingredientId,
          quantity: Number.isNaN(qty) ? 0 : qty,
          yield:
            Number.isNaN(yieldValue) || yieldValue <= 0 ? 100 : yieldValue,
        };
      }),
      recipes: recipeComposition.map(row => ({
        recipeId: row.recipeId,
        quantity: parseFloat(row.quantity),
      })),
      active,
      vat: parseInt(vat),
      outlets: selectedOutlets, // <-- ENKEL strings!
      category,
      lightspeedId: lightspeedId || "",
    });
  }

  const formContent = (
    <>
      <h2 className="text-xl font-bold mb-4">{editProduct ? t("form.editTitle") : t("form.createTitle")}</h2>
      <form onSubmit={handleFormSubmit} className="space-y-4">
          <input
            type="text"
            placeholder={t("form.namePlaceholder")}
            className="border px-3 py-2 w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder={t("form.saleUnitPlaceholder")}
            className="border px-3 py-2 w-full"
            value={saleUnit}
            onChange={e => setSaleUnit(e.target.value)}
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder={t("form.pricePlaceholder")}
            className="border px-3 py-2 w-full"
            value={price}
            onChange={e => setPrice(e.target.value)}
            required
          />
          <div>
            <label className="block font-medium mb-2">{t("form.vatLabel")}</label>
            <select
              value={vat}
              onChange={e => setVat(e.target.value)}
              className="border px-3 py-2 w-full"
              required
            >
              <option value="">{t("form.selectVatRate")}</option>
              {vatOptions.map(opt => (
                <option key={opt} value={opt}>{opt}%</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-2">{t("form.categoryLabel")}</label>
            <Combobox value={category} onChange={setCategory}>
              <div className="relative">
                <Combobox.Input
                  className="border px-3 py-2 w-full"
                  onChange={event => setCategory(event.target.value)}
                  displayValue={catKey => productCategories[catKey]?.label || catKey}
                  placeholder={t("form.categoryPlaceholder")}
                />
                <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded bg-white border shadow">
                  {Object.entries(productCategories)
                    .filter(([key, val]) =>
                      !category ||
                      (productCategories[category]) ||
                      val.label.toLowerCase().includes((category || '').toLowerCase())
                    )
                    .map(([key, val]) => (
                      <Combobox.Option
                        key={key}
                        value={key}
                        className={({ active }) =>
                          `cursor-pointer px-4 py-2 ${active ? "bg-gray-100 text-black" : "text-gray-800"}`
                        }
                      >
                        {val.label}
                      </Combobox.Option>
                    ))}
                </Combobox.Options>
              </div>
            </Combobox>
          </div>
          <input
            type="text"
            placeholder={t("form.lightspeedPlaceholder")}
            className="border px-3 py-2 w-full"
            value={lightspeedId}
            onChange={e => setLightspeedId(e.target.value)}
          />
          <div>
            <label className="block font-medium mb-2">{t("form.compositionLabel")}</label>
              {composition.map((row, idx) => {
                const selectedIng = ingredients.find(i => i.id === row.ingredientId);
                const ingredientInputId = `ingredient-${idx}`;
                const ingredientHelperId = `ingredient-helper-${idx}`;
                const quantityInputId = `quantity-${idx}`;
                const quantityHelperId = `quantity-helper-${idx}`;
                const yieldInputId = `yield-${idx}`;
                const yieldHelperId = `yield-helper-${idx}`;
                const unitSuffix = selectedIng?.unit ? ` (${selectedIng.unit})` : "";
                return (
              <div key={idx} className="flex gap-2 mb-2 flex-wrap md:flex-nowrap">
                <div className="w-full md:w-1/2">
                  <label
                    htmlFor={ingredientInputId}
                    className="mb-1 block text-xs font-medium text-gray-700"
                  >
                    {t("form.ingredientLabel")}
                  </label>
                  <Combobox value={row.ingredientId} onChange={val => handleIngredientChange(idx, "ingredientId", val)}>
                    <div className="relative">
                      <Combobox.Input
                        id={ingredientInputId}
                        className="border px-2 py-1 w-full"
                        onChange={e => handleIngredientChange(idx, "ingredientId", e.target.value)}
                        displayValue={id => {
                          const ing = ingredients.find(ing => ing.id === id);
                          return ing?.aliases?.[language] || ing?.name || id;
                        }}
                        placeholder={t("form.ingredientPlaceholder")}
                        aria-describedby={ingredientHelperId}
                      />
                      <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded bg-white border shadow">
                        {ingredients
                          .filter(ing => {
                            if (!row.ingredientId) return true;
                            if (ingredients.find(i => i.id === row.ingredientId)) return true;
                            const tokens = getSearchTokens(row.ingredientId);
                            if (tokens.length === 0) return true;
                            const fields = [
                              ing.aliases?.[language],
                              ing.name,
                              ing.brand,
                            ];
                            return matchesSearchTokensAcross(fields, tokens);
                          })
                          .map(ing => {
                            const unit = ing.unit;
                            const name = ing.aliases?.[language] || ing.name;
                            return (
                              <Combobox.Option
                                key={ing.id}
                                value={ing.id}
                                className={({ active }) =>
                                  `cursor-pointer px-4 py-2 ${active ? 'bg-gray-100 text-black' : 'text-gray-800'}`
                                }
                              >
                                <div className="flex flex-col">
                                  <span>
                                    {name} ({unit})
                                  </span>
                                  {ing.brand && (
                                    <span className="text-xs text-gray-500">{ing.brand}</span>
                                  )}
                                </div>
                              </Combobox.Option>
                            );
                          })}
                      </Combobox.Options>
                    </div>
                  </Combobox>
                  <p id={ingredientHelperId} className="mt-1 text-[11px] text-gray-500">
                    {t("form.ingredientHelper")}
                  </p>
                </div>
                <div className="w-full md:w-1/4">
                  <label
                    htmlFor={quantityInputId}
                    className="mb-1 block text-xs font-medium text-gray-700"
                  >
                    {t("form.quantityLabel", { unit: unitSuffix })}
                  </label>
                  <input
                    id={quantityInputId}
                    type="number"
                    step="0.0001"
                    placeholder={t("form.quantityPlaceholder", {
                      unit: unitSuffix,
                    })}
                    className="border px-2 py-1 w-full"
                    value={row.quantity}
                    onChange={e => handleIngredientChange(idx, "quantity", e.target.value)}
                    aria-describedby={quantityHelperId}
                    required
                  />
                  <p id={quantityHelperId} className="mt-1 text-[11px] text-gray-500">
                    {t("form.quantityHelper", { unit: unitSuffix })}
                  </p>
                </div>
                <div className="w-full md:w-1/4">
                  <label
                    htmlFor={yieldInputId}
                    className="mb-1 block text-xs font-medium text-gray-700"
                  >
                    {t("form.yieldLabel")}
                  </label>
                  <input
                    id={yieldInputId}
                    type="number"
                    step="0.1"
                    min="1"
                    max="100"
                    placeholder={t("form.yieldPlaceholder")}
                    className="border px-2 py-1 w-full"
                    value={row.yield}
                    onChange={e => handleIngredientChange(idx, "yield", e.target.value)}
                    aria-describedby={yieldHelperId}
                    required
                  />
                  <p id={yieldHelperId} className="mt-1 text-[11px] text-gray-500">
                    {t("form.yieldHelper")}
                  </p>
                </div>
                <button
                  type="button"
                  className="bg-red-500 text-white px-2 py-1 rounded self-start"
                  onClick={() => handleRemoveIngredient(idx)}
                >✕</button>
              </div>
                );
              })}
            <button
              type="button"
              className="bg-black text-white px-3 py-1 rounded text-sm"
              onClick={handleAddIngredient}
          >+ {t("form.addIngredient")}</button>
          </div>
          <div>
            <label className="block font-medium mb-2">{t("form.recipesLabel")}</label>
              {recipeComposition.map((row, idx) => {
                const selectedRecipe = recipes.find(r => r.id === row.recipeId);
                return (
              <div key={idx} className="flex gap-2 mb-2">
                <Combobox value={row.recipeId} onChange={val => handleRecipeChange(idx, 'recipeId', val)}>
                  <div className="relative w-1/2">
                    <Combobox.Input
                      className="border px-2 py-1 w-full"
                      onChange={e => handleRecipeChange(idx, 'recipeId', e.target.value)}
                      displayValue={id => recipes.find(r => r.id === id)?.name || id}
                      placeholder={t("form.recipePlaceholder")}
                    />
                    <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded bg-white border shadow">
                      {recipes
                        .filter(r => {
                          if (!row.recipeId) return true;
                          if (recipes.find(i => i.id === row.recipeId)) return true;
                          const tokens = getSearchTokens(row.recipeId);
                          if (tokens.length === 0) return true;
                          return matchesSearchTokens(r.name, tokens);
                        })
                        .map(r => (
                          <Combobox.Option
                            key={r.id}
                            value={r.id}
                            className={({ active }) =>
                              `cursor-pointer px-4 py-2 ${active ? 'bg-gray-100 text-black' : 'text-gray-800'}`
                            }
                          >
                            {r.name}
                          </Combobox.Option>
                        ))}
                    </Combobox.Options>
                  </div>
                </Combobox>
                <input
                  type="number"
                  step="0.0001"
                  placeholder={t("form.quantityPlaceholder", {
                    unit: selectedRecipe?.contentUnit ? ` (${selectedRecipe.contentUnit})` : "",
                  })}
                  className="border px-2 py-1 w-1/3"
                  value={row.quantity}
                  onChange={e => handleRecipeChange(idx, 'quantity', e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="bg-red-500 text-white px-2 py-1 rounded"
                  onClick={() => handleRemoveRecipe(idx)}
                >✕</button>
              </div>
                );
              })}
            <button
              type="button"
              className="bg-black text-white px-3 py-1 rounded text-sm"
              onClick={handleAddRecipe}
            >+ {t("form.addRecipe")}</button>
          </div>
          <div>
            <label className="block font-medium mb-2">{t("form.outletsLabel")} <span className="text-gray-400 text-xs">{t("form.outletsHelper")}</span></label>
            <div className="flex flex-wrap gap-2 mb-3">
              {outlets.map(o => (
                <label
                  key={o.id || o.name}
                  className="flex items-center gap-2 border rounded px-2 py-1 cursor-pointer bg-gray-50 hover:bg-gray-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedOutlets.includes(o.name)}
                    onChange={e => {
                      if (e.target.checked) setSelectedOutlets([...selectedOutlets, o.name]);
                      else setSelectedOutlets(selectedOutlets.filter(x => x !== o.name));
                    }}
                  />
                  <span>{o.name}</span>
                </label>
              ))}
              {!outlets.length && (
                <span className="text-gray-400 text-xs italic">{t("form.noOutlets")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="mr-2" />
            <label>{t("form.activeLabel")}</label>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="bg-[#b41f1f] text-white px-4 py-2 rounded">{editProduct ? t("form.submitEdit") : t("form.submitCreate")}</button>
            <button type="button" onClick={() => onClose && onClose()} className="bg-gray-200 px-4 py-2 rounded">{t("form.cancel")}</button>
          </div>
        </form>
    </>
  );

  if (asPage) {
    return <div className="mb-6 w-full rounded bg-white p-6 shadow">{formContent}</div>;
  }

  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50 overflow-hidden">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-xl p-6 overflow-y-auto">
        {formContent}
      </div>
    </Dialog>
  );
}
