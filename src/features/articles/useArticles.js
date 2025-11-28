import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getArticlesIndexed,
  addArticle,
  updateArticle,
  deleteArticle,
} from "../../services/firebaseArticles";
import {
  getCategories,
  getSuppliers,
} from "../../services/firebaseSettings";
import { getIngredients, updateIngredient } from "../../services/firebaseIngredients";
import { usePermission } from "../../hooks/usePermission";

/**
 * Custom hook voor het beheren van ingrediënten, filters, en CRUD-logica.
 * @param {string} hotelUid
 * @returns Object met state, handlers en helpers
 */
export default function useArticles(hotelUid) {
  const { t } = useTranslation("articles");
  const canView = usePermission("articles", "view");
  const canCreate = usePermission("articles", "create");
  const canEdit = usePermission("articles", "edit");
  const canDelete = usePermission("articles", "delete");
  // Core state
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Nieuw ingrediënt states
  const [form, setForm] = useState({
    name: "",
    pricePerPurchaseUnit: "",
    pricePerKg: "",
    brand: "",
    supplier: "",
    vat: "6",
    articleNumber: "",
    ean: "",
    active: true,
    frozen: false,
    parentCategory: "",
    category: "",
    purchaseUnit: "",
    unitsPerPurchaseUnit: "",
    stockUnit: "",
    // Toegevoegd:
    recipeUnit: "",
    contentPerStockUnit: "",
    isWeighed: false,
    imageUrl: "",
    ingredientIds: [],
    aliases: { en: "", fr: "", nl: "" },
  });

  // Filters
  const [filters, setFilters] = useState({
    search: sessionStorage.getItem("articlesSearch") || "",
    parentCategory: "",
    category: "",
    supplier: "",
    lastUpdate: "",
  });

  // Persist search term across navigation
  useEffect(() => {
    sessionStorage.setItem("articlesSearch", filters.search);
  }, [filters.search]);

  // Edit states
  const [editForm, setEditForm] = useState({
    name: "",
    brand: "",
    pricePerPurchaseUnit: "",
    pricePerKg: "",
    supplier: "",
    articleNumber: "",
    ean: "",
    purchaseUnit: "",
    unitsPerPurchaseUnit: "",
    stockUnit: "",
    vat: "6",
    parentCategory: "",
    category: "",
    active: true,
    frozen: false,
    // Toegevoegd:
    recipeUnit: "",
    contentPerStockUnit: "",
    isWeighed: false,
    imageUrl: "",
    ingredientIds: [],
    aliases: { en: "", fr: "", nl: "" },
  });

  // Init
  useEffect(() => {
    if (!canView) return;
    getArticlesIndexed().then(setArticles);
    getCategories().then(setCategories);
    getSuppliers().then(setSuppliers);
    getIngredients(hotelUid).then(setIngredients);
  }, [canView, hotelUid]);

  // Bij selecteren van een article voor edit
  useEffect(() => {
    if (editMode && selectedArticle) {
      setEditForm({
        name: selectedArticle.name || "",
        brand: selectedArticle.brand || "",
        pricePerPurchaseUnit: selectedArticle.pricePerPurchaseUnit?.toString() || "",
        pricePerKg: selectedArticle.isWeighed
          ? selectedArticle.pricePerStockUnit?.toString() || ""
          : "",
        supplier: selectedArticle.supplier || "",
        articleNumber: selectedArticle.articleNumber || "",
        ean: selectedArticle.ean || "",
        purchaseUnit: selectedArticle.purchaseUnit || "",
        unitsPerPurchaseUnit: selectedArticle.unitsPerPurchaseUnit?.toString() || "",
        stockUnit: selectedArticle.stockUnit || "",
        vat: selectedArticle.vat?.toString() || "6",
        parentCategory: categories[selectedArticle.category]?.parentId || "",
        category: selectedArticle.category || "",
        active: selectedArticle.active !== false,
        frozen: selectedArticle.frozen ?? false,
        // Toegevoegd:
        recipeUnit: selectedArticle.recipeUnit || "",
        contentPerStockUnit: selectedArticle.contentPerStockUnit?.toString() || "",
        isWeighed: selectedArticle.isWeighed || false,
        imageUrl: selectedArticle.imageUrl || "",
        ingredientIds: ingredients
          .filter(i => Array.isArray(i.articles) && i.articles.includes(selectedArticle.id))
          .map(i => i.id),
        aliases: {
          en: selectedArticle.aliases?.en || "",
          fr: selectedArticle.aliases?.fr || "",
          nl: selectedArticle.aliases?.nl || "",
        },
      });
    }
  }, [editMode, selectedArticle, categories, ingredients]);

  // CRUD handlers
  const handleAdd = async () => {
    if (!canCreate) {
      alert(t("noAddPermission"));
      return false;
    }
    const {
      name,
      brand,
      supplier,
      articleNumber,
      ean,
      purchaseUnit,
      unitsPerPurchaseUnit,
      stockUnit,
      pricePerPurchaseUnit,
      pricePerKg,
      vat,
      category,
      active,
      frozen,
      isWeighed,
      // Toegevoegd:
      recipeUnit,
      contentPerStockUnit,
      imageUrl,
      ingredientIds = [],
      aliases,
    } = form;

    if (!purchaseUnit || !stockUnit || isNaN(parseFloat(unitsPerPurchaseUnit))) {
      alert(t("invalidUnit"));
      return false;
    }

    const _unitsPerPurchaseUnit = parseFloat(unitsPerPurchaseUnit);
    let _pricePerPurchaseUnit = parseFloat(pricePerPurchaseUnit);
    let pricePerStockUnit;
    if (isWeighed) {
      const _pricePerKg = parseFloat(pricePerKg);
      _pricePerPurchaseUnit = (_pricePerKg && _unitsPerPurchaseUnit) ? (_pricePerKg * _unitsPerPurchaseUnit) : 0;
      pricePerStockUnit = _pricePerKg || 0;
    } else {
      pricePerStockUnit = (_unitsPerPurchaseUnit && _pricePerPurchaseUnit)
        ? (_pricePerPurchaseUnit / _unitsPerPurchaseUnit)
        : 0;
    }

    setForm({
      name: "",
      pricePerPurchaseUnit: "",
      pricePerKg: "",
      brand: "",
      supplier: "",
      vat: "6",
      articleNumber: "",
      ean: "",
      active: true,
      frozen: false,
      parentCategory: "",
      category: "",
      purchaseUnit: "",
      unitsPerPurchaseUnit: "",
      stockUnit: "",
      isWeighed: false,
      recipeUnit: "",
      contentPerStockUnit: "",
      imageUrl: "",
      ingredientIds: [],
      aliases: { en: "", fr: "", nl: "" },
    });

    const newId = await addArticle({
      name,
      brand,
      supplier,
      articleNumber,
      ean,
      purchaseUnit,
      unitsPerPurchaseUnit: _unitsPerPurchaseUnit,
      stockUnit,
      pricePerPurchaseUnit: _pricePerPurchaseUnit,
      pricePerStockUnit,
      vat: parseInt(vat),
      category,
      active,
      frozen,
      isWeighed,
      recipeUnit,
      contentPerStockUnit: contentPerStockUnit ? parseFloat(contentPerStockUnit) : "",
      imageUrl: imageUrl || "",
      aliases: aliases || { en: "", fr: "", nl: "" },
    });

    await Promise.all(
      (ingredientIds || []).map(id => {
        const ing = ingredients.find(i => i.id === id);
        const current = Array.isArray(ing?.articles) ? ing.articles : [];
        return updateIngredient(hotelUid, id, {
          articles: [...current, newId],
        });
      })
    );

    getArticlesIndexed().then(setArticles);
    getIngredients(hotelUid).then(setIngredients);
    return true;
  };

  const handleEdit = async () => {
    if (!canEdit) {
      alert(t("noEditPermission"));
      return false;
    }
    if (!selectedArticle) return false;
    const {
      name,
      brand,
      pricePerPurchaseUnit,
      pricePerKg,
      supplier,
      articleNumber,
      ean,
      purchaseUnit,
      unitsPerPurchaseUnit,
      stockUnit,
      vat,
      category,
      active,
      recipeUnit,
      contentPerStockUnit,
      isWeighed,
      frozen,
      imageUrl,
      ingredientIds = [],
      aliases,
    } = editForm;


    if (!purchaseUnit || !stockUnit || isNaN(parseFloat(unitsPerPurchaseUnit))) {
      alert(t("invalidUnit"));
      return false;
    }

    const _unitsPerPurchaseUnit = parseFloat(unitsPerPurchaseUnit);
    let _pricePerPurchaseUnit = parseFloat(pricePerPurchaseUnit);
    let pricePerStockUnit;
    if (isWeighed) {
      const _pricePerKg = parseFloat(pricePerKg);
      _pricePerPurchaseUnit = (_pricePerKg && _unitsPerPurchaseUnit) ? (_pricePerKg * _unitsPerPurchaseUnit) : 0;
      pricePerStockUnit = _pricePerKg || 0;
    } else {
      pricePerStockUnit = (_unitsPerPurchaseUnit && _pricePerPurchaseUnit)
        ? (_pricePerPurchaseUnit / _unitsPerPurchaseUnit)
        : 0;
    }

    await updateArticle(hotelUid, selectedArticle.id, {
      name,
      brand,
      pricePerPurchaseUnit: _pricePerPurchaseUnit,
      supplier,
      articleNumber,
      ean,
      purchaseUnit,
      unitsPerPurchaseUnit: _unitsPerPurchaseUnit,
      stockUnit,
      vat: parseInt(vat),
      category,
      pricePerStockUnit,
      active,
      frozen,
      isWeighed,
      recipeUnit,
      contentPerStockUnit: contentPerStockUnit ? parseFloat(contentPerStockUnit) : "",
      imageUrl: imageUrl || "",
      aliases: aliases || { en: "", fr: "", nl: "" },
    });
    const currentIds = ingredients
      .filter(i => Array.isArray(i.articles) && i.articles.includes(selectedArticle.id))
      .map(i => i.id);
    const toAdd = (ingredientIds || []).filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !(ingredientIds || []).includes(id));
    await Promise.all(
      toAdd.map(id => {
        const ing = ingredients.find(i => i.id === id);
        const curr = Array.isArray(ing?.articles) ? ing.articles : [];
        return updateIngredient(hotelUid, id, { articles: [...curr, selectedArticle.id] });
      })
    );
    await Promise.all(
      toRemove.map(id => {
        const ing = ingredients.find(i => i.id === id);
        const curr = Array.isArray(ing?.articles) ? ing.articles : [];
        return updateIngredient(hotelUid, id, { articles: curr.filter(aid => aid !== selectedArticle.id) });
      })
    );
    setShowDetails(false);
    setEditMode(false);
    getArticlesIndexed().then(setArticles);
    getIngredients(hotelUid).then(setIngredients);
    return true;
  };

  const handleDelete = async () => {
    if (!canDelete) {
      alert(t("noDeletePermission"));
      return;
    }
    if (selectedArticle) {
      await deleteArticle(hotelUid, selectedArticle.id);
      setEditMode(false);
      setShowDetails(false);
      getArticlesIndexed().then(setArticles);
    }
  };


  // Filtering
  const filteredArticles = articles.filter((article) => {
    const { search, category, supplier, lastUpdate, parentCategory } = filters;
    const searchLower = search.toLowerCase();
    const matchesSearch =
      (article.name || "").toLowerCase().includes(searchLower) ||
      (article.brand || "").toLowerCase().includes(searchLower) ||
      (article.articleNumber || "").toLowerCase().includes(searchLower) ||
      (article.ean || "").toLowerCase().includes(searchLower) ||
      (article.aliases?.nl || "").toLowerCase().includes(searchLower) ||
      (article.aliases?.fr || "").toLowerCase().includes(searchLower) ||
      (article.aliases?.en || "").toLowerCase().includes(searchLower);
    const matchesCategory = category
      ? article.category === category
      : parentCategory
        ? categories[article.category]?.parentId === parentCategory
        : true;
    const matchesSupplier = supplier ? article.supplier === supplier : true;

    let matchesLastUpdate = true;
    if (lastUpdate && article.lastPriceUpdate) {
      const msOld = Date.now() - article.lastPriceUpdate;
      if (lastUpdate === "recent") matchesLastUpdate = msOld < 7776000000;
      else if (lastUpdate === "middelmatig") matchesLastUpdate = msOld >= 7776000000 && msOld < 15552000000;
      else if (lastUpdate === "oud") matchesLastUpdate = msOld >= 15552000000;
    }
    if (lastUpdate && !article.lastPriceUpdate) matchesLastUpdate = false;

    return matchesSearch && matchesCategory && matchesSupplier && matchesLastUpdate;
  });

  // Helper
  const getLastPriceUpdateColor = (date) => {
    if (!date) return "";
    const ms = Date.now() - date;
    if (ms > 15552000000) return "text-red-600 font-bold";
    if (ms > 7776000000) return "text-orange-500 font-semibold";
    return "text-green-600";
  };

  // Exports
  return {
    articles,
    setArticles,
    categories,
    suppliers,
    ingredients,
    form,
    setForm,
    filters,
    setFilters,
    selectedArticle,
    setSelectedArticle,
    showDetails,
    setShowDetails,
    editMode,
    setEditMode,
    editForm,
    setEditForm,
    handleAdd,
    handleEdit,
    handleDelete,
    filteredArticles,
    getLastPriceUpdateColor,
  };
}
