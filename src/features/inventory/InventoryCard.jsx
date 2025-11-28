import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { usePermission } from "../../hooks/usePermission";

export default function InventoryCard({ item, onEdit, onRemove }) {
  const quantity = Number(item.quantity ?? 0);
  const pricePerStockUnit = Number(item.pricePerStockUnit ?? 0);
  const stockUnit = item.stockUnit || "-";
  const totalValue = (quantity * pricePerStockUnit).toFixed(2);
  const canEdit = usePermission("inventory", "edit");
    const canDelete = usePermission("inventory", "delete");

  // Status badge: altijd actief (want inactive items zie je normaal niet in stock)
  // Je kunt een badge toevoegen voor voorraad < drempelwaarde indien gewenst
  let badge = null;
  // Voorbeeld: badge als voorraad 0
  if (quantity === 0) {
    badge = (
      <span className="text-xs px-2 py-0.5 rounded font-semibold bg-orange-100 text-orange-600 border border-orange-300 ml-2">
        Geen voorraad
      </span>
    );
  }

  return (
    <div className="flex flex-col bg-white rounded-2xl shadow-md px-4 py-4 mb-2 min-w-0 cursor-pointer transition hover:shadow-lg relative">
      <div className="flex justify-between items-start mb-1">
        <div className="font-bold text-base text-gray-900 truncate">
          {item.name}
        </div>
        <div className="flex gap-2">
          {canEdit && <button
            type="button"
            className="p-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
            onClick={e => { e.stopPropagation(); onEdit && onEdit(item); }}
            title="Bewerken"
          >
            <Pencil size={18} />
          </button>}
          {canDelete && <button
            type="button"
            className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
            onClick={e => { e.stopPropagation(); onRemove && onRemove(item); }}
            title="Verwijderen"
          >
            <Trash2 size={18} />
          </button>}
        </div>
      </div>
      <div className="text-gray-500 text-sm truncate mb-1">{item.brand}</div>
      <div className="flex items-center gap-2 text-xs mb-1 text-gray-700">
        <span className="font-semibold">Aantal:</span>
        <span className="text-gray-900">{quantity} {stockUnit}</span>
        {badge}
      </div>
      <div className="flex items-center gap-2 text-xs mb-1 text-gray-700">
        <span>Prijs per eenheid:</span>
        <span className="text-gray-900 font-semibold">
          €{pricePerStockUnit.toFixed(2)} / {stockUnit}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs mb-1 text-gray-700">
        <span>Totaalwaarde:</span>
        <span className="text-gray-900 font-semibold">
          €{totalValue}
        </span>
      </div>
      <div className="text-gray-500 text-sm">{item.categoryLabel}</div>
      <div className="text-gray-400 text-xs mt-1">{item.supplier}</div>
    </div>
  );
}
