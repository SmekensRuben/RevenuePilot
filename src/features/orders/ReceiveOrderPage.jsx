import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useHotelContext } from "contexts/HotelContext";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";
import ReceiveOrderItemCard from "./ReceiveOrderItemCard";
import AddProductModal from "./AddProductModal";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Dialog } from "@headlessui/react";
import { Combobox } from "components/ui/combobox";
import { getOrder, setOrderReceived, getIngredients } from "./orderService";
import { getArticlesIndexed } from "../../services/firebaseArticles";

export default function ReceiveOrderPage() {
  const { hotelUid, hotelName, language } = useHotelContext();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("orders");

  const [order, setOrder] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [ingredientToEdit, setIngredientToEdit] = useState(null);
  const [editIndex, setEditIndex] = useState(-1);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  

  const locale = language === "fr" ? "fr-FR" : language === "en" ? "en-GB" : "nl-BE";

  const today = new Date().toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [ings, arts, o] = await Promise.all([
        getIngredients(hotelUid),
        getArticlesIndexed(hotelUid),
        getOrder(hotelUid, orderId),
      ]);
      setIngredients(ings);
      setArticles(arts.filter(a => a.active !== false));
      setOrder(o);
      setLines(
        (o.items || o.articles || []).map(item => {
          const { articles: _unused, ...rest } = item;
          const ing = ings.find(i => i.id === item.ingredientId);
          const isWeighed = item.isWeighed ?? ing?.isWeighed ?? false;
          return {
            ...rest,
            isWeighed,
            received: item.quantity,
            shortage: 0,
            receivedWeight: isWeighed ? "" : undefined,
            imageUrl: item.imageUrl || ing?.imageUrl || "",
          };
        })
      );
      setLoading(false);
    }
    fetchData();
  }, [hotelUid, orderId]);


  const handleChange = (idx, field, value) => {
    setLines(lines =>
      lines.map((line, i) =>
        i === idx
          ? {
              ...line,
              [field]: Math.max(0, Number(value)),
              shortage:
                field === "received"
                  ? Math.max(0, line.quantity - Number(value))
                  : line.shortage,
            }
          : line
      )
    );
  };

  function handleChangeArticle(idx) {
    const line = lines[idx];
    const ing = ingredients.find(i => i.id === line.ingredientId);
    if (!ing) return;
    setIngredientToEdit(ing);
    setEditIndex(idx);
    setShowArticleModal(true);
  }

  function handleAddProduct(ing) {
    if (!ing) return;
    setIngredientToEdit(ing);
    setEditIndex(-1);
    setShowArticleModal(true);
  }

  function confirmChangeArticle(qty, article) {
    if (editIndex >= 0) {
      setLines(lines =>
        lines.map((line, i) =>
          i === editIndex
            ? {
                ...line,
                ...article,
                id: article?.id || line.id,
                name: article?.name || line.name,
                brand: article?.brand || line.brand,
                supplier: article?.supplier || line.supplier || "",
                purchaseUnit: article?.purchaseUnit || line.purchaseUnit,
                unitsPerPurchaseUnit:
                  article?.unitsPerPurchaseUnit || line.unitsPerPurchaseUnit,
                stockUnit: article?.stockUnit || line.stockUnit,
                contentPerStockUnit:
                  article?.contentPerStockUnit || line.contentPerStockUnit,
                recipeUnit: article?.recipeUnit || line.recipeUnit,
                articleNumber: article?.articleNumber || line.articleNumber,
                pricePerStockUnit:
                  article?.pricePerStockUnit ?? line.pricePerStockUnit,
                pricePerPurchaseUnit:
                  article?.pricePerPurchaseUnit ?? line.pricePerPurchaseUnit,
                price: Number(article?.pricePerPurchaseUnit ?? line.price ?? line.pricePerPurchaseUnit ?? 0),
                invoicedPricePerPurchaseUnit: Number(
                  article?.pricePerPurchaseUnit
                  ?? line.invoicedPricePerPurchaseUnit
                  ?? line.price
                  ?? line.pricePerPurchaseUnit
                  ?? 0
                ),
                imageUrl: article?.imageUrl || line.imageUrl,
                quantity: qty ?? line.quantity,
              }
            : line
        )
      );
    } else if (ingredientToEdit) {
      const ing = ingredientToEdit;
      const art = article || {};
      const isWeighed = ing.isWeighed ?? false;
      const newLine = {
        ...art,
        ingredientId: ing.id,
        id: art.id || ing.id,
        name: art.name || ing.name,
        brand: art.brand || ing.brand,
        supplier: art.supplier || ing.supplier || "",
        purchaseUnit: art.purchaseUnit || ing.purchaseUnit,
        unitsPerPurchaseUnit: art.unitsPerPurchaseUnit || ing.unitsPerPurchaseUnit,
        stockUnit: art.stockUnit || ing.stockUnit,
        contentPerStockUnit: art.contentPerStockUnit || ing.contentPerStockUnit,
        recipeUnit: art.recipeUnit || ing.recipeUnit,
        articleNumber: art.articleNumber || ing.articleNumber,
        pricePerStockUnit: art.pricePerStockUnit ?? ing.pricePerStockUnit,
        pricePerPurchaseUnit: Number(art.pricePerPurchaseUnit ?? ing.pricePerPurchaseUnit ?? 0),
        price: Number(art.pricePerPurchaseUnit ?? ing.pricePerPurchaseUnit ?? 0),
        invoicedPricePerPurchaseUnit: Number(art.pricePerPurchaseUnit ?? ing.pricePerPurchaseUnit ?? 0),
        imageUrl: art.imageUrl || ing.imageUrl || "",
        isWeighed,
        quantity: qty,
        received: qty,
        shortage: 0,
        receivedWeight: isWeighed ? "" : undefined,
        outlet: "",
      };
      setLines(lines => [...lines, newLine]);
    }
    setShowArticleModal(false);
    setIngredientToEdit(null);
    setEditIndex(-1);
  }

  function deepRemoveUndefined(obj) {
  if (Array.isArray(obj)) {
    return obj.map(deepRemoveUndefined);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, deepRemoveUndefined(v)])
    );
  }
  return obj;
}



  async function handleConfirm() {
    setSaving(true);

    // 1. Bouw de lijst itemsWithReceived
    const itemsWithReceived = lines.map(item => {
      let ingredientId = item.ingredientId;
      if (!ingredientId) {
        const found = ingredients.find(
          ing =>
            ing.name === item.name &&
            (!item.brand || ing.brand === item.brand)
        );
        ingredientId = found ? found.id : "";
      }
      if (item.isWeighed) {
        const perUnit = Number(item.unitsPerPurchaseUnit) || 1;
        const qtyReceived =
          perUnit > 0 ? Number(item.receivedWeight || 0) / perUnit : 0;
        return {
          ...item,
          ingredientId,
          received: qtyReceived,
          shortage: Math.max(0, item.quantity - qtyReceived),
        };
      }
      return {
        ...item,
        ingredientId,
        received: Number(item.received),
        shortage: Math.max(0, item.quantity - Number(item.received)),
      };
    });

    // 2. Update order in DB
    const cleanedItemsWithReceived = deepRemoveUndefined(itemsWithReceived);
    await setOrderReceived(
      hotelUid,
      orderId,
      cleanedItemsWithReceived,
      order.deliveryDate
    );


    setSaving(false);
    navigate("/orders");
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-8 text-center text-gray-500">
        {t("receive.loading")}
      </div>
    );
  }
  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-8 text-center text-red-600">
        {t("receive.notFound")}
      </div>
    );
  }
  if (order.status !== "ordered") {
    return (
      <div className="max-w-xl mx-auto py-8 text-center text-gray-600">
        {t("receive.alreadyHandled")}
      </div>
    );
  }

  const regularLines = lines.filter(l => !l.isWeighed);
  const weighedLines = lines.filter(l => l.isWeighed);

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-3">{t("receive.title")}</h1>
        <div className="mb-3">
          <div className="font-medium">{t("receive.orderFrom", { supplier: order.supplier })}</div>
          <div className="text-xs text-gray-500">
            {t("receive.deliveredOn", { date: order.deliveryDate })}
          </div>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleConfirm();
          }}
          className="bg-white rounded-2xl shadow p-4 flex flex-col gap-4"
        >
          {/* Mobiel: kaarten */}
          {regularLines.length > 0 && (
            <>
              <h2 className="font-semibold sm:hidden mt-2">
                {t("receive.sections.regular")}
              </h2>
              <div className="flex flex-col gap-3 sm:hidden mt-2">
                {regularLines.map(line => {
                  const originalIdx = lines.indexOf(line);
                  return (
                    <ReceiveOrderItemCard
                      key={originalIdx}
                      item={line}
                      idx={originalIdx}
                      onChange={handleChange}
                      onChangeArticle={handleChangeArticle}
                    />
                  );
                })}
              </div>
            </>
          )}
          {weighedLines.length > 0 && (
            <>
              <h2 className="font-semibold sm:hidden mt-6">
                {t("receive.sections.weighed")}
              </h2>
              <div className="flex flex-col gap-3 sm:hidden mt-2">
                {weighedLines.map(line => {
                  const originalIdx = lines.indexOf(line);
                  return (
                    <ReceiveOrderItemCard
                      key={originalIdx}
                      item={line}
                      idx={originalIdx}
                      onChange={handleChange}
                      onChangeArticle={handleChangeArticle}
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* Desktop: grids */}
          <div className="hidden sm:block">
            {regularLines.length > 0 && (
              <>
                <h2 className="font-semibold mb-1">{t("receive.sections.regular")}</h2>
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 font-semibold text-marriott text-sm mb-1">
                  <div className="sm:col-span-2">{t("receive.table.article")}</div>
                  <div>{t("receive.table.brand")}</div>
                  <div>{t("receive.table.outlet")}</div>
                  <div>{t("receive.table.ordered")}</div>
                  <div className="hidden sm:block">{t("receive.table.received")}</div>
                  <div className="hidden sm:block">{t("receive.table.shortage")}</div>
                </div>
                {regularLines.map(line => {
                  const originalIdx = lines.indexOf(line);
                  return (
                    <div
                      key={originalIdx}
                      className="grid grid-cols-5 sm:grid-cols-7 gap-2 items-center text-sm"
                    >
                      <div className="flex items-center gap-2 sm:col-span-2">
                        {line.imageUrl && (
                          <img
                            src={line.imageUrl}
                            alt={line.name}
                            className="w-8 h-8 object-contain"
                          />
                        )}
                        <span>{line.name}</span>
                        <button
                          type="button"
                          className="ml-auto text-gray-500 hover:text-marriott"
                          onClick={() => handleChangeArticle(originalIdx)}
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div>{line.brand}</div>
                      <div>{line.outlet}</div>
                      <div>
                        {`${line.quantity}${line.purchaseUnit ? " / " + line.purchaseUnit : ""}`}
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={line.quantity}
                        step="0.01"
                        value={line.received}
                        className="border rounded px-2 py-1 w-16"
                        onChange={e => handleChange(originalIdx, "received", e.target.value)}
                      />
                      <div className="hidden sm:block">
                        {Math.max(0, line.quantity - line.received)}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {weighedLines.length > 0 && (
              <>
                <h2 className="font-semibold mt-6 mb-1">{t("receive.sections.weighed")}</h2>
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 font-semibold text-marriott text-sm mb-1">
                  <div className="sm:col-span-2">{t("receive.table.article")}</div>
                  <div>{t("receive.table.brand")}</div>
                  <div>{t("receive.table.outlet")}</div>
                  <div>{t("receive.table.orderedWeight")}</div>
                  <div className="hidden sm:block">{t("receive.table.received")}</div>
                  <div className="hidden sm:block">{t("receive.table.shortage")}</div>
                </div>
                {weighedLines.map(line => {
                  const originalIdx = lines.indexOf(line);
                  return (
                    <div
                      key={originalIdx}
                      className="grid grid-cols-5 sm:grid-cols-7 gap-2 items-center text-sm"
                    >
                      <div className="flex items-center gap-2 sm:col-span-2">
                        {line.imageUrl && (
                          <img
                            src={line.imageUrl}
                            alt={line.name}
                            className="w-8 h-8 object-contain"
                          />
                        )}
                        <span>{line.name}</span>
                        <button
                          type="button"
                          className="ml-auto text-gray-500 hover:text-marriott"
                          onClick={() => handleChangeArticle(originalIdx)}
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div>{line.brand}</div>
                      <div>{line.outlet}</div>
                      <div>
                        {((Number(line.quantity) || 0) * (Number(line.unitsPerPurchaseUnit) || 0)).toFixed(2)} kg
                      </div>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.receivedWeight || ""}
                        className="border rounded px-2 py-1 w-24"
                        onChange={e => handleChange(originalIdx, "receivedWeight", e.target.value)}
                        placeholder={t("receive.card.weightPlaceholder")}
                      />
                      <div className="hidden sm:block">
                        {Math.max(0, (Number(line.unitsPerPurchaseUnit) || 0) * (Number(line.quantity) || 0) - Number(line.receivedWeight || 0)).toFixed(2)} kg
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => navigate("/orders")}
              className="px-4 py-2 rounded-2xl bg-red-600 text-white hover:bg-red-700"
            >
              {t("receive.actions.cancel")}
            </button>
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-2xl font-semibold hover:bg-green-700"
              disabled={saving}
            >
              {saving ? t("receive.actions.saving") : t("receive.actions.confirm")}
            </button>
          </div>
        </form>
      </PageContainer>
      <button
        type="button"
        className="fixed right-4 top-24 bg-marriott text-white rounded-full p-4 shadow-lg z-50 flex items-center justify-center"
        onClick={() => setShowIngredientModal(true)}
      >
        <Plus className="w-6 h-6" />
      </button>
      <Dialog
        open={showIngredientModal}
        onClose={() => setShowIngredientModal(false)}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div className="fixed inset-0 bg-black/40 z-40" aria-hidden="true" />
        <Dialog.Panel className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 z-50">
          <Dialog.Title className="text-lg font-semibold mb-4">
            {t("receive.search.title")}
          </Dialog.Title>
          <Combobox
            value={null}
            onChange={ing => {
              setShowIngredientModal(false);
              handleAddProduct(ing);
            }}
            options={ingredients.filter(i => i.active !== false)}
            displayValue={i => i.aliases?.[language] || i.name}
            getOptionValue={i => i.id}
            placeholder={t("receive.search.placeholder")}
          />
          <div className="mt-4 text-right">
            <button
              type="button"
              className="bg-gray-200 px-4 py-2 rounded-2xl"
              onClick={() => setShowIngredientModal(false)}
            >
              {t("receive.actions.cancel")}
            </button>
          </div>
        </Dialog.Panel>
      </Dialog>
      <AddProductModal
        open={showArticleModal}
        ingredient={ingredientToEdit}
        articles={articles}
        onConfirm={confirmChangeArticle}
        onCancel={() => setShowArticleModal(false)}
        initialQty={editIndex >= 0 ? lines[editIndex]?.quantity : 1}
        currentArticleId={editIndex >= 0 ? lines[editIndex]?.id : undefined}
      />
    </>
  );
}
