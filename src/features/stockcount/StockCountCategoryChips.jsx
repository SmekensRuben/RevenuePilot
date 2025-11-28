import React from "react";

export default function StockCountCategoryChips({ categories, categoryLabels }) {
  if (!categories?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 my-2">
      {categories.map(c => (
        <li
          key={c}
          className="px-3 py-1 rounded-full bg-gray-200 text-marriott font-semibold text-sm"
        >
          {categoryLabels[c] || c}
        </li>
      ))}
    </ul>
  );
}
