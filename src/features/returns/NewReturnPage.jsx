// src/features/returns/NewReturnPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useHotelContext } from "contexts/HotelContext";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";
import { getSuppliers } from "services/firebaseSettings";
import ReturnMailPreviewModal from "./ReturnMailPreviewModal";
import {
  addReturn,
  getIngredients,
  getAllOrderProducts
} from "./returnsService";
import { getLastDeliveryForIngredient } from "./returnHelpers";
import { getSearchTokens, matchesSearchTokensAcross } from "utils/search";

export default function NewReturnPage() {
  const [ingredients, setIngredients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showMailPreview, setShowMailPreview] = useState(false);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendMail, setSendMail] = useState(false);
  const [toast, setToast] = useState("");
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { hotelUid, hotelName } = useHotelContext();

  useEffect(() => {
    getSuppliers().then(setSuppliers);
  }, []);

  useEffect(() => {
    if (!hotelUid) return;
    getIngredients(hotelUid).then(setIngredients);
    getAllOrderProducts(hotelUid).then(setOrders);
  }, [hotelUid]);

  useEffect(() => {
    const tokens = getSearchTokens(query);
    if (tokens.length === 0) {
      setFiltered([]);
    } else {
      setFiltered(
        ingredients.filter(
          ing =>
            matchesSearchTokensAcross([
              ing.label,
              ing.name,
              ing.brand,
            ], tokens) &&
            !selectedProducts.some(sel => sel.id === ing.id)
        )
      );
    }
  }, [query, ingredients, selectedProducts]);

  function handleSelectProduct(ing) {
    setSelectedProducts([
      ...selectedProducts,
      {
        ...ing,
        quantity: 1,
        note: "",
        lastDelivery: getLastDeliveryForIngredient(ing, orders),
      }
    ]);
    setQuery("");
    setFiltered([]);
  }

  function handleRemoveProduct(idx) {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== idx));
  }

  function handleProductChange(idx, field, value) {
    setSelectedProducts(selectedProducts.map((p, i) =>
      i === idx ? { ...p, [field]: value } : p
    ));
  }

  // Vind supplier object op basis van eerste geselecteerde
  const supplierObj =
    selectedProducts.length > 0
      ? suppliers.find(s => s.name === selectedProducts[0].supplier)
      : null;

  function buildMailPreview() {
    if (!supplierObj) return { subject: "", body: "" };
    const subject = `${hotelName} - ${supplierObj.customerNr || ""} - Retour ${selectedProducts.map(p => p.name).join(", ")}`;
    const lines = selectedProducts.map(p => {
      const artikelnummer =
        p.artikelnummer ||
        p.articleNumber ||
        p.lastDelivery.artikelnummer ||
        p.lastDelivery.articleNumber ||
        "-";
      const artikelnaam = p.name || "-";
      const orderdate = p.lastDelivery.deliveryDate || "-";
      const prijs = typeof p.pricePerPurchaseUnit === "number"
        ? `@ €${Number(p.pricePerPurchaseUnit).toFixed(2)}`
        : "";
      return (
        `${p.quantity} x (${artikelnummer}) - ${artikelnaam} ${prijs}\nReden: ${p.note || "-"}\nBesteld op: ${orderdate}`
      );
    }).join("\n\n");

    const body = `
Beste,

Volgende items zouden retour moeten:

${lines}

Bedankt om hiervoor een creditnota op te maken en de retour mee te nemen.

Met vriendelijke groeten,
F&B ${hotelName}
    `.trim();
    return { subject, body };
  }

  async function sendReturnMail({ to, subject, text }) {
    const res = await fetch(
      "https://sendtestmail-jds3lxtzaq-uc.a.run.app",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text }),
      }
    );
    return await res.json();
  }

  async function handleFinalMailAndCreate() {
    setSaving(true);
    try {
      const { subject, body } = buildMailPreview();
      const mailResult = await sendReturnMail({
        to: supplierObj.email,
        subject,
        text: body,
      });
      if (!mailResult.ok) {
        setToast("Mailen naar leverancier is mislukt, retour werd niet aangemaakt.");
        setSaving(false);
        return;
      }
      await Promise.all(selectedProducts.map(prod =>
        addReturn(hotelUid, {
          ingredientId: prod.id,
          productLabel: prod.label,
          brand: prod.brand,
          supplier: prod.supplier,
          quantity: Number(prod.quantity),
          unit: prod.purchaseUnit,
          note: prod.note,
          status: "created",
          dateCreated: Date.now(),
          pricePerPurchaseUnit: prod.pricePerPurchaseUnit,
        })
      ));
      setToast("Retour & mail succesvol verzonden!");
      setTimeout(() => navigate("/returns"), 1000);
    } catch (e) {
      setToast("Onverwachte fout: " + e.message);
    } finally {
      setSaving(false);
      setShowMailPreview(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedProducts.length) return;
    if (sendMail && supplierObj && supplierObj.email) {
      const { subject, body } = buildMailPreview();
      setMailSubject(subject);
      setMailBody(body);
      setShowMailPreview(true);
      return;
    }
    setSaving(true);
    try {
      await Promise.all(selectedProducts.map(sel =>
        addReturn(hotelUid, {
          ingredientId: sel.id,
          productLabel: sel.label,
          brand: sel.brand,
          supplier: sel.supplier,
          quantity: Number(sel.quantity),
          unit: sel.purchaseUnit,
          note: sel.note,
          status: "created",
          dateCreated: Date.now(),
          pricePerPurchaseUnit: sel.pricePerPurchaseUnit,
        })
      ));
      setToast("Retour succesvol aangemaakt!");
      setTimeout(() => navigate("/returns"), 1000);
    } catch (e) {
      setToast("Onverwachte fout: " + e.message);
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4">Nieuwe retour</h1>
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-2xl shadow flex flex-col gap-4 relative">
          <div>
            <label className="block mb-1 font-medium">Product(en)</label>
            <div className="flex gap-2 mb-2">
              <input
                className="border rounded-xl px-2 py-1 w-full"
                placeholder="Type om ingrediënt te zoeken..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoComplete="off"
                ref={inputRef}
              />
            </div>
            {filtered.length > 0 && (
              <div className="bg-white border rounded shadow mt-1 absolute z-10 w-full max-h-56 overflow-y-auto">
                {filtered.slice(0, 10).map((ing, idx) => (
                  <div
                    key={idx}
                    className="px-2 py-1 hover:bg-marriott/10 cursor-pointer flex flex-col"
                    onClick={() => handleSelectProduct(ing)}
                  >
                    <span>
                      {ing.label} <span className="ml-2 text-xs text-gray-500">{ing.supplier}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {getLastDeliveryForIngredient(ing, orders).deliveryDate
                        ? `Laatste levering: ${getLastDeliveryForIngredient(ing, orders).deliveryDate}`
                        : "Nooit geleverd"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            {selectedProducts.map((prod, idx) => (
              <div
                key={prod.id}
                className="bg-gray-50 border rounded-xl p-3 mb-2 flex flex-col gap-2 relative"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <b>{prod.label}</b> ({prod.supplier})
                    <span className="ml-2 text-xs text-gray-500">
                      {prod.lastDelivery.deliveryDate ? `Laatste levering: ${prod.lastDelivery.deliveryDate}` : "Nooit geleverd"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-red-600 px-2"
                    onClick={() => handleRemoveProduct(idx)}
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="block font-medium">
                    Aantal <span className="text-gray-500">(in {prod.purchaseUnit})</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="border rounded-xl px-2 py-1 w-20"
                    value={prod.quantity}
                    onChange={e => handleProductChange(idx, "quantity", Number(e.target.value))}
                    required
                  />
                  <span className="ml-2 text-gray-500">
                    Prijs aankoopverpakking: €{prod.pricePerPurchaseUnit?.toFixed ? prod.pricePerPurchaseUnit.toFixed(2) : "-"}
                  </span>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Reden / Notitie</label>
                  <textarea
                    className="border rounded-xl px-2 py-1 w-full"
                    value={prod.note}
                    onChange={e => handleProductChange(idx, "note", e.target.value)}
                    rows={2}
                    placeholder="Beschadigd, vervallen, verkeerd geleverd, ..."
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="sendMail"
              checked={sendMail}
              onChange={e => setSendMail(e.target.checked)}
              className="h-5 w-5"
            />
            <label htmlFor="sendMail" className="text-base">
              Stuur mail naar leverancier
            </label>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              className="bg-gray-200 px-4 py-2 rounded-2xl"
              onClick={() => navigate("/returns")}
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="bg-marriott text-white px-6 py-2 rounded-2xl font-semibold hover:bg-marriott-dark"
              disabled={saving || selectedProducts.length === 0}
            >
              {saving ? "Bezig..." : "Retour aanmaken"}
            </button>
          </div>
          {toast && (
            <div className="fixed bottom-4 right-4 bg-marriott text-white px-6 py-3 rounded-2xl shadow-xl z-50 animate-fade-in">
              {toast}
            </div>
          )}
        </form>
        <ReturnMailPreviewModal
          open={showMailPreview}
          onCancel={() => setShowMailPreview(false)}
          onSend={handleFinalMailAndCreate}
          supplierEmail={supplierObj?.email}
          subject={mailSubject}
          body={mailBody}
        />
      </PageContainer>
    </>
  );
}
