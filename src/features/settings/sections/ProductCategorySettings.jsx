import React from "react";
import AccordionCard from "../cards/AccordionCard";
import AddCategoryForm from "../cards/AddCategoryForm";
import { getProductCategories } from "services/firebaseSettings";

const isFood = cat => cat.type === "food";
const isBeverage = cat => cat.type === "beverage";
const isOther = cat => cat.type === "other";

function enrichWithType(cat) {
  if (cat.type) return cat;
  if (cat.key.startsWith("food_")) return { ...cat, type: "food" };
  if (cat.key.startsWith("beverage_")) return { ...cat, type: "beverage" };
  if (cat.key.startsWith("other_")) return { ...cat, type: "other" };
  return { ...cat, type: "food" };
}

export default function ProductCategorySettings({
  categoryList = [],
  addProductCategory,
  deleteProductCategory,
  setProductCategories
}) {
  const enrichedList = categoryList.map(enrichWithType);

  const handleAdd = async (form) => {
    await addProductCategory(form.key, form.label, form.vat, form.type, form.parentId);
    setProductCategories(await getProductCategories());
  };

  const handleUpdate = async (form) => {
    await addProductCategory(form.key, form.label, form.vat, form.type, form.parentId);
    setProductCategories(await getProductCategories());
  };

  const handleDelete = async (key) => {
    await deleteProductCategory(key);
    setProductCategories(await getProductCategories());
  };

  // Card-style wrapper for mobile
  function CategoryMobileCard({ cat }) {
    const [edit, setEdit] = React.useState(false);
    const [label, setLabel] = React.useState(cat.label);
    const [vat, setVat] = React.useState(cat.vat);
    const [type, setType] = React.useState(cat.type);
    const [parentId, setParentId] = React.useState(cat.parentId || "");
    const [saving, setSaving] = React.useState(false);

    const types = ["food", "beverage", "other"];

    async function handleSave() {
      setSaving(true);
      await handleUpdate({ key: cat.key, label, vat, type, parentId });
      setSaving(false);
      setEdit(false);
    }

    if (edit) {
      return (
        <div className="bg-yellow-50 border border-gray-200 rounded-xl shadow-md px-4 py-3 flex flex-col gap-2 mb-3 relative">
          <input className="border rounded px-2 py-1" value={label} onChange={e => setLabel(e.target.value)} />
          <input type="number" className="border rounded px-2 py-1" value={vat} onChange={e => setVat(e.target.value)} />
          <select className="border rounded px-2 py-1" value={type} onChange={e => setType(e.target.value)}>
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="border rounded px-2 py-1" value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">Geen</option>
            {enrichedList.filter(c => c.key !== cat.key).map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs">Bewaar</button>
            <button onClick={() => setEdit(false)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs">Annuleer</button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3 flex flex-col gap-1 mb-3 relative">
        <div className="font-bold text-base text-gray-900 mb-1">{cat.label}</div>
        <div className="flex flex-wrap gap-2 text-sm mb-1">
          <span className="bg-gray-100 rounded px-2 py-0.5">{cat.key}</span>
          <span className="bg-gray-100 rounded px-2 py-0.5">{cat.vat}%</span>
        </div>
        <div className="flex gap-2 absolute top-2 right-2">
          <button type="button" className="text-marriott bg-gray-100 hover:bg-gray-200 rounded-full p-1 text-xs" title="Bewerk" onClick={() => setEdit(true)}>✎</button>
          <button type="button" className="text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs" title="Verwijder" onClick={() => handleDelete(cat.key)}>🗑</button>
        </div>
      </div>
    );
  }

  // Table row for desktop
  function CategoryRow({ cat }) {
    const [edit, setEdit] = React.useState(false);
    const [label, setLabel] = React.useState(cat.label);
    const [vat, setVat] = React.useState(cat.vat);
    const [type, setType] = React.useState(cat.type);
    const [parentId, setParentId] = React.useState(cat.parentId || "");
    const [saving, setSaving] = React.useState(false);
    const types = ["food", "beverage", "other"];

    async function save() {
      setSaving(true);
      await handleUpdate({ key: cat.key, label, vat, type, parentId });
      setSaving(false);
      setEdit(false);
    }

    if (edit) {
      return (
        <tr className="bg-yellow-50">
          <td className="p-3"><input className="border rounded px-2 py-1" value={label} onChange={e => setLabel(e.target.value)} /></td>
          <td className="p-3">{cat.key}</td>
          <td className="p-3 w-20"><input type="number" className="border rounded px-2 py-1 w-full" value={vat} onChange={e => setVat(e.target.value)} /></td>
          <td className="p-3">
            <select className="border rounded px-2 py-1" value={type} onChange={e => setType(e.target.value)}>
              {types.map(t => (<option key={t} value={t}>{t}</option>))}
            </select>
          </td>
          <td className="p-3">
            <select className="border rounded px-2 py-1" value={parentId} onChange={e => setParentId(e.target.value)}>
              <option value="">Geen</option>
              {enrichedList.filter(c => c.key !== cat.key).map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </td>
          <td className="p-3 flex gap-2">
            <button onClick={save} disabled={saving} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs">Bewaar</button>
            <button onClick={() => setEdit(false)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs">Annuleer</button>
          </td>
        </tr>
      );
    }

    const parentLabel = enrichedList.find(c => c.key === cat.parentId)?.label || "";
    return (
      <tr className="hover:bg-gray-50 transition">
        <td className="p-3">{cat.label}</td>
        <td className="p-3">{cat.key}</td>
        <td className="p-3 w-20">{cat.vat}</td>
        <td className="p-3">{cat.type}</td>
        <td className="p-3">{parentLabel}</td>
        <td className="p-3 flex gap-2">
          <button type="button" className="bg-marriott text-white px-3 py-1 rounded text-xs" onClick={() => setEdit(true)}>Bewerk</button>
          <button type="button" className="text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs" title="Verwijder" onClick={() => handleDelete(cat.key)}>🗑</button>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <AccordionCard title="Nieuwe product-categorie toevoegen" defaultOpen={false}>
        <AddCategoryForm
          onAdd={handleAdd}
          types={["food", "beverage", "other"]}
          parentOptions={enrichedList}
        />
      </AccordionCard>

      {/* FOOD */}
      <div className="mb-6">
        <h3 className="font-semibold text-lg mb-2">Food-categorieën</h3>
        {/* Mobiel: cards */}
        <div className="md:hidden flex flex-col gap-3 mt-2">
          {enrichedList.filter(isFood).map(cat => (
            <CategoryMobileCard key={cat.key} cat={cat} />
          ))}
          {enrichedList.filter(isFood).length === 0 &&
            <div className="text-gray-400 py-2">Geen food-categorieën</div>
          }
        </div>
        {/* Desktop: tabel */}
        <div className="hidden md:block mt-2">
          <div className="overflow-x-auto rounded-xl shadow border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left font-semibold text-gray-700">Label</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Key</th>
                  <th className="p-3 text-left font-semibold text-gray-700 w-20">BTW</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Parent</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {enrichedList.filter(isFood).map(cat => (
                  <CategoryRow key={cat.key} cat={cat} />
                ))}
                {enrichedList.filter(isFood).length === 0 &&
                  <tr><td colSpan={6} className="py-2 text-gray-400 text-center">Geen food-categorieën</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BEVERAGE */}
      <div className="mb-6">
        <h3 className="font-semibold text-lg mb-2">Beverage-categorieën</h3>
        <div className="md:hidden flex flex-col gap-3 mt-2">
          {enrichedList.filter(isBeverage).map(cat => (
            <CategoryMobileCard key={cat.key} cat={cat} />
          ))}
          {enrichedList.filter(isBeverage).length === 0 &&
            <div className="text-gray-400 py-2">Geen beverage-categorieën</div>
          }
        </div>
        <div className="hidden md:block mt-2">
          <div className="overflow-x-auto rounded-xl shadow border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left font-semibold text-gray-700">Label</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Key</th>
                  <th className="p-3 text-left font-semibold text-gray-700 w-20">BTW</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Parent</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {enrichedList.filter(isBeverage).map(cat => (
                  <CategoryRow key={cat.key} cat={cat} />
                ))}
                {enrichedList.filter(isBeverage).length === 0 &&
                  <tr><td colSpan={6} className="py-2 text-gray-400 text-center">Geen beverage-categorieën</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OTHER */}
      <div>
        <h3 className="font-semibold text-lg mb-2">Overige categorieën</h3>
        <div className="md:hidden flex flex-col gap-3 mt-2">
          {enrichedList.filter(isOther).map(cat => (
            <CategoryMobileCard key={cat.key} cat={cat} />
          ))}
          {enrichedList.filter(isOther).length === 0 && (
            <div className="text-gray-400 py-2">Geen overige categorieën</div>
          )}
        </div>
        <div className="hidden md:block mt-2">
          <div className="overflow-x-auto rounded-xl shadow border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left font-semibold text-gray-700">Label</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Key</th>
                  <th className="p-3 text-left font-semibold text-gray-700 w-20">BTW</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Parent</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {enrichedList.filter(isOther).map(cat => (
                  <CategoryRow key={cat.key} cat={cat} />
                ))}
                {enrichedList.filter(isOther).length === 0 && (
                  <tr><td colSpan={6} className="py-2 text-gray-400 text-center">Geen overige categorieën</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
