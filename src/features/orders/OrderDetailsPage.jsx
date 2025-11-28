import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useHotelContext } from "contexts/HotelContext";
import { usePermission } from "hooks/usePermission";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import ConfirmModal from "components/layout/ConfirmModal";
import ProductLine from "./ProductLine";
import PriceEditModal from "./PriceEditModal";
import {
  getOrder,
  setOrderStatus,
  getIngredients,
  updateOrder,
} from "./orderService";
import { updateArticle } from "../../services/firebaseArticles";
import { logout } from "../../services/firebaseAuth";
import { AlertCircle, ArrowLeft, FileDown, Settings } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function OrderDetailsPage() {
  const { hotelUid, hotelName, language } = useHotelContext();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("orders");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState({});
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);
  const [showBackToCreatedConfirm, setShowBackToCreatedConfirm] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [editType, setEditType] = useState("price");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const locale = language === "fr" ? "fr-FR" : language === "en" ? "en-GB" : "nl-BE";

  const canApproveOrder = usePermission("orders", "approve");
  const canReceiveOrder = usePermission("orders", "receive");
  const canFinalizeOrder = usePermission("orders", "finalize");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [o, ingArr] = await Promise.all([
        getOrder(hotelUid, orderId),
        getIngredients(hotelUid),
      ]);
      const ingMap = {};
      ingArr.forEach(ing => {
        ingMap[ing.id] = ing;
      });
      setIngredients(ingMap);
      setOrder(o);
      setLoading(false);
    }
    fetchData();
  }, [hotelUid, orderId]);

  function formatToday() {
    const d = new Date();
    return d.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const showReceived = ["received", "checked", "completed"].includes(order?.status);
  const isCompleted = order?.status === "completed";
  const getUnitPrice = prod => Number(
    prod?.invoicedPricePerPurchaseUnit
    ?? prod?.price
    ?? prod?.pricePerPurchaseUnit
    ?? 0
  );
  const orderTotal = order?.articles
    ? order.articles.reduce((sum, prod) => {
        const qty = showReceived
          ? Number(prod.received) || 0
          : Number(prod.quantity) || 0;
        return sum + qty * getUnitPrice(prod);
      }, 0)
    : 0;

  const statusColors = {
    created: "bg-orange-50 text-orange-700 border border-orange-200",
    ordered: "bg-yellow-50 text-yellow-700 border border-yellow-200",
    received: "bg-green-50 text-green-700 border border-green-200",
    checked: "bg-sky-50 text-sky-700 border border-sky-200",
    completed: "bg-emerald-700 text-white border border-emerald-800",
    cancelled: "bg-red-50 text-red-700 border border-red-200",
    canceled: "bg-red-50 text-red-700 border border-red-200",
  };

  const handleConfirm = async () => {
    if (!canApproveOrder) return;
    setShowConfirmOrder(false);
    await setOrderStatus(hotelUid, order.id, "ordered");
    navigate("/orders");
  };

  const handleCancel = async () => {
    setShowCancelConfirm(false);
    await setOrderStatus(hotelUid, order.id, "cancelled");
    navigate("/orders");
  };

  const handleBackToCreated = async () => {
    if (!canApproveOrder) return;
    setShowBackToCreatedConfirm(false);
    await setOrderStatus(hotelUid, order.id, "created");
    navigate("/orders");
  };

  const handleReset = async () => {
    if (!canFinalizeOrder) return;
    await setOrderStatus(hotelUid, order.id, "ordered");
    navigate("/orders");
  };

  const handleFinalCheck = async () => {
    if (!canFinalizeOrder) return;
    await setOrderStatus(hotelUid, order.id, "checked");
    setOrder(prev => (prev ? { ...prev, status: "checked" } : prev));
  };

  const handleBackToReceived = async () => {
    if (!canFinalizeOrder) return;
    await setOrderStatus(hotelUid, order.id, "received");
    setOrder(prev => (prev ? { ...prev, status: "received" } : prev));
  };

  const handleComplete = async () => {
    if (!canFinalizeOrder) return;
    await setOrderStatus(hotelUid, order.id, "completed");
    navigate("/orders");
  };

  function handleLogout() {
    logout().then(() => navigate("/login"));
  }

  const handleEditPrice = (idx, type = "price") => {
    setEditIndex(idx);
    setEditType(type);
  };

  const handleSavePrice = async newPrice => {
    if (editIndex === null || !order) return;
    const products = [...(order.articles || [])];
    const prod = { ...products[editIndex] };
    const price = Number(newPrice) || 0;

    if (editType === "invoiced") {
      prod.invoicedPricePerPurchaseUnit = price;
      products[editIndex] = prod;
      setOrder({ ...order, articles: products });
      setEditIndex(null);
      setEditType("price");
      await updateOrder(hotelUid, order.id, { articles: products });
      return;
    }

    prod.price = price;
    const units = Number(prod.unitsPerPurchaseUnit) || 0;
    let newPricePerStock = prod.pricePerStockUnit;
    if (units > 0) {
      newPricePerStock = price / units;
    }
    prod.pricePerStockUnit = newPricePerStock;
    products[editIndex] = prod;
    setOrder({ ...order, articles: products });
    setEditIndex(null);
    setEditType("price");
    await updateOrder(hotelUid, order.id, { articles: products });
    if (prod.id) {
      await updateArticle(hotelUid, prod.id, {
        pricePerPurchaseUnit: price,
        pricePerStockUnit: newPricePerStock,
      });
    }
  };

  const handleCreatePdf = async () => {
    if (!order) return;
    try {
      setIsGeneratingPdf(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 14;
      let cursorY = 20;

      const addLine = (text, options = {}) => {
        const { fontSize = 11, gap = 6, bold = false } = options;
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(fontSize);
        const lines = Array.isArray(text)
          ? text
          : doc.splitTextToSize(text, pageWidth - marginX * 2);
        lines.forEach(line => {
          doc.text(line, marginX, cursorY);
          cursorY += gap;
        });
      };

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(t("details.pdf.documentTitle", { id: order.id }), marginX, cursorY);
      cursorY += 10;

      addLine(`${t("details.pdf.hotel")}: ${hotelName || "-"}`, { fontSize: 12, gap: 6 });
      addLine(`${t("details.pdf.supplier")}: ${order.supplier || "-"}`, { fontSize: 12, gap: 6 });
      addLine(`${t("details.pdf.orderedOn")}: ${order.orderDate || "-"}`, { fontSize: 11, gap: 5 });
      addLine(`${t("details.pdf.delivery")}: ${order.deliveryDate || "-"}`, { fontSize: 11, gap: 8 });

      if (order.note) {
        addLine(`${t("details.pdf.notes")}:`, { fontSize: 11, gap: 6, bold: true });
        addLine(order.note, { fontSize: 11, gap: 6 });
        cursorY += 4;
      }

      const tableBody = order.articles.map((prod, index) => {
        const orderedQty = [
          prod.quantity != null ? `${Number(prod.quantity)}${prod.purchaseUnit ? ` ${prod.purchaseUnit}` : ""}` : "-",
        ];

        if (prod.unitsPerPurchaseUnit && prod.stockUnit) {
          const unitsText = prod.purchaseUnit
            ? t("details.pdf.unitsPer", {
                count: prod.unitsPerPurchaseUnit,
                stockUnit: prod.stockUnit,
                purchaseUnit: prod.purchaseUnit,
              })
            : t("details.pdf.unitsPerNoPurchase", {
                count: prod.unitsPerPurchaseUnit,
                stockUnit: prod.stockUnit,
              });
          orderedQty.push(`(${unitsText})`);
        }

        const articleDetails = [prod.name || "-"];
        if (prod.brand) {
          articleDetails.push(t("details.pdf.brand", { brand: prod.brand }));
        }
        if (prod.articleNumber) {
          articleDetails.push(t("details.pdf.articleNumber", { number: prod.articleNumber }));
        }
        if (prod.outlet) {
          articleDetails.push(t("details.pdf.outlet", { outlet: prod.outlet }));
        }

        return [
          `${index + 1}`,
          articleDetails.join("\n"),
          orderedQty.join("\n"),
          "",
        ];
      });

      autoTable(doc, {
        startY: Math.max(cursorY, 40),
        head: [[
          t("details.pdf.table.index"),
          t("details.pdf.table.article"),
          t("details.pdf.table.ordered"),
          t("details.pdf.table.received"),
        ]],
        body: tableBody,
        styles: { fontSize: 10, cellPadding: 3, valign: "top" },
        headStyles: { fillColor: [174, 14, 35], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 90 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 },
        },
        didDrawPage: () => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text(
            t("details.pdf.footer", { date: new Date().toLocaleDateString(locale) }),
            marginX,
            doc.internal.pageSize.getHeight() - 10
          );
          doc.text(
            `${hotelName || ""}`,
            pageWidth - marginX,
            doc.internal.pageSize.getHeight() - 10,
            { align: "right" }
          );
        },
      });

      const afterTableY = doc.lastAutoTable?.finalY || cursorY;
      const summaryY = afterTableY + 12;
      if (summaryY < doc.internal.pageSize.getHeight() - 20) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(t("details.pdf.total", { total: orderTotal.toFixed(2) }), marginX, summaryY);
      } else {
        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(t("details.pdf.total", { total: orderTotal.toFixed(2) }), marginX, 30);
      }

      doc.save(t("details.pdf.fileName", { id: order.id }));
    } catch (error) {
      console.error("Failed to generate PDF", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-8 text-center text-gray-500">
        {t("details.loading")}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-8 text-center text-red-600">
        {t("details.notFound")}
      </div>
    );
  }

  const statusKey = order?.status === "canceled" ? "cancelled" : order?.status;
  const statusLabel = statusKey ? t(`filters.${statusKey}`, statusKey) : "";

  return (
    <>
      <HeaderBar hotelName={hotelName} today={formatToday()} onLogout={handleLogout} />
      <PageContainer className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">{t("details.title")}</h1>
        <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("details.back")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreatePdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-marriott text-white shadow-sm hover:bg-marriott/90 transition text-sm font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <FileDown className="w-4 h-4" />
              {isGeneratingPdf ? t("details.pdf.creating") : t("details.pdf.create")}
            </button>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${statusColors[order.status] || "bg-gray-100 text-gray-600"}`}
              style={{ minWidth: 90, textAlign: "center", letterSpacing: 1 }}
            >
              {statusLabel || order.status}
            </span>
          </div>
        </div>
        <div>
          <div className="mb-4">
            <div className="font-semibold">{order.supplier}</div>
            <div className="text-xs text-gray-500">{t("details.header.orderDate")}: {order.orderDate}</div>
            <div className="text-xs text-gray-500">{t("details.header.deliveryDate")}: {order.deliveryDate}</div>
            {order.note && <div className="text-xs mt-1 text-gray-600">{order.note}</div>}
          </div>

          <div className="hidden sm:block overflow-hidden rounded-xl shadow border border-gray-200 bg-white">
            <div
              className={`grid grid-cols-5 ${showReceived ? "sm:grid-cols-8" : "sm:grid-cols-7"} gap-2 font-semibold text-marriott text-sm bg-gray-50 border-b border-gray-200 px-4 py-2`}
            >
              <div className="sm:col-span-2">{t("details.table.article")}</div>
              <div>{t("details.table.brand")}</div>
              <div>{t("details.table.outlet")}</div>
              <div>{t("details.table.quantity")}</div>
              <div className="hidden sm:block">{t("details.table.price")}</div>
              {showReceived && <div className="hidden sm:block">{t("details.table.received")}</div>}
              <div className="font-semibold">{t("details.table.total")}</div>
            </div>
            <div className="divide-y divide-gray-100">
              {order.articles.map((prod, i) => (
                <ProductLine
                  key={i}
                  prod={prod}
                  imageUrl={ingredients[prod.ingredientId]?.imageUrl}
                  showReceived={showReceived}
                  canEditPrice={order.status === "ordered" || order.status === "checked"}
                  onEditPrice={handleEditPrice}
                  canEditInvoicedPrice={order.status === "checked"}
                  onEditInvoicedPrice={() => handleEditPrice(i, "invoiced")}
                  index={i}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:hidden mt-2">
            {order.articles.map((prod, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1 relative">
                {(order.status === "ordered" || order.status === "checked") && (
                  <div className="absolute right-2 top-2 flex flex-col gap-2 items-end">
                    <button
                      type="button"
                      onClick={() => handleEditPrice(i)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    {order.status === "checked" && (
                      <button
                        type="button"
                        onClick={() => handleEditPrice(i, "invoiced")}
                        className="text-red-600 hover:text-red-700"
                        title={t("details.priceEdit.invoicedTitle")}
                      >
                        <AlertCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
                {ingredients[prod.ingredientId]?.imageUrl && (
                  <img
                    src={ingredients[prod.ingredientId].imageUrl}
                    alt={prod.name}
                    className="w-16 h-16 object-contain mb-1"
                  />
                )}
                <div className="font-bold text-base text-gray-900 flex flex-wrap items-center gap-2">
                  <span>{prod.name}</span>
                  {prod.custom && <span className="badge-new">{t("labels.newBadge")}</span>}
                </div>
                <div className="text-xs text-gray-600">{prod.brand}</div>
                {prod.articleNumber && (
                  <div className="text-xs text-gray-600">{t("labels.articleNumber")} {prod.articleNumber}</div>
                )}
                {prod.outlet && <div className="text-xs text-gray-600">{prod.outlet}</div>}
                <div className="flex flex-wrap gap-2 text-sm mt-1">
                  <span className="text-gray-500">{t("details.mobile.quantity")}</span>
                  <span className="font-semibold">{prod.quantity}</span>
                  {prod.unitsPerPurchaseUnit && prod.stockUnit && (
                    <span className="ml-2 text-xs text-gray-500">
                      / {prod.unitsPerPurchaseUnit} {prod.stockUnit}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-gray-500">{t("details.mobile.price")}</span>
                  <span>€{getUnitPrice(prod).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-gray-500">{t("details.mobile.total")}</span>
                  <span className="font-semibold text-marriott">
                    €
                    {(
                      (showReceived
                        ? Number(prod.received) || 0
                        : Number(prod.quantity) || 0) * getUnitPrice(prod)
                    ).toFixed(2)}
                  </span>
                </div>
                {showReceived && prod.received !== undefined && (
                  <div className="text-xs text-emerald-600">
                    {t("details.mobile.received")} {Number(prod.received).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 text-right font-bold text-lg text-marriott border-t pt-3">
            {t("details.totals.order", { total: orderTotal.toFixed(2) })}
          </div>

          {(order.status === "created" || order.status === "ordered") && (
            <div className="flex flex-col items-center gap-2 my-4">
              <div className="flex gap-2">
                {order.status === "created" && (
                  <>
                    <button
                      onClick={() => navigate(`/orders/${order.id}/edit`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-marriott border border-marriott/40 shadow-sm hover:bg-marriott hover:text-white transition font-semibold"
                    >
                      {t("details.actions.edit")}
                    </button>
                    {canApproveOrder && (
                      <button
                        onClick={() => setShowConfirmOrder(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white shadow-sm hover:bg-green-700 transition font-semibold"
                      >
                        {t("details.actions.confirm")}
                      </button>
                    )}
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white shadow-sm hover:bg-red-700 transition font-semibold"
                    >
                      {t("details.actions.cancel")}
                    </button>
                  </>
                )}
                {order.status === "ordered" && (
                  <>
                    {canReceiveOrder && (
                      <button
                        onClick={() => navigate(`/orders/${order.id}/receive`)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white shadow-sm hover:bg-green-700 transition font-semibold"
                      >
                        {t("details.actions.receive")}
                      </button>
                    )}
                    {canApproveOrder && (
                      <button
                        onClick={() => setShowBackToCreatedConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white shadow-sm hover:bg-amber-700 transition font-semibold"
                      >
                        {t("details.actions.backToCreated")}
                      </button>
                    )}
                  </>
                )}
              </div>
              <span className="text-xs text-gray-400 mt-1">
                {order.status === "created" &&
                  t("details.hints.created")}
                {order.status === "ordered" &&
                  t("details.hints.ordered")}
              </span>
            </div>
          )}
          {order.status === "received" && canFinalizeOrder && (
            <div className="flex flex-col items-center gap-2 my-4">
              <div className="flex gap-2">
                <button
                  onClick={handleFinalCheck}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white shadow-sm hover:bg-sky-700 transition font-semibold"
                >
                  {t("details.actions.finalCheck")}
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white shadow-sm hover:bg-amber-700 transition font-semibold"
                >
                  {t("details.actions.backToOrdered")}
                </button>
              </div>
              <span className="text-xs text-gray-400 mt-1">
                {t("details.hints.received")}
              </span>
            </div>
          )}
          {order.status === "checked" && canFinalizeOrder && (
            <div className="flex flex-col items-center gap-2 my-4">
              <div className="flex gap-2">
                <button
                  onClick={handleBackToReceived}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white shadow-sm hover:bg-amber-700 transition font-semibold"
                >
                  {t("details.actions.backToReceived")}
                </button>
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition font-semibold"
                >
                  {t("details.actions.markCompleted")}
                </button>
              </div>
              <span className="text-xs text-gray-400 mt-1 text-center">
                {t("details.hints.checked")}
              </span>
            </div>
          )}
          {isCompleted && (
            <div className="flex flex-col items-center gap-2 my-4 text-sm text-emerald-700">
              {t("details.completedMessage")}
            </div>
          )}
        </div>

        </PageContainer>
        <PriceEditModal
          open={editIndex !== null}
          currentPrice={
            editIndex !== null
              ? (
                  editType === "invoiced"
                    ? Number(
                        order.articles[editIndex]?.invoicedPricePerPurchaseUnit
                        ?? order.articles[editIndex]?.price
                        ?? 0
                      )
                    : Number(order.articles[editIndex]?.price ?? 0)
                )
              : 0
          }
          title={
            editType === "invoiced"
              ? t("details.priceEdit.invoicedTitle")
              : t("details.priceEdit.title")
          }
          onConfirm={handleSavePrice}
          onCancel={() => { setEditIndex(null); setEditType("price"); }}
        />
        <ConfirmModal
          open={showCancelConfirm}
          title={t("details.confirmCancel.title")}
          message={t("details.confirmCancel.message")}
          onConfirm={handleCancel}
          onCancel={() => setShowCancelConfirm(false)}
        />
        <ConfirmModal
          open={showConfirmOrder}
          title={t("details.confirmOrder.title")}
          message={t("details.confirmOrder.message")}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirmOrder(false)}
        />
        <ConfirmModal
          open={showBackToCreatedConfirm}
          title={t("details.confirmBackToCreated.title")}
          message={t("details.confirmBackToCreated.message")}
          onConfirm={handleBackToCreated}
          onCancel={() => setShowBackToCreatedConfirm(false)}
        />
    </>
  );
}
