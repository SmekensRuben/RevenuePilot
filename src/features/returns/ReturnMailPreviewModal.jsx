// src/features/returns/ReturnMailPreviewModal.jsx
import React from "react";

export default function ReturnMailPreviewModal({ open, onCancel, onSend, supplierEmail, subject, body }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
        <h2 className="text-xl font-semibold mb-4">Voorbeeld e-mail aan leverancier</h2>
        <div className="mb-2 text-sm">
          <b>Ontvanger:</b> {supplierEmail}
        </div>
        <div className="mb-2 text-sm">
          <b>Onderwerp:</b> {subject}
        </div>
        <div className="whitespace-pre-line border rounded bg-gray-50 p-3 text-sm mb-4">{body}</div>
        <div className="flex gap-2 justify-end mt-2">
          <button
            className="bg-gray-100 px-4 py-2 rounded-xl text-gray-700"
            onClick={onCancel}
          >
            Annuleren
          </button>
          <button
            className="bg-marriott text-white px-6 py-2 rounded-xl font-semibold hover:bg-marriott-dark"
            onClick={onSend}
          >
            Mail verzenden & retour aanmaken
          </button>
        </div>
      </div>
    </div>
  );
}
