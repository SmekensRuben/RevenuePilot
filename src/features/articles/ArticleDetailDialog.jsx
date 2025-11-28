import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { usePermission } from "../../hooks/usePermission";
import { useTranslation } from "react-i18next";
import ConfirmModal from "components/layout/ConfirmModal";
import { useHotelContext } from "../../contexts/HotelContext";
import { getArticlePriceHistory } from "../../services/firebaseArticles";
import PriceHistoryChart from "./PriceHistoryChart";
import { useMemo } from "react";

export default function ArticleDetailDialog({
  open,
  onClose,
  article,
  categories,
  editMode,
  setEditMode,
  editForm,
  setEditForm,
  onEditSubmit,
  onDelete,
  suppliers
}) {
  // Helper voor change
  const handleEditChange = (field, value) => {
    setEditForm(prev => {
      const updated = { ...prev, [field]: value };
      if (updated.isWeighed && (field === "pricePerKg" || field === "unitsPerPurchaseUnit")) {
        const price = parseFloat(updated.pricePerKg || 0);
        const units = parseFloat(updated.unitsPerPurchaseUnit || 0);
        updated.pricePerPurchaseUnit = price && units ? (price * units).toFixed(4) : "";
      }
      return updated;
    });
  };

  const { t } = useTranslation("articles");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { hotelUid } = useHotelContext();
  const [priceHistory, setPriceHistory] = useState([]);

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
      .filter(([key, val]) => val.parentId === editForm.parentCategory)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories, editForm.parentCategory]);

  useEffect(() => {
    if (open && article?.id) {
      getArticlePriceHistory(hotelUid, article.id).then(setPriceHistory);
    } else {
      setPriceHistory([]);
    }
  }, [open, article, hotelUid]);

  const canEdit = usePermission("articles", "edit");
  const canDelete = usePermission("articles", "delete");

  if (!article) return null;

  return (
    <>
    <Dialog open={open} onClose={() => { onClose(); setEditMode(false); }} className="fixed inset-0 z-50 overflow-hidden">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:max-w-sm w-full bg-white shadow-xl p-6 overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
          {article.name}
        </h2>
        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt={article.name}
            className="mb-4 w-40 h-40 object-contain mx-auto"
          />
        )}
        {editMode ? (
          <form
            onSubmit={e => { e.preventDefault(); onEditSubmit(); }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">{t("name")}</label>
              <input
                type="text"
                value={editForm.name}
                onChange={e => handleEditChange("name", e.target.value)}
                className="border px-3 py-2 w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("brand")}</label>
              <input
                type="text"
                value={editForm.brand}
                onChange={e => handleEditChange("brand", e.target.value)}
                className="border px-3 py-2 w-full"
              />
            </div>
            {editForm.isWeighed ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("pricePerKg")}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.pricePerKg || ""}
                    onChange={e => handleEditChange("pricePerKg", e.target.value)}
                    className="border px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("pricePerPurchaseUnit")}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.pricePerPurchaseUnit || ""}
                    readOnly
                    className="border px-3 py-2 w-full bg-gray-100"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1">{t("pricePerPurchaseUnit")}</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.pricePerPurchaseUnit}
                  onChange={e => handleEditChange("pricePerPurchaseUnit", e.target.value)}
                  className="border px-3 py-2 w-full"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">{t("category")}</label>
              <select
                value={editForm.parentCategory}
                onChange={e => {
                  handleEditChange("parentCategory", e.target.value);
                  handleEditChange("category", "");
                }}
                className="border px-3 py-2 w-full"
              >
                <option value="">{t("selectParentCategory")}</option>
                {parentCategoryOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <select
                value={editForm.category}
                onChange={e => handleEditChange("category", e.target.value)}
                className="border px-3 py-2 w-full mt-2"
                required
                disabled={!editForm.parentCategory}
              >
                <option value="">{t("selectSubcategory")}</option>
                {childCategoryOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("supplier")}</label>
              <select
                value={editForm.supplier}
                onChange={e => handleEditChange("supplier", e.target.value)}
                className="border px-3 py-2 w-full"
                required
              >
                <option value="">{t("selectSupplier")}</option>
                {suppliers.map((s, idx) => (
                  <option key={s.key || idx} value={s.name}>
                    {s.name}{s.customerNr ? ` (${s.customerNr})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("articleNumber")}</label>
              <input
                type="text"
                value={editForm.articleNumber}
                onChange={e => handleEditChange("articleNumber", e.target.value)}
                className="border px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("ean")}</label>
              <input
                type="text"
                value={editForm.ean || ""}
                onChange={e => handleEditChange("ean", e.target.value)}
                className="border px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("purchaseUnit")}</label>
              <input
                type="text"
                value={editForm.purchaseUnit}
                onChange={e => handleEditChange("purchaseUnit", e.target.value)}
                className="border px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("stockUnit")}</label>
              <input
                type="text"
                value={editForm.stockUnit}
                onChange={e => handleEditChange("stockUnit", e.target.value)}
                className="border px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{editForm.isWeighed ? t("kgPerPurchaseUnit") : t("unitsPerPurchaseUnit")}</label>
              <input
                type="number"
                step="0.0001"
                value={editForm.unitsPerPurchaseUnit}
                onChange={e => handleEditChange("unitsPerPurchaseUnit", e.target.value)}
                className="border px-3 py-2 w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("recipeUnit")}</label>
              <input
                type="text"
                value={editForm.recipeUnit || ""}
                onChange={e => handleEditChange("recipeUnit", e.target.value)}
                className="border px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("contentPerStockUnit")}</label>
              <input
                type="number"
                value={editForm.contentPerStockUnit || ""}
                onChange={e => handleEditChange("contentPerStockUnit", e.target.value)}
                className="border px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("vat")} (%)</label>
              <input
                type="number"
                value={editForm.vat}
                onChange={e => handleEditChange("vat", e.target.value)}
                className="border px-3 py-2 w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("imageUrl")}</label>
              <input
                type="text"
                value={editForm.imageUrl || ""}
                onChange={e => handleEditChange("imageUrl", e.target.value)}
                className="border px-3 py-2 w-full"
              />
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={!!editForm.frozen}
                onChange={e => handleEditChange("frozen", e.target.checked)}
                className="h-4 w-4"
              />
              <span>{t("frozen")}</span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={!!editForm.isWeighed}
                onChange={e => handleEditChange("isWeighed", e.target.checked)}
                className="h-4 w-4"
              />
              <span>{t("isWeighed")}</span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={e => handleEditChange("active", e.target.checked)}
                className="h-4 w-4"
              />
              <span>{t("active")}</span>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-black text-white px-4 py-2">{t("save")}</button>
              <button type="button" onClick={() => setEditMode(false)} className="bg-gray-200 text-gray-800 px-4 py-2">{t("cancel")}</button>
            </div>
          </form>
        ) : (
          <>
          <ul className="text-sm text-gray-800 space-y-2">
            <li><strong>{t("brand")}:</strong> {article.brand}</li>
            <li><strong>{t("pricePerPurchaseUnit")}:</strong> €{(article.pricePerPurchaseUnit ?? 0).toFixed(2)}</li>
            <li><strong>{t("category")}:</strong> {categories[article.category]?.label || article.category}</li>
            <li><strong>{t("supplier")}:</strong> {article.supplier}</li>
            <li><strong>{t("articleNumber")}:</strong> {article.articleNumber}</li>
            <li><strong>{t("ean")}:</strong> {article.ean}</li>
            <li><strong>{t("packageSize")}:</strong> 1 {article.purchaseUnit} = {article.unitsPerPurchaseUnit} {article.stockUnit}</li>
            <li><strong>{t("recipeUnit")}:</strong> {article.recipeUnit}</li>
            <li><strong>{t("contentPerStockUnit")}:</strong> {article.contentPerStockUnit} {article.recipeUnit}</li>
            <li><strong>{t("vat")}:</strong> {article.vat}%</li>
            <li><strong>{t("frozen")}:</strong> {article.frozen ? "✅" : "❌"}</li>
            <li><strong>{t("isWeighed")}:</strong> {article.isWeighed ? "✅" : "❌"}</li>
            <li><strong>{t("active")}:</strong> {article.active ? "✅" : "❌"}</li>
            <li>
              <strong>{t("lastUpdatedPrice")}:</strong>{" "}
              {article.lastPriceUpdate
                ? new Date(article.lastPriceUpdate).toLocaleDateString("nl-BE")
                : "-"}
              {article.lastPriceUpdate && (
                <span className="ml-2 text-xs text-green-600">●</span>
              )}
            </li>
          </ul>
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">{t("priceHistory")}</h3>
            <PriceHistoryChart history={priceHistory} />
          </div>
          </>
        )}
        {!editMode && (
          <div className="mt-6 flex flex-wrap gap-2">
            {canEdit && <button onClick={() => setEditMode(true)} className="bg-black text-white px-4 py-2">{t("edit")}</button>}
            <button onClick={() => onClose()} className="bg-gray-200 text-gray-800 px-4 py-2">{t("close")}</button>
            {canDelete && <button onClick={() => setConfirmDelete(true)} className="bg-red-600 text-white px-4 py-2">{t("delete")}</button>}
          </div>
        )}
      </div>
    </Dialog>
    <ConfirmModal
      open={confirmDelete}
      title={t("deleteConfirmationTitle")}
      message={t("deleteConfirmationMessage")}
      onConfirm={() => { setConfirmDelete(false); onDelete(); }}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  );
}
