import React, { useState, useMemo, useEffect, useRef } from "react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import useArticles from "./useArticles";
import ArticleFilters from "./ArticleFilters";
import ArticleForm from "./ArticleForm";
import ArticlesTable from "./ArticlesTable";
import Pagination from "shared/Pagination";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { usePermission } from "../../hooks/usePermission";
import { useNavigate, useLocation } from "react-router-dom";
import Papa from "papaparse";
import { Plus, X, Upload, Download } from "lucide-react";
import { addArticle, getArticlesIndexed } from "../../services/firebaseArticles";

export default function ArticlesPage() {
  const { t } = useTranslation("articles");
  const { t: tCommon } = useTranslation("common");
  const { hotelUid, hotelName, language } = useHotelContext();
  const navigate = useNavigate();
  const location = useLocation();
  const canView = usePermission("articles", "view");
  const canCreate = usePermission("articles", "create");
  const allowedSortFields = useMemo(
    () => new Set(["name", "purchaseUnit", "brand", "pricePerPurchaseUnit", "lastPriceUpdate", "supplier", "active"]),
    []
  );
  const initialParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [sortField, setSortField] = useState(() => {
    const field = initialParams.get("sortField");
    return field && allowedSortFields.has(field) ? field : "name";
  });
  const [sortDir, setSortDir] = useState(() => {
    const dir = initialParams.get("sortDir");
    return dir === "desc" ? "desc" : "asc";
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [page, setPage] = useState(() => {
    const urlPage = parseInt(initialParams.get("page"), 10);
    return Number.isFinite(urlPage) && urlPage > 0 ? urlPage : 1;
  });
  const ITEMS_PER_PAGE = 50;
  const importInputRef = useRef(null);
  const hasInitializedFilters = useRef(false);

  if (!canView) return <div>{t("noAccess")}</div>;

  // Custom hook met alle state & handlers
  const {
    articles,
    setArticles,
    categories,
    suppliers,
    ingredients,
    form,
    setForm,
    filters,
    setFilters,
    handleAdd,
    filteredArticles,
    getLastPriceUpdateColor,
  } = useArticles(hotelUid);

  useEffect(() => {
    if (prefillApplied) return;
    if (!canCreate) return;

    const params = new URLSearchParams(location.search);
    if (!params.has("prefillArticle")) return;

    const rawPrice = params.get("pricePerPurchaseUnit") || "";
    const parsedPrice = parseFloat(rawPrice);
    const updates = {};

    const maybeAssign = (key, value) => {
      if (typeof value === "string" && value.trim()) {
        updates[key] = value.trim();
      }
    };

    maybeAssign("name", params.get("name") || "");
    maybeAssign("brand", params.get("brand") || "");
    maybeAssign("articleNumber", params.get("articleNumber") || "");
    maybeAssign("supplier", params.get("supplier") || "");
    maybeAssign("imageUrl", params.get("imageUrl") || "");

    if (!Number.isNaN(parsedPrice) && parsedPrice >= 0) {
      updates.pricePerPurchaseUnit = parsedPrice.toString();
    }

    if (Object.keys(updates).length > 0) {
      setForm(prev => ({ ...prev, ...updates }));
      setShowAddForm(true);
    }

    setPrefillApplied(true);
    navigate(location.pathname, { replace: true });
  }, [prefillApplied, canCreate, location.search, location.pathname, navigate, setForm, setShowAddForm]);

  const parentCategoryOptions = useMemo(() => {
    const list = Object.entries(categories).map(([key, val]) => ({ key, ...val }));
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
  }, [categories]);

  const childCategoryOptions = useMemo(() => {
    return Object.entries(categories)
      .filter(([key, val]) => val.parentId === filters.parentCategory)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories, filters.parentCategory]);


  // Date voor in de header
  const locale = language === "en" ? "en-GB" : language === "fr" ? "fr-FR" : "nl-NL";
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [locale]
  );

  // Optioneel: logout functionaliteit
  // (Je kan dit ook in een aparte hook/context stoppen)
  const handleLogout = async () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const sortedArticles = useMemo(() => {
    return [...filteredArticles].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      // Voor getallen en booleans
      if (typeof a[sortField] === "number" || typeof a[sortField] === "boolean") {
        return (a[sortField] - b[sortField]) * dir;
      }
      // Voor strings (case-insensitive)
      return String(a[sortField] || "").localeCompare(String(b[sortField] || ""), undefined, { sensitivity: "base" }) * dir;
    });
  }, [filteredArticles, sortField, sortDir]);

  useEffect(() => {
    if (!hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      return;
    }

    setPage(1);
  }, [
    sortField,
    sortDir,
    filters.search,
    filters.parentCategory,
    filters.category,
    filters.supplier,
    filters.lastUpdate,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let shouldUpdate = false;

    if (params.get("sortField") !== sortField) {
      params.set("sortField", sortField);
      shouldUpdate = true;
    }

    if (params.get("sortDir") !== sortDir) {
      params.set("sortDir", sortDir);
      shouldUpdate = true;
    }

    if (params.get("page") !== page.toString()) {
      params.set("page", page.toString());
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate, page, sortDir, sortField]);


  const totalPages = Math.ceil(sortedArticles.length / ITEMS_PER_PAGE) || 1;
  const paginatedArticles = sortedArticles.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleExport = () => {
    const exportData = articles.map(({ pricePerStockUnit, lastPriceUpdate, ...rest }) => rest);
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = t("exportFileName");
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
      for (const row of data) {
        try {
          const pricePerPurchaseUnit = row.pricePerPurchaseUnit
            ? parseFloat(row.pricePerPurchaseUnit)
            : "";
          const unitsPerPurchaseUnit = row.unitsPerPurchaseUnit
            ? parseFloat(row.unitsPerPurchaseUnit)
            : "";
          const pricePerStockUnit =
            unitsPerPurchaseUnit && pricePerPurchaseUnit
              ? pricePerPurchaseUnit / unitsPerPurchaseUnit
              : 0;
          await addArticle({
            name: row.name || "",
            brand: row.brand || "",
            supplier: row.supplier || "",
            articleNumber: row.articleNumber || "",
            ean: row.ean || "",
            purchaseUnit: row.purchaseUnit || "",
            unitsPerPurchaseUnit,
            stockUnit: row.stockUnit || "",
            pricePerPurchaseUnit,
            pricePerStockUnit,
            vat: row.vat ? parseInt(row.vat) : 6,
            category: row.category || "",
            active:
              row.active === undefined || row.active === "true" || row.active === true,
            frozen: row.frozen === "true" || row.frozen === true,
            recipeUnit: row.recipeUnit || "",
            contentPerStockUnit: row.contentPerStockUnit
              ? parseFloat(row.contentPerStockUnit)
              : "",
            isWeighed: row.isWeighed === "true" || row.isWeighed === true,
            imageUrl: row.imageUrl || "",
          });
        } catch (err) {
          console.error("Failed to import row", row, err);
        }
      }
      getArticlesIndexed(hotelUid).then(setArticles);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>


        {/* Actieknoppen */}
          {canCreate && (
            <div className="mb-4 flex items-center gap-2 justify-end">
            <button
              className="bg-marriott text-white p-2 rounded-lg hover:bg-marriott-dark shadow"
              onClick={() => setShowAddForm(prev => !prev)}
              title={showAddForm ? t("cancel") : t("newArticle")}
            >
              {showAddForm ? (
                <X className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>
            <input
              type="file"
              accept=".csv"
              ref={importInputRef}
              className="hidden"
              onChange={handleImport}
            />
            <button
              className="bg-marriott text-white p-2 rounded-lg hover:bg-marriott-dark shadow"
              onClick={() => importInputRef.current && importInputRef.current.click()}
              title={t("importList")}
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              className="bg-marriott text-white p-2 rounded-lg hover:bg-marriott-dark shadow"
              onClick={handleExport}
              title={t("exportList")}
            >
              <Upload className="w-5 h-5" />
            </button>
          </div>
        )}

        {showAddForm && canCreate && (
          <div className="mb-6">
            <ArticleForm
              form={form}
              setForm={setForm}
              categories={categories}
              suppliers={suppliers}
              ingredients={ingredients}
              submitLabel={t("add")}
              onCancel={() => setShowAddForm(false)}
              onSubmit={async () => {
                const ok = await handleAdd();
                if (ok) setShowAddForm(false);
              }}
            />
          </div>
        )}

        {/* Filters */}
        <ArticleFilters
          search={filters.search}
          onSearchChange={val => setFilters(f => ({ ...f, search: val }))}
          parentCategory={filters.parentCategory}
          onParentCategoryChange={val => setFilters(f => ({ ...f, parentCategory: val, category: "" }))}
          category={filters.category}
          onCategoryChange={val => setFilters(f => ({ ...f, category: val }))}
          parentCategoryOptions={parentCategoryOptions}
          childCategoryOptions={childCategoryOptions}
          supplier={filters.supplier}
          onSupplierChange={val => setFilters(f => ({ ...f, supplier: val }))}
          suppliers={suppliers}
          lastUpdate={filters.lastUpdate}
          onLastUpdateChange={val => setFilters(f => ({ ...f, lastUpdate: val }))}
        />

        {/* Tabel met alle ingrediënten */}
        <ArticlesTable
          articles={paginatedArticles}
          onSelect={article => navigate(`/articles/${article.id}`)}
          getLastPriceUpdateColor={getLastPriceUpdateColor}
          categories={categories}
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
