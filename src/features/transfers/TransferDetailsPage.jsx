import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useHotelContext } from "contexts/HotelContext";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { getTransfer, setTransferStatus, deleteTransfer } from "./transferService";
import { usePermission } from "../../hooks/usePermission";
import { useTranslation } from "react-i18next";
import ConfirmModal from "components/layout/ConfirmModal";

export default function TransferDetailsPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const { transferId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("transfers");
  const canEdit = usePermission("transfers", "edit");
  const canDelete = usePermission("transfers", "delete");

  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const tr = await getTransfer(hotelUid, transferId);
      setTransfer(tr);
      setLoading(false);
    }
    fetchData();
  }, [hotelUid, transferId]);

  const statusColors = {
    created: "bg-blue-50 text-blue-600 border border-blue-200",
    confirmed: "bg-amber-50 text-amber-700 border border-amber-200",
    received: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };

  const handleNextStatus = async () => {
    if (!transfer || !canEdit) return;
    if (transfer.status === "created") {
      await setTransferStatus(hotelUid, transfer.id, "confirmed");
      setTransfer(tr => ({ ...tr, status: "confirmed" }));
    } else if (transfer.status === "confirmed") {
      navigate(`/transfers/${transfer.id}/receive`);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      alert(t("noDeletePermission"));
      return;
    }
    await deleteTransfer(hotelUid, transfer.id);
    navigate("/transfers");
  };

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

  return (
    <>
      <HeaderBar hotelName={hotelName} />
      <PageContainer className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">{t("detailsTitle")}</h1>
        <div className="mb-4 flex items-center gap-4 flex-wrap">
          <div className="flex-1">
            <div className="font-semibold">{transfer.requester}</div>
            <div className="text-xs text-gray-500">
              {t("date")}: {transfer.date}
            </div>
            {transfer.reason && (
              <div className="text-xs mt-1 text-gray-600">{transfer.reason}</div>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${statusColors[transfer.status] || "bg-gray-100 text-gray-600"}`}
            style={{ minWidth: 90, textAlign: "center" }}
          >
            {transfer.status}
          </span>
        </div>
        <div className="flex gap-4 text-sm mb-4">
          {transfer.fromOutlet && (
            <div>
              <span className="font-semibold mr-1">{t("from")}:</span>
              {transfer.fromOutlet}
            </div>
          )}
          {transfer.toOutlet && (
            <div>
              <span className="font-semibold mr-1">{t("to")}:</span>
              {transfer.toOutlet}
            </div>
          )}
        </div>
        <div className="hidden sm:block">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 font-semibold text-marriott text-sm mb-1 border-b border-gray-200 pb-1">
            <div>{t("name")}</div>
            <div>{t("brand")}</div>
            <div>{t("quantity")}</div>
            <div>{t("from")}</div>
            <div>{t("to")}</div>
          </div>
          <div className="divide-y divide-gray-100">
            {transfer.products.map((prod, idx) => (
              <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 items-center text-sm py-2">
                <div className="break-words">{prod.name}</div>
                <div>{prod.brand}</div>
                <div>{prod.quantity}</div>
                <div>{prod.fromOutlet || transfer.fromOutlet}</div>
                <div>{prod.toOutlet || transfer.toOutlet}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:hidden mt-2">
          {transfer.products.map((prod, idx) => (
            <div key={idx} className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1 text-sm">
              <div className="font-bold text-base text-gray-900">{prod.name}</div>
              {prod.brand && <div className="text-xs text-gray-600">{prod.brand}</div>}
              <div>
                <span className="text-gray-500 mr-1">{t("quantity")}:</span>
                {prod.quantity}
              </div>
              <div>
                <span className="text-gray-500 mr-1">{t("from")}:</span>
                {prod.fromOutlet || transfer.fromOutlet}
              </div>
              <div>
                <span className="text-gray-500 mr-1">{t("to")}:</span>
                {prod.toOutlet || transfer.toOutlet}
              </div>
            </div>
          ))}
        </div>
        {(canDelete || (canEdit && (transfer.status === "created" || transfer.status === "confirmed"))) && (
          <div className="flex gap-2 justify-end mt-4">
            {canDelete && (
              <button
                type="button"
                className="bg-red-600 text-white px-6 py-2 rounded-2xl font-semibold hover:bg-red-700"
                onClick={() => setConfirmDelete(true)}
              >
                {t("delete")}
              </button>
            )}
            {canEdit && (transfer.status === "created" || transfer.status === "confirmed") && (
              <button
                type="button"
                className="bg-marriott text-white px-6 py-2 rounded-2xl font-semibold hover:bg-marriott-dark"
                onClick={handleNextStatus}
              >
                {transfer.status === "created" ? t("confirm") : t("markReceived")}
              </button>
            )}
          </div>
        )}
      </PageContainer>
      <ConfirmModal
        open={confirmDelete}
        title={t("deleteConfirmationTitle")}
        message={t("deleteConfirmationMessage")}
        onConfirm={() => {
          setConfirmDelete(false);
          handleDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
