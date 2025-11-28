import React from "react";

export default function IngredientMiniCard({ ingredient, onRemove }) {
  if (!ingredient) return null;
  return (
    <div className="flex items-center gap-2 bg-white border rounded shadow p-2 max-w-full">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center w-full">
          <span className="font-semibold text-sm text-gray-800 truncate">
            {ingredient.name}
          </span>
          {onRemove && (
            <button
              type="button"
              className="text-red-500 hover:text-red-700 ml-2"
              onClick={() => onRemove(ingredient.id)}
            >
              ✕
            </button>
          )}
        </div>
        {ingredient.unit && (
          <div className="text-xs text-gray-500 truncate">{ingredient.unit}</div>
        )}
      </div>
    </div>
  );
}
