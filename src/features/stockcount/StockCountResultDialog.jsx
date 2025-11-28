// src/features/stockcount/StockCountResultDialog.jsx
import React from "react";

export default function StockCountResultDialog({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h2 className="text-xl font-bold mb-3">Stocktake completed</h2>
      <p>All locations have been counted and inventory has been updated.</p>
      <button onClick={onClose} className="mt-5 bg-marriott text-white px-4 py-2 rounded-xl">
        Close
      </button>
    </div>
  );
}
