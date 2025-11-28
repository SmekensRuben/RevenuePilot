// src/features/stockcount/ConfirmAllButton.jsx
import React from "react";

export default function ConfirmAllButton({ ready, onConfirm, disabled }) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        className="bg-green-600 text-white px-8 py-2 rounded-xl font-semibold"
        disabled={!ready || disabled}
        onClick={onConfirm}
      >
        All locations counted — Confirm final stocktake
      </button>
    </div>
  );
}
