// features/inventory/InventoryContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { useHotelContext } from "contexts/HotelContext";
import {
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  removeInventoryItem,
} from "./inventoryService";

export const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
  const { hotelUid } = useHotelContext();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshInventory = async () => {
    if (!hotelUid) return;
    setLoading(true);
    const arr = await getInventory(hotelUid);
    setInventory(arr);
    setLoading(false);
  };

  // Inventory ophalen bij mount of wanneer hotelUid verandert
  useEffect(() => {
    if (!hotelUid) return;
    refreshInventory();
  }, [hotelUid]);

  // Handlers roepen de services aan
  const handleAddInventoryItem = async ({ articleId, quantity }) => {
    // Check of het artikel al bestaat
    const existingItem = inventory.find(
      (item) => item.articleId === articleId
    );
    if (existingItem) {
      // Tel bij bestaande op
      await handleUpdateInventoryItem(existingItem.id, {
        quantity: Number(existingItem.quantity ?? 0) + Number(quantity),
      });
    } else {
      await addInventoryItem(hotelUid, { articleId, quantity });
    }
    await refreshInventory();
  };

  const handleUpdateInventoryItem = async (id, { quantity }) => {
    await updateInventoryItem(hotelUid, id, { quantity });
    await refreshInventory();
  };

  const handleRemoveInventoryItem = async (id) => {
    await removeInventoryItem(hotelUid, id);
    await refreshInventory();
  };

  return (
    <InventoryContext.Provider
      value={{
        inventory,
        loading,
        refreshInventory,
        addInventoryItem: handleAddInventoryItem,
        updateInventoryItem: handleUpdateInventoryItem,
        removeInventoryItem: handleRemoveInventoryItem,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};
