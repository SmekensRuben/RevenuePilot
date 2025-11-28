import React, { useState } from "react";
import { Combobox } from "components/ui/combobox";

export default function AddSalesPromoProductForm({ onAdd, products = [], categories = [] }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [appliesTo, setAppliesTo] = useState([]);
  const [appliesToProducts, setAppliesToProducts] = useState([]);
  const [percentage, setPercentage] = useState("");
  const [specific, setSpecific] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [checkItem, setCheckItem] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const reset = () => {
    setSelectedProduct(null);
    setAppliesTo([]);
    setAppliesToProducts([]);
    setPercentage("");
    setSpecific(false);
    setChecklist([]);
    setCheckItem("");
  };

  const handleToggleCategory = key => {
    setAppliesTo(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    if (!selectedProduct) {
      setError("Selecteer een product.");
      return;
    }
    setSaving(true);
    try {
      const prodId = selectedProduct.lightspeedId || selectedProduct.id || selectedProduct;
      await onAdd({
        productId: prodId,
        appliesTo,
        appliesToProducts: appliesToProducts.map(p => p.lightspeedId || p.id || p),
        percentage: Number(percentage) || 0,
        specificProduct: specific,
        checklist,
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
      className="bg-white shadow rounded-xl px-4 py-4 mb-6 max-w-xl w-full flex flex-col gap-3 border border-gray-200"
      onSubmit={handleSubmit}
    >
      <h3 className="font-bold text-lg mb-2 text-marriott">Sales & Promo product toevoegen</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Product</label>
        <Combobox
          value={selectedProduct}
          onChange={setSelectedProduct}
          options={products}
          displayValue={opt => opt.name}
          getOptionValue={opt => opt.id}
          placeholder="Kies product"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          className="text-sm font-medium text-gray-700 flex items-center gap-1"
          onClick={() => setShowCategories(o => !o)}
        >
          {showCategories ? "▼" : "▶"} Applies to categorieën
        </button>
        {showCategories && (
          <div className="flex flex-col gap-2">
            <div>
              <div className="font-medium text-sm mb-1">Food</div>
              <div className="flex flex-wrap gap-2">
                {categories.filter(c => c.type === "food").map(cat => (
                  <label key={cat.key} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={appliesTo.includes(cat.key)}
                      onChange={() => handleToggleCategory(cat.key)}
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium text-sm mb-1 mt-2">Beverage</div>
              <div className="flex flex-wrap gap-2">
                {categories.filter(c => c.type === "beverage").map(cat => (
                  <label key={cat.key} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={appliesTo.includes(cat.key)}
                      onChange={() => handleToggleCategory(cat.key)}
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Applies to producten</label>
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
          displayValue={opt => opt.name}
          getOptionValue={opt => opt.id}
          placeholder="Kies product om toe te voegen"
        />
        {appliesToProducts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {appliesToProducts.map(prod => (
              <span key={prod.id || prod.lightspeedId} className="bg-gray-100 rounded px-2 py-0.5 flex items-center gap-1">
                {prod.name}
                <button type="button" onClick={() => setAppliesToProducts(prev => prev.filter(p => (p.id || p.lightspeedId) !== (prod.id || prod.lightspeedId)))}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Percentage</label>
        <input
          className="border rounded px-3 py-2 outline-marriott focus:ring-2 focus:ring-marriott/30"
          type="number"
          min={0}
          max={100}
          value={percentage}
          onChange={e => setPercentage(e.target.value)}
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
        <label className="text-sm font-medium text-gray-700">Checklist</label>
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-1 flex-1"
            value={checkItem}
            onChange={e => setCheckItem(e.target.value)}
            placeholder="Voeg item toe"
          />
          <button
            type="button"
            className="bg-gray-200 px-2 rounded"
            onClick={() => {
              const t = checkItem.trim();
              if (t) { setChecklist(c => [...c, t]); setCheckItem(""); }
            }}
          >+</button>
        </div>
        {checklist.length > 0 && (
          <ul className="list-disc ml-6 mt-1">
            {checklist.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {c}
                <button type="button" onClick={() => setChecklist(list => list.filter((_,idx) => idx !== i))} className="text-red-600">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
