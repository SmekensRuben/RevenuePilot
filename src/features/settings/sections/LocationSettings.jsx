import React from "react";
import AccordionCard from "../cards/AccordionCard";

export default function LocationSettings({ locations = [], handleAddLocation, handleDeleteLocation }) {
  const handleAdd = async (form) => {
    await handleAddLocation(form);
  };

  return (
    <div>
      <AccordionCard title="Nieuwe locatie toevoegen" defaultOpen={false}>
        <form
          onSubmit={e => {
            e.preventDefault();
            const name = e.target.locationName.value.trim();
            if (name) {
              handleAdd({ name });
              e.target.reset();
            }
          }}
          className="flex gap-2"
        >
          <input
            className="input input-bordered flex-1"
            name="locationName"
            placeholder="Naam locatie"
            required
          />
          <button type="submit" className="btn">
            Toevoegen
          </button>
        </form>
      </AccordionCard>

      {/* Mobiel: cards */}
      <div className="md:hidden flex flex-col gap-3 mt-4">
        {locations.length === 0 ? (
          <div className="text-gray-400 py-4 text-center">Geen locaties</div>
        ) : (
          locations.map(loc => (
            <div
              key={loc.id || loc.name}
              className="bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3 flex flex-col gap-1 relative"
            >
              <div className="font-bold text-base text-gray-900 mb-1">{loc.name}</div>
              <button
                type="button"
                className="absolute top-2 right-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs"
                title="Verwijder"
                onClick={() => handleDeleteLocation(loc.id || loc.name)}
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
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-gray-400">Geen locaties</td>
                </tr>
              ) : (
                locations.map(loc => (
                  <tr key={loc.id || loc.name} className="hover:bg-gray-50 transition">
                    <td className="p-3">{loc.name}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-1 text-xs"
                        title="Verwijder"
                        onClick={() => handleDeleteLocation(loc.id || loc.name)}
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
