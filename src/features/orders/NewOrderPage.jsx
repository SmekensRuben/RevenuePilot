import React, { useState, useEffect, useMemo } from "react";
import PageContainer from "components/layout/PageContainer";
import HeaderBar from "components/layout/HeaderBar";
import { useNavigate } from "react-router-dom";
import { useHotelContext } from "contexts/HotelContext";
import OrderProductCard from "./OrderProductCard";
import AddProductModal from "./AddProductModal";
import OrderProductsModal from "./OrderProductsModal";
import CreateArticleModal from "./CreateArticleModal";
import { ShoppingCart, Plus } from "lucide-react";
import Pagination from "shared/Pagination";
import AlertModal from "components/layout/AlertModal";
import ConfirmModal from "components/layout/ConfirmModal";
import useConfirmOnLeave from "../../hooks/useConfirmOnLeave";
import { useTranslation } from "react-i18next";
import {
  getIngredients,
  getCreatedOrders,
  addOrder,
  updateOrder
} from "./orderService";
import { getOutlets, getCategories, getSuppliers } from "services/firebaseSettings";
import { fetchUserProfile } from "services/firebaseUsers";
import { getArticlesIndexed } from "../../services/firebaseArticles";
import { auth, signOut } from "../../firebaseConfig";
import { getSearchTokens, matchesSearchTokensAcross } from "utils/search";
import { formatArticlePackaging } from "../../utils/articleFormatting";

export default function NewOrderPage() {
  const { hotelUid, hotelName, orderMode = "ingredient" } = useHotelContext();
  const isArticleMode = orderMode === "article";
  const [ingredients, setIngredients] = useState([]);
  const [allArticles, setAllArticles] = useState([]);
  const [articleToAdd, setArticleToAdd] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [orderArticles, setOrderArticles] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [requester, setRequester] = useState("");
  const [categories, setCategories] = useState({});
  const [parentCategory, setParentCategory] = useState("");
  const [category, setCategory] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ingredientToAdd, setIngredientToAdd] = useState(null);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [showCreateArticleModal, setShowCreateArticleModal] = useState(false);
  const [bulkOutlet, setBulkOutlet] = useState("");
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missingFields, setMissingFields] = useState([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const { t: tCommon } = useTranslation("common");
  const { t } = useTranslation("orders");
  const { isBlocked, confirm, cancel } = useConfirmOnLeave(orderArticles.length > 0);
  const ITEMS_PER_PAGE = 50;
  const canOpenCart = deliveryDate && requester;
  const [suppliers, setSuppliers] = useState([]);

  const articleNumbersByIngredient = useMemo(() => {
    const map = {};
    allArticles.forEach(article => {
      const { ingredientId, articleNumber } = article || {};
      if (!ingredientId || !articleNumber) return;
      map[ingredientId] = map[ingredientId] || [];
      map[ingredientId].push(articleNumber);
    });
    return map;
  }, [allArticles]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const sanitizeOrderItem = item => {
    const priceValue = Number(item.price ?? item.pricePerPurchaseUnit ?? 0);
    const invoicedPrice =
      item.invoicedPricePerPurchaseUnit ?? priceValue;
    const pricePerPurchaseUnit = item.pricePerPurchaseUnit ?? priceValue;

    const normalized = {
      ...item,
      price: priceValue,
      pricePerPurchaseUnit,
      invoicedPricePerPurchaseUnit: Number(invoicedPrice),
    };

    return Object.fromEntries(
      Object.entries(normalized).filter(([, value]) => value !== undefined)
    );
  };

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
      .filter(([key, val]) => val.parentId === parentCategory)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories, parentCategory]);

  const supplierOptions = useMemo(() => {
    return suppliers
      .map(sup => {
        const name = sup.name || sup.key || "";
        return { value: name, label: name };
      })
      .filter(opt => opt.value)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [suppliers]);

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

  useEffect(() => {
    async function fetch() {
      const arr = await getIngredients(hotelUid);
      setIngredients(arr);
      const [outs, arts, cats, sups] = await Promise.all([
        getOutlets(hotelUid),
        getArticlesIndexed(hotelUid),
        getCategories(),
        getSuppliers(),
      ]);
      setOutlets(outs);
      setAllArticles(arts.filter(a => a.active !== false));
      setCategories(cats);
      setSuppliers(sups);
    }
    fetch();
  }, [hotelUid]);

  useEffect(() => {
    let list = isArticleMode ? allArticles : ingredients;
    if (parentCategory) {
      list = list.filter(item => categories[item.category]?.parentId === parentCategory);
    }
    if (category) {
      list = list.filter(item => item.category === category);
    }
    if (supplierFilter) {
      list = list.filter(item => {
        const supplierName = item.supplier || "";
        return supplierName.toLowerCase() === supplierFilter.toLowerCase();
      });
    }
    if (query) {
      const tokens = getSearchTokens(query);
      if (tokens.length > 0) {
        list = list.filter(item => {
          const valuesToSearch = isArticleMode
            ? [
                item.name,
                item.brand,
                item.supplier,
                item.articleNumber,
                item.aliases?.nl,
                item.aliases?.fr,
                item.aliases?.en,
              ]
            : [
                item.name,
                item.label,
                item.aliases?.nl,
                item.aliases?.fr,
                item.brand,
                item.articleNumber,
                ...(articleNumbersByIngredient[item.id] || []),
              ];
          return matchesSearchTokensAcross(valuesToSearch, tokens);
        });
      }
    }
    setFiltered(list.sort((a, b) => (a.name || a.label || "").localeCompare(b.name || b.label || "")));
    setPage(1);
  }, [
    query,
    ingredients,
    parentCategory,
    category,
    categories,
    isArticleMode,
    allArticles,
    articleNumbersByIngredient,
    supplierFilter,
  ]);

  function handleAddProduct(ing) {
    setIngredientToAdd(ing);
    setArticleToAdd(null);
    setShowAddModal(true);
  }

  function handleAddArticle(article) {
    setArticleToAdd(article);
    setIngredientToAdd(null);
    setShowAddModal(true);
  }

  const buildOrderItem = (ingredient, selectedArticle, quantity) => {
    const { id, articles: _unusedArticles, ...rest } = ingredient || {};
    const art = selectedArticle || {};
    const priceValue = Number(art.pricePerPurchaseUnit ?? rest.pricePerPurchaseUnit ?? 0);
    return {
      ...rest,
      ...art,
      ingredientId: art.ingredientId || id || rest?.ingredientId,
      articleId: art.id || art.articleId || "",
      name: art.name || rest.name || rest.label || "",
      label: art.label || art.name || rest.label || rest.name || "",
      brand: art.brand || rest.brand,
      supplier: art.supplier || rest.supplier || "",
      purchaseUnit: art.purchaseUnit || rest.purchaseUnit,
      unitsPerPurchaseUnit: art.unitsPerPurchaseUnit ?? rest.unitsPerPurchaseUnit,
      stockUnit: art.stockUnit || rest.stockUnit,
      contentPerStockUnit: art.contentPerStockUnit ?? rest.contentPerStockUnit,
      recipeUnit: art.recipeUnit || rest.recipeUnit,
      articleNumber: art.articleNumber || rest.articleNumber,
      price: priceValue,
      pricePerPurchaseUnit: priceValue,
      invoicedPricePerPurchaseUnit: priceValue,
      pricePerStockUnit: art.pricePerStockUnit ?? rest.pricePerStockUnit,
      imageUrl: art.imageUrl || rest.imageUrl,
      quantity: quantity,
      outlet: "",
    };
  };

  function confirmAddProduct(qty, article) {
    const chosenArticle = article || articleToAdd;
    if (!ingredientToAdd && !chosenArticle) return;
    const newProd = buildOrderItem(ingredientToAdd, chosenArticle, qty);
    setOrderArticles(prev => [newProd, ...prev]);
    setIngredientToAdd(null);
    setArticleToAdd(null);
    setShowAddModal(false);
    setQuery("");
  }

  function closeAddModal() {
    setShowAddModal(false);
    setIngredientToAdd(null);
    setArticleToAdd(null);
  }

  function handleCreateCustomArticle(article) {
    if (!article) return;
    setOrderArticles(prev => [article, ...prev]);
    setShowCreateArticleModal(false);
    setError("");
    if (canOpenCart) {
      setShowProductsModal(true);
    } else {
      const missing = [];
      if (!deliveryDate) missing.push(t("newOrder.missingFieldDeliveryDate"));
      if (!requester) missing.push(t("newOrder.missingFieldRequester"));
      if (missing.length > 0) {
        setMissingFields(missing);
        setShowMissingModal(true);
      }
    }
  }

  // Product verwijderen
  function handleRemoveProduct(idx) {
    setOrderArticles(orderArticles.filter((_, i) => i !== idx));
  }

  // Product aantal aanpassen
  function handleChangeQuantity(idx, value) {
    if (value === "") {
      setOrderArticles(orderArticles.map((p, i) => (i === idx ? { ...p, quantity: "" } : p)));
      return;
    }
    const qty = Number(value);
    if (qty <= 0) {
      handleRemoveProduct(idx);
    } else {
      setOrderArticles(
        orderArticles.map((p, i) => (i === idx ? { ...p, quantity: qty } : p))
      );
    }
  }

  function handleChangeOutlet(idx, value) {
    setOrderArticles(orderArticles.map((p, i) =>
      i === idx ? { ...p, outlet: value } : p
    ));
  }

  function handleBulkOutletChange(value) {
    setBulkOutlet(value);
    setOrderArticles(prev => prev.map(p => ({ ...p, outlet: value })));
  }

  useEffect(() => {
    if (orderArticles.length === 0) {
      setBulkOutlet("");
      return;
    }
    const firstOutlet = orderArticles[0].outlet || "";
    const allSameOutlet = orderArticles.every(p => (p.outlet || "") === firstOutlet);
    setBulkOutlet(allSameOutlet ? firstOutlet : "");
  }, [orderArticles]);

  // Bestelling(en) opslaan (service-based)
  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    if (!deliveryDate || !requester || orderArticles.length === 0) {
      setError(t("newOrder.errorMissingFields"));
      return;
    }
    if (orderArticles.some(p => !p.outlet)) {
      setError(t("errors.missingOutlets"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const sanitizedArticles = orderArticles.map(sanitizeOrderItem);

      // Groepeer producten per supplier
      const grouped = {};
      sanitizedArticles.forEach(p => {
        if (!grouped[p.supplier]) grouped[p.supplier] = [];
        grouped[p.supplier].push(p);
      });

      const orderDate = new Date().toISOString().slice(0, 10);

      // Haal bestaande "created" orders op
      const existingOrders = await getCreatedOrders(hotelUid);

      // Controleer eerst op dubbele producten
      const warningLines = [];
      for (const [supplier, prodList] of Object.entries(grouped)) {
        const match = existingOrders.find(
          o => o.supplier === supplier && o.deliveryDate === deliveryDate
        );
        if (match) {
          prodList.forEach(newProd => {
            const found = match.articles.find(
              prod => prod.name === newProd.name && prod.brand === newProd.brand
            );
            if (found) {
              const brandText = found.brand ? ` (${found.brand})` : "";
              warningLines.push(
                t("newOrder.duplicateWarningLine", {
                  quantity: found.quantity,
                  name: found.name,
                  brandText,
                  date: deliveryDate,
                  supplier
                })
              );
            }
          });
        }
      }
      if (warningLines.length > 0) {
        const confirmText = [
          t("newOrder.duplicateWarningIntro"),
          "",
          ...warningLines,
          "",
          t("newOrder.duplicateWarningConfirm")
        ].join("\n");
        if (!window.confirm(confirmText)) {
          setSaving(false);
          return;
        }
      }

      // Voeg producten toe aan bestaande "created" orders (indien zelfde supplier én deliveryDate), anders maak nieuw
      for (const [supplier, prodList] of Object.entries(grouped)) {
        const match = existingOrders.find(
          o => o.supplier === supplier && o.deliveryDate === deliveryDate
        );
        if (match) {
          let mergedProducts = [...match.articles];
          prodList.forEach(newProd => {
            const idx = mergedProducts.findIndex(
              prod => prod.name === newProd.name && prod.brand === newProd.brand
            );
            if (idx !== -1) {
              mergedProducts[idx].quantity += newProd.quantity;
            } else {
              mergedProducts.push(newProd);
            }
          });
          const sanitizedMerged = mergedProducts.map(sanitizeOrderItem);
          await updateOrder(hotelUid, match.id, { articles: sanitizedMerged });
        } else {
          const sanitizedProdList = prodList.map(sanitizeOrderItem);
          await addOrder(hotelUid, {
            supplier,
            orderDate,
            deliveryDate,
            status: "created",
            note,
            articles: sanitizedProdList
          });
        }
      }

      navigate("/orders");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate("/orders");
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
      <h1 className="text-2xl font-bold mb-4">{t("newOrder.title")}</h1>
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-2xl shadow flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <label className="block mb-1 font-medium">{t("newOrder.deliveryDate")}</label>
            <input
              type="date"
              className="border rounded-xl px-2 py-1 w-full"
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <label className="block mb-1 font-medium">{t("newOrder.requester")}</label>
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
        <div>
          <label className="block mb-1 font-medium">{t("newOrder.noteOptional")}</label>
          <textarea
            className="border rounded-xl px-2 py-1 w-full"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
          />
        </div>
        <div className="bg-gray-50 p-3 rounded-xl flex flex-col gap-2 border">
          <label className="font-medium">{t("newOrder.addArticle")}</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="border rounded-xl px-2 py-1 flex-1"
              value={parentCategory}
              onChange={e => { setParentCategory(e.target.value); setCategory(""); }}
            >
              <option value="">{t("newOrder.allParentCategories")}</option>
              {parentCategoryOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <select
              className="border rounded-xl px-2 py-1 flex-1"
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={!parentCategory}
            >
              <option value="">{t("newOrder.allChildCategories")}</option>
              {childCategoryOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <select
              className="border rounded-xl px-2 py-1 flex-1"
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
            >
              <option value="">{t("newOrder.allSuppliers")}</option>
              {supplierOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <input
            className="border rounded-xl px-2 py-1 w-full"
            placeholder={t("newOrder.searchPlaceholder")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">{t("newOrder.nameColumn")}</th>
                  <th className="p-2 text-left">{t("newOrder.supplierColumn")}</th>
                  {isArticleMode && <th className="p-2 text-left">{t("newOrder.brandColumn")}</th>}
                  {isArticleMode && <th className="p-2 text-left">{t("newOrder.priceColumn")}</th>}
                  {isArticleMode && <th className="p-2 text-left">{t("newOrder.packageColumn")}</th>}
                  <th className="p-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                  .map(item => {
                    const displayName = item.label || item.name;
                    const packagingText = formatArticlePackaging(item);
                    const priceText = item.pricePerPurchaseUnit != null
                      ? `€${Number(item.pricePerPurchaseUnit || 0).toFixed(2)}`
                      : "";
                    const existingIdx = isArticleMode
                      ? orderArticles.findIndex(p =>
                          p.articleId === item.id ||
                          (!p.articleId && p.name === item.name && p.brand === item.brand)
                        )
                      : orderArticles.findIndex(p => p.ingredientId === item.id);
                    const qty = existingIdx === -1 ? 0 : Number(orderArticles[existingIdx].quantity) || 0;
                    return (
                      <tr key={item.id} className="border-b">
                        <td className="p-2">{displayName}</td>
                        <td className="p-2">{item.supplier}</td>
                        {isArticleMode && <td className="p-2">{item.brand}</td>}
                        {isArticleMode && <td className="p-2">{priceText}</td>}
                        {isArticleMode && <td className="p-2">{packagingText}</td>}
                        <td className="p-2 text-right">
                          {existingIdx === -1 ? (
                            <button
                              type="button"
                              className="bg-marriott text-white px-3 py-1 rounded"
                              onClick={() => (isArticleMode ? handleAddArticle(item) : handleAddProduct(item))}
                              title={t("newOrder.addArticle")}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="px-2 py-1 border rounded-l-xl hover:bg-gray-100"
                                onClick={() => handleChangeQuantity(existingIdx, qty - 1)}
                              >
                                -
                              </button>
                              <div className="px-3 border-t border-b select-none min-w-[2rem] text-center">
                                {qty}
                              </div>
                              <button
                                type="button"
                                className="px-2 py-1 border rounded-r-xl hover:bg-gray-100"
                                onClick={() => handleChangeQuantity(existingIdx, qty + 1)}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1}
              onPageChange={setPage}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button
            type="button"
            className="bg-gray-200 px-4 py-2 rounded-2xl"
            onClick={handleCancel}
          >
            {t("newOrder.cancel")}
          </button>
        </div>
      </form>
      <div className="fixed right-4 top-24 flex flex-col gap-3 z-50">
        <button
          type="button"
          className="bg-white text-marriott border border-marriott rounded-full p-4 shadow-lg flex items-center justify-center hover:bg-marriott hover:text-white transition-colors"
          onClick={() => {
            setShowCreateArticleModal(true);
          }}
          title={t("newOrder.newArticleTooltip")}
          aria-label={t("newOrder.newArticleTooltip")}
        >
          <Plus className="w-6 h-6" />
        </button>
        <button
          type="button"
          className="bg-marriott text-white rounded-full p-4 shadow-lg flex items-center justify-center relative"
          onClick={() => {
            if (!canOpenCart) {
              const missing = [];
              if (!deliveryDate) missing.push(t("newOrder.missingFieldDeliveryDate"));
              if (!requester) missing.push(t("newOrder.missingFieldRequester"));
              setMissingFields(missing);
              setShowMissingModal(true);
              return;
            }
            setError("");
            setShowProductsModal(true);
          }}
        >
          <ShoppingCart className="w-6 h-6" />
          {orderArticles.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-white text-marriott rounded-full text-xs font-bold px-2">
              {orderArticles.length}
            </span>
          )}
        </button>
      </div>
      <AddProductModal
        open={showAddModal}
        ingredient={ingredientToAdd}
        article={articleToAdd}
        articles={allArticles}
        onConfirm={confirmAddProduct}
        onCancel={closeAddModal}
      />
      <OrderProductsModal
        open={showProductsModal}
        articles={orderArticles}
        outlets={outlets}
        bulkOutlet={bulkOutlet}
        onClose={() => setShowProductsModal(false)}
        onQuantityChange={handleChangeQuantity}
        onOutletChange={handleChangeOutlet}
        onBulkOutletChange={handleBulkOutletChange}
        onRemove={handleRemoveProduct}
        onConfirm={handleSubmit}
        saving={saving}
        error={error}
      />
      <CreateArticleModal
        open={showCreateArticleModal}
        onCancel={() => setShowCreateArticleModal(false)}
        onCreate={handleCreateCustomArticle}
        suppliers={suppliers}
      />
      <AlertModal
        open={showMissingModal}
        onClose={() => setShowMissingModal(false)}
        title={t("newOrder.missingFieldsTitle")}
        message={
          <div>
            <p className="mb-2">{t("newOrder.missingFieldsIntro")}</p>
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
