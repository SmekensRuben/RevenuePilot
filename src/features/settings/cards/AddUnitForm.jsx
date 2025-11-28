import React, { useState } from "react";

export default function AddUnitForm({ onAdd }) {
  const [form, setForm] = useState({
    name: "",
    abbreviation: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () =>
    setForm({ name: "", abbreviation: "" });

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    if (!form.name) {
      setError("Naam is verplicht.");
      return;
    }
    setSaving(true);
    try {
      await onAdd({ ...form });
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
      <h3 className="font-bold text-lg mb-2 text-marriott">Nieuwe eenheid toevoegen</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Naam</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="Eenheid (bv. kilo, liter)"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Afkorting</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="(bv. kg, l, st)"
          value={form.abbreviation}
          onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))}
        />
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
