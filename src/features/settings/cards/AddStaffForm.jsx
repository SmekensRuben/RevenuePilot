import React, { useId, useMemo, useState } from "react";

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export default function AddStaffForm({ onAdd, onCancel, canEditHourlyWage = false, contractTypes = [] }) {
  const [form, setForm] = useState({
    name: "",
    job: "",
    department: "",
    email: "",
    contractType: "",
    contractHours: "",
    hourlyWage: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const contractTypeInputId = useId();

  const contractTypeOptions = useMemo(
    () =>
      (Array.isArray(contractTypes) ? contractTypes : [])
        .filter(type => type?.name)
        .map(type => ({
          id: type.id,
          name: type.name,
        })),
    [contractTypes]
  );
  const hasContractTypeOptions = contractTypeOptions.length > 0;

  const reset = () =>
    setForm({
      name: "",
      job: "",
      department: "",
      email: "",
      contractType: "",
      contractHours: "",
      hourlyWage: "",
    });

  const validateEmail = email =>
    !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    if (!form.name) {
      setError("Naam is verplicht.");
      return;
    }
    if (!validateEmail(form.email)) {
      setError("Geef een geldig e-mailadres op.");
      return;
    }
    const contractHoursNumber = form.contractHours ? Number.parseFloat(form.contractHours) : null;
    if (form.contractHours && Number.isNaN(contractHoursNumber)) {
      setError("Contracturen moeten een getal zijn.");
      return;
    }

    const hourlyWageNumber = form.hourlyWage ? Number.parseFloat(form.hourlyWage) : null;
    if (canEditHourlyWage && form.hourlyWage && Number.isNaN(hourlyWageNumber)) {
      setError("Uurloon moet een getal zijn.");
      return;
    }

    setSaving(true);
    try {
      const sanitized = form.name.trim().toLowerCase().replace(/[^a-z0-9]/gi, "_");
      const id = sanitized ? `${sanitized}_${createId()}` : createId();
      await onAdd({
        ...form,
        id,
        job: form.job.trim(),
        contractHours: contractHoursNumber,
        hourlyWage: canEditHourlyWage ? hourlyWageNumber : null,
      });
      reset();
    } catch (err) {
      setError(err.message || "Toevoegen mislukt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="w-full max-w-xl rounded-xl border border-gray-200 bg-white px-4 py-4 shadow"
      onSubmit={handleSubmit}
    >
      <h3 className="mb-4 text-lg font-semibold text-marriott">Nieuw personeelslid toevoegen</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Naam</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="Naam"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Functie</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="Functie (bijv. Chef, Ober)"
          value={form.job}
          onChange={e => setForm(f => ({ ...f, job: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Afdeling</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          placeholder="Afdeling"
          value={form.department}
          onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">E-mail</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          type="email"
          placeholder="E-mail"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700" htmlFor={contractTypeInputId}>
          Contracttype
        </label>
        <select
          id={contractTypeInputId}
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          value={form.contractType}
          onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))}
          disabled={!hasContractTypeOptions}
        >
          <option value="">
            {hasContractTypeOptions ? "Selecteer een contracttype" : "Geen contracttypes beschikbaar"}
          </option>
          {contractTypeOptions.map(option => (
            <option key={option.id} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Contracturen per week</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          type="number"
          min="0"
          step="0.25"
          placeholder="Bijvoorbeeld 38"
          value={form.contractHours}
          onChange={e => setForm(f => ({ ...f, contractHours: e.target.value }))}
        />
      </div>
      {canEditHourlyWage && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Uurloon</label>
          <input
            className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
            type="number"
            min="0"
            step="0.01"
            placeholder="Bijvoorbeeld 15.5"
            value={form.hourlyWage}
            onChange={e => setForm(f => ({ ...f, hourlyWage: e.target.value }))}
          />
        </div>
      )}
      {error && <div className="text-red-600 bg-red-50 px-3 py-2 rounded">{error}</div>}
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
          className="rounded bg-gray-100 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-200"
          onClick={() => {
            reset();
            onCancel?.();
          }}
          disabled={saving}
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
