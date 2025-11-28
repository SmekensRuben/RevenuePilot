import React, { useState, useEffect, useMemo } from "react";
import { useHotelContext } from "../../../contexts/HotelContext";
import { rebuildProductMasterIndex } from "../../../services/firebaseProducts";
import { rebuildIngredientIndex } from "../../../services/firebaseIngredients";

const SYNC_TABS = [
  { key: "ingredients", label: "Ingredienten" },
  { key: "products", label: "Producten" },
  { key: "receipts", label: "Receipts" },
];

const getValidTab = tab =>
  SYNC_TABS.some(t => t.key === tab) ? tab : "ingredients";

export default function SynchronisatieSettings({ initialTab }) {
  const { hotelUid } = useHotelContext();
  const defaultTab = useMemo(() => getValidTab(initialTab), [initialTab]);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const btnClass = "btn bg-marriott text-white px-4 py-2 rounded";

  const handleProductSync = async () => {
    try {
      await rebuildProductMasterIndex(hotelUid);
    } catch (err) {
      console.error("Fout bij synchroniseren producten:", err);
    }
  };

  const handleIngredientSync = async () => {
    try {
      await rebuildIngredientIndex(hotelUid);
    } catch (err) {
      console.error("Fout bij synchroniseren ingredienten:", err);
    }
  };

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const renderContent = () => {
    switch (activeTab) {
      case "ingredients":
        return (
          <button className={btnClass} type="button" onClick={handleIngredientSync}>
            Synchroniseer Ingredienten
          </button>
        );
      case "products":
        return (
          <button className={btnClass} type="button" onClick={handleProductSync}>
            Synchroniseer Producten
          </button>
        );
      case "receipts":
        return (
          <button className={btnClass} type="button">
            Synchroniseer Receipts
          </button>
        );
      default:
        return null;
    }
  };

  return (
      <div>
        <div className="flex mb-4 border-b">
          {SYNC_TABS.map(tab => (
            <button
              key={tab.key}
              className={
                "px-4 py-2 mr-2 border-b-2 " +
                (activeTab === tab.key
                  ? "border-primary font-bold text-primary"
                  : "border-transparent text-gray-600")
              }
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mt-4">{renderContent()}</div>
      </div>
    );
  }
