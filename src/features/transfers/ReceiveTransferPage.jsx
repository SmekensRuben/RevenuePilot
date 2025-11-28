import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useHotelContext } from "contexts/HotelContext";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { getTransfer, updateTransfer } from "./transferService";
import ReceiveTransferProductCard from "./ReceiveTransferProductCard";
import { getIngredientsIndexed } from "../../services/firebaseIngredients";
import { getArticlesIndexed } from "../../services/firebaseArticles";
import { usePermission } from "../../hooks/usePermission";
import { useTranslation } from "react-i18next";

export default function ReceiveTransferPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { transferId } = useParams();
  const navigate = useNavigate();
  const canEdit = usePermission("transfers", "edit");
  const { t } = useTranslation("transfers");

  const [transfer, setTransfer] = useState(null);
  const [lines, setLines] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return (
      <PageContainer>
        <div className="max-w-xl mx-auto py-8 text-center text-gray-600">
          {t("noAccessEdit")}
        </div>
      </PageContainer>
    );
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [tr, ings, arts] = await Promise.all([
        getTransfer(hotelUid, transferId),
        getIngredientsIndexed(hotelUid),
        getArticlesIndexed(hotelUid),
      ]);
      setTransfer(tr);
      setIngredients(ings);
      setArticles(arts);
      setLines((tr?.products || []).map(p => ({ ...p, received: p.quantity })));
      setLoading(false);
    }
    fetchData();
  }, [hotelUid, transferId]);

  const handleChange = (idx, value) => {
    setLines(lines =>
      lines.map((line, i) =>
        i === idx ? { ...line, received: Number(value) } : line
      )
    );
  };

  const handleArticleChange = (idx, article) => {
    setLines(lines =>
      lines.map((line, i) =>
        i === idx
          ? {
              ...line,
              ...article,
              id: article.id,
              name: article.name || line.name,
              brand: article.brand || line.brand,
              supplier: article.supplier || line.supplier,
              purchaseUnit: article.purchaseUnit || line.purchaseUnit,
              unitsPerPurchaseUnit:
                article.unitsPerPurchaseUnit || line.unitsPerPurchaseUnit,
              stockUnit: article.stockUnit || line.stockUnit,
              contentPerStockUnit:
                article.contentPerStockUnit || line.contentPerStockUnit,
              recipeUnit: article.recipeUnit || line.recipeUnit,
              imageUrl: article.imageUrl || line.imageUrl,
            }
          : line
      )
    );
  };

  async function handleConfirm() {
    setSaving(true);
    await updateTransfer(hotelUid, transferId, {
      status: "received",
      products: lines,
    });
    setSaving(false);
    navigate("/transfers");
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-8 text-center text-gray-500">
        {t("loading")}
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="max-w-xl mx-auto py-8 text-center text-red-600">
        {t("notFound")}
      </div>
    );
  }

  if (transfer.status !== "confirmed") {
    return (
      <div className="max-w-xl mx-auto py-8 text-center text-gray-600">
        {t("alreadyHandled")}
      </div>
    );
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} />
      <PageContainer className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-3">{t("receiveTitle")}</h1>
        <div className="flex flex-col gap-3 mt-2">
          {lines.map((line, idx) => {
            const ing = ingredients.find(i => i.id === line.ingredientId);
            return (
              <ReceiveTransferProductCard
                key={idx}
                prod={line}
                ingredient={ing}
                articles={articles}
                idx={idx}
                onChange={handleChange}
                onArticleChange={handleArticleChange}
              />
            );
          })}
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button
            type="button"
            onClick={() => navigate("/transfers")}
            className="bg-gray-200 px-4 py-2 rounded-2xl"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="bg-marriott text-white px-6 py-2 rounded-2xl font-semibold hover:bg-marriott-dark"
            disabled={saving}
          >
            {saving ? t("saving") : t("confirm")}
          </button>
        </div>
      </PageContainer>
    </>
  );
}
