import React from "react";
import { useTranslation } from "react-i18next";
import { calculateRecipeCost } from "./recipeHelpers";

export default function RecipeCard({
  recipe,
  ingredients,
  articles = [],
  onClick,
}) {
  const { t } = useTranslation("recipes");
  const cost = calculateRecipeCost(recipe, ingredients, articles);
  return (
    <div
      className="bg-white rounded-2xl shadow border border-gray-200 px-4 py-4 mb-3 cursor-pointer hover:shadow-lg transition relative"
      onClick={onClick}
      tabIndex={0}
    >
      <div className="font-bold text-lg text-gray-900 mb-1">{recipe.name}</div>
      <div className="text-gray-500 text-base mb-2">
        {recipe.content} {recipe.contentUnit}
      </div>
      <div className="flex flex-col gap-1 mb-2 text-sm">
        <div>
          <span className="font-semibold text-gray-500">{t("card.cost")}: </span>
          €{cost.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
