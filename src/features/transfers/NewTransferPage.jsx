import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useHotelContext } from "contexts/HotelContext";
import { getIngredientsIndexed } from "services/firebaseIngredients";
import { getOutlets, getCategories } from "services/firebaseSettings";
import { getArticlesIndexed } from "../../services/firebaseArticles";
import { fetchUserProfile } from "services/firebaseUsers";
import { auth, signOut } from "../../firebaseConfig";
import { addTransfer } from "./transferService";
import Pagination from "shared/Pagination";
import PageContainer from "components/layout/PageContainer";
import HeaderBar from "components/layout/HeaderBar";
import AddProductModal from "./AddProductModal";
import TransferProductsModal from "./TransferProductsModal";
import { ShoppingCart, Plus } from "lucide-react";
import AlertModal from "components/layout/AlertModal";
import { usePermission } from "../../hooks/usePermission";
import { useTranslation } from "react-i18next";
import { getSearchTokens, matchesSearchTokensAcross } from "utils/search";

function removeUndefined(obj) {
  if (Array.isArray(obj)) {
    return obj
      .map(item => (typeof item === "object" && item !== null ? removeUndefined(item) : item))
      .filter(item => item !== undefined);
  }

  if (obj && typeof obj === "object") {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value === undefined) {
        return acc;
      }
      acc[key] =
        typeof value === "object" && value !== null ? removeUndefined(value) : value;
      return acc;
    }, {});
  }

  return obj;
}

export default function NewTransferPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { t } = useTranslation("transfers");
  const [ingredients, setIngredients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [products, setProducts] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [requester, setRequester] = useState("");
  const [fromOutlet, setFromOutlet] = useState("");
  const [toOutlet, setToOutlet] = useState("");
  const [categories, setCategories] = useState({});
  const [parentCategory, setParentCategory] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ingredientToAdd, setIngredientToAdd] = useState(null);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const navigate = useNavigate();
  const canCreate = usePermission("transfers", "create");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missingFields, setMissingFields] = useState([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const ITEMS_PER_PAGE = 50;

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

  if (!canCreate) {
    return (
      <PageContainer>
        <div className="text-center text-gray-600">No access to create transfers.</div>
      </PageContainer>
    );
  }
  const canOpenCart = date && fromOutlet && toOutlet && requester;

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
      const arr = await getIngredientsIndexed(hotelUid);
      setIngredients(arr);
      const [outs, arts, cats] = await Promise.all([
        getOutlets(hotelUid),
        getArticlesIndexed(hotelUid),
        getCategories()
      ]);
      setOutlets(outs);
      setArticles(arts.filter(a => a.active !== false));
      setCategories(cats);
    }
    fetch();
  }, [hotelUid]);

  useEffect(() => {
    let list = ingredients;
    if (parentCategory) {
      list = list.filter(
        ing => categories[ing.category]?.parentId === parentCategory
      );
    }
    if (category) {
      list = list.filter(ing => ing.category === category);
    }
    if (query) {
      const tokens = getSearchTokens(query);
      if (tokens.length > 0) {
        list = list.filter(ing =>
          matchesSearchTokensAcross([
            ing.name,
            ing.aliases?.nl,
            ing.aliases?.fr,
            ing.brand,
          ], tokens)
        );
      }
    }
    setFiltered(list);
    setPage(1);
  }, [query, ingredients, parentCategory, category, categories]);

  function handleAddProduct(ing) {
    setError('');
    setIngredientToAdd(ing);
    setShowAddModal(true);
  }

  function confirmAddProduct(qty, article) {
    if (!ingredientToAdd) return;
    const { id, articles: _unusedArticles, ...rest } = ingredientToAdd;
    const art = article || {};
    const newProd = removeUndefined({
      ...rest,
      ...art,
      ingredientId: id,
      name: art.name || rest.name,
      brand: art.brand || rest.brand,
      supplier: art.supplier || rest.supplier || "",
      purchaseUnit: art.purchaseUnit || rest.purchaseUnit,
      unitsPerPurchaseUnit: art.unitsPerPurchaseUnit || rest.unitsPerPurchaseUnit,
      stockUnit: art.stockUnit || rest.stockUnit,
      contentPerStockUnit: art.contentPerStockUnit || rest.contentPerStockUnit,
      recipeUnit: art.recipeUnit || rest.recipeUnit,
      imageUrl: art.imageUrl || rest.imageUrl,
      quantity: qty,
      fromOutlet,
      toOutlet,
    });
    setProducts(prods => {
      const idx = prods.findIndex(p => p.ingredientId === id);
      if (idx !== -1) {
        const arr = [...prods];
        arr[idx] = { ...arr[idx], quantity: arr[idx].quantity + qty };
        return arr;
      }
      return [newProd, ...prods];
    });
    setIngredientToAdd(null);
    setShowAddModal(false);
    setQuery("");
  }

  function handleRemoveProduct(idx) {
    setProducts(products.filter((_, i) => i !== idx));
  }

  function handleChangeQuantity(idx, value) {
    if (value === "") {
      setProducts(prods =>
        prods.map((p, i) => (i === idx ? { ...p, quantity: "" } : p))
      );
      return;
    }
    const qty = Number(value);
    if (qty <= 0) {
      setProducts(prods => prods.filter((_, i) => i !== idx));
    } else {
      setProducts(prods =>
        prods.map((p, i) => (i === idx ? { ...p, quantity: qty } : p))
      );
    }
  }

  useEffect(() => {
    setProducts(prods => prods.map(p => ({ ...p, fromOutlet })));
  }, [fromOutlet]);

  useEffect(() => {
    setProducts(prods => prods.map(p => ({ ...p, toOutlet })));
  }, [toOutlet]);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (saving) return;
    if (!date || !requester || products.length === 0) {
      setError(t("missingFieldsError"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const transferData = removeUndefined({
        date,
        requester,
        fromOutlet,
        toOutlet,
        status: "created",
        products,
      });
      await addTransfer(hotelUid, transferData);
      navigate("/transfers");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
      <h1 className="text-2xl font-bold mb-4">{t("newTransfer")}</h1>
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-2xl shadow flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="sm:w-1/2">
            <label className="block mb-1 font-medium">{t("date")}</label>
            <input
              type="date"
              className="border rounded-xl px-2 py-1 w-full"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
          <div className="sm:w-1/2">
            <label className="block mb-1 font-medium">{t("requester")}</label>
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
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <label className="block mb-1 font-medium">{t("fromOutlet")}</label>
            <select
              className="border rounded-xl px-2 py-1 w-full"
              value={fromOutlet}
              onChange={e => setFromOutlet(e.target.value)}
            >
              <option value="">{t("selectOutlet")}</option>
              {outlets.map(o => (
                <option key={o.id || o.name} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block mb-1 font-medium">{t("toOutlet")}</label>
            <select
              className="border rounded-xl px-2 py-1 w-full"
              value={toOutlet}
              onChange={e => setToOutlet(e.target.value)}
            >
              <option value="">{t("selectOutlet")}</option>
              {outlets.map(o => (
                <option key={o.id || o.name} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-xl flex flex-col gap-2 border">
          <label className="font-medium">{t("addIngredient")}</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="border rounded-xl px-2 py-1 flex-1"
              value={parentCategory}
              onChange={e => {
                setParentCategory(e.target.value);
                setCategory("");
              }}
            >
              <option value="">{t("allParentCategories")}</option>
              {parentCategoryOptions.map(opt => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="border rounded-xl px-2 py-1 flex-1"
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={!parentCategory}
            >
              <option value="">{t("allSubCategories")}</option>
              {childCategoryOptions.map(opt => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <input
            className="border rounded-xl px-2 py-1 w-full"
            placeholder={t("searchIngredient")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">{t("photo")}</th>
                  <th className="p-2 text-left">{t("name")}</th>
                  <th className="p-2 text-left">{t("content")}</th>
                  <th className="p-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                  .map(ing => (
                    <tr key={ing.id} className="border-b">
                      <td className="p-2">
                        {ing.imageUrl && (
                          <img
                            src={ing.imageUrl}
                            alt={ing.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                      </td>
                      <td className="p-2">{ing.name}</td>
                      <td className="p-2">
                        {ing.contentPerStockUnit} {ing.recipeUnit} / {ing.stockUnit}
                      </td>
                      <td className="p-2 text-right">
                        {(() => {
                          const idx = products.findIndex(p => p.ingredientId === ing.id);
                          if (idx === -1) {
                            return (
                              <button
                                type="button"
                                className="bg-marriott text-white px-3 py-1 rounded"
                                onClick={() => handleAddProduct(ing)}
                                title={t("add")}
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            );
                          }
                          const qty = Number(products[idx].quantity) || 0;
                          return (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="px-2 py-1 border rounded-l-xl hover:bg-gray-100"
                                onClick={() => handleChangeQuantity(idx, Math.max(0, qty - 1))}
                              >
                                -
                              </button>
                              <div className="px-3 border-t border-b select-none min-w-[2rem] text-center">
                                {qty}
                              </div>
                              <button
                                type="button"
                                className="px-2 py-1 border rounded-r-xl hover:bg-gray-100"
                                onClick={() => handleChangeQuantity(idx, qty + 1)}
                              >
                                +
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
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
            onClick={() => navigate("/transfers")}
          >
            {t("cancel")}
          </button>
        </div>
        {error && (
          <div className="text-red-600 text-sm mt-2">{error}</div>
        )}
      </form>
      <button
        type="button"
        className="fixed right-4 top-24 bg-marriott text-white rounded-full p-4 shadow-lg z-50 flex items-center justify-center"
        onClick={() => {
          if (!canOpenCart) {
            const missing = [];
            if (!date) missing.push(t("date"));
            if (!fromOutlet) missing.push(t("fromOutlet"));
            if (!toOutlet) missing.push(t("toOutlet"));
            if (!requester) missing.push(t("requester"));
            setMissingFields(missing);
            setShowMissingModal(true);
            return;
          }
          setError('');
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
        ingredient={ingredientToAdd}
        articles={articles}
        onConfirm={confirmAddProduct}
        onCancel={() => setShowAddModal(false)}
      />
      <TransferProductsModal
        open={showProductsModal}
        products={products}
        outlets={outlets}
        onClose={() => setShowProductsModal(false)}
        onQuantityChange={handleChangeQuantity}
        onRemove={handleRemoveProduct}
        onConfirm={handleSubmit}
        saving={saving}
        error={error}
      />
      <AlertModal
        open={showMissingModal}
        onClose={() => setShowMissingModal(false)}
        title={t("missingFieldsTitle")}
        message={
          <div>
            <p className="mb-2">{t("missingFieldsMessage")}</p>
            <ul className="list-disc list-inside">
              {missingFields.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        }
      />
    </PageContainer>
    </>
  );
}
