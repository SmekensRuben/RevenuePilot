import React from "react";
import AccordionCard from "../cards/AccordionCard";
import AddSupplierForm from "../cards/AddSupplierForm";
import SupplierCard from "../cards/SupplierCard";

export default function SupplierSettings({
  suppliers = [],
  handleAddSupplier,
  handleUpdateSupplier,
  handleDeleteSupplier
}) {
  const handleAdd = async (form) => {
    await handleAddSupplier(form);
  };

  return (
    <div>
      <AccordionCard title="Nieuwe leverancier toevoegen" defaultOpen={false}>
        <AddSupplierForm onAdd={handleAdd} />
      </AccordionCard>

      {/* MOBILE: cards */}
      <div className="md:hidden flex flex-col gap-3 mt-4">
        {suppliers.length === 0 ? (
          <div className="text-gray-400 py-4 text-center">Geen leveranciers</div>
        ) : (
          suppliers.map(supplier => (
            <div
              key={supplier.name}
              className="bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3 flex flex-col gap-1 relative"
            >
              <div className="font-bold text-base text-gray-900 mb-1">{supplier.name}</div>
              <div className="flex flex-wrap gap-2 text-sm mb-1">
                {supplier.customerNr && (
                  <span className="bg-gray-100 rounded px-2 py-0.5">{supplier.customerNr}</span>
                )}
                {supplier.email && (
                  <span className="bg-gray-100 rounded px-2 py-0.5">{supplier.email}</span>
                )}
              </div>
              <button
                type="button"
                className="absolute top-2 right-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs"
                title="Verwijder"
                onClick={() => handleDeleteSupplier(supplier.name)}
              >🗑</button>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP: tabel */}
      <div className="hidden md:block mt-6">
        <div className="overflow-hidden rounded-xl shadow border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left font-semibold text-gray-700">Naam</th>
                <th className="p-3 text-left font-semibold text-gray-700">Klantnr</th>
                <th className="p-3 text-left font-semibold text-gray-700">E-mail</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">Geen leveranciers</td>
                </tr>
              ) : (
                suppliers.map(supplier => (
                  <tr key={supplier.name} className="hover:bg-gray-50 transition">
                    <td className="p-3">{supplier.name}</td>
                    <td className="p-3">{supplier.customerNr}</td>
                    <td className="p-3">{supplier.email}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs"
                        title="Verwijder"
                        onClick={() => handleDeleteSupplier(supplier.name)}
                      >🗑</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
