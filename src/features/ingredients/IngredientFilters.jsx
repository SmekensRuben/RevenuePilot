import React from "react";
import { useTranslation } from "react-i18next";

export default function IngredientFilters({
  search,
  onSearchChange,
  parentCategory,
  onParentCategoryChange,
  category,
  onCategoryChange,
  parentCategoryOptions = [],
  childCategoryOptions = [],
}) {
  const { t } = useTranslation("ingredients");
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <input
        type="text"
        placeholder={`🔍 ${t("searchByName")}`}
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        className="border px-3 py-2 w-full"
      />
      <select
        value={parentCategory}
        onChange={e => {
          onParentCategoryChange(e.target.value);
        }}
        className="border px-3 py-2 w-full"
      >
        <option value="">{t("allParentCategories")}</option>
        {parentCategoryOptions.map(opt => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>
      <select
        value={category}
        onChange={e => onCategoryChange(e.target.value)}
        className="border px-3 py-2 w-full"
        disabled={!parentCategory}
      >
        <option value="">{t("allSubcategories")}</option>
        {childCategoryOptions.map(opt => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
