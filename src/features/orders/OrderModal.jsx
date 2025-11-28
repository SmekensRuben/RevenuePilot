// src/features/orders/OrderModal.jsx
import React, { useState, useEffect } from "react";
import { addOrder } from "./orderService";
import { db, collection, getDocs } from "../../firebaseConfig";

// hotelUid wordt als prop doorgegeven!

export default function OrderModal({ open, onClose, onOrderAdded, hotelUid }) {
  const [supplier, setSupplier] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [articles, setArticles] = useState([
    { name: "", brand: "", quantity: 1, price: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState([]);

  // Haal ingrediënten op wanneer modal opent (nu met Firestore)
  useEffect(() => {
    if (!open) return;
    async function fetchIngredients() {
      const ingredientsCol = collection(db, `hotels/${hotelUid}/ingredients`);
      const snap = await getDocs(ingredientsCol);
      const arr = snap.docs.map(doc => {
        const ing = doc.data();
        return {
          name: ing.name,
          brand: ing.brand || "",
          unit: ing.unit || "",
          label: ing.brand ? `${ing.name} (${ing.brand})` : ing.name,
        };
      });
      setIngredients(arr);
    }
    fetchIngredients();
  }, [open, hotelUid]);

  // Productregel toevoegen
  const handleAddProduct = () => {
    setArticles([
      ...articles,
      {
        name: "",
        brand: "",
        quantity: 1,
        price: 0,
        invoicedPricePerPurchaseUnit: 0,
      },
    ]);
  };

  // Productregel aanpassen
  const handleChange = (i, field, val) => {
    setArticles(
      articles.map((p, idx) => (i === idx ? { ...p, [field]: val } : p))
    );
  };

  // Reset formulier bij sluiten
  useEffect(() => {
    if (!open) {
      setSupplier("");
      setDeliveryDate("");
      setNote("");
      setArticles([{
        name: "",
        brand: "",
        quantity: 1,
        price: 0,
        invoicedPricePerPurchaseUnit: 0,
      }]);
    }
  }, [open]);

  // Submit order
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const newOrder = {
      supplier,
      orderDate: new Date().toISOString().slice(0, 10),
      deliveryDate,
      status: "ordered",
      note,
      articles: articles.map(p => {
        const priceValue = Number(p.price) || 0;
        const invoicedPrice = p.invoicedPricePerPurchaseUnit ?? priceValue;
        return {
          ...p,
          quantity: Number(p.quantity),
          price: priceValue,
          pricePerPurchaseUnit: priceValue,
          invoicedPricePerPurchaseUnit: Number(invoicedPrice),
        };
      })
    };

    try {
      await addOrder(hotelUid, newOrder);
      if (onOrderAdded) onOrderAdded();
      onClose();
    } catch (err) {
      alert("Er is iets misgelopen bij het opslaan.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed z-30 inset-0 bg-black/40 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl w-[95vw] max-w-lg shadow-lg flex flex-col gap-3"
      >
        <h2 className="font-bold text-xl mb-1">New Order</h2>
        <input
          className="border rounded-xl px-2 py-1"
          placeholder="Supplier"
          value={supplier}
          onChange={e => setSupplier(e.target.value)}
          required
        />
        <input
          className="border rounded-xl px-2 py-1"
          type="date"
          value={deliveryDate}
          onChange={e => setDeliveryDate(e.target.value)}
          required
        />
        <textarea
          className="border rounded-xl px-2 py-1"
          placeholder="Note"
          value={note}
          onChange={e => setNote(e.target.value)}
        />

        <div>
          <h3 className="font-semibold mb-1">Articles</h3>
          {articles.map((prod, i) => {
            const foundIng = ingredients.find(
              ing => ing.name === prod.name && ing.brand === prod.brand
            );
            return (
              <div key={i} className="grid grid-cols-4 gap-1 mb-1 items-center">
                <select
                  className="border rounded-xl px-2 py-1"
                  value={
                    prod.name && prod.brand
                      ? `${prod.name}|${prod.brand}`
                      : ""
                  }
                  onChange={e => {
                    const [name, brand] = e.target.value.split("|");
                    handleChange(i, "name", name);
                    handleChange(i, "brand", brand);
                  }}
                  required
                >
                  <option value="">Select ingredient</option>
                  {ingredients.map((ing, idx) => (
                    <option key={idx} value={`${ing.name}|${ing.brand}`}>
                      {ing.label}
                    </option>
                  ))}
                </select>
                <input
                  className="border rounded-xl px-2 py-1"
                  placeholder="Qty"
                  type="number"
                  min={1}
                  value={prod.quantity}
                  onChange={e => handleChange(i, "quantity", e.target.value)}
                  required
                />
                <input
                  className="border rounded-xl px-2 py-1"
                  placeholder="Unit"
                  value={foundIng?.unit || ""}
                  disabled
                />
                <input
                  className="border rounded-xl px-2 py-1"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Price"
                  value={prod.price}
                  onChange={e => handleChange(i, "price", e.target.value)}
                  required
                />
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleAddProduct}
            className="text-marriott underline text-sm"
          >
            + Add product
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-200 px-4 py-2 rounded-2xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-marriott text-white px-4 py-2 rounded-2xl font-semibold hover:bg-marriott-dark"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
