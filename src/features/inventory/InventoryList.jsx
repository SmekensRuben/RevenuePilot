import React from "react";
import InventoryItem from "./InventoryItem";
import InventoryCard from "./InventoryCard";
import { ChevronUp, ChevronDown } from "lucide-react";
import { usePermission } from "../../hooks/usePermission";

const sortIcon = (active, dir) =>
  active ? (
    dir === "asc" ? (
      <ChevronUp size={16} className="inline ml-1 -mt-1" />
    ) : (
      <ChevronDown size={16} className="inline ml-1 -mt-1" />
    )
  ) : (
    <span className="inline-block w-4" />
  );

export default function InventoryList({
  inventory,
  onEdit,
  onRemove,
  sortField,
  sortDir,
  setSortField,
  setSortDir,
}) {
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };
  const canView = usePermission("inventory", "view");

  if (!inventory || inventory.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow text-gray-400 text-center">
        No inventory items found.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Cards */}
      {canView && <div className="md:hidden flex flex-col gap-2 mt-4">
        {inventory.map(item => (
          <InventoryCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
      </div>}
      {/* Desktop: Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableTh
                label="Article"
                field="name"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Brand"
                field="brand"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Quantity"
                field="quantity"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Price"
                field="pricePerStockUnit"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Total Value"
                field="totalValue"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Category"
                field="categoryLabel"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          {canView && <tbody className="bg-white divide-y divide-gray-100 text-sm">
            {inventory.map((item) => (
              <InventoryItem
                key={item.id}
                item={item}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
          </tbody>}
        </table>
      </div>
    </>
  );
}

function SortableTh({ label, field, sortField, sortDir, onSort, align }) {
  const active = sortField === field;
  return (
    <th
      className={`px-4 py-2 text-xs font-semibold uppercase select-none cursor-pointer hover:bg-gray-100 transition ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => onSort(field)}
      scope="col"
    >
      <span className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        {sortIcon(active, sortDir)}
      </span>
    </th>
  );
}
