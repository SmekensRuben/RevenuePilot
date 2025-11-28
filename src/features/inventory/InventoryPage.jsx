// features/inventory/InventoryPage.jsx
import React, { useEffect, useState, useContext } from "react";
import { getArticles } from "../../services/firebaseArticles";
import { getRecipes } from "../../services/firebaseRecipes";
import { getIngredients } from "../../services/firebaseIngredients";
import { calculateRecipeCost } from "../recipes/recipeHelpers";
import { InventoryContext, InventoryProvider } from "./InventoryContext";
import InventoryList from "./InventoryList";
import InventoryForm from "./InventoryForm";
import InventoryFilterBar from "./InventoryFilterBar";
import HeaderBar from "../../components/layout/HeaderBar";
import PageContainer from "../../components/layout/PageContainer";
import { useHotelContext } from "../../contexts/HotelContext";
import { Button } from "../../components/layout/Button";
import { getCategories } from "../../services/firebaseSettings";
import { usePermission } from "../../hooks/usePermission";

const InventoryPageContent = () => {
  const { hotelName, logout, hotelUid } = useHotelContext();
  const { inventory, loading, addInventoryItem, updateInventoryItem, removeInventoryItem } = useContext(InventoryContext);
  const [categories, setCategories] = useState({});
  const [articles, setArticles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const canView = usePermission("inventory", "view");
  const canCreate = usePermission("inventory", "create");

  // Filters & search
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState({});

  // Sorteer state
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // Header: today in English
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });


  useEffect(() => {
    let active = true;
    getCategories().then(setCategories);
    async function fetchAll() {
      const [artRes, recRes, ingRes] = await Promise.all([
        getArticles(hotelUid),
        getRecipes(hotelUid),
        getIngredients(hotelUid),
      ]);
      if (!active) return;
      const artList = artRes.filter(art => art.active !== false);
      const recList = recRes
        .filter(rec => rec.active !== false)
        .map(rec => {
          const cost = calculateRecipeCost(rec, ingRes, artRes);
          const pricePerStockUnit = cost / Number(rec.content || 1);
          return {
            ...rec,
            stockUnit: rec.contentUnit || "",
            pricePerStockUnit,
            price: pricePerStockUnit,
          };
        });
      setArticles([...artList, ...recList]);
    }
    fetchAll();
    return () => { active = false; };
  }, [hotelUid]);

  // Combineer voorraad met artikels voor weergave
  const inventoryWithDetails = inventory.map(item => {
    const article = articles.find(art => art.id === item.articleId);
    const pricePerStockUnit = Number(article?.pricePerStockUnit ?? 0);
    const quantity = Number(item.quantity ?? 0);
    return {
      ...item,
      name: article?.name || "",
      brand: article?.brand || "",
      stockUnit: article?.stockUnit || "",
      category: article?.category || "",
      categoryLabel: categories[article?.category]?.label || article?.category || "-",
      pricePerStockUnit,
      totalValue: pricePerStockUnit * quantity,
    };
  });

  // Filteren op zoekterm
  const filteredInventory = inventoryWithDetails.filter(item => {
    const matchesSearch =
      (item.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Sorteren
  const sortedInventory = [...filteredInventory].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    if (sortField === "totalValue") {
      aValue = Number(aValue);
      bValue = Number(bValue);
    }
    if (typeof aValue === "string") aValue = aValue.toLowerCase();
    if (typeof bValue === "string") bValue = bValue.toLowerCase();
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;
    if (aValue === bValue) return 0;
    return sortDir === "asc"
      ? aValue > bValue ? 1 : -1
      : aValue < bValue ? 1 : -1;
  });

  // Handlers
  const handleEdit = (item) => {
    setEditItem(item);
    setShowForm(true);
  };
  const handleAdd = () => {
    setEditItem(null);
    setShowForm(true);
  };
  const handleRemove = (item) => {
    if (window.confirm(`Voorraadregel voor ${item.name} verwijderen?`)) {
      removeInventoryItem(item.id);
    }
  };
  const handleFormClose = () => {
    setShowForm(false);
    setEditItem(null);
  };

  // Logout & redirect
  const handleLogout = () => {
    if (typeof logout === "function") logout();
    window.location.href = "/login";
  };

  const totalInventoryValue = sortedInventory.reduce(
  (sum, item) => sum + (Number(item.quantity) * Number(item.pricePerStockUnit || 0)),
  0
);


  return (
    <>
      <HeaderBar
        hotelName={hotelName}
        today={today}
        onLogout={handleLogout}
      />

      <PageContainer className="max-w-4xl">
        <main>
        <div className="flex justify-between items-center mb-4">
          <InventoryFilterBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filter={filter}
            setFilter={setFilter}
          />
         {canCreate && <Button onClick={handleAdd} className="ml-2">
            + Add Inventory
          </Button>}
        </div>
<div className="mb-4 flex items-center gap-4">
  <div className="rounded-xl bg-white shadow px-5 py-3 font-semibold text-lg">
    Totale waarde voorraad: € {totalInventoryValue.toFixed(2)}
  </div>
</div>

        {loading ? (
          <div className="bg-white rounded-xl shadow p-10 text-center text-gray-500">Loading inventory...</div>
        ) : (
            <InventoryList
            inventory={sortedInventory}
            onEdit={handleEdit}
            onRemove={handleRemove}
            sortField={sortField}
            sortDir={sortDir}
            setSortField={setSortField}
            setSortDir={setSortDir}
          />
        )}

        {showForm && (
            <InventoryForm
            item={editItem}
            onClose={handleFormClose}
            articles={articles}
            onSave={(data) => {
              if (editItem) {
                updateInventoryItem(editItem.id, data);
              } else {
                addInventoryItem(data);
              }
              handleFormClose();
            }}
          />
        )}
        </main>
      </PageContainer>
    </>
  );
};

const InventoryPage = () => (
  <InventoryProvider>
    <InventoryPageContent />
  </InventoryProvider>
);

export default InventoryPage;
