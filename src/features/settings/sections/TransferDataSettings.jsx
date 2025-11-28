import React, { useState } from "react";
import { useHotelContext } from "contexts/HotelContext";
import {
  transferArticles,
  transferIngredients,
  transferSettings,
  transferProducts,
} from "services/firebaseDataTransfer";

export default function TransferDataSettings() {
  const { hotelUid, hotelUids } = useHotelContext();
  const otherHotels = hotelUids.filter(uid => uid !== hotelUid);
  const [targetHotel, setTargetHotel] = useState("");

  const handleTransfer = async type => {
    if (!targetHotel) {
      alert("Selecteer een doelhotel.");
      return;
    }
    if (!window.confirm(`Wil je ${type} kopiëren naar ${targetHotel}?`)) return;
    try {
      if (type === "articles") await transferArticles(hotelUid, targetHotel);
      if (type === "ingredients") await transferIngredients(hotelUid, targetHotel);
      if (type === "settings") await transferSettings(hotelUid, targetHotel);
      if (type === "products") await transferProducts(hotelUid, targetHotel);
      alert("Transfer voltooid");
    } catch (err) {
      console.error(err);
      alert("Transfer mislukt");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-bold mb-4">Transfer Data</h2>
      <div className="mb-4 max-w-xs">
        <label className="block text-gray-600 mb-1">Doelhotel</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={targetHotel}
          onChange={e => setTargetHotel(e.target.value)}
        >
          <option value="">-- Kies hotel --</option>
          {otherHotels.map(uid => (
            <option key={uid} value={uid}>
              {uid}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => handleTransfer("articles")}
        >
          Transfer Articles
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => handleTransfer("ingredients")}
        >
          Transfer Ingredients
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => handleTransfer("products")}
        >
          Transfer Products
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => handleTransfer("settings")}
        >
          Transfer Settings
        </button>
      </div>
    </div>
  );
}

