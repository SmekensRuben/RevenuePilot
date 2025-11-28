import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";

export default function PriceEditModal({
  open,
  currentPrice,
  onConfirm,
  onCancel,
  title = "Prijs aanpassen",
  confirmLabel = "Opslaan",
}) {
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (open) {
      setPrice(typeof currentPrice === "number" ? currentPrice.toString() : "");
    }
  }, [open, currentPrice]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onCancel} className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <Dialog.Panel className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full mx-4 z-50">
        <Dialog.Title className="text-lg font-semibold mb-4">{title}</Dialog.Title>
        <input
          type="number"
          step="0.01"
          className="border rounded-xl px-3 py-2 w-full mb-4"
          value={price}
          onChange={e => setPrice(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="bg-gray-200 px-4 py-2 rounded-2xl" onClick={onCancel}>
            Annuleren
          </button>
          <button
            type="button"
            className="bg-marriott text-white px-4 py-2 rounded-2xl font-semibold hover:bg-marriott-dark"
            onClick={() => onConfirm(Number(price))}
          >
            {confirmLabel}
          </button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
