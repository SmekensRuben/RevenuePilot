import React, { useEffect, useState } from "react";
import { Combobox } from "components/ui/combobox";

export default function SalesPromoTicketForm({
  outlets = [],
  types = [],
  staff = [],
  onSave,
  onDelete,
  initialData,
}) {
  const formatDate = d => d.toLocaleDateString("en-CA");
  const normalizeChecklist = list => {
    if (!Array.isArray(list)) return [];
    return list
      .map(item => {
        if (typeof item === "string") {
          const trimmed = item.trim();
          return trimmed ? { label: trimmed, checked: false } : null;
        }
        if (item && typeof item === "object") {
          const rawLabel =
            typeof item.label === "string"
              ? item.label
              : typeof item.text === "string"
              ? item.text
              : "";
          const label = rawLabel.trim();
          if (!label) return null;
          return { label, checked: !!item.checked };
        }
        return null;
      })
      .filter(Boolean);
  };

  const defaultForm = {
    date: formatDate(new Date()),
    receiptNumber: "",
    cashier: "",
    type: "",
    outlet: "",
    reason: "",
    checklist: [],
    notInPos: false,
  };

  const [form, setForm] = useState(() => {
    if (!initialData) return { ...defaultForm };
    const { signed: _signed, notInPos = false, ...rest } = initialData || {};
    return {
      ...defaultForm,
      ...rest,
      checklist: normalizeChecklist(initialData.checklist),
      notInPos: !!notInPos,
    };
  });
  const [subOutlets, setSubOutlets] = useState(initialData?.subOutlets || []);
  const [errors, setErrors] = useState({});

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => {
      const updated = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
      return updated;
    });
    setErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleCashierChange = option => {
    const nextValue = option?.value || "";
    setForm(prev => ({
      ...prev,
      cashier: nextValue,
    }));
    setErrors(prev => {
      if (!prev.cashier) return prev;
      if (!nextValue) return prev;
      const next = { ...prev };
      delete next.cashier;
      return next;
    });
  };

  const handleTypeChange = option => {
    const nextValue = option?.value || "";
    setForm(prev => ({
      ...prev,
      type: nextValue,
      checklist: nextValue ? prev.checklist : [],
    }));
    setErrors(prev => {
      if (!prev.type) return prev;
      if (!nextValue) return prev;
      const next = { ...prev };
      delete next.type;
      return next;
    });
  };

  const handleAddSubOutlet = () => {
    setSubOutlets(list => [...list, { name: "", amount: "" }]);
    setErrors(prev => {
      if (!prev.subOutlets) return prev;
      const next = { ...prev };
      delete next.subOutlets;
      return next;
    });
  };

  const handleSubOutletChange = (idx, field, value) => {
    setSubOutlets(list =>
      list.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
    setErrors(prev => {
      if (!prev.subOutlets) return prev;
      const next = { ...prev };
      delete next.subOutlets;
      return next;
    });
  };

  const handleRemoveSubOutlet = idx => {
    setSubOutlets(list => list.filter((_, i) => i !== idx));
  };

  const handleChecklistToggle = index => {
    setForm(prev => ({
      ...prev,
      checklist: (prev.checklist || []).map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      ),
    }));
  };

  const validate = () => {
    const newErrors = {};
    const trimmedReceipt = `${form.receiptNumber || ""}`.trim();
    const trimmedCashier = `${form.cashier || ""}`.trim();
    if (!form.date) {
      newErrors.date = "Date is required.";
    }
    if (!trimmedReceipt) {
      newErrors.receiptNumber = "Receipt number is required.";
    }
    if (!trimmedCashier) {
      newErrors.cashier = "Cashier is required.";
    }
    if (!form.type) {
      newErrors.type = "Type is required.";
    }
    if (!form.outlet) {
      newErrors.outlet = "Outlet is required.";
    }
    const sanitizedSubOutlets = (subOutlets || []).filter(subOutlet => {
      if (!subOutlet) return false;
      const name = `${subOutlet.name || ""}`.trim();
      const amount = `${subOutlet.amount ?? ""}`.trim();
      return !!name && amount !== "";
    });
    if (sanitizedSubOutlets.length === 0) {
      newErrors.subOutlets = "Add at least one suboutlet.";
    }
    return { newErrors, sanitizedSubOutlets, trimmedReceipt, trimmedCashier };
  };

  const handleSubmit = e => {
    e.preventDefault();
    const { newErrors, sanitizedSubOutlets, trimmedReceipt, trimmedCashier } = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    onSave({
      ...form,
      receiptNumber: trimmedReceipt,
      cashier: trimmedCashier,
      subOutlets: sanitizedSubOutlets,
    });
  };

  const currentOutlet = outlets.find(o => o.name === form.outlet);
  const availableSubOutlets = currentOutlet?.subOutlets || [];
  const typeNames = types.map(type => type.name);
  const availableTypeNames =
    form.type && form.type && !typeNames.includes(form.type)
      ? [form.type, ...typeNames]
      : typeNames;
  const typeOptions = availableTypeNames.map(type => ({
    value: type,
    label: type,
  }));
  const staffOptions = staff
    .filter(member => member?.name)
    .map(member => ({
      value: member.name,
      label: member.department ? `${member.department} - ${member.name}` : member.name,
    }));
  const availableCashiers =
    form.cashier && !staffOptions.some(option => option.value === form.cashier)
      ? [{ value: form.cashier, label: form.cashier }, ...staffOptions]
      : staffOptions;
  const selectedCashier =
    availableCashiers.find(option => option.value === form.cashier) || null;
  const selectedTypeOption =
    typeOptions.find(option => option.value === form.type) || null;

  useEffect(() => {
    if (!form.type) return;
    const selectedType = types.find(type => type.name === form.type);
    if (!selectedType) return;
    setForm(prev => {
      const existingMap = new Map(
        (prev.checklist || []).map(item => [item.label, !!item.checked])
      );
      const nextChecklist = (selectedType.checklist || []).map(label => ({
        label,
        checked: existingMap.get(label) || false,
      }));
      return { ...prev, checklist: nextChecklist };
    });
  }, [form.type, types]);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow p-6 mb-4 space-y-4"
    >
      <div className="flex justify-end">
        <label
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 shadow-sm"
        >
          <input
            id="notInPos"
            name="notInPos"
            type="checkbox"
            checked={!!form.notInPos}
            onChange={handleChange}
            className="h-3.5 w-3.5 accent-marriott"
          />
          <span>Not in POS</span>
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="border rounded px-2 py-1 bg-white"
          />
          {errors.date && (
            <span className="text-xs text-red-600">{errors.date}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="receiptNumber">
            Receipt #
          </label>
          <input
            id="receiptNumber"
            type="text"
            name="receiptNumber"
            value={form.receiptNumber}
            onChange={handleChange}
            className="border rounded px-2 py-1 bg-white"
          />
          {errors.receiptNumber && (
            <span className="text-xs text-red-600">{errors.receiptNumber}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="cashier">
            Cashier
          </label>
          <Combobox
            value={selectedCashier}
            onChange={handleCashierChange}
            options={availableCashiers}
            displayValue={option => option?.label || option?.value || ""}
            getOptionValue={option => option?.value || option?.label || ""}
            placeholder="Select cashier"
            id="cashier"
            name="cashier"
            className="border rounded px-2 py-1 bg-white"
            required
          />
          {errors.cashier && (
            <span className="text-xs text-red-600">{errors.cashier}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="type">
            Type
          </label>
          <Combobox
            value={selectedTypeOption}
            onChange={handleTypeChange}
            options={typeOptions}
            displayValue={option => option?.label || ""}
            getOptionValue={option => option?.value || option?.label || ""}
            placeholder="Select type"
            id="type"
            name="type"
            className="border rounded px-2 py-1 bg-white"
            required
          />
          {errors.type && (
            <span className="text-xs text-red-600">{errors.type}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="outlet">
            Outlet
          </label>
          <select
            id="outlet"
            name="outlet"
            value={form.outlet}
            onChange={handleChange}
            className="border rounded px-2 py-1 bg-white"
          >
            <option value="">Select outlet</option>
            {outlets.map(o => (
              <option key={o.name} value={o.name}>
                {o.name}
              </option>
            ))}
          </select>
          {errors.outlet && (
            <span className="text-xs text-red-600">{errors.outlet}</span>
          )}
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-sm font-medium">Suboutlets</label>
          {subOutlets.map((s, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <select
                value={s.name}
                onChange={e =>
                  handleSubOutletChange(idx, "name", e.target.value)
                }
                className="border rounded px-2 py-1 flex-1 bg-white"
              >
                <option value="">Select suboutlet</option>
                {availableSubOutlets.map(sub => (
                  <option key={sub.name} value={sub.name}>
                    {sub.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={s.amount}
                onChange={e =>
                  handleSubOutletChange(idx, "amount", e.target.value)
                }
                className="border rounded px-2 py-1 w-24 bg-white"
                placeholder="€"
              />
              <button
                type="button"
                onClick={() => handleRemoveSubOutlet(idx)}
                className="text-red-600"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddSubOutlet}
            className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-sm w-fit"
          >
            Add suboutlet
          </button>
          {errors.subOutlets && (
            <span className="text-xs text-red-600">{errors.subOutlets}</span>
          )}
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="reason">
            Reason
          </label>
          <textarea
            id="reason"
            name="reason"
            value={form.reason}
            onChange={handleChange}
            className="border rounded px-2 py-1 bg-white"
          />
        </div>
        {form.checklist?.length > 0 && (
          <div className="md:col-span-2 flex flex-col gap-2">
            <span className="text-sm font-medium">Checklist</span>
            <div className="flex flex-col gap-2">
              {form.checklist.map((item, index) => (
                <label key={item.label} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!item.checked}
                    onChange={() => handleChecklistToggle(index)}
                    className="h-4 w-4"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-marriott text-white px-3 py-1 rounded text-sm"
        >
          Save
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}


