import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Fuse from "fuse.js";
import {
  getIngredientsIndexed,
  addIngredient,
  updateIngredient,
  deleteIngredient,
} from "../../services/firebaseIngredients";
import { getArticlesIndexed } from "../../services/firebaseArticles";
import { getCategories } from "../../services/firebaseSettings";
import { usePermission } from "../../hooks/usePermission";
import { ALLERGENS } from "../../constants/allergens";

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "");
}

export default function useIngredients(hotelUid) {
  const { t } = useTranslation("ingredients");
  const canView = usePermission("ingredients", "view");
  const canCreate = usePermission("ingredients", "create");
  const canEdit = usePermission("ingredients", "edit");
  const canDelete = usePermission("ingredients", "delete");

  const [ingredients, setIngredients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState({});
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const createEmptyAllergens = () =>
    ALLERGENS.reduce((acc, key) => ({ ...acc, [key]: false }), {});
  const createEmptyForm = () => ({
    name: "",
    aliases: { en: "", fr: "", nl: "" },
    unit: "",
    articles: [],
    parentCategory: "",
    category: "",
    allergens: createEmptyAllergens(),
  });

  const [form, setForm] = useState(createEmptyForm());
  const [editForm, setEditForm] = useState(createEmptyForm());

  const [filters, setFilters] = useState({
    search: "",
    parentCategory: "",
    category: "",
  });

  const loadIngredients = () =>
    getIngredientsIndexed().then(arr =>
      setIngredients(
        arr.map(ingredient => ({
          ...ingredient,
          normalizedName: normalizeText(ingredient.name),
          normalizedAliases: Object.values(ingredient.aliases || {}).map(
            normalizeText
          ),
        }))
      )
    );

  useEffect(() => {
    if (!canView) return;
    loadIngredients();
    getArticlesIndexed().then(arr =>
      setArticles(arr.filter(a => a.active !== false))
    );
    getCategories().then(setCategories);
  }, [canView]);

  useEffect(() => {
    if (editMode && selectedIngredient) {
      setEditForm({
        name: selectedIngredient.name || "",
        aliases: {
          en: selectedIngredient.aliases?.en || "",
          fr: selectedIngredient.aliases?.fr || "",
          nl: selectedIngredient.aliases?.nl || "",
        },
        unit: selectedIngredient.unit || "",
        articles: selectedIngredient.articles || [],
        parentCategory:
          categories[selectedIngredient.category]?.parentId || "",
        category: selectedIngredient.category || "",
        allergens: {
          ...createEmptyAllergens(),
          ...(selectedIngredient.allergens || {}),
        },
      });
    }
  }, [editMode, selectedIngredient, categories]);

  const fuse = useMemo(
    () =>
      new Fuse(ingredients, {
        keys: ["normalizedName", "normalizedAliases"],
        threshold: 0.3,
        ignoreLocation: true,
        useExtendedSearch: true,
      }),
    [ingredients]
  );

  const handleAdd = async () => {
    if (!canCreate) {
      alert(t("noAddPermission"));
      return false;
    }
    await addIngredient({
      name: form.name,
      aliases: form.aliases,
      unit: form.unit,
      articles: form.articles,
      category: form.category,
      allergens: form.allergens,
    });
    setForm(createEmptyForm());
    loadIngredients();
    return true;
  };

  const handleEdit = async () => {
    if (!canEdit) {
      alert(t("noEditPermission"));
      return false;
    }
    if (!selectedIngredient) return false;
    await updateIngredient(hotelUid, selectedIngredient.id, {
      name: editForm.name,
      aliases: editForm.aliases,
      unit: editForm.unit,
      articles: editForm.articles,
      category: editForm.category,
      allergens: editForm.allergens,
    });
    setShowDetails(false);
    setEditMode(false);
    loadIngredients();
    return true;
  };

  const handleDelete = async () => {
    if (!canDelete) {
      alert(t("noDeletePermission"));
      return;
    }
    if (selectedIngredient) {
      await deleteIngredient(hotelUid, selectedIngredient.id);
      setEditMode(false);
      setShowDetails(false);
      loadIngredients();
    }
  };

  const filteredIngredients = useMemo(() => {
    const { search, category, parentCategory } = filters;
    const normalizedSearch = normalizeText(search);
    const words = normalizedSearch.split(/\s+/).filter(Boolean);
    const searchResults = words.length
      ? fuse
          .search({
            $and: words.map(w => ({
              $or: [{ normalizedName: w }, { normalizedAliases: w }],
            })),
          })
          .map(result => result.item)
      : ingredients;
    return searchResults.filter(ingredient => {
      const matchesCategory = category
        ? ingredient.category === category
        : parentCategory
          ? categories[ingredient.category]?.parentId === parentCategory
          : true;
      return matchesCategory;
    });
  }, [filters, fuse, ingredients, categories]);

  return {
    ingredients,
    setIngredients,
    articles,
    form,
    setForm,
    filters,
    setFilters,
    selectedIngredient,
    setSelectedIngredient,
    showDetails,
    setShowDetails,
    editMode,
    setEditMode,
    editForm,
    setEditForm,
    categories,
    handleAdd,
    handleEdit,
    handleDelete,
    filteredIngredients,
  };
}
