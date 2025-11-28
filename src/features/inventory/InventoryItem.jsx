import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { usePermission } from "../../hooks/usePermission";

const InventoryItem = ({ item, onEdit, onRemove }) => {
  const quantity = Number(item.quantity ?? 0);
  const pricePerStockUnit = Number(item.pricePerStockUnit ?? 0);
  const stockUnit = item.stockUnit || "-";
  const totalValue = (quantity * pricePerStockUnit).toFixed(2);
  const canEdit = usePermission("inventory", "edit");
  const canDelete = usePermission("inventory", "delete");

  return (
    <tr className="hover:bg-gray-50 cursor-pointer transition text-sm">
      {/* Naam */}
      <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
        {item.name}
      </td>
      {/* Merk met max-w/truncate */}
      <td className="px-4 py-2 text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] truncate">
        {item.brand || "-"}
      </td>
      {/* Quantity + unit stacked */}
      <td className="px-2 py-2 whitespace-nowrap">
        <div className="flex flex-col items-start">
           <span>
    {quantity} <span className="text-xs text-gray-400">{stockUnit}</span>
  </span>
        </div>
      </td>
      {/* Prijs per eenheid */}
      <td className="px-4 py-2 whitespace-nowrap">€{pricePerStockUnit.toFixed(2)}</td>

      {/* Totale waarde */}
      <td className="px-4 py-2 font-semibold whitespace-nowrap">€{totalValue}</td>
      {/* Categorie */}
      <td className="px-4 py-2 whitespace-nowrap">{item.categoryLabel}</td>
      {/* Actions */}
      <td className="px-4 py-2 flex justify-end gap-2">
        {onEdit && canEdit && (
          <button
            onClick={() => onEdit(item)}
            title="Edit"
            className="p-1 rounded hover:bg-gray-200"
          >
            <Pencil size={18} />
          </button>
        )}
        {onRemove && canDelete && (
          <button
            onClick={() => onRemove(item)}
            title="Set to zero"
            className="p-1 rounded hover:bg-red-100"
          >
            <Trash2 size={18} />
          </button>
        )}
      </td>
    </tr>
  );
};

export default InventoryItem;
