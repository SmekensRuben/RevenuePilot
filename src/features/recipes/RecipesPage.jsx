import React, { useEffect, useState, useMemo } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { getIngredients } from "services/firebaseIngredients";
import { getArticlesIndexed } from "services/firebaseArticles";
import RecipeForm from "./RecipeForm";
import RecipeTable from "./RecipeTable";
import RecipeDetailsDialog from "./RecipeDetailsDialog";
import Pagination from "shared/Pagination";
import { calculateRecipeCost } from "./recipeHelpers";
import {
  addRecipe,
  updateRecipe,
  deleteRecipe
} from "./recipesService";
import { getRecipesIndexed } from "../../services/firebaseRecipes";
import { getCategories } from "../../services/firebaseSettings";
import { usePermission } from "../../hooks/usePermission";

export default function RecipesPage() {
  const { t } = useTranslation("recipes");
  const { hotelUid, hotelName } = useHotelContext();
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editRecipe, setEditRecipe] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const canCreate = usePermission("recipes", "create");
  const canEdit = usePermission("recipes", "edit");
  const canDelete = usePermission("recipes", "delete");


  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  useEffect(() => {
    getRecipesIndexed(hotelUid).then(setRecipes);
    getIngredients(hotelUid).then(res =>
      setIngredients(res.filter(ing => ing.active !== false))
    );
    getArticlesIndexed(hotelUid).then(setArticles);
    getCategories().then(setCategories);
  }, [hotelUid]);

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const handleShowDetails = (recipe) => {
    setSelectedRecipe(recipe);
    setShowDetails(true);
  };

  const handleEdit = (recipe) => {
    if (!canEdit) return;
    setEditRecipe(recipe);
    setShowForm(true);
  };

  const handleDelete = async (recipe) => {
    if (!canDelete) return;
    if (window.confirm(t("confirmDelete", { name: recipe.name }))) {
      await deleteRecipe(hotelUid, recipe.id);
      getRecipesIndexed(hotelUid).then(setRecipes);
      setShowDetails(false);
    }
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editRecipe) {
        await updateRecipe(hotelUid, editRecipe.id, data);
      } else {
        await addRecipe(hotelUid, data);
      }
      getRecipesIndexed(hotelUid).then(setRecipes);
      setShowForm(false);
      setEditRecipe(null);
    } catch (err) {
        alert(err.message || t("errors.save"));
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    if (search) {
      const lower = search.toLowerCase();
      return recipe.name?.toLowerCase().includes(lower);
    }
    return true;
  });

  const sortedRecipes = useMemo(() => {
    const getValue = (p) => {
      switch (sortField) {
        case "content":
          return p.content || 0;
        case "cost":
          return calculateRecipeCost(p, ingredients, articles);
        default:
          return p.name || "";
      }
    };
    return [...filteredRecipes].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const valA = getValue(a);
      const valB = getValue(b);
      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * dir;
      }
      return String(valA).localeCompare(String(valB), undefined, { sensitivity: "base" }) * dir;
    });
  }, [filteredRecipes, sortField, sortDir, ingredients, articles]);

  useEffect(() => {
    setPage(1);
  }, [search, sortField, sortDir]);

  const totalPages = Math.ceil(sortedRecipes.length / ITEMS_PER_PAGE) || 1;
  const paginatedRecipes = sortedRecipes.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-6">{t("title", "Recipes")}</h1>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex-1">
            <input
              type="text"
              className="border px-3 py-2 w-full"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        {canCreate && (
          <button
            className="mb-6 bg-[#b41f1f] text-white px-4 py-2 rounded hover:bg-[#a41a1a]"
            onClick={() => { setEditRecipe(null); setShowForm(true); }}
          >
            {t("createButton")}
          </button>
        )}
        <RecipeTable
          recipes={paginatedRecipes}
          ingredients={ingredients}
          articles={articles}
          handleShowDetails={handleShowDetails}
          handleEdit={handleEdit}
          canEdit={canEdit}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
        <RecipeForm
          open={showForm}
          onClose={() => { setShowForm(false); setEditRecipe(null); }}
          onSubmit={handleFormSubmit}
          ingredients={ingredients}
          editRecipe={editRecipe}
          categories={categories}
        />
        <RecipeDetailsDialog
          open={showDetails}
          recipe={selectedRecipe}
          ingredients={ingredients}
          categories={categories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClose={() => setShowDetails(false)}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </PageContainer>
    </>
  );
}
