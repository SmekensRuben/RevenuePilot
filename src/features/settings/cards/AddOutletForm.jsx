import React, { useState } from "react";

export default function AddOutletForm({ onAdd }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    department: "",
    outletId: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [costCenterIds, setCostCenterIds] = useState([]);
  const [costCenterInput, setCostCenterInput] = useState("");

  const reset = () => {
    setForm({ name: "", description: "", department: "", outletId: "" });
    setCostCenterIds([]);
    setCostCenterInput("");
  };

  const handleAddCostCenterId = () => {
    const trimmed = costCenterInput.trim();
    if (!trimmed) return;
    const exists = costCenterIds.some(
      id => id.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setCostCenterInput("");
      return;
    }
    setCostCenterIds(prev => [...prev, trimmed]);
    setCostCenterInput("");
  };

  const handleRemoveCostCenterId = index => {
    setCostCenterIds(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    if (!form.name) {
      setError("Naam is verplicht.");
      return;
    }
    setSaving(true);
    try {
      // Key genereren indien gewenst
      await onAdd({
        ...form,
        name: form.name.trim(),
        department: form.department.trim(),
        description: form.description.trim(),
        outletId: form.outletId.trim(),
        subOutlets: [],
        menuCategories: [],
        costCenterIds,
      });
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
      <h3 className="font-bold text-lg mb-2 text-marriott">Nieuwe outlet toevoegen</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Naam</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="Outletnaam"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Afdeling</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="bv. F&B"
          value={form.department}
          onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Outlet ID</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="Unieke referentie (optioneel)"
          value={form.outletId}
          onChange={e => setForm(f => ({ ...f, outletId: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Beschrijving</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="(optioneel)"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Cost center IDs</label>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
              placeholder="Voeg een cost center ID toe"
              value={costCenterInput}
              onChange={e => setCostCenterInput(e.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddCostCenterId();
                }
              }}
            />
            <button
              type="button"
              className="bg-marriott text-white px-4 py-2 rounded font-semibold hover:bg-marriott-dark"
              onClick={handleAddCostCenterId}
              disabled={!costCenterInput.trim()}
            >
              Voeg toe
            </button>
          </div>
          {costCenterIds.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {costCenterIds.map((id, index) => (
                <li key={`${id}-${index}`} className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded text-sm">
                  <span>{id}</span>
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-800"
                    onClick={() => handleRemoveCostCenterId(index)}
                    aria-label={`Verwijder cost center ${id}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
