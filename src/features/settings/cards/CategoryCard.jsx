import React from "react";

export default function CategoryCard({ category, onDelete }) {
  return (
    <div className="bg-white rounded-xl shadow px-4 py-3 mb-3 flex flex-col gap-1 relative">
      <div className="font-bold text-base text-gray-900 mb-1">{category.label}</div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="bg-gray-100 rounded px-2 py-0.5">{category.key}</span>
        <span className="bg-blue-100 text-blue-700 rounded px-2 py-0.5">{category.vat}% BTW</span>
      </div>
      <button
        type="button"
        className="absolute top-2 right-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs"
        title="Verwijder"
        onClick={() => onDelete(category.key)}
      >🗑</button>
    </div>
  );
}
