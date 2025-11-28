// src/features/orders/EditOrderPage.jsx
import React, { useState, useEffect, useRef } from "react";
import PageContainer from "components/layout/PageContainer";
import { useParams, useNavigate } from "react-router-dom";
import { useHotelContext } from "contexts/HotelContext";
import { getSuppliers } from "services/firebaseSettings";
import { getOutlets } from "services/firebaseSettings";
import OrderProductCard from "./OrderProductCard";
import AddProductModal from "./AddProductModal";
import {
  getOrder,
  getIngredients,
  updateOrder,
  setOrderStatus,
} from "./orderService";
import { getArticlesIndexed } from "../../services/firebaseArticles";
import { ArrowLeft } from "lucide-react";
import { getSearchTokens, matchesSearchTokensAcross } from "utils/search";

export default function EditOrderPage() {
  const { hotelUid } = useHotelContext();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ingredientToAdd, setIngredientToAdd] = useState(null);
  const [editIndex, setEditIndex] = useState(-1);

  // Form state
  const [products, setProducts] = useState([]);
  const [note, setNote] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  useEffect(() => {
    getSuppliers().then(setSuppliers);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const orderData = await getOrder(hotelUid, orderId);
      setOrder(orderData);
      setProducts(orderData?.articles || []);
      setNote(orderData?.note || "");
      setDeliveryDate(orderData?.deliveryDate || "");
      setLoading(false);
    }
    fetchData();
  }, [hotelUid, orderId]);

  useEffect(() => {
    async function fetchIngredients() {
      const ingArr = await getIngredients(hotelUid);
      setIngredients(ingArr);
      const outs = await getOutlets(hotelUid);
      const arts = await getArticlesIndexed(hotelUid);
      setOutlets(outs);
      setArticles(arts.filter(a => a.active !== false));
    }
    fetchIngredients();
  }, [hotelUid]);

  // Autocomplete filter
  useEffect(() => {
    const tokens = getSearchTokens(query);
    if (tokens.length === 0) {
      setFiltered([]);
      setShowSuggestions(false);
    } else {
      setFiltered(
        ingredients.filter(ing =>
          matchesSearchTokensAcross([
            ing.label,
            ing.name,
            ing.brand,
          ], tokens)
        )
      );
      setShowSuggestions(true);
    }
  }, [query, ingredients]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Edit Order</h1>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Edit Order</h1>
        <div className="text-red-600">Order not found.</div>
      </div>
    );
  }

  const editable = order.status === "created";
  const getUnitPrice = prod => Number(
    prod.invoicedPricePerPurchaseUnit
    ?? prod.price
    ?? prod.pricePerPurchaseUnit
    ?? 0
  );

  const orderTotal = products.reduce(
    (acc, prod) => acc + ((Number(prod.quantity) || 0) * getUnitPrice(prod)),
    0
  );

  function handleAddProduct(ing) {
    setIngredientToAdd(ing);
    setEditIndex(-1);
    setShowAddModal(true);
    setQuery("");
    setShowSuggestions(false);
  }

  function confirmAddProduct(qty, article) {
    if (!ingredientToAdd) return;
    const { id, articles: _unusedArticles, ...rest } = ingredientToAdd;
    const art = article || {};
    const baseProd = {
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
      price: Number(art.pricePerPurchaseUnit ?? rest.pricePerPurchaseUnit ?? 0),
      pricePerPurchaseUnit: Number(art.pricePerPurchaseUnit ?? rest.pricePerPurchaseUnit ?? 0),
      invoicedPricePerPurchaseUnit: Number(art.pricePerPurchaseUnit ?? rest.pricePerPurchaseUnit ?? 0),
      pricePerStockUnit: art.pricePerStockUnit ?? rest.pricePerStockUnit,
      imageUrl: art.imageUrl || rest.imageUrl,
      quantity: qty,
    };
    if (editIndex >= 0) {
      const prevOutlet = products[editIndex].outlet || "";
      setProducts(products.map((p, i) => (i === editIndex ? { ...baseProd, outlet: prevOutlet } : p)));
    } else {
      setProducts([...products, { ...baseProd, outlet: outlets[0]?.name || "" }]);
    }
    setIngredientToAdd(null);
    setEditIndex(-1);
    setShowAddModal(false);
  }

  function handleChangeArticle(idx) {
    const prod = products[idx];
    const ing = ingredients.find(i => i.id === prod.ingredientId);
    if (!ing) return;
    setIngredientToAdd(ing);
    setEditIndex(idx);
    setShowAddModal(true);
  }

  function handleChangeQuantity(idx, value) {
    setProducts(products.map((p, i) =>
      i === idx ? { ...p, quantity: value === "" ? "" : Number(value) } : p
    ));
  }

  function handleChangeOutlet(idx, value) {
    setProducts(products.map((p, i) =>
      i === idx ? { ...p, outlet: value } : p
    ));
  }

  function handleRemoveProduct(idx) {
    setProducts(products.filter((_, i) => i !== idx));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!deliveryDate || products.length === 0) {
      alert("Set a delivery date and add at least 1 product.");
      return;
    }
    setSaving(true);
    await updateOrder(hotelUid, orderId, {
      deliveryDate,
      note,
      articles: products,
    });
    setSaving(false);
    navigate("/orders");
  }

  async function handleConfirmOrder(e) {
    e.preventDefault();
    if (!deliveryDate || products.length === 0) {
      alert("Set a delivery date and add at least 1 product.");
      return;
    }
    setSaving(true);
    await updateOrder(hotelUid, orderId, {
      deliveryDate,
      note,
      articles: products,
      status: "ordered"
    });
    setSaving(false);
    navigate("/orders");
  }

  async function handleCancelOrder() {
    setSaving(true);
    await setOrderStatus(hotelUid, orderId, "cancelled");
    setSaving(false);
    navigate("/orders");
  }

  function handleCancel() {
    navigate("/orders");
  }

  // Vind alle info van de supplier indien beschikbaar
  const supplierObj = suppliers.find(s => s.name === order.supplier);

  const statusColors = {
    created: "bg-orange-50 text-orange-700 border border-orange-200",
    ordered: "bg-yellow-50 text-yellow-700 border border-yellow-200",
    received: "bg-green-50 text-green-700 border border-green-200",
    cancelled: "bg-red-50 text-red-700 border border-red-200",
    canceled: "bg-red-50 text-red-700 border border-red-200"
  };

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Edit Order</h1>
      <div className="flex justify-between items-center mb-2">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${statusColors[order.status] || "bg-gray-100 text-gray-600"}`}
          style={{ minWidth: 90, textAlign: "center", letterSpacing: 1 }}
        >
          {order.status}
        </span>
      </div>
      <div className="mb-4">
        <span className="font-semibold">Supplier: </span>
        <span>
          {supplierObj ? (
            <>
              {supplierObj.name}
              {supplierObj.customerNr && <> — klantnr: <b>{supplierObj.customerNr}</b></>}
              {supplierObj.email && (
                <>
                  {" "}
                  | <a href={`mailto:${supplierObj.email}`} className="underline text-blue-600">{supplierObj.email}</a>
                </>
              )}
            </>
          ) : (
            order.supplier
          )}
        </span>
      </div>
      <form onSubmit={handleConfirmOrder} className="bg-white p-4 rounded-2xl shadow flex flex-col gap-4">
        <div className="flex gap-4 mb-2 flex-wrap">
          <div>
            <label className="block mb-1 font-medium">Leverdatum</label>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              required
              disabled={!editable}
            />
          </div>
          <div className="flex-1">
            <label className="block mb-1 font-medium">Notitie</label>
            <input
              type="text"
              className="border rounded px-2 py-1 w-full"
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={!editable}
            />
          </div>
        </div>
        {editable && (
          <div className="mb-2" ref={inputRef}>
            <label className="block mb-1 font-medium">Product toevoegen</label>
            <input
              type="text"
              className="border rounded px-2 py-1 w-full"
              placeholder="Zoek op naam of merk..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              autoComplete="off"
            />
            {showSuggestions && filtered.length > 0 && (
              <div className="absolute bg-white border rounded shadow w-full z-20 max-h-60 overflow-y-auto">
                {filtered.slice(0, 12).map((ing, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 cursor-pointer hover:bg-marriott/10"
                    onClick={() => handleAddProduct(ing)}
                  >
                    {ing.label}
                    {ing.supplier && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({ing.supplier})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div>
  <h2 className="font-medium mb-2">Products in Order</h2>
  {products.length === 0 ? (
    <div className="text-gray-400">No products added yet.</div>
  ) : (
    <>
      {/* Mobiel: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {products.map((prod, idx) => {
          const ing = ingredients.find(i => i.id === prod.ingredientId);
          const opts = Array.isArray(ing?.articles)
            ? articles.filter(a => ing.articles.includes(a.id) && a.active !== false)
            : [];
          const canChange = opts.length > 1;
          return (
            <OrderProductCard
              key={idx}
              prod={prod}
              idx={idx}
              editable={editable}
              outlets={outlets}
              onQuantityChange={(i, val) => handleChangeQuantity(i, val)}
              onOutletChange={handleChangeOutlet}
              onRemove={handleRemoveProduct}
              canChangeArticle={canChange}
              onChangeArticle={handleChangeArticle}
            />
          );
        })}
      </div>
      {/* Desktop: rij-layout zoals vroeger */}
      <div className="flex flex-col gap-2 hidden sm:flex">
        {products.map((prod, idx) => {
          const qty = Number(prod.quantity) || 0;
          const unitPrice = getUnitPrice(prod);
          const total = qty * unitPrice;
          const ing = ingredients.find(i => i.id === prod.ingredientId);
          const opts = Array.isArray(ing?.articles)
            ? articles.filter(a => ing.articles.includes(a.id) && a.active !== false)
            : [];
          const canChange = opts.length > 1;
          return (
            <div key={idx} className="flex gap-3 items-center border rounded-xl px-3 py-1 bg-gray-50">
              <div className="flex-1">
                {prod.label}
                {prod.supplier && (
                  <span className="ml-2 text-xs text-gray-500">({prod.supplier})</span>
                )}
                {canChange && editable && (
                  <button
                    type="button"
                    className="text-marriott text-xs underline ml-2"
                    onClick={() => handleChangeArticle(idx)}
                  >
                    andere
                  </button>
                )}
                {prod.unitsPerPurchaseUnit && prod.stockUnit && (
                  <span className="ml-2 text-xs text-gray-500">
                    / {prod.unitsPerPurchaseUnit} {prod.stockUnit}
                  </span>
                )}

                {!prod.unitsPerPurchaseUnit && prod.purchaseUnit && (
                  <span className="ml-2 text-xs text-gray-500">/ {prod.purchaseUnit}</span>
                )}
              </div>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={e => handleChangeQuantity(idx, e.target.value)}
                className="w-16 border rounded-xl px-2 py-1 text-center"
                required
                disabled={!editable}
              />
              <select
                className="border rounded-xl px-2 py-1"
                value={prod.outlet || ""}
                onChange={e => handleChangeOutlet(idx, e.target.value)}
                disabled={!editable}
              >
                <option value="">Select outlet</option>
                {outlets.map(o => (
                  <option key={o.id || o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
              <div>
                €{unitPrice.toFixed(2)}
                {qty > 1 && (
                  <span className="text-xs text-gray-500 ml-1">({qty}×)</span>
                )}
              </div>
              <div className="font-semibold text-marriott">
                €{total.toFixed(2)}
              </div>
              {editable && (
                <button
                  type="button"
                  className="text-marriott text-xs underline ml-2 hover:text-marriott-dark"
                  onClick={() => handleRemoveProduct(idx)}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  )}
  <div className="mt-4 text-right font-bold text-lg text-marriott border-t pt-3">
    Totaal bestelling: €{orderTotal.toFixed(2)}
  </div>
</div>

        <div className="flex gap-2 flex-wrap justify-end mt-4">
          <button
            type="button"
            className="bg-gray-100 border border-gray-300 text-gray-600 px-4 py-2 rounded-xl font-medium hover:bg-gray-200"
            onClick={handleCancel}
          >
            Cancel
          </button>
          {editable && (
            <button
              type="button"
              className="bg-marriott text-white px-6 py-2 rounded-xl font-semibold hover:bg-marriott-dark transition"
              disabled={products.length === 0 || !deliveryDate || saving}
              onClick={handleSave}
            >
              Save Changes
            </button>
          )}
          {editable && (
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-green-800 transition"
              disabled={products.length === 0 || !deliveryDate || saving}
            >
              Confirm Order
            </button>
          )}
        {editable && (
            <button
              type="button"
              className="bg-gray-100 border border-gray-300 text-gray-600 px-4 py-2 rounded-xl font-medium hover:bg-gray-200"
              onClick={handleCancelOrder}
            >
              Cancel Order
            </button>
          )}
        </div>
      </form>
      <AddProductModal
        open={showAddModal}
        ingredient={ingredientToAdd}
        articles={articles}
        onConfirm={confirmAddProduct}
        onCancel={() => {
          setShowAddModal(false);
          setIngredientToAdd(null);
          setEditIndex(-1);
        }}
        initialQty={editIndex >= 0 ? products[editIndex]?.quantity : 1}
        currentArticleId={editIndex >= 0 ? products[editIndex]?.id : undefined}
      />
    </PageContainer>
  );
}
