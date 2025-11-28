import React from "react";
import AccordionCard from "../cards/AccordionCard";
import AddUnitForm from "../cards/AddUnitForm";

export default function UnitSettings({ units = [], handleAddUnit, handleDeleteUnit }) {
  const handleAdd = async (form) => {
    await handleAddUnit(form);
  };

  return (
    <div>
      <AccordionCard title="Nieuwe eenheid toevoegen" defaultOpen={false}>
        <AddUnitForm onAdd={handleAdd} />
      </AccordionCard>

      {/* Mobiel: cards */}
      <div className="md:hidden flex flex-col gap-3 mt-4">
        {units.length === 0 ? (
          <div className="text-gray-400 py-4 text-center">Geen eenheden</div>
        ) : (
          units.map(unit => (
            <div
              key={unit.id || unit.name}
              className="bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3 flex flex-col gap-1 relative"
            >
              <div className="font-bold text-base text-gray-900 mb-1">{unit.name}</div>
              {unit.abbreviation && (
                <div className="bg-gray-100 rounded px-2 py-0.5 text-sm w-fit">{unit.abbreviation}</div>
              )}
              <button
                type="button"
                className="absolute top-2 right-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs"
                title="Verwijder"
                onClick={() => handleDeleteUnit(unit.id || unit.name)}
              >🗑</button>
            </div>
          ))
        )}
      </div>
      {/* Desktop: tabel */}
      <div className="hidden md:block mt-6">
        <div className="overflow-hidden rounded-xl shadow border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left font-semibold text-gray-700">Naam</th>
                <th className="p-3 text-left font-semibold text-gray-700">Afkorting</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {units.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-400">Geen eenheden</td>
                </tr>
              ) : (
                units.map(unit => (
                  <tr key={unit.id || unit.name} className="hover:bg-gray-50 transition">
                    <td className="p-3">{unit.name}</td>
                    <td className="p-3">{unit.abbreviation}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs"
                        title="Verwijder"
                        onClick={() => handleDeleteUnit(unit.id || unit.name)}
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
