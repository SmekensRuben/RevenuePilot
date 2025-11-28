import React, { useRef, useEffect, useState } from "react";

export default function StockCountAddForm({
  search,
  setSearch,
  selected,
  setSelected,
  quantity,
  setQuantity,
  filteredArticles,
  onAdd,
  selectedUnit,
  setToast,
  disabled = false,
}) {
  const searchRef = useRef(null);
  const qtyRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!disabled && selected && qtyRef.current) {
      qtyRef.current.focus();
    }
  }, [disabled, selected]);

  const handleSelect = ing => {
    if (disabled) return;
    setSelected(ing);
    setSearch(ing.name);
    setShowDropdown(false);
    setTimeout(() => qtyRef.current && qtyRef.current.focus(), 50);
  };

  // Reset na toevoegen
  useEffect(() => {
    if (!disabled && !selected && searchRef.current) {
      searchRef.current.focus();
    }
  }, [disabled, selected]);

  return (
    <div className="flex flex-col sm:flex-row gap-2 relative">
      <div className="w-full sm:w-80 relative">
        <input
          ref={searchRef}
          value={search}
          onChange={e => {
            if (disabled) return;
            setSearch(e.target.value);
            setSelected(null);
            setShowDropdown(e.target.value.length > 0);
          }}
          placeholder="Zoek artikel..."
          className="w-full rounded border border-gray-300 p-2 text-base focus:outline-none focus:ring-2 focus:ring-[#b41f1f]"
          autoComplete="off"
          onFocus={() => !disabled && setShowDropdown(search.length > 0)}
          onBlur={() => !disabled && setTimeout(() => setShowDropdown(false), 150)}
          disabled={disabled}
        />
        {/* Dropdown alleen tonen als er echt gefilterd wordt */}
        {showDropdown && !disabled && filteredArticles.length > 0 && !selected && (
          <div className="absolute z-30 bg-white border rounded shadow max-h-56 overflow-y-auto w-full">
            {filteredArticles.map(ing => (
              <div
                key={ing.id}
                className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
                onMouseDown={() => handleSelect(ing)}
              >
                <span className="flex-1">{ing.name}</span>
                {ing.brand && (
                  <span className="ml-2 text-xs text-gray-500">{ing.brand}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 w-full sm:w-auto">
        <input
          ref={qtyRef}
          type="number"
          min="0"
          step="0.01"
          value={quantity}
          onChange={e => !disabled && setQuantity(e.target.value)}
          placeholder="Aantal"
          className="w-24 rounded border border-gray-300 p-2 text-base focus:outline-none focus:ring-2 focus:ring-[#b41f1f]"
          disabled={!selected || disabled}
          onKeyDown={e => {
            if (!disabled && e.key === "Enter" && selected && quantity) {
              onAdd(selected, quantity);
              setQuantity("");
              setSelected(null);
              setSearch("");
              setToast(`${selected.name} toegevoegd!`);
            }
          }}
        />
        {/* Toon unit enkel indien geselecteerd */}
        {selected && (
          <div className="flex items-center text-sm text-gray-500 px-2">
            {selected.stockUnit || selectedUnit}
          </div>
        )}
        <button
          type="button"
          className="bg-[#b41f1f] hover:bg-[#951616] text-white font-bold px-4 rounded transition"
          style={{ minHeight: 38 }}
          disabled={!selected || !quantity || disabled}
          onClick={() => {
            if (!disabled && selected && quantity) {
              onAdd(selected, quantity);
              setQuantity("");
              setSelected(null);
              setSearch("");
              setToast(`${selected.name} toegevoegd!`);
            }
          }}
        >
          Toevoegen
        </button>
      </div>
    </div>
  );
}
