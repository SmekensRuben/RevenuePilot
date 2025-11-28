import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getEntityFields, clearEntityField } from "../../../services/firebaseBulkEdit";

const ENTITIES = [
  { value: "ingredients", labelKey: "bulkEdit.entities.ingredients" },
  { value: "inventory", labelKey: "bulkEdit.entities.inventory" },
  { value: "products", labelKey: "bulkEdit.entities.products" },
];

export default function BulkEditMappings() {
  const { t } = useTranslation("settings");
  const [entity, setEntity] = useState("");
  const [field, setField] = useState("");
  const [fields, setFields] = useState([]);

  useEffect(() => {
    async function loadFields() {
      if (!entity) {
        setFields([]);
        setField("");
        return;
      }
      const list = await getEntityFields(entity);
      setFields(list);
      setField("");
    }
    loadFields();
  }, [entity]);

  const handleClear = async () => {
    if (!entity || !field) return;
    if (!window.confirm(t("bulkEdit.confirm"))) return;
    await clearEntityField(entity, field);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <select
          value={entity}
          onChange={e => setEntity(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">{t("bulkEdit.selectEntity")}</option>
          {ENTITIES.map(e => (
            <option key={e.value} value={e.value}>{t(e.labelKey)}</option>
          ))}
        </select>

        <select
          value={field}
          onChange={e => setField(e.target.value)}
          className="border rounded px-2 py-1"
          disabled={!fields.length}
        >
          <option value="">{t("bulkEdit.selectField")}</option>
          {fields.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleClear}
        className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={!entity || !field}
      >
        {t("bulkEdit.clearButton")}
      </button>
    </div>
  );
}
