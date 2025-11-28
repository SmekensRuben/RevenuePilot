import React, { useState } from "react";

export default function AddCategoryMappingForm({ categories = [], productCategories = [], onAdd }) {
  const [form, setForm] = useState({ category: "", productCategory: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => setForm({ category: "", productCategory: "" });

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    if (!form.category || !form.productCategory) {
      setError("Beide velden zijn verplicht.");
      return;
    }
    setSaving(true);
    try {
      await onAdd(form);
      reset();
    } catch (err) {
      setError(err.message || "Toevoegen mislukt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="bg-white shadow rounded-xl px-4 py-4 mb-6 max-w-xl w-full flex flex-col gap-3 border border-gray-200"
      onSubmit={handleSubmit}
    >
      <h3 className="font-bold text-lg mb-2 text-marriott">Nieuwe mapping toevoegen</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Product-categorie</label>
        <select
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          value={form.productCategory}
          onChange={e => setForm(f => ({ ...f, productCategory: e.target.value }))}
        >
          <option value="">Kies product-categorie</option>
          {productCategories.map(pc => (
            <option key={pc.key} value={pc.key}>{pc.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Categorie</label>
        <select
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        >
          <option value="">Kies categorie</option>
          {categories.map(cat => (
            <option key={cat.key} value={cat.key}>{cat.label}</option>
          ))}
        </select>
      </div>
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
