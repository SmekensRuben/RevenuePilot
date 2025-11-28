// src/features/products/ProductsPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { getOutlets, getProductCategories } from "services/firebaseSettings";
import { getIngredients } from "services/firebaseIngredients";
import { getArticlesIndexed } from "services/firebaseArticles";
import { getRecipesIndexed } from "services/firebaseRecipes";
import ProductTable from "./ProductTable";
import Pagination from "shared/Pagination";
import { calculateCostAndFoodcost } from "./productHelpers";
import { getProductsIndexed } from "services/firebaseProducts";
import { usePermission } from "../../hooks/usePermission";
import { useNavigate } from "react-router-dom";

export default function ProductsPage() {
  const { t } = useTranslation("products");
  const { t: tCommon } = useTranslation("common");
  const { hotelUid, hotelName, language } = useHotelContext();
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [productCategories, setProductCategories] = useState({});
  const navigate = useNavigate();
  const [parentCategoryFilter, setParentCategoryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const canCreate = usePermission("products", "create");
  const canEdit = usePermission("products", "edit");

  const parentCategoryOptions = useMemo(() => {
    const list = Object.entries(productCategories).map(([key, val]) => ({ key, ...val }));
    const map = {};
    list.forEach(cat => {
      map[cat.key] = { ...cat, childCount: 0 };
    });
    list.forEach(cat => {
      if (cat.parentId && map[cat.parentId]) {
        map[cat.parentId].childCount += 1;
      }
    });
    return Object.values(map)
      .filter(cat => !cat.parentId && cat.childCount > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [productCategories]);

  const childCategoryOptions = useMemo(() => {
    return Object.entries(productCategories)
      .filter(([key, val]) => val.parentId === parentCategoryFilter)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [productCategories, parentCategoryFilter]);

  // Header: today in English
  const locale = language === "en" ? "en-GB" : language === "fr" ? "fr-FR" : "nl-NL";
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [locale]
  );

  useEffect(() => {
    getProductsIndexed(hotelUid).then(setProducts);
    getIngredients(hotelUid).then(res =>
      setIngredients(res.filter(ing => ing.active !== false))
    );
    getArticlesIndexed(hotelUid).then(setArticles);
    getRecipesIndexed(hotelUid).then(setRecipes);
    getOutlets(hotelUid).then(_outlets => setOutlets(_outlets || []));
    getProductCategories().then(setProductCategories);
  }, [hotelUid]);

  const handleLogout = () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const handleShowDetails = (product) => {
    navigate(`/products/${product.id}`);
  };

  const handleEdit = (product) => {
    if (!canEdit) return;
    navigate(`/products/${product.id}/edit`);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredProducts = products.filter(product => {
    if (outletFilter && !(product.outlets && product.outlets.includes(outletFilter))) return false;
    if (categoryFilter) {
      if (product.category !== categoryFilter) return false;
    } else if (parentCategoryFilter) {
      if (productCategories[product.category]?.parentId !== parentCategoryFilter) return false;
    }
    if (search) {
      const lower = search.toLowerCase();
      const nameMatch = product.name?.toLowerCase().includes(lower);
      const categoryLabel = productCategories[product.category]?.label?.toLowerCase() || "";
      const categoryMatch = categoryLabel.includes(lower);
      return nameMatch || categoryMatch;
    }
    return true;
  });

  const sortedProducts = useMemo(() => {
    const getValue = (p) => {
      switch (sortField) {
        case "saleUnit":
          return p.saleUnit || "";
        case "price":
          return p.price || 0;
        case "cost":
          return calculateCostAndFoodcost(p, ingredients, recipes, articles).kostprijs;
        case "foodcost":
          return calculateCostAndFoodcost(p, ingredients, recipes, articles).foodcostPct;
        case "outlets":
          return p.outlets ? p.outlets.join(", ") : "";
        case "category":
          return productCategories[p.category]?.label || "";
        case "active":
          return p.active !== false;
        default:
          return p.name || "";
      }
    };
    return [...filteredProducts].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const valA = getValue(a);
      const valB = getValue(b);
      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * dir;
      }
      return String(valA).localeCompare(String(valB), undefined, { sensitivity: "base" }) * dir;
    });
  }, [filteredProducts, sortField, sortDir, ingredients, recipes, articles, productCategories]);

useEffect(() => {
  setPage(1);
}, [search, parentCategoryFilter, categoryFilter, outletFilter, sortField, sortDir]);


  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = sortedProducts.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
        {/* Filterbalk */}
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
          <div className="flex-1">
            <select
              value={parentCategoryFilter}
              onChange={e => { setParentCategoryFilter(e.target.value); setCategoryFilter(""); }}
              className="border px-3 py-2 w-full"
            >
              <option value="">{t("allParentCategories")}</option>
              {parentCategoryOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="border px-3 py-2 w-full"
              disabled={!parentCategoryFilter}
            >
              <option value="">{t("allSubcategories")}</option>
              {childCategoryOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <select
              value={outletFilter}
              onChange={e => setOutletFilter(e.target.value)}
              className="border px-3 py-2 w-full"
            >
              <option value="">{t("allOutlets")}</option>
              {outlets.map(o => (
                <option key={o.id || o.name} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {canCreate && (
          <button
            className="mb-6 bg-[#b41f1f] text-white px-4 py-2 rounded hover:bg-[#a41a1a]"
            onClick={() => navigate("/products/new")}
          >
            + {t("newProduct")}
          </button>
        )}
        <ProductTable
          products={paginatedProducts}
          ingredients={ingredients}
          recipes={recipes}
          articles={articles}
          categories={productCategories}
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
      </PageContainer>
    </>
  );
}
