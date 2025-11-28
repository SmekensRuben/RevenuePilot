import React from "react";
import IngredientCard from "./IngredientCard";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown } from "lucide-react";
import { ALLERGENS, ALLERGEN_ICONS } from "../../constants/allergens";

export default function IngredientsTable({
  ingredients,
  categories = {},
  loading = false,
  onSelect,
  sortField,
  sortDir,
  onSort,
}) {
  const { t } = useTranslation("ingredients");
  return (
    <>
      <div className="md:hidden flex flex-col gap-2 mt-4">
        {loading ? (
          <div className="text-center text-gray-400 py-8">{t("loading")}</div>
        ) : ingredients.length === 0 ? (
          <div className="text-center text-gray-400 py-8">{t("noResults")}</div>
        ) : (
          ingredients.map(ing => (
            <IngredientCard
              key={ing.id}
              ingredient={ing}
              categories={categories}
              onClick={() => onSelect && onSelect(ing)}
            />
          ))
        )}
      </div>
      <div className="overflow-hidden rounded-xl shadow border border-gray-200 hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableTh label={t("name")}
                          field="name"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={onSort} />
              <SortableTh label={t("unit")}
                          field="unit"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={onSort} />
              <SortableTh label={t("category")}
                          field="category"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={onSort} />
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase">
                {t("allergensLabel")}
              </th>
              <SortableTh label={t("articles")}
                          field="articles"
                          sortField={sortField}
                          sortDir={sortDir}
                          onSort={onSort}
                          align="right" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">{t("loading")}</td>
              </tr>
            ) : ingredients.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">{t("noResults")}</td>
              </tr>
            ) : (
              ingredients.map(ing => (
                <tr key={ing.id} onClick={() => onSelect && onSelect(ing)} className="hover:bg-gray-50 cursor-pointer transition">
                  <td className="px-4 py-2 font-medium text-gray-900">{ing.name}</td>
                  <td className="px-4 py-2 text-gray-700">{ing.unit}</td>
                  <td className="px-4 py-2 text-gray-700">{categories[ing.category]?.label || ing.category}</td>
                  <td className="px-4 py-2 text-gray-700">
                    <div className="flex flex-wrap gap-1">
                      {ALLERGENS.filter(a => ing.allergens?.[a]).map(a => {
                        const Icon = ALLERGEN_ICONS[a];
                        return (
                          <Icon key={a} className="w-4 h-4" title={t(`allergens.${a}`)} />
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-700 text-right">{(ing.articles && ing.articles.length) || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

const sortIcon = (active, dir) =>
  active ? (
    dir === "asc" ? (
      <ChevronUp size={16} className="inline ml-1 -mt-1" />
    ) : (
      <ChevronDown size={16} className="inline ml-1 -mt-1" />
    )
  ) : (
    <span className="inline-block w-4" />
  );

function SortableTh({ label, field, sortField, sortDir, onSort, align }) {
  const active = sortField === field;
  return (
    <th
      className={`px-4 py-2 text-xs font-semibold uppercase select-none cursor-pointer hover:bg-gray-100 transition ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => onSort(field)}
      scope="col"
    >
      <span
        className={`flex items-center gap-1 ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        {label}
        {sortIcon(active, sortDir)}
      </span>
    </th>
  );
}
