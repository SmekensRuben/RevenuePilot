import React from "react";
import { useTranslation } from "react-i18next";
import { calculateRecipeCost } from "./recipeHelpers";
import RecipeCard from "./RecipeCard";
import { ChevronUp, ChevronDown } from "lucide-react";

const sortIcon = (active, dir) =>
  active ? (dir === "asc" ? <ChevronUp size={16} className="inline ml-1 -mt-1" /> : <ChevronDown size={16} className="inline ml-1 -mt-1" />) : <span className="inline-block w-4" />;

function SortableTh({ label, field, sortField, sortDir, onSort, align }) {
  const active = sortField === field;
  return (
    <th
      className={`px-4 py-2 text-xs font-semibold uppercase select-none cursor-pointer hover:bg-gray-100 transition ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => onSort(field)}
      scope="col"
    >
      <span className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>{label}{sortIcon(active, sortDir)}</span>
    </th>
  );
}

export default function RecipeTable({
  recipes,
  ingredients,
  articles = [],
  handleShowDetails,
  handleEdit,
  canEdit,
  sortField,
  sortDir,
  onSort,
}) {
  const { t } = useTranslation("recipes");
  const sorted = recipes;
  return (
    <>
      <div className="md:hidden flex flex-col gap-2">
        {sorted.length === 0 ? (
          <div className="text-center text-gray-400 py-8">{t("table.empty")}</div>
        ) : (
          sorted.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              ingredients={ingredients}
              articles={articles}
              onClick={() => handleShowDetails(recipe)}
            />
          ))
        )}
      </div>
      <div className="overflow-hidden rounded-xl shadow border border-gray-200 hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableTh label={t("table.name")} field="name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("table.content")} field="content" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableTh label={t("table.cost")} field="cost" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
              <th />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sorted.map(recipe => {
              const cost = calculateRecipeCost(recipe, ingredients, articles);
              return (
                <tr
                  key={recipe.id}
                  className="hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => handleShowDetails(recipe)}
                >
                  <td className="px-4 py-2 font-medium text-gray-900">{recipe.name}</td>
                  <td className="px-4 py-2">{recipe.content} {recipe.contentUnit}</td>
                  <td className="px-4 py-2 text-right">€{cost.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {canEdit && (
                      <button
                        className="bg-black text-white px-2 py-1 text-xs rounded"
                        onClick={e => { e.stopPropagation(); handleEdit(recipe); }}
                      >{t("details.edit")}</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">{t("table.empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
