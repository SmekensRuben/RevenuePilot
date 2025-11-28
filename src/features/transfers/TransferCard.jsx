import React, { useState } from "react";
import { setTransferStatus } from "./transferService";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../hooks/usePermission";
import { useTranslation } from "react-i18next";

const statusColors = {
  created: "bg-blue-50 text-blue-600 border border-blue-200",
  confirmed: "bg-amber-50 text-amber-700 border border-amber-200",
  received: "bg-emerald-50 text-emerald-700 border border-emerald-200"
};

export default function TransferCard({ transfer, onStatusUpdate }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const canEdit = usePermission("transfers", "edit");
  const { t } = useTranslation("transfers");
  const firstProd = transfer.products?.[0] || {};
  const from = transfer.fromOutlet || firstProd.fromOutlet;
  const to = transfer.toOutlet || firstProd.toOutlet;
  const title = from && to ? `${from} => ${to}` : transfer.requester;

  const handleNextStatus = async () => {
    if (!canEdit) return;
    if (transfer.status === "created") {
      const next = "confirmed";
      await setTransferStatus(
        transfer.hotelUid || "hotel_001",
        transfer.id,
        next
      );
      if (onStatusUpdate) onStatusUpdate(transfer.id, next);
    } else if (transfer.status === "confirmed") {
      navigate(`/transfers/${transfer.id}/receive`);
    }
  };

  return (
    <div className="rounded-2xl shadow p-4 bg-white border flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-gray-500">{transfer.requester}</div>
          <div className="text-xs text-gray-500">{t("date")}: {transfer.date}</div>
          {transfer.reason && (
            <div className="text-xs mt-1 text-gray-600">{transfer.reason}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${statusColors[transfer.status] || "bg-gray-100 text-gray-600"}`}
            style={{ minWidth: 90, textAlign: "center" }}
          >
            {transfer.status}
          </span>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-marriott underline text-sm hover:text-marriott-dark"
          >
            {open ? t("hide") : t("details")}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-2">
          <div className="hidden sm:block">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 font-semibold text-marriott text-sm mb-1">
              <div>{t("name")}</div>
              <div>{t("brand")}</div>
              <div>{t("quantity")}</div>
              <div>{t("from")}</div>
              <div>{t("to")}</div>
              <div className="font-semibold"> </div>
            </div>
            {transfer.products.map((prod, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center text-sm">
  <div className="break-words">{prod.name}</div>
                <div>{prod.brand}</div>
                <div>{prod.quantity}</div>
                <div>{prod.fromOutlet || transfer.fromOutlet}</div>
                <div>{prod.toOutlet || transfer.toOutlet}</div>
                <div></div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:hidden mt-2">
            {transfer.products.map((prod, idx) => (
              <div key={idx} className="bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-1 text-sm">
                <div className="font-bold text-base text-gray-900">{prod.name}</div>
                <div className="text-xs text-gray-600">{prod.brand}</div>
                <div>
                  <span className="text-gray-500 mr-1">{t("quantity")}: </span>{prod.quantity}
                </div>
                <div><span className="text-gray-500 mr-1">{t("from")}: </span>{prod.fromOutlet || transfer.fromOutlet}</div>
                <div><span className="text-gray-500 mr-1">{t("to")}: </span>{prod.toOutlet || transfer.toOutlet}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 mt-2">
        {canEdit &&
          (transfer.status === "created" || transfer.status === "confirmed") && (
            <button
              className="bg-marriott text-white px-3 py-1 rounded"
              onClick={handleNextStatus}
            >
              {transfer.status === "created" ? t("confirm") : t("markReceived")}
            </button>
          )}
      </div>
    </div>
  );
}
