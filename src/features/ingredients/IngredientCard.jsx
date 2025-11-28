import React from "react";
import { useTranslation } from "react-i18next";
import { ALLERGENS, ALLERGEN_ICONS } from "../../constants/allergens";

export default function IngredientCard({ ingredient, categories = {}, onClick }) {
  const { t } = useTranslation("ingredients");
  return (
    <div
      className="flex flex-col bg-white rounded-2xl shadow-md px-4 py-4 mb-2 cursor-pointer transition hover:shadow-lg"
      onClick={onClick}
    >
      <div className="font-bold text-base text-gray-900 mb-1">{ingredient.name}</div>
      <div className="text-sm text-gray-700">{ingredient.unit}</div>
      <div className="text-sm text-gray-700">
        {t("category")}: {categories[ingredient.category]?.label || ingredient.category}
      </div>
      <div className="text-sm text-gray-700">
        {t("articles")}: {(ingredient.articles && ingredient.articles.length) || 0}
      </div>
      {ingredient.allergens && Object.values(ingredient.allergens).some(v => v) && (
        <div className="flex gap-1 flex-wrap mt-1">
          {ALLERGENS.filter(a => ingredient.allergens?.[a]).map(a => {
            const Icon = ALLERGEN_ICONS[a];
            return <Icon key={a} className="w-4 h-4" title={t(`allergens.${a}`)} />;
          })}
        </div>
      )}
    </div>
  );
}
