import React, { useState } from "react";
import { Combobox } from "components/ui/combobox";

export default function SalesPromoProductCard({
  item,
  products = [],
  categories = [],
  onSave,
  onDelete,
}) {
  const findProduct = id =>
    products.find(p => p.id === id || String(p.lightspeedId) === String(id));

  const [edit, setEdit] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(() =>
    findProduct(item.productId)
  );
  const [appliesTo, setAppliesTo] = useState(item.appliesTo || []);
  const [appliesToProducts, setAppliesToProducts] = useState(
    (item.appliesToProducts || []).map(pid => findProduct(pid)).filter(Boolean)
  );
  const [percentage, setPercentage] = useState(item.percentage ?? 0);
  const [specific, setSpecific] = useState(!!item.specificProduct);
  const [checklist, setChecklist] = useState(item.checklist || []);
  const [checkItem, setCheckItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleCategory = key => {
    setAppliesTo(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSave = async e => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSaving(true);
    await onSave({
      productId: selectedProduct.lightspeedId || selectedProduct.id,
      appliesTo,
      appliesToProducts: appliesToProducts.map(
        p => p.lightspeedId || p.id
      ),
      percentage: Number(percentage) || 0,
      specificProduct: specific,
      checklist,
    });
    setSaving(false);
    setEdit(false);
  };

  const addCheckItem = () => {
    const trimmed = checkItem.trim();
    if (!trimmed) return;
    setChecklist(list => [...list, trimmed]);
    setCheckItem("");
  };

  const removeCheckItem = idx =>
    setChecklist(list => list.filter((_, i) => i !== idx));

  if (edit) {
    return (
      <div className="bg-yellow-50 rounded-xl shadow px-4 py-3 mb-3 flex flex-col gap-2 relative">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Product</label>
          <Combobox
            value={selectedProduct}
            onChange={setSelectedProduct}
            options={products}
            displayValue={p => p.name}
            getOptionValue={p => p.id}
            placeholder="Kies product"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Applies to categorieën</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <label key={cat.key} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={appliesTo.includes(cat.key)}
                  onChange={() => toggleCategory(cat.key)}
                />
                <span>{cat.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Applies to producten</label>
          <Combobox
            value={null}
            onChange={prod => {
              if (!prod) return;
              setAppliesToProducts(prev =>
                prev.some(p => (p.id || p.lightspeedId) === (prod.id || prod.lightspeedId))
                  ? prev
                  : [...prev, prod]
              );
            }}
            options={products}
            displayValue={p => p.name}
            getOptionValue={p => p.id}
            placeholder="Kies product om toe te voegen"
          />
          {appliesToProducts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {appliesToProducts.map(prod => (
                <span key={prod.id || prod.lightspeedId} className="bg-gray-100 rounded px-2 py-0.5 flex items-center gap-1">
                  {prod.name}
                  <button type="button" onClick={() => setAppliesToProducts(prev => prev.filter(p => (p.id || p.lightspeedId) !== (prod.id || prod.lightspeedId)))}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Percentage</label>
          <input
            type="number"
            min={0}
            max={100}
            value={percentage}
            onChange={e => setPercentage(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={specific}
            onChange={e => setSpecific(e.target.checked)}
          />
          <span>Specifiek product</span>
        </label>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Checklist</label>
          <div className="flex gap-2">
            <input
              className="border rounded px-2 py-1 flex-1"
              value={checkItem}
              onChange={e => setCheckItem(e.target.value)}
              placeholder="Voeg item toe"
            />
            <button type="button" onClick={addCheckItem} className="px-2 rounded bg-gray-200">+</button>
          </div>
          {checklist.length > 0 && (
            <ul className="list-disc ml-6 mt-1">
              {checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-1">
                  {c}
                  <button type="button" onClick={() => removeCheckItem(i)} className="text-red-600">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2 mt-2">
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

  const prod = selectedProduct || findProduct(item.productId) || { name: item.productId };
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3 flex flex-col gap-1 relative mb-3">
      <div className="font-bold text-base text-gray-900 mb-1">{prod.name}</div>
      <div className="text-sm mb-1">
        <span className="mr-2">{percentage}%</span>
        <span>{specific ? "Specifiek" : "Algemeen"}</span>
      </div>
      {checklist.length > 0 && (
        <div className="text-sm mb-1 flex flex-wrap gap-1">
          {checklist.map((c, i) => (
            <span key={i} className="bg-gray-100 rounded px-2 py-0.5">{c}</span>
          ))}
        </div>
      )}
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
              onClick={() => onDelete(item.productId)}
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
