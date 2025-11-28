// src/features/settings/SupplierRow.jsx
import React, { useState } from "react";

export default function SupplierRow({ supplier, onSave, onDelete }) {
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
      <tr className="bg-yellow-50">
        <td className="px-3 py-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="border rounded px-2 py-1 w-full" />
        </td>
        <td className="px-3 py-2">
          <input type="text" value={customerNr} onChange={e => setCustomerNr(e.target.value)} className="border rounded px-2 py-1 w-full" />
        </td>
        <td className="px-3 py-2">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border rounded px-2 py-1 w-full" />
        </td>
        <td className="px-3 py-2 flex gap-2">
          <button onClick={handleSave} disabled={saving} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs">Bewaar</button>
          <button onClick={() => setEdit(false)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs">Annuleer</button>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td className="px-3 py-2">{supplier.name}</td>
      <td className="px-3 py-2">{supplier.customerNr}</td>
      <td className="px-3 py-2">
        <a href={`mailto:${supplier.email}`}>{supplier.email}</a>
      </td>
      <td className="px-3 py-2 flex gap-2">
        <button onClick={() => setEdit(true)} className="bg-marriott text-white px-3 py-1 rounded text-xs">Bewerk</button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="bg-red-500 text-white px-3 py-1 rounded text-xs" title="Verwijderen">🗑</button>
        ) : (
          <span className="flex gap-1 items-center">
            <button onClick={onDelete} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Ja</button>
            <button onClick={() => setConfirmDelete(false)} className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">Nee</button>
          </span>
        )}
      </td>
    </tr>
  );
}
