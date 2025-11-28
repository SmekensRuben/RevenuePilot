import React, { useState } from "react";

export default function AddCategoryForm({ onAdd, types = ["food", "beverage"], parentOptions = [] }) {
  const defaultType = types[0] || "food";
  const [form, setForm] = useState({
    label: "",
    vat: "",
    type: defaultType,
    parentId: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () =>
    setForm({ label: "", vat: "", type: defaultType, parentId: "" });

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    if (!form.label || !form.vat) {
      setError("Alle velden zijn verplicht.");
      return;
    }
    setSaving(true);
    try {
      // Key genereren (type_label, alles lowercase, spaties => underscores)
      const normLabel = form.label.trim().toLowerCase().replace(/[^a-z0-9]/gi, "_");
      const key = `${form.type}_${normLabel}`;
      await onAdd({ ...form, key });
      reset();
    } catch (e) {
      setError(e.message || "Toevoegen mislukt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="bg-white shadow rounded-xl px-4 py-4 mb-6 max-w-xl w-full flex flex-col gap-3 border border-gray-200"
      onSubmit={handleSubmit}
    >
      <h3 className="font-bold text-lg mb-2 text-marriott">Nieuwe categorie toevoegen</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Label</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="Naam (bv. Groenten)"
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">BTW %</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="BTW (bv. 6)"
          type="number"
          min={0}
          max={100}
          value={form.vat}
          onChange={e => setForm(f => ({ ...f, vat: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Type</label>
        <select
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          value={form.type}
          onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
        >
          {types.map(t => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {parentOptions.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Parent categorie</label>
          <select
            className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
            value={form.parentId}
            onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
          >
            <option value="">Geen</option>
            {parentOptions.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <div className="text-red-600 bg-red-50 px-3 py-2 rounded">{error}</div>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="submit"
          className="bg-marriott text-white px-4 py-2 rounded font-semibold hover:bg-marriott-dark transition"
          disabled={saving}
        >
          {saving ? "Toevoegen..." : "Toevoegen"}
        </button>
        <button
          type="button"
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-200"
          onClick={reset}
          disabled={saving}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
