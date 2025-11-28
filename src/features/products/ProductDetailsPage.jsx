import React, { useEffect, useState, useMemo } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ALLERGENS, ALLERGEN_ICONS } from "../../constants/allergens";
import { doc, getDoc, db } from "../../firebaseConfig";
import { getIngredients } from "services/firebaseIngredients";
import { getRecipesIndexed } from "services/firebaseRecipes";
import { getProductCategories } from "services/firebaseSettings";
import { getArticlesIndexed } from "services/firebaseArticles";
import { calculateCostAndFoodcost } from "./productHelpers";
import { deleteProduct } from "./productsService";
import { usePermission } from "../../hooks/usePermission";
import { Pencil, Trash2, FileText, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { exportProductPDF } from "./exportProductPDF";
import { Dialog } from "@headlessui/react";

/**
 * Product details page — refined
 * - Removed gradient for maximum readability
 * - De-duplicated: dropped the "Overzicht" card (data lives in hero + stats)
 * - Added Outlets pill to the hero meta row
 * - Allergens shown as a single, full-width card below the hero
 * - Ingredients & Recipes keep clean tables
 * - Steps use timeline cards with comfortable spacing
 */
export default function ProductDetailsPage() {
  const { hotelUid, hotelName, language } = useHotelContext();
  const { productId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("products");
  const { t: tCommon } = useTranslation("common");
  const { t: tIngredients } = useTranslation("ingredients");

  const [product, setProduct] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [articles, setArticles] = useState([]);
  const [productCategories, setProductCategories] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  const canEdit = usePermission("products", "edit");
  const canDelete = usePermission("products", "delete");

  const handleExport = async () => {
    if (!product) return;
    await exportProductPDF({
      product,
      ingredients,
      recipes,
      productCategories,
      tIngredients,
      tProducts: t,
    });
  };

  useEffect(() => {
    if (!hotelUid || !productId) return;
    const load = async () => {
      const snap = await getDoc(doc(db, `hotels/${hotelUid}/products/${productId}`));
      if (snap.exists()) setProduct({ id: snap.id, ...snap.data() });
    };
    load();
    getIngredients(hotelUid).then(res => setIngredients(res.filter(ing => ing.active !== false)));
    getRecipesIndexed(hotelUid).then(setRecipes);
    getArticlesIndexed(hotelUid).then(setArticles);
    getProductCategories().then(setProductCategories);
  }, [hotelUid, productId]);

  const handleDelete = async () => {
    if (!canDelete || !product) return;
    if (window.confirm(t("details.deleteConfirm", { name: product.name }))) {
      await deleteProduct(hotelUid, product.id);
      navigate("/products");
    }
  };

  const { kostprijs, foodcostPct } = useMemo(() => {
    if (!product) {
      return { kostprijs: 0, foodcostPct: 0 };
    }
    return calculateCostAndFoodcost(product, ingredients, recipes, articles);
  }, [product, ingredients, recipes, articles]);

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

  if (!product) return null;

  const productAllergens = ALLERGENS.filter(a =>
    (product.composition || []).some(row => {
      const ing = ingredients.find(i => i.id === row.ingredientId);
      return ing?.allergens?.[a];
    })
  );

  const outletsText = product.outlets?.length ? product.outlets.join(", ") : null;

  const handleLogout = () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer className="max-w-6xl">
        {/* Breadcrumb / Back */}
        <div className="mb-4 flex items-center gap-3 text-sm text-gray-600">
          <button onClick={() => navigate("/products")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4" /> {t("details.back")}
          </button>
        </div>

        {/* HERO (clean, no gradient) */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">{product.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  {product.active !== false ? <CheckCircle2 className="h-4 w-4"/> : <XCircle className="h-4 w-4"/>}
                  {product.active !== false ? t("status.active") : t("status.inactive")}
                </span>
                {product.category && (
                  <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-gray-700 ring-1 ring-inset ring-gray-200">
                    {productCategories[product.category]?.label || product.category}
                  </span>
                )}
                {outletsText && (
                  <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-gray-700 ring-1 ring-inset ring-gray-200">
                    {t("details.outletsLabel")}: {outletsText}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-gray-50">
                <FileText className="h-4 w-4" /> {t("details.exportPdf")}
              </button>
              {canEdit && (
                <button onClick={() => navigate(`/products/${product.id}/edit`)} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black">
                  <Pencil className="h-4 w-4" /> {t("details.edit")}
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200 transition hover:bg-red-100">
                  <Trash2 className="h-4 w-4" /> {t("details.delete")}
                </button>
              )}
            </div>
          </div>

          {/* Compact stats ribbon (no duplication elsewhere) */}
          <div className="grid grid-cols-1 gap-4 border-t border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">

            <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
              <div className="text-xs text-gray-500">{t("details.priceInclVat")}</div>
              <div className="mt-1 text-base font-semibold">{product.price != null ? `€${Number(product.price).toFixed(2)}` : "-"}</div>
            </div>
            <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
              <div className="text-xs text-gray-500">{t("details.vat")}</div>
              <div className="mt-1 text-base font-semibold">{product.vat != null ? `${product.vat}%` : "-"}</div>
            </div>
            <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
              <div className="text-xs text-gray-500">{t("details.costExclVat")}</div>
              <div className="mt-1 text-base font-semibold">€{kostprijs.toFixed(2)}</div>
            </div>
            <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
              <div className="text-xs text-gray-500">{t("details.foodcost")}</div>
              <div className="mt-1 text-base font-semibold">{foodcostPct.toFixed(1)}%</div>
            </div>
            <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
              <div className="text-xs text-gray-500">{t("details.lightspeedId")}</div>
              <div className="mt-1 text-base font-semibold">{product.lightspeedId || "-"}</div>
            </div>
            <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
              <div className="text-xs text-gray-500">{t("details.saleUnit")}</div>
              <div className="mt-1 text-base font-semibold">{product.saleUnit || "-"}</div>
            </div>
          </div>
        </div>

        {/* Allergens — full width card */}
        <div className="mt-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold tracking-tight">{tIngredients("allergensLabel")}</h3>
            {productAllergens.length ? (
              <ul className="flex flex-wrap gap-2">
                {productAllergens.map((a) => {
                  const Icon = ALLERGEN_ICONS[a];
                  return (
                    <li key={a} className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                      <Icon className="h-4 w-4" /> {tIngredients(`allergens.${a}`)}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="italic text-gray-400">-</p>
            )}
          </div>
        </div>

        {/* INGREDIENTS & RECIPES */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">{t("details.ingredients")}</h2>
            {product.composition?.length ? (
              <div className="overflow-hidden rounded-lg ring-1 ring-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{t("details.ingredient")}</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">{t("details.quantity")}</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">{t("details.yield")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {product.composition.map((row, idx) => {
                      const ing = ingredients.find(i => i.id === row.ingredientId);
                      const unit = ing?.unit ? ` ${ing.unit}` : "";
                      const yieldValue =
                        row.yield === undefined || row.yield === null || row.yield === ""
                          ? 100
                          : Number(row.yield);
                      const yieldText = Number.isFinite(yieldValue)
                        ? `${yieldValue % 1 === 0 ? yieldValue : yieldValue.toFixed(2)}%`
                        : "-";
                      return (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-900">{ing?.name || row.ingredientId}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-900">{row.quantity}{unit}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-900">{yieldText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="italic text-gray-400">-</p>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">{t("details.recipes")}</h2>
            {product.recipes?.length ? (
              <div className="overflow-hidden rounded-lg ring-1 ring-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{t("details.recipe")}</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">{t("details.quantity")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {product.recipes.map((row, idx) => {
                      const recipe = recipes.find(r => r.id === row.recipeId);
                      const unit = recipe?.contentUnit ? ` ${recipe.contentUnit}` : "";
                      return (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-900">{recipe?.name || row.recipeId}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-900">{row.quantity}{unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="italic text-gray-400">-</p>
            )}
          </section>
        </div>

        {/* STEPS TIMELINE (unchanged from refined card-version) */}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">{t("details.steps")}</h2>
          {product.steps?.length ? (
            <ol className="relative ml-3 border-l border-gray-200 pl-6">
              {product.steps.map((step, idx) => (
                <li key={idx} className="mb-8 last:mb-0">
                  <span className="absolute -left-[9px] mt-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-gray-300 ring-2 ring-gray-200" />
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{t("details.step", { index: idx + 1 })}</p>
                    </div>
                    {step.description && (
                      <p className="mb-4 text-sm leading-6 text-gray-700">{step.description}</p>
                    )}
                    {(step.photos || []).length > 0 && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {step.photos.map((url, i) => (
                          <button key={i} type="button" onClick={() => setPreviewImage(url)} className="group block overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                            <img src={url} alt="step" className="h-32 w-full object-cover transition group-hover:brightness-105 sm:h-36" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="italic text-gray-400">-</p>
          )}
        </section>
      </PageContainer>

      {/* Image preview */}
      <Dialog open={!!previewImage} onClose={() => setPreviewImage(null)} className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        {previewImage && (
          <Dialog.Panel>
            <img src={previewImage} alt="preview" className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
          </Dialog.Panel>
        )}
      </Dialog>
    </>
  );
}
