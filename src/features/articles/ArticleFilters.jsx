import React from "react";
import { useTranslation } from "react-i18next";

export default function ArticleFilters({
  search,
  onSearchChange,
  parentCategory,
  onParentCategoryChange,
  category,
  onCategoryChange,
  parentCategoryOptions = [],
  childCategoryOptions = [],
  supplier,
  onSupplierChange,
  suppliers,
  lastUpdate,
  onLastUpdateChange,
}) {
  const { t } = useTranslation("articles");
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
      <input
        type="text"
        placeholder={`🔍 ${t("searchByNameBrandNumber")}`}
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
      <select
        value={supplier}
        onChange={e => onSupplierChange(e.target.value)}
        className="border px-3 py-2 w-full"
      >
        <option value="">{t("allSuppliers")}</option>
        {suppliers.map((s, idx) => (
          <option key={s.key || idx} value={s.name}>
            {s.name}{s.customerNr ? ` (${s.customerNr})` : ""}
          </option>
        ))}
      </select>
      <select
        value={lastUpdate}
        onChange={e => onLastUpdateChange(e.target.value)}
        className="border px-3 py-2 w-full"
      >
        <option value="">{t("filterByLastUpdate")}</option>
        <option value="recent">{t("recent")}</option>
        <option value="middelmatig">{t("moderate")}</option>
        <option value="oud">{t("old")}</option>
      </select>
    </div>
  );
}
