// features/inventory/InventoryFilterBar.jsx
import React from "react";

const InventoryFilterBar = ({
  searchTerm,
  setSearchTerm,
  filter,
  setFilter,
}) => {
  return (
    <div className="flex gap-2 items-center w-full">
      <input
        type="text"
        placeholder="Search article or brand..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="border rounded-xl px-4 py-2 w-64"
      />
    </div>
  );
};

export default InventoryFilterBar;
