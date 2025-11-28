import React, { useState } from "react";

export default function SupplierCard({ supplier, onSave, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(supplier.name);
  const [customerNr, setCustomerNr] = useState(supplier.customerNr || "");
  const [email, setEmail] = useState(supplier.email || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ name, customerNr, email });
    setSaving(false);
    setEdit(false);
  }

  if (edit) {
    return (
      <div className="bg-yellow-50 rounded-xl shadow px-4 py-3 mb-3 flex flex-col gap-2 relative">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="Naam"
        />
        <input
          type="text"
          value={customerNr}
          onChange={e => setCustomerNr(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="Klantnr"
        />
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="E-mail"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 text-white px-3 py-1 rounded text-xs"
          >Bewaar</button>
          <button
            onClick={() => setEdit(false)}
            className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs"
          >Annuleer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow px-4 py-3 mb-3 flex flex-col gap-1 relative">
      <div className="font-bold text-base text-gray-900 mb-1">{supplier.name}</div>
      <div className="flex flex-wrap gap-2 text-sm mb-2">
        <span className="bg-gray-100 rounded px-2 py-0.5">{supplier.customerNr}</span>
        <a
          href={`mailto:${supplier.email}`}
          className="bg-blue-100 text-blue-700 rounded px-2 py-0.5"
        >{supplier.email}</a>
      </div>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          className="bg-marriott text-white px-3 py-1 rounded text-xs"
          onClick={() => setEdit(true)}
        >Bewerk</button>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="bg-red-500 text-white px-3 py-1 rounded text-xs"
            title="Verwijderen"
          >🗑</button>
        ) : (
          <span className="flex gap-1 items-center">
            <button
              onClick={() => onDelete(supplier.name)}
              className="bg-red-600 text-white px-2 py-1 rounded text-xs"
            >Ja</button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs"
            >Nee</button>
          </span>
        )}
      </div>
    </div>
  );
}
