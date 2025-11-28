import React, { useState, useMemo, useRef, useEffect } from "react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import useIngredients from "./useIngredients";
import IngredientFilters from "./IngredientFilters";
import IngredientForm from "./IngredientForm";
import IngredientsTable from "./IngredientsTable";
import IngredientDetailDialog from "./IngredientDetailDialog";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { Plus, X, Upload, Download } from "lucide-react";
import { usePermission } from "../../hooks/usePermission";
import * as XLSX from "xlsx";
import { updateIngredient, getIngredientsIndexed } from "../../services/firebaseIngredients";
import { useLocation, useNavigate } from "react-router-dom";

export default function IngredientsPage() {
  const { t } = useTranslation("ingredients");
  const { t: tCommon } = useTranslation("common");
  const { hotelUid, hotelName, language } = useHotelContext();
  const location = useLocation();
  const navigate = useNavigate();
  const canView = usePermission("ingredients", "view");
  const canCreate = usePermission("ingredients", "create");
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const importInputRef = useRef(null);

  const normalizeText = text =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, "");

  if (!canView) return <div>{t("noAccess")}</div>;

  const {
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
    handleAdd,
    handleEdit,
    handleDelete,
    filteredIngredients,
    categories,
  } = useIngredients(hotelUid);

  const [prefillFromArticle, setPrefillFromArticle] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);

  useEffect(() => {
    if (!location.state) return;

    const { prefillIngredient, returnTo } = location.state;
    if (prefillIngredient) {
      setPrefillFromArticle(prefillIngredient);
    }
    if (returnTo) {
      setReturnTarget(returnTo);
    }
    if (prefillIngredient || returnTo) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!prefillFromArticle) return;
    const { category, articleId, name, unit } = prefillFromArticle;

    if (category && !categories[category]) {
      return;
    }

    const parentCategoryId =
      category && categories[category]?.parentId
        ? categories[category].parentId
        : prefillFromArticle.parentCategory || "";

    setForm(prev => ({
      ...prev,
      name: name || "",
      unit: unit || "",
      articles: articleId ? [articleId] : [],
      category: category || "",
      parentCategory: parentCategoryId || "",
    }));
    setShowAddForm(true);
    setPrefillFromArticle(null);
  }, [prefillFromArticle, categories, setForm]);

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

  const handleLogout = async () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const handleExport = () => {
    if (!Array.isArray(ingredients) || ingredients.length === 0) return;
    const header = [
      t("exportHeaders.id"),
      t("exportHeaders.name"),
      t("exportHeaders.aliasEn"),
      t("exportHeaders.aliasFr"),
      t("exportHeaders.aliasNl"),
    ];
    const rows = ingredients.map(ing => [
      ing.id || "",
      ing.name || "",
      ing.aliases?.en || "",
      ing.aliases?.fr || "",
      ing.aliases?.nl || "",
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, t("exportSheetName"));
    XLSX.writeFile(wb, t("exportFileName"));
  };

  const handleImport = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      for (const row of rows.slice(1)) {
        const [id, name, aliasEn, aliasFr, aliasNl] = row;
        if (!id) continue;
        const updateData = {};
        if (name) updateData.name = name;
        const aliases = {};
        if (aliasEn) aliases.en = aliasEn;
        if (aliasFr) aliases.fr = aliasFr;
        if (aliasNl) aliases.nl = aliasNl;
        if (Object.keys(aliases).length > 0) updateData.aliases = aliases;
        if (Object.keys(updateData).length > 0) {
          // eslint-disable-next-line no-await-in-loop
          await updateIngredient(hotelUid, id, updateData);
        }
      }
      getIngredientsIndexed(hotelUid).then(arr =>
        setIngredients(
          arr.map(ingredient => ({
            ...ingredient,
            normalizedName: normalizeText(ingredient.name),
            normalizedAliases: Object.values(ingredient.aliases || {}).map(normalizeText),
          }))
        )
      );
    } catch (err) {
      console.error("Import failed", err);
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const sortedIngredients = useMemo(() => {
    return [...filteredIngredients].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "articles") {
        const lenA = a.articles ? a.articles.length : 0;
        const lenB = b.articles ? b.articles.length : 0;
        return (lenA - lenB) * dir;
      }
      if (typeof a[sortField] === "number" || typeof a[sortField] === "boolean") {
        return (a[sortField] - b[sortField]) * dir;
      }
      return (
        String(a[sortField] || "").localeCompare(
          String(b[sortField] || ""),
          undefined,
          { sensitivity: "base" }
        ) * dir
      );
    });
  }, [filteredIngredients, sortField, sortDir]);

  const parentCategoryOptions = useMemo(() => {
    const list = Object.entries(categories).map(([key, val]) => ({ key, ...val }));
    const map = {};
    list.forEach(cat => { map[cat.key] = { ...cat, childCount: 0 }; });
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

  const handleSort = field => {
    if (sortField === field) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
        {canCreate && (
          <div className="mb-4 flex items-center gap-2 justify-end">
            <button
              className="bg-marriott text-white p-2 rounded-lg hover:bg-marriott-dark shadow"
              onClick={() => setShowAddForm(prev => !prev)}
              title={showAddForm ? t("cancel") : t("newIngredient")}
            >
              {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
            <input
              type="file"
              accept=".xlsx,.xls"
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
            <IngredientForm
              form={form}
              setForm={setForm}
              articles={articles}
              ingredients={ingredients}
              categories={categories}
              onSubmit={async () => {
                const success = await handleAdd();
                if (!success) return;
                setShowAddForm(false);
                if (returnTarget) {
                  const { pathname = "/", search = "", state: navState = {}, replace = true } = returnTarget;
                  navigate({ pathname, search }, { state: navState, replace });
                  setReturnTarget(null);
                }
              }}
            />
          </div>
        )}
        <IngredientFilters
          search={filters.search}
          onSearchChange={val => setFilters(f => ({ ...f, search: val }))}
          parentCategory={filters.parentCategory}
          onParentCategoryChange={val =>
            setFilters(f => ({ ...f, parentCategory: val, category: "" }))
          }
          category={filters.category}
          onCategoryChange={val => setFilters(f => ({ ...f, category: val }))}
          parentCategoryOptions={parentCategoryOptions}
          childCategoryOptions={childCategoryOptions}
        />
        <IngredientsTable
          ingredients={sortedIngredients}
          categories={categories}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          onSelect={ing => {
            setSelectedIngredient(ing);
            setShowDetails(true);
            setEditMode(false);
          }}
        />
        <IngredientDetailDialog
          open={showDetails}
          onClose={() => {
            setShowDetails(false);
            setEditMode(false);
          }}
          ingredient={selectedIngredient}
          articles={articles}
          ingredients={ingredients}
          categories={categories}
          editMode={editMode}
          setEditMode={setEditMode}
          editForm={editForm}
          setEditForm={setEditForm}
          onEditSubmit={handleEdit}
          onDelete={handleDelete}
        />
      </PageContainer>
    </>
  );
}
