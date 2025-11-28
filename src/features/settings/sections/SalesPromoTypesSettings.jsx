import React, { useState } from "react";
import AccordionCard from "../cards/AccordionCard";

export default function SalesPromoTypesSettings({
  types = [],
  handleAddType = async () => {},
  handleDeleteType = async () => {},
  handleUpdateType = async () => {},
}) {
  const [newType, setNewType] = useState("");
  const [error, setError] = useState("");
  const [checklistInputs, setChecklistInputs] = useState({});

  const onSubmit = async event => {
    event.preventDefault();
    const trimmed = newType.trim();
    if (!trimmed) return;
    if (
      types.some(type => type.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setError("Type bestaat al.");
      return;
    }
    try {
      await handleAddType(trimmed);
      setNewType("");
      setError("");
    } catch (err) {
      setError(err?.message || "Toevoegen mislukt.");
    }
  };

  const onDelete = async typeName => {
    try {
      await handleDeleteType(typeName);
      setChecklistInputs(prev => {
        const next = { ...prev };
        delete next[typeName];
        return next;
      });
      setError("");
    } catch (err) {
      setError(err?.message || "Verwijderen mislukt.");
    }
  };

  const handleChecklistInputChange = (typeName, value) => {
    setChecklistInputs(prev => ({ ...prev, [typeName]: value }));
    if (error) setError("");
  };

  const handleAddChecklistItem = async typeName => {
    const trimmed = (checklistInputs[typeName] || "").trim();
    if (!trimmed) return;
    const type = types.find(t => t.name === typeName);
    if (!type) return;
    const exists = (type.checklist || []).some(
      item => item.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setError(`Checklist item bestaat al voor ${typeName}.`);
      return;
    }
    try {
      await handleUpdateType({
        ...type,
        checklist: [...(type.checklist || []), trimmed],
      });
      setChecklistInputs(prev => ({ ...prev, [typeName]: "" }));
      setError("");
    } catch (err) {
      setError(err?.message || "Toevoegen mislukt.");
    }
  };

  const handleRemoveChecklistItem = async (typeName, index) => {
    const type = types.find(t => t.name === typeName);
    if (!type) return;
    try {
      await handleUpdateType({
        ...type,
        checklist: (type.checklist || []).filter((_, i) => i !== index),
      });
      setError("");
    } catch (err) {
      setError(err?.message || "Verwijderen mislukt.");
    }
  };

  return (
    <div>
      <AccordionCard title="Nieuw Sales & Promo type" defaultOpen={false}>
        <form
          onSubmit={onSubmit}
          className="flex flex-col md:flex-row gap-2 md:items-center"
        >
          <input
            className="input input-bordered flex-1"
            value={newType}
            onChange={e => {
              setNewType(e.target.value);
              if (error) setError("");
            }}
            placeholder="Naam van het type"
            required
          />
          <button type="submit" className="btn">
            Toevoegen
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </AccordionCard>

      <div className="mt-6">
        {types.length === 0 ? (
          <div className="text-gray-400 py-8 text-center border border-dashed border-gray-300 rounded-xl">
            Geen types
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {types.map(type => (
              <div
                key={type.name}
                className="bg-white border border-gray-200 rounded-xl shadow px-4 py-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {type.name}
                  </h3>
                  <button
                    type="button"
                    className="text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs"
                    title="Verwijder"
                    onClick={() => onDelete(type.name)}
                  >
                    🗑
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    Checklist
                  </span>
                  {(type.checklist || []).length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Geen checklist items
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {type.checklist.map((item, index) => (
                        <li
                          key={`${type.name}-${index}`}
                          className="bg-gray-100 rounded-full px-3 py-1 text-sm flex items-center gap-2"
                        >
                          <span>{item}</span>
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleRemoveChecklistItem(type.name, index)}
                            aria-label={`Verwijder ${item}`}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="border rounded px-3 py-1 flex-1"
                    placeholder="Voeg checklist item toe"
                    value={checklistInputs[type.name] || ""}
                    onChange={e =>
                      handleChecklistInputChange(type.name, e.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded"
                    onClick={() => handleAddChecklistItem(type.name)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
