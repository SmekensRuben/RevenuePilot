import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { Combobox } from "components/ui/combobox";
import { useHotelContext } from "contexts/HotelContext";
import ConfirmModal from "components/layout/ConfirmModal";
import AlertModal from "components/layout/AlertModal";
import useConfirmOnLeave from "../../hooks/useConfirmOnLeave";
import { useTranslation } from "react-i18next";
import {
  getShoppingLists,
  addItemToList,
  removeItemFromList,
  updateShoppingList,
  deleteShoppingList,
} from "./shoppingListService";
import { getIngredients } from "services/firebaseIngredients";
import { getOutlets, getLocations } from "services/firebaseSettings";
import { ChevronUp, ChevronDown, ShoppingCart, Plus, Trash2 } from "lucide-react";
import AddProductModal from "../orders/AddProductModal";
import OrderProductsModal from "../orders/OrderProductsModal";
import { getArticlesIndexed } from "../../services/firebaseArticles";
import { formatArticlePackaging } from "../../utils/articleFormatting";
import {
  getCreatedOrders,
  addOrder,
  updateOrder,
} from "../orders/orderService";
import { fetchUserProfile } from "services/firebaseUsers";
import { auth } from "../../firebaseConfig";

export default function ShoppingListOrderPage() {
  const { hotelUid, hotelName, language, orderMode = "ingredient" } = useHotelContext();
  const isArticleMode = orderMode === "article";
  const { listId } = useParams();
  const navigate = useNavigate();

  const [list, setList] = useState(null);
  const [ingredients, setIngredients] = useState({});
  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [articles, setArticles] = useState([]);
  const [products, setProducts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemToAdd, setItemToAdd] = useState(null);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [error, setError] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [requester, setRequester] = useState("");
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState("");
  const { t: tCommon } = useTranslation("common");
  const { t: tShopping } = useTranslation("shoppinglists");
  const { t: tOrders } = useTranslation("orders");
  const { isBlocked, confirm, cancel } = useConfirmOnLeave(products.length > 0);
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [itemForm, setItemForm] = useState({
    ingredientId: "",
    articleId: "",
    location: "",
  });

  const canOpenCart = deliveryDate && requester;

  useEffect(() => {
    async function fetchData() {
      const [lists, ingArr, outs, locs, arts] = await Promise.all([
        getShoppingLists(hotelUid),
        getIngredients(hotelUid),
        getOutlets(hotelUid),
        getLocations(hotelUid),
        getArticlesIndexed(hotelUid),
      ]);
      const l = lists.find((l) => l.id === listId);
      setList(l);
      setOutlet(l?.outlet || "");
      const map = {};
      ingArr.forEach((i) => {
        map[i.id] = i;
      });
      setIngredients(map);
      setIngredientOptions(ingArr.filter(i => i.active !== false));
      setOutlets(outs);
      setLocations(locs);
      setArticles(arts.filter(a => a.active !== false));
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDeliveryDate(tomorrow.toISOString().slice(0, 10));
    }
    fetchData();
  }, [hotelUid, listId]);

  useEffect(() => {
    async function fetchRequester() {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const profile = await fetchUserProfile(uid);
      if (profile) {
        const name = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
        setRequester(name);
      }
    }
    fetchRequester();
  }, []);

  const updateItemForm = (field, value) => {
    setItemForm((f) => ({ ...f, [field]: value }));
  };

  useEffect(() => {
    setItemForm({ ingredientId: "", articleId: "", location: "" });
  }, [isArticleMode]);

  const articleMap = useMemo(() => {
    const map = {};
    articles.forEach(a => {
      map[a.id] = a;
    });
    return map;
  }, [articles]);

  const displayItems = useMemo(() => {
    if (!list) return [];
    let arr = Object.entries(list.items || {}).map(([key, data]) => {
      const article = data.articleId ? articleMap[data.articleId] : articleMap[key];
      const ingredient =
        data.ingredientId
          ? ingredients[data.ingredientId]
          : article?.ingredientId
            ? ingredients[article.ingredientId]
            : ingredients[key];

      return {
        key,
        ...data,
        article,
        ingredient,
        supplier: data.supplier || article?.supplier || ingredient?.supplier || "",
      };
    });
    if (locationFilter) {
      arr = arr.filter((it) => it.location === locationFilter);
    }
    arr.sort((a, b) => {
      const itemA = isArticleMode
        ? a.article || a.ingredient
        : a.ingredient || a.article;
      const itemB = isArticleMode
        ? b.article || b.ingredient
        : b.ingredient || b.article;
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "location") {
        return (
          String(a.location || "").localeCompare(
            String(b.location || ""),
            undefined,
            { sensitivity: "base" }
          ) * dir
        );
      }
      if (sortField === "supplier") {
        return (
          String(a.supplier || "").localeCompare(
            String(b.supplier || ""),
            undefined,
            { sensitivity: "base" }
          ) * dir
        );
      }
      return (
        String(itemA?.name || "").localeCompare(
          String(itemB?.name || ""),
          undefined,
          { sensitivity: "base" }
        ) * dir
      );
    });
    return arr;
  }, [
    articleMap,
    ingredients,
    isArticleMode,
    list,
    locationFilter,
    sortDir,
    sortField,
  ]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleItemChange = (key, field, value) => {
    setList((l) => ({
      ...l,
      items: { ...l.items, [key]: { ...l.items[key], [field]: value } },
    }));
  };

  const handleItemBlur = async (key) => {
    const item = list.items[key];
    await addItemToList(hotelUid, listId, key, {
      min: item.min,
      max: item.max,
      location: item.location || "",
      articleId: item.articleId,
      ingredientId: item.ingredientId,
    });
  };

  const handleOutletChange = async (value) => {
    setOutlet(value);
    setList(l => ({ ...l, outlet: value }));
    await updateShoppingList(hotelUid, listId, { outlet: value });
  };

  const handleRemoveItem = async (key) => {
    const confirmKey = isArticleMode
      ? "removeArticleConfirm"
      : "removeIngredientConfirm";
    if (!window.confirm(tShopping(confirmKey))) return;
    await removeItemFromList(hotelUid, listId, key);
    setList((l) => {
      const items = { ...l.items };
      delete items[key];
      return { ...l, items };
    });
  };

  const handleDeleteList = async () => {
    if (!window.confirm(tShopping("order.deleteConfirm"))) return;
    await deleteShoppingList(hotelUid, listId);
    navigate("/shoppinglists");
  };

  async function handleAddItem() {
    const selectedArticle = isArticleMode
      ? articleMap[itemForm.articleId]
      : null;
    const selectedIngredient = isArticleMode
      ? selectedArticle?.ingredientId
        ? ingredients[selectedArticle.ingredientId]
        : null
      : ingredients[itemForm.ingredientId];

    if (!selectedArticle && !selectedIngredient) return;

    const linkedArticle = selectedArticle
      || (Array.isArray(selectedIngredient?.articles)
        ? selectedIngredient.articles
            .map(id => articleMap[id])
            .find(a => a && a.active !== false)
        : null);

    const itemKey = linkedArticle?.id || selectedIngredient?.id || itemForm.articleId;
    if (!itemKey) return;

    await addItemToList(hotelUid, listId, itemKey, {
      min: 0,
      max: 0,
      location: itemForm.location,
      articleId: linkedArticle?.id,
      ingredientId: selectedIngredient?.id || linkedArticle?.ingredientId,
    });
    setItemForm({ ingredientId: "", articleId: "", location: "" });
    // Refresh list
    const lists = await getShoppingLists(hotelUid);
    const l = lists.find((l) => l.id === listId);
    setList(l);
  }

  function handleAddProduct({ ingredient, article }) {
    setItemToAdd({ ingredient, article });
    setShowAddModal(true);
  }

  function confirmAddProduct(qty, article) {
    if (!itemToAdd) return;
    const selectedArticle = article || itemToAdd.article || null;
    const linkedIngredient =
      itemToAdd.ingredient
        || (selectedArticle?.ingredientId
          ? ingredients[selectedArticle.ingredientId]
          : null);

    const { articles: _unusedArticles, ...ingredientRest } = linkedIngredient || {};
    const art = selectedArticle || {};
    const priceValue = Number(art.pricePerPurchaseUnit ?? ingredientRest.pricePerPurchaseUnit ?? 0);
    const newProd = {
      ...ingredientRest,
      ...art,
      articleId: art.id || itemToAdd.article?.id || "",
      ingredientId: linkedIngredient?.id || art.ingredientId || itemToAdd.ingredient?.id,
      name: art.name || ingredientRest.name,
      brand: art.brand || ingredientRest.brand,
      supplier: art.supplier || ingredientRest.supplier || "",
      purchaseUnit: art.purchaseUnit || ingredientRest.purchaseUnit,
      unitsPerPurchaseUnit: art.unitsPerPurchaseUnit || ingredientRest.unitsPerPurchaseUnit,
      stockUnit: art.stockUnit || ingredientRest.stockUnit,
      contentPerStockUnit: art.contentPerStockUnit || ingredientRest.contentPerStockUnit,
      recipeUnit: art.recipeUnit || ingredientRest.recipeUnit,
      price: priceValue,
      pricePerPurchaseUnit: priceValue,
      invoicedPricePerPurchaseUnit: priceValue,
      pricePerStockUnit: art.pricePerStockUnit ?? ingredientRest.pricePerStockUnit,
      imageUrl: art.imageUrl || ingredientRest.imageUrl,
      quantity: qty,
      outlet,
    };
    setProducts([newProd, ...products]);
    setItemToAdd(null);
    setShowAddModal(false);
  }

  function handleRemoveProduct(idx) {
    setProducts(products.filter((_, i) => i !== idx));
  }

  function handleChangeQuantity(idx, value) {
    if (value === "") {
      setProducts(products.map((p, i) => (i === idx ? { ...p, quantity: "" } : p)));
      return;
    }
    const qty = Number(value);
    if (qty <= 0) {
      handleRemoveProduct(idx);
    } else {
      setProducts(
        products.map((p, i) => (i === idx ? { ...p, quantity: qty } : p))
      );
    }
  }

  function handleChangeOutlet(idx, value) {
    setProducts(products.map((p, i) => (i === idx ? { ...p, outlet: value } : p)));
  }

  async function handleSubmit() {
    if (products.length === 0 || !deliveryDate || !requester) {
      setError(tShopping("errors.missingFields"));
      return;
    }
    if (products.some(p => !p.outlet)) {
      setError(tShopping("errors.missingOutlets"));
      return;
    }
    setSaving(true);
    try {
      const normalizedProducts = products.map(p => {
        const priceValue = Number(p.price ?? p.pricePerPurchaseUnit ?? 0);
        const invoicedPrice = p.invoicedPricePerPurchaseUnit ?? priceValue;
        const pricePerPurchaseUnit = p.pricePerPurchaseUnit ?? priceValue;
        return {
          ...p,
          price: priceValue,
          pricePerPurchaseUnit,
          invoicedPricePerPurchaseUnit: Number(invoicedPrice),
        };
      });

      const grouped = {};
      normalizedProducts.forEach((p) => {
        if (!grouped[p.supplier]) grouped[p.supplier] = [];
        grouped[p.supplier].push(p);
      });

      const orderDate = new Date().toISOString().slice(0, 10);
      const existingOrders = await getCreatedOrders(hotelUid);

      const warningLines = [];
      for (const [supplier, prodList] of Object.entries(grouped)) {
        const match = existingOrders.find(
          (o) => o.supplier === supplier && o.deliveryDate === deliveryDate,
        );
        if (match) {
          prodList.forEach((newProd) => {
            const found = match.articles.find(
              (prod) =>
                prod.name === newProd.name && prod.brand === newProd.brand,
            );
            if (found) {
              const brandText = found.brand ? ` (${found.brand})` : "";
              warningLines.push(
                tShopping("duplicateWarningLine", {
                  quantity: found.quantity,
                  name: found.name,
                  brandText,
                  date: deliveryDate,
                  supplier,
                })
              );
            }
          });
        }
      }
      if (warningLines.length > 0) {
        const confirmText = [
          tShopping("duplicateWarningIntro"),
          "",
          ...warningLines,
          "",
          tShopping("duplicateWarningConfirm"),
        ].join("\n");
        if (!window.confirm(confirmText)) {
          setSaving(false);
          return;
        }
      }

      for (const [supplier, prodList] of Object.entries(grouped)) {
        const match = existingOrders.find(
          (o) => o.supplier === supplier && o.deliveryDate === deliveryDate,
        );
        if (match) {
          let merged = [...match.articles];
          prodList.forEach((newProd) => {
            const idx = merged.findIndex(
              (prod) =>
                prod.name === newProd.name && prod.brand === newProd.brand,
            );
            if (idx !== -1) {
              merged[idx].quantity += newProd.quantity;
            } else {
              merged.push(newProd);
            }
          });
        const sanitizedMerged = merged.map(p => {
          const priceValue = Number(p.price ?? p.pricePerPurchaseUnit ?? 0);
          const invoicedPrice = p.invoicedPricePerPurchaseUnit ?? priceValue;
          const pricePerPurchaseUnit = p.pricePerPurchaseUnit ?? priceValue;
          return {
            ...p,
            price: priceValue,
            pricePerPurchaseUnit,
            invoicedPricePerPurchaseUnit: Number(invoicedPrice),
          };
        });
        await updateOrder(hotelUid, match.id, { articles: sanitizedMerged });
      } else {
        await addOrder(hotelUid, {
          supplier,
          orderDate,
          deliveryDate,
          status: "created",
          requester,
          articles: prodList,
        });
      }
    }

      navigate("/orders");
    } finally {
      setSaving(false);
    }
  }

  const formatToday = () => {
    const d = new Date();
    return d.toLocaleDateString("nl-BE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!list) {
    return (
      <div className="max-w-xl mx-auto py-8 text-center text-gray-500">
        {tShopping("order.loading")}
      </div>
    );
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} today={formatToday()} />
      <PageContainer className="max-w-full sm:max-w-4xl overflow-x-auto min-h-[50vh]">
        <button
          className="text-marriott underline mb-4"
          onClick={() => navigate("/shoppinglists")}
        >
          {tShopping("order.back")}
        </button>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{list.name}</h1>
          <div className="flex items-center gap-3">
            {editMode && (
              <button
                className="text-red-600 underline"
                onClick={handleDeleteList}
              >
                {tShopping("order.deleteList")}
              </button>
            )}
            <button
              className="text-marriott underline"
              onClick={() => setEditMode((e) => !e)}
            >
              {editMode ? tShopping("order.done") : tShopping("order.edit")}
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block mb-1 font-medium">{tShopping("order.deliveryDate")}</label>
            <input
              type="date"
              className="border rounded-xl px-2 py-1 w-full"
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              required
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block mb-1 font-medium">{tShopping("order.requester")}</label>
            <input
              type="text"
              className="border rounded-xl px-2 py-1 w-full"
              value={requester}
              onChange={e => setRequester(e.target.value)}
              readOnly
              required
            />
          </div>
        </div>
        <div className="mb-4 flex gap-4 flex-wrap items-end">
          <div className="min-w-[200px]">
            <label className="block mb-1 font-medium">{tShopping("order.outlet")}</label>
            <select
              className="border rounded-xl px-2 py-1 w-full"
              value={outlet}
              onChange={e => handleOutletChange(e.target.value)}
              disabled={!editMode}
            >
              <option value="">{tOrders("productsModal.selectOutlet")}</option>
              {outlets.map(o => (
                <option key={o.id || o.name} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block mb-1 font-medium">{tShopping("order.filterLocation")}</label>
            <select
              className="border rounded-xl px-2 py-1 w-full"
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
            >
              <option value="">{tShopping("order.filterAll")}</option>
              {locations.map(loc => (
                <option key={loc.id || loc.name} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {editMode && (
          <div className="mb-4 flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-grow">
              <Combobox
                value={
                  (isArticleMode
                    ? articles.find(a => a.id === itemForm.articleId)
                    : ingredientOptions.find(i => i.id === itemForm.ingredientId)) || null
                }
                onChange={opt => {
                  if (isArticleMode) {
                    updateItemForm("articleId", opt.id);
                    updateItemForm("ingredientId", opt.ingredientId || "");
                  } else {
                    updateItemForm("ingredientId", opt.id);
                    const linked = Array.isArray(opt.articles)
                      ? opt.articles.map(id => articleMap[id]).find(a => a)
                      : null;
                    updateItemForm("articleId", linked?.id || "");
                  }
                }}
                options={isArticleMode ? articles : ingredientOptions}
                displayValue={opt => opt.aliases?.[language] || opt.name}
                getOptionValue={opt => opt.id}
                placeholder={isArticleMode
                  ? tShopping("order.chooseArticle")
                  : tShopping("order.chooseIngredient")}
              />
            </div>
            <select
              className="border p-2 w-full sm:w-40 rounded"
              value={itemForm.location}
              onChange={(e) => updateItemForm("location", e.target.value)}
            >
              <option value="">{tShopping("order.chooseLocation")}</option>
              {locations.map(loc => (
                <option key={loc.id || loc.name} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
            <button
              className="bg-marriott text-white px-4 py-2 rounded w-full sm:w-auto"
              onClick={handleAddItem}
            >
              {isArticleMode
                ? tShopping("order.addArticle")
                : tShopping("order.addIngredient")}
            </button>
          </div>
        )}
        {/* Mobile view */}
        <div className="sm:hidden space-y-4">
          {displayItems.map(({ key, article, ingredient, ...data }) => {
            const displayName = isArticleMode
              ? article?.name || ingredient?.name
              : ingredient?.name || article?.name;
            if (!displayName) return null;
            return (
              <div key={key} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{displayName}</div>
                    <div className="text-xs text-gray-600">{data.location}</div>
                  </div>
                  {!editMode && (
                    <button
                      type="button"
                      className="bg-marriott text-white rounded p-2"
                      onClick={() => handleAddProduct({ ingredient, article })}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  {editMode ? (
                    <select className="border rounded w-32 text-sm" value={data.location || ''} onChange={(e) => handleItemChange(key, 'location', e.target.value)} onBlur={() => handleItemBlur(key)}>
                      <option value="">{tShopping("order.locationPlaceholder")}</option>
                      {locations.map((loc) => (
                        <option key={loc.id || loc.name} value={loc.name}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {editMode && (
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => handleRemoveItem(key)}
                      title={tShopping("order.remove")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table view */}
        <div className="hidden sm:block">
          <div className="overflow-hidden rounded-xl shadow border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <SortableTh
                    label={tShopping("order.nameColumn")}
                    field="name"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label={tShopping("order.locationColumn")}
                    field="location"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label={tShopping("order.supplierColumn")}
                    field="supplier"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  {isArticleMode && (
                    <>
                      <th className="p-2">{tShopping("order.brandColumn")}</th>
                      <th className="p-2">{tShopping("order.priceColumn")}</th>
                      <th className="p-2">{tShopping("order.packagingColumn")}</th>
                    </>
                  )}
                {!editMode && <th className="p-2"></th>}
                {editMode && <th className="p-2"></th>}
              </tr>
            </thead>
            <tbody>
              {displayItems.map(({ key, article, ingredient, ...data }) => {
                const displayName = isArticleMode
                  ? article?.name || ingredient?.name
                  : ingredient?.name || article?.name;
                if (!displayName) return null;
                const displaySupplier = data.supplier || article?.supplier || ingredient?.supplier || "";
                const priceValue = article?.pricePerPurchaseUnit ?? article?.price;
                const priceText =
                  priceValue != null && priceValue !== ""
                    ? `€${Number(priceValue || 0).toFixed(2)}`
                    : "";
                const packagingText = formatArticlePackaging(article);
                return (
                  <tr key={key} className="border-b">
                    <td className="p-2">{displayName}</td>
                    <td className="p-2">
                      {editMode ? (
                        <select
                          className="border rounded w-32"
                          value={data.location || ""}
                          onChange={(e) =>
                            handleItemChange(key, "location", e.target.value)
                          }
                          onBlur={() => handleItemBlur(key)}
                        >
                          <option value="">{tShopping("order.locationPlaceholder")}</option>
                          {locations.map((loc) => (
                            <option key={loc.id || loc.name} value={loc.name}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        data.location
                      )}
                    </td>
                    <td className="p-2">{displaySupplier}</td>
                    {isArticleMode && <td className="p-2">{article?.brand || ""}</td>}
                    {isArticleMode && <td className="p-2">{priceText}</td>}
                    {isArticleMode && <td className="p-2">{packagingText}</td>}
                    {!editMode && (
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          className="bg-marriott text-white rounded p-2"
                          onClick={() => handleAddProduct({ ingredient, article })}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                    {editMode && (
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={() => handleRemoveItem(key)}
                          title={tShopping("order.remove")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
        <button
          type="button"
          className="fixed right-4 top-24 bg-marriott text-white rounded-full p-4 shadow-lg z-50 flex items-center justify-center"
          onClick={() => {
            if (!canOpenCart) {
              const missing = [];
              if (!deliveryDate) missing.push(tShopping("order.missingFieldDeliveryDate"));
              if (!requester) missing.push(tShopping("order.missingFieldRequester"));
              setMissingFields(missing);
              setShowMissingModal(true);
              return;
            }
            setError("");
            setShowProductsModal(true);
          }}
        >
          <ShoppingCart className="w-6 h-6" />
          {products.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-white text-marriott rounded-full text-xs font-bold px-2">
              {products.length}
            </span>
          )}
        </button>
        <AddProductModal
          open={showAddModal}
          ingredient={itemToAdd?.ingredient}
          article={itemToAdd?.article}
          articles={articles}
          onConfirm={confirmAddProduct}
          onCancel={() => {
            setShowAddModal(false);
            setItemToAdd(null);
          }}
        />
        <OrderProductsModal
          open={showProductsModal}
          articles={products}
          outlets={outlets}
          onClose={() => setShowProductsModal(false)}
          onQuantityChange={handleChangeQuantity}
          onOutletChange={handleChangeOutlet}
          onRemove={handleRemoveProduct}
          onConfirm={handleSubmit}
          saving={saving}
          error={error}
        />
      <AlertModal
        open={showMissingModal}
        onClose={() => setShowMissingModal(false)}
        title={tShopping("order.missingFieldsTitle")}
        message={
          <div>
            <p className="mb-2">{tShopping("order.missingFieldsIntro")}</p>
            <ul className="list-disc list-inside">
              {missingFields.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        }
      />
      <ConfirmModal
        open={isBlocked}
        title={tCommon("leavePageTitle")}
        message={tCommon("leavePageMessage")}
        onConfirm={confirm}
        onCancel={cancel}
      />
    </PageContainer>
  </>
);
}

const sortIcon = (active, dir) =>
  active ? (
    dir === "asc" ? (
      <ChevronUp size={16} className="inline ml-1 -mt-1" />
    ) : (
      <ChevronDown size={16} className="inline ml-1 -mt-1" />
    )
  ) : (
    <span className="inline-block w-4" />
  );

function SortableTh({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <th
      className="p-2 cursor-pointer select-none hover:bg-gray-100"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortIcon(active, sortDir)}
      </span>
    </th>
  );
}
