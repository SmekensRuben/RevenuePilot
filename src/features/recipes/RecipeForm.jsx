import React, { useState, useEffect, useMemo } from "react";
import { Dialog } from "@headlessui/react";
import { Combobox } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { useHotelContext } from "../../contexts/HotelContext";
import { getSearchTokens, matchesSearchTokensAcross } from "utils/search";

export default function RecipeForm({
  open,
  onClose,
  onSubmit,
  ingredients,
  editRecipe,
  categories = {},
}) {
  const [name, setName] = useState("");
  const [composition, setComposition] = useState([]);
  const [content, setContent] = useState("");
  const [contentUnit, setContentUnit] = useState("");
  const [parentCategory, setParentCategory] = useState("");
  const [category, setCategory] = useState("");
  const { language } = useHotelContext();
  const { t } = useTranslation("recipes");

  useEffect(() => {
    if (editRecipe) {
      setName(editRecipe.name || "");
      setComposition(editRecipe.composition || []);
      setContent(editRecipe.content || "");
      setContentUnit(editRecipe.contentUnit || "");
      setCategory(editRecipe.category || "");
      setParentCategory(categories[editRecipe.category]?.parentId || "");
    } else {
      setName("");
      setComposition([]);
      setContent("");
      setContentUnit("");
      setCategory("");
      setParentCategory("");
    }
  }, [editRecipe, open, categories]);

  const handleAddIngredient = () => {
    setComposition([...composition, { ingredientId: "", quantity: "" }]);
  };
  const handleIngredientChange = (idx, field, value) => {
    setComposition(
      composition.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };
  const handleRemoveIngredient = idx => {
    setComposition(composition.filter((_, i) => i !== idx));
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
      .filter(([key, val]) => val.parentId === parentCategory)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories, parentCategory]);

  function handleFormSubmit(e) {
    e.preventDefault();
    if (!name || !content || !contentUnit || !category || composition.some(row => !row.ingredientId || !row.quantity)) {
      alert(t("form.missingFields"));
      return;
    }
    onSubmit({
      name,
      composition: composition.map(row => ({
        ingredientId: row.ingredientId,
        quantity: parseFloat(row.quantity),
      })),
      content: parseFloat(content),
      contentUnit,
      category,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50 overflow-hidden">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-xl p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{editRecipe ? t("form.editTitle") : t("form.createTitle")}</h2>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <input
            type="text"
            placeholder={t("form.namePlaceholder")}
            className="border px-3 py-2 w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              placeholder={t("form.contentPlaceholder")}
              className="border px-3 py-2 w-1/2"
              value={content}
              onChange={e => setContent(e.target.value)}
              required
            />
          <input
            type="text"
            placeholder={t("form.unitPlaceholder")}
            className="border px-3 py-2 w-1/2"
            value={contentUnit}
            onChange={e => setContentUnit(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block font-medium mb-2">{t("form.parentCategoryLabel")}</label>
          <select
            className="border px-3 py-2 w-full"
            value={parentCategory}
            onChange={e => {
              setParentCategory(e.target.value);
              setCategory("");
            }}
          >
            <option value="">{t("form.parentCategoryPlaceholder")}</option>
            {parentCategoryOptions.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-2">{t("form.categoryLabel")}</label>
          <select
            className="border px-3 py-2 w-full"
            value={category}
            onChange={e => setCategory(e.target.value)}
            required
            disabled={!parentCategory}
          >
            <option value="">{t("form.categoryPlaceholder")}</option>
            {childCategoryOptions.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-2">{t("form.compositionLabel")}</label>
              {composition.map((row, idx) => {
                const selectedIng = ingredients.find(i => i.id === row.ingredientId);
                return (
              <div key={idx} className="flex gap-2 mb-2">
                <Combobox value={row.ingredientId} onChange={val => handleIngredientChange(idx, 'ingredientId', val)}>
                  <div className="relative w-1/2">
                    <Combobox.Input
                      className="border px-2 py-1 w-full"
                      onChange={e => handleIngredientChange(idx, 'ingredientId', e.target.value)}
                      displayValue={id => {
                        const ing = ingredients.find(ing => ing.id === id);
                        return ing?.aliases?.[language] || ing?.name || id;
                      }}
                      placeholder={t("form.ingredientPlaceholder")}
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
                                  {name}
                                  {unit ? ` (${unit})` : ''}
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
                <div className="flex items-center w-1/3">
                  <input
                    type="number"
                    step="0.0001"
                    placeholder={t("form.quantityPlaceholder")}
                    className="border px-2 py-1 w-full"
                    value={row.quantity}
                    onChange={e => handleIngredientChange(idx, 'quantity', e.target.value)}
                    required
                  />
                  {selectedIng?.unit && (
                    <span className="ml-2 text-xs text-gray-500">
                      {selectedIng.unit}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="bg-red-500 text-white px-2 py-1 rounded"
                  onClick={() => handleRemoveIngredient(idx)}
                >✕</button>
              </div>
                );
              })}
            <button
              type="button"
              className="bg-black text-white px-3 py-1 rounded text-sm"
              onClick={handleAddIngredient}
            >{t("form.addIngredient")}</button>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="bg-[#b41f1f] text-white px-4 py-2 rounded">{editRecipe ? t("form.save") : t("form.add")}</button>
            <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded">{t("form.cancel")}</button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
