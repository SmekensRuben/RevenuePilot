import React from "react";
import AccordionCard from "../cards/AccordionCard";
import AddCategoryMappingForm from "../cards/AddCategoryMappingForm";

export default function CategoryMappingSettings({
  categories = [],
  productCategoryList = [],
  mappings = {},
  addMapping,
  updateMapping,
  deleteMapping,
}) {
  const categoriesByKey = Object.fromEntries(categories.map(c => [c.key, c]));
  const productByKey = Object.fromEntries(productCategoryList.map(c => [c.key, c]));

  const handleAdd = async ({ category, productCategory }) => {
    await addMapping(productCategory, category);
  };

  const handleUpdate = async (pcKey, catKey) => {
    await updateMapping(pcKey, catKey);
  };

  const handleDelete = async pcKey => {
    await deleteMapping(pcKey);
  };

  function MappingRow({ pcKey, catKey }) {
    const [edit, setEdit] = React.useState(false);
    const [category, setCategory] = React.useState(catKey);

    if (edit) {
      return (
        <tr className="bg-yellow-50">
          <td className="p-3">{productByKey[pcKey]?.label || pcKey}</td>
          <td className="p-3">
            <select className="border rounded px-2 py-1" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Geen</option>
              {categories.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </td>
          <td className="p-3 flex gap-2">
            <button onClick={() => { handleUpdate(pcKey, category); setEdit(false); }} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs">Bewaar</button>
            <button onClick={() => setEdit(false)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs">Annuleer</button>
          </td>
        </tr>
      );
    }

    return (
      <tr className="hover:bg-gray-50">
        <td className="p-3">{productByKey[pcKey]?.label || pcKey}</td>
        <td className="p-3">{categoriesByKey[catKey]?.label || catKey}</td>
        <td className="p-3 flex gap-2">
          <button onClick={() => setEdit(true)} className="bg-marriott text-white px-3 py-1 rounded text-xs">Bewerk</button>
          <button onClick={() => handleDelete(pcKey)} className="text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs" title="Verwijder">🗑</button>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <AccordionCard title="Nieuwe mapping toevoegen" defaultOpen={false}>
        <AddCategoryMappingForm
          categories={categories}
          productCategories={productCategoryList}
          onAdd={handleAdd}
        />
      </AccordionCard>

      <div className="hidden md:block mt-2">
        <div className="overflow-x-auto rounded-xl shadow border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left font-semibold text-gray-700">Product-categorie</th>
                <th className="p-3 text-left font-semibold text-gray-700">Categorie</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mappings).map(([pcKey, catKey]) => (
                <MappingRow key={pcKey} pcKey={pcKey} catKey={catKey} />
              ))}
              {Object.keys(mappings).length === 0 && (
                <tr><td colSpan="3" className="py-2 text-gray-400 text-center">Geen mappings</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden flex flex-col gap-3 mt-4">
        {Object.entries(mappings).map(([pcKey, catKey]) => (
          <div key={pcKey} className="bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3 flex flex-col gap-1 mb-3">
            <div className="font-bold text-base text-gray-900 mb-1">{productByKey[pcKey]?.label || pcKey}</div>
            <div className="text-sm mb-2">{categoriesByKey[catKey]?.label || catKey}</div>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(pcKey)} className="text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs" title="Verwijder">🗑</button>
            </div>
          </div>
        ))}
        {Object.keys(mappings).length === 0 && (
          <div className="text-gray-400 py-2">Geen mappings</div>
        )}
      </div>
    </div>
  );
}
