// features/inventory/InventoryForm.jsx
import React, { useState } from "react";
import { Combobox } from "components/ui/combobox";
import { X } from "lucide-react";

const InventoryForm = ({ item, onClose, articles = [], onSave }) => {
  const isEdit = !!item;
  const [selectedArticle, setSelectedArticle] = useState(
    isEdit
      ? articles.find(art => art.id === item.articleId)
      : null
  );
  const [quantity, setQuantity] = useState(item?.quantity || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedArticle || !quantity) return;
    onSave({
      articleId: selectedArticle.id,
      quantity: Number(quantity),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      <form
        className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md relative"
        onSubmit={handleSubmit}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-gray-400 hover:text-gray-600"
        >
          <X size={22} />
        </button>
        <h2 className="text-xl font-semibold mb-4">
          {isEdit ? "Edit Inventory" : "Add Inventory"}
        </h2>

        {/* Combobox voor artikel */}
        <div className="mb-4">
          <label className="block font-medium mb-1">Article</label>
          <Combobox
            value={selectedArticle}
            onChange={setSelectedArticle}
            options={articles.filter(art => art.active !== false)}
            displayValue={option => option?.name || ""}
            getOptionValue={option => option?.id}
            placeholder="Type to search articles..."
            disabled={isEdit}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block font-medium mb-1">Brand</label>
          <input
            type="text"
            value={selectedArticle?.brand || ""}
            readOnly
            className="w-full border rounded p-2 bg-gray-100"
            disabled
          />
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-1">Quantity</label>
          <input
  type="number"
  min={0}
  step="any"
  value={quantity}
  onChange={e => setQuantity(e.target.value)}
  className="w-full border rounded p-2"
  required
/>

        </div>
        <div className="mb-6">
          <label className="block font-medium mb-1">Price per unit (€)</label>
          <div className="px-3 py-2 bg-gray-100 rounded text-gray-700">
            {selectedArticle?.pricePerStockUnit
              ? `€${selectedArticle.pricePerStockUnit}`
              : "-"}
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-marriott text-white font-semibold rounded p-3 hover:bg-marriott-dark transition"
        >
          {isEdit ? "Save Changes" : "Add Inventory"}
        </button>
      </form>
    </div>
  );
};

export default InventoryForm;
