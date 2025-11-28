// src/features/stockcount/StockCountStartModal.jsx
import React, { useState, useEffect } from "react";
import { useHotelContext } from "contexts/HotelContext";
import { startNewTelling } from "./stockCountService";
import { db, doc, getDoc } from "../../firebaseConfig";
import { getLocations } from "services/firebaseSettings"; // <-- Importeer de service

// Utility: split array in 2 kolommen
function splitInColumns(arr) {
  const half = Math.ceil(arr.length / 2);
  return [arr.slice(0, half), arr.slice(half)];
}

export default function StockCountStartModal({ onSuccess, onClose }) {
  const { hotelUid } = useHotelContext();
  const [saving, setSaving] = useState(false);
  const [beverageCats, setBeverageCats] = useState([]);
  const [foodCats, setFoodCats] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [locations, setLocations] = useState([]); // <-- Toegevoegd

  useEffect(() => {
    async function fetchCategories() {
      if (!hotelUid) return;
      const settingsDoc = doc(db, `hotels/${hotelUid}/settings`, hotelUid);
      const snap = await getDoc(settingsDoc);
      if (snap.exists() && snap.data().categories) {
        const allCats = snap.data().categories;
        const bev = [];
        const food = [];
        Object.entries(allCats).forEach(([key, val]) => {
          if (key.startsWith("beverage_")) bev.push({ key, label: val.label });
          else if (key.startsWith("food_")) food.push({ key, label: val.label });
        });
        bev.sort((a, b) => a.label.localeCompare(b.label));
        food.sort((a, b) => a.label.localeCompare(b.label));
        setBeverageCats(bev);
        setFoodCats(food);
      }
    }
    fetchCategories();
  }, [hotelUid]);

  // Haal locaties op uit settings
  useEffect(() => {
    async function fetchLocs() {
      if (!hotelUid) return;
      const locs = await getLocations(hotelUid);
      setLocations(locs.map(l => l.name));
    }
    fetchLocs();
  }, [hotelUid]);

  const handleStart = async () => {
    if (!selectedCategories.length) return;
    setSaving(true);
    const tellingId = await startNewTelling(hotelUid, selectedCategories, locations);
    setSaving(false);
    onSuccess(tellingId);
  };

  const [bevCol1, bevCol2] = splitInColumns(beverageCats);
  const [foodCol1, foodCol2] = splitInColumns(foodCats);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-xl w-full shadow">
        <h2 className="font-bold text-xl mb-4">Nieuwe telling starten</h2>
        <p className="mb-4">Selecteer de categorieën die je deze telling wil opnemen.</p>

        <div className="mb-7">
          <div className="text-sm font-bold mb-2 text-marriott">Dranken</div>
          <div className="grid grid-cols-2 gap-2">
            {[bevCol1, bevCol2].map((col, i) => (
              <div key={i} className="flex flex-col gap-2">
                {col.map(({ key, label }) => (
                  <label key={key} className="px-3 py-1 bg-gray-100 rounded-full cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={key}
                      checked={selectedCategories.includes(key)}
                      onChange={e =>
                        setSelectedCategories(s =>
                          e.target.checked
                            ? [...s, key]
                            : s.filter(x => x !== key)
                        )
                      }
                    />
                    <span className="capitalize">{label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-bold mb-2 text-[#2d2a6e]">Food</div>
          <div className="grid grid-cols-2 gap-2">
            {[foodCol1, foodCol2].map((col, i) => (
              <div key={i} className="flex flex-col gap-2">
                {col.map(({ key, label }) => (
                  <label key={key} className="px-3 py-1 bg-gray-100 rounded-full cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={key}
                      checked={selectedCategories.includes(key)}
                      onChange={e =>
                        setSelectedCategories(s =>
                          e.target.checked
                            ? [...s, key]
                            : s.filter(x => x !== key)
                        )
                      }
                    />
                    <span className="capitalize">{label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-8">
          <button
            className="px-4 py-2 rounded bg-gray-100"
            onClick={onClose}
            disabled={saving}
          >
            Annuleren
          </button>
          <button
            className="px-6 py-2 rounded bg-marriott text-white font-bold"
            onClick={handleStart}
            disabled={saving || !selectedCategories.length || !locations.length}
            title={locations.length === 0 ? "Geen locaties gevonden" : undefined}
          >
            {saving ? "Starten..." : "Start nieuwe telling"}
          </button>
        </div>
      </div>
    </div>
  );
}
