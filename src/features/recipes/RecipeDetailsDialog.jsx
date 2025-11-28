import React from "react";
import { Dialog } from "@headlessui/react";
import { useTranslation } from "react-i18next";

export default function RecipeDetailsDialog({
  open,
  recipe,
  ingredients,
  categories = {},
  onEdit,
  onDelete,
  onClose,
  canEdit,
  canDelete
}) {
  const { t } = useTranslation("recipes");
  if (!recipe) return null;

  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50 overflow-hidden">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-y-0 right-0 max-w-sm w-full bg-white shadow-xl p-6 overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
          {recipe.name}
        </h2>
        <ul className="text-sm text-gray-800 space-y-2 mb-6">
          <li><strong>{t("details.content")}:</strong> {recipe.content} {recipe.contentUnit}</li>
          <li>
            <strong>{t("details.category")}:</strong> {categories[recipe.category]?.label || recipe.category || "-"}
          </li>
          <li>
            <strong>{t("details.composition")}:</strong>
            {recipe.composition && recipe.composition.length > 0 ? (
              <ul className="ml-4 mt-1 list-disc">
                {recipe.composition.map((row, idx) => {
                  const ingredient = ingredients.find(ing => ing.id === row.ingredientId);
                  return (
                    <li key={idx}>
                      {ingredient
                        ? (() => {
                            const unit = ingredient.unit;
                            return `${ingredient.name} (${row.quantity} ${unit})`;
                          })()
                        : t("details.unknownIngredient", { id: row.ingredientId })}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="ml-2 text-gray-400 italic">{t("details.empty")}</span>
            )}
          </li>
        </ul>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={() => onEdit(recipe)}
              className="bg-black text-white px-4 py-2"
            >{t("details.edit")}</button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(recipe)}
              className="bg-red-600 text-white px-4 py-2"
            >{t("details.delete")}</button>
          )}
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-800 px-4 py-2"
          >{t("details.close")}</button>
        </div>
      </div>
    </Dialog>
  );
}
