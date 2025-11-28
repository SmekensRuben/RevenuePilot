import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import ConfirmModal from "components/layout/ConfirmModal";
import PriceHistoryChart from "./PriceHistoryChart";
import ArticleForm from "./ArticleForm";
import { useTranslation } from "react-i18next";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  getArticle,
  updateArticle,
  deleteArticle,
  getArticlePriceHistory,
} from "../../services/firebaseArticles";
import { getCategories, getSuppliers } from "../../services/firebaseSettings";
import { getIngredients, updateIngredient } from "../../services/firebaseIngredients";
import { usePermission } from "../../hooks/usePermission";

export default function ArticleDetailsPage() {
  const { t } = useTranslation("articles");
  const { t: tCommon } = useTranslation("common");
  const { articleId } = useParams();
  const navigate = useNavigate();
  const { hotelUid, hotelName, language } = useHotelContext();

  const [article, setArticle] = useState(null);
  const [categories, setCategories] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [linkedIngredients, setLinkedIngredients] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [editMode, setEditMode] = useState(false);
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
    recipeUnit: "",
    contentPerStockUnit: "",
    isWeighed: false,
    imageUrl: "",
    ingredientIds: [],
    aliases: { en: "", fr: "", nl: "" },
  });
  const [priceHistory, setPriceHistory] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [art, cats, sups, ings] = await Promise.all([
        getArticle(articleId),
        getCategories(),
        getSuppliers(),
        getIngredients(hotelUid),
      ]);
      setArticle(art);
      setCategories(cats);
      setSuppliers(sups);
      setIngredients(ings);
      const linked = ings.filter(i => Array.isArray(i.articles) && i.articles.includes(articleId));
      setLinkedIngredients(linked);
      if (art) {
        setEditForm({
          name: art.name || "",
          brand: art.brand || "",
          pricePerPurchaseUnit: art.pricePerPurchaseUnit?.toString() || "",
          pricePerKg: art.isWeighed ? art.pricePerStockUnit?.toString() || "" : "",
          supplier: art.supplier || "",
          articleNumber: art.articleNumber || "",
          ean: art.ean || "",
          purchaseUnit: art.purchaseUnit || "",
          unitsPerPurchaseUnit: art.unitsPerPurchaseUnit?.toString() || "",
          stockUnit: art.stockUnit || "",
          vat: art.vat?.toString() || "6",
          parentCategory: cats[art.category]?.parentId || "",
          category: art.category || "",
          active: art.active !== false,
          frozen: art.frozen ?? false,
          recipeUnit: art.recipeUnit || "",
          contentPerStockUnit: art.contentPerStockUnit?.toString() || "",
          isWeighed: art.isWeighed || false,
          imageUrl: art.imageUrl || "",
          ingredientIds: linked.map(i => i.id),
          aliases: {
            en: art.aliases?.en || "",
            fr: art.aliases?.fr || "",
            nl: art.aliases?.nl || "",
          },
        });
        getArticlePriceHistory(hotelUid, art.id).then(setPriceHistory);
      }
    }
    fetchData();
  }, [articleId, hotelUid]);

  const canEdit = usePermission("articles", "edit");
  const canDelete = usePermission("articles", "delete");

  const handleEditSubmit = async () => {
    if (!article) return;

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
      frozen,
      recipeUnit,
      contentPerStockUnit,
      isWeighed,
      imageUrl,
      aliases,
    } = editForm;

    if (!purchaseUnit || !stockUnit || isNaN(parseFloat(unitsPerPurchaseUnit))) {
      alert(t("invalidUnit"));
      return;
    }

    const _unitsPerPurchaseUnit = parseFloat(unitsPerPurchaseUnit);
    let _pricePerPurchaseUnit = parseFloat(pricePerPurchaseUnit);
    let pricePerStockUnit;
    if (isWeighed) {
      const _pricePerKg = parseFloat(pricePerKg);
      _pricePerPurchaseUnit =
        _pricePerKg && _unitsPerPurchaseUnit ? _pricePerKg * _unitsPerPurchaseUnit : 0;
      pricePerStockUnit = _pricePerKg || 0;
    } else {
      pricePerStockUnit =
        _unitsPerPurchaseUnit && _pricePerPurchaseUnit
          ? _pricePerPurchaseUnit / _unitsPerPurchaseUnit
          : 0;
    }

    await updateArticle(hotelUid, article.id, {
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
    const originalIds = linkedIngredients.map(i => i.id);
    const newIds = editForm.ingredientIds || [];
    const toAdd = newIds.filter(id => !originalIds.includes(id));
    const toRemove = originalIds.filter(id => !newIds.includes(id));
    await Promise.all(
      toAdd.map(id => {
        const ing = ingredients.find(i => i.id === id);
        const current = Array.isArray(ing?.articles) ? ing.articles : [];
        return updateIngredient(hotelUid, id, { articles: [...current, article.id] });
      })
    );
    await Promise.all(
      toRemove.map(id => {
        const ing = ingredients.find(i => i.id === id);
        const current = Array.isArray(ing?.articles) ? ing.articles : [];
        return updateIngredient(hotelUid, id, { articles: current.filter(aid => aid !== article.id) });
      })
    );
    const refreshed = await getIngredients(hotelUid);
    setIngredients(refreshed);
    setLinkedIngredients(
      refreshed.filter(i => Array.isArray(i.articles) && i.articles.includes(article.id))
    );
    const updated = await getArticle(article.id);
    setArticle(updated);
    setEditMode(false);
  };

  const handleDelete = async () => {
    if (!article) return;
    await deleteArticle(hotelUid, article.id);
    navigate("/articles");
  };

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

  if (!article) {
    return <div className="p-4">{t("noArticle")}</div>;
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4 text-center">{article.name}</h1>
        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt={article.name}
            className="mb-6 w-40 h-40 object-contain mx-auto"
          />
        )}

        {editMode ? (
          <ArticleForm
            form={editForm}
            setForm={setEditForm}
            categories={categories}
            suppliers={suppliers}
            ingredients={ingredients}
            submitLabel={t("save")}
            onCancel={() => setEditMode(false)}
            onSubmit={handleEditSubmit}
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-semibold mb-2">{t("details")}</h2>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between"><dt className="font-medium">{t("brand")}</dt><dd>{article.brand || "-"}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("supplier")}</dt><dd>{article.supplier || "-"}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("articleNumber")}</dt><dd>{article.articleNumber || "-"}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("ean")}</dt><dd>{article.ean || "-"}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("category")}</dt><dd>{categories[article.category]?.label || article.category || "-"}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("frozen")}</dt><dd>{article.frozen ? "✅" : "❌"}</dd></div>
                </dl>
              </div>
              <div className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-semibold mb-2">{t("pricing")}</h2>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between"><dt className="font-medium">{t("pricePerPurchaseUnit")}</dt><dd>€{(article.pricePerPurchaseUnit ?? 0).toFixed(2)}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("pricePerStockUnitLabel", { unit: article.stockUnit || "" })}</dt><dd>€{(article.pricePerStockUnit ?? 0).toFixed(4)}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("vat")}</dt><dd>{article.vat}%</dd></div>
                </dl>
              </div>
              <div className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-semibold mb-2">{t("units")}</h2>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between"><dt className="font-medium">{t("purchaseUnit")}</dt><dd>{article.purchaseUnit}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{article.isWeighed ? t("kgPerPurchaseUnit") : t("unitsPerPurchaseUnit")}</dt><dd>{article.unitsPerPurchaseUnit}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("stockUnit")}</dt><dd>{article.stockUnit}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("recipeUnit")}</dt><dd>{article.recipeUnit}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("contentPerStockUnit")}</dt><dd>{article.contentPerStockUnit} {article.recipeUnit}</dd></div>
                </dl>
              </div>
              <div className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-semibold mb-2">{t("status")}</h2>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between"><dt className="font-medium">{t("isWeighed")}</dt><dd>{article.isWeighed ? "✅" : "❌"}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("active")}</dt><dd>{article.active ? "✅" : "❌"}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">{t("lastUpdatedPrice")}</dt><dd>{article.lastPriceUpdate ? new Date(article.lastPriceUpdate).toLocaleDateString(locale) : "-"}</dd></div>
                </dl>
              </div>
              <div className="bg-white rounded-2xl shadow p-4 md:col-span-2 lg:col-span-3">
                <h2 className="font-semibold mb-2">{t("linkedIngredients")}</h2>
                {linkedIngredients.length > 0 ? (
                  <ul className="list-disc pl-4 text-sm space-y-1">
                    {linkedIngredients.map(ing => (
                      <li key={ing.id}>{ing.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">{t("noLinkedIngredients")}</p>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow p-4 md:col-span-2 lg:col-span-3">
                <h2 className="font-semibold mb-2">{t("priceHistory")}</h2>
                <PriceHistoryChart history={priceHistory} />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {canEdit && (
                <button
                  onClick={() => setEditMode(true)}
                  className="bg-black text-white px-4 py-2"
                >
                  {t("edit")}
                </button>
              )}
              <button
                onClick={() => navigate(-1)}
                className="bg-gray-200 text-gray-800 px-4 py-2"
              >
                {t("close")}
              </button>
              {canDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="bg-red-600 text-white px-4 py-2"
                >
                  {t("delete")}
                </button>
              )}
            </div>
          </>
        )}
      </PageContainer>
      <ConfirmModal
        open={confirmDelete}
        title={t("deleteConfirmationTitle")}
        message={t("deleteConfirmationMessage")}
        onConfirm={() => {
          setConfirmDelete(false);
          handleDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

