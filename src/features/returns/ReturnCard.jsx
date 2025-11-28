import React, { useState } from "react";

const statusColors = {
  created: "bg-blue-50 text-blue-600 border border-blue-200",
  pickedup: "bg-amber-50 text-amber-700 border border-amber-200",
  creditnota: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

function formatStatus(status) {
  if (status === "creditnota") return "Creditnota ontvangen";
  if (status === "pickedup") return "Opgehaald";
  if (status === "created") return "Aangemaakt";
  return status;
}

export default function ReturnCard({ retour, onStatusUpdate }) {
  const [open, setOpen] = useState(false);

  // Zorg dat prijs en totaal altijd als number geïnterpreteerd worden
  const pricePerUnit = Number(retour.pricePerPurchaseUnit) || 0;
  const quantity = Number(retour.quantity) || 0;
  const total = pricePerUnit * quantity;

  return (
    <div className="rounded-2xl shadow p-4 bg-white border flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{retour.supplier}</div>
          <div className="text-xs text-gray-500">
            Retour: <b>{retour.quantity} x {retour.productLabel}</b>
          </div>
          <div className="text-xs text-gray-500">Aangemaakt op: {retour.dateCreated ? new Date(retour.dateCreated).toLocaleDateString() : "-"}</div>
          {retour.note && (
            <div className="text-xs mt-1 text-gray-600">{retour.note}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${statusColors[retour.status] || "bg-gray-100 text-gray-600"}`} style={{ minWidth: 120, textAlign: "center" }}>
            {formatStatus(retour.status)}
          </span>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-marriott underline text-sm hover:text-marriott-dark"
          >
            {open ? "Verberg" : "Details"}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-2 text-sm">
          <div><b>Product:</b> {retour.productLabel}</div>
          <div><b>Merk:</b> {retour.brand}</div>
          <div><b>Aantal:</b> {retour.quantity} {retour.unit}</div>
          <div>
            <b>Prijs per aankoopverpakking:</b>{" "}
            {pricePerUnit > 0 ? `€${pricePerUnit.toFixed(2)}` : "-"}
          </div>
          <div>
            <b>Totaalprijs:</b>{" "}
            {total > 0 ? `€${total.toFixed(2)}` : "-"}
          </div>
          <div><b>Status:</b> {formatStatus(retour.status)}</div>
          {retour.datePickedUp && <div><b>Opgehaald:</b> {new Date(retour.datePickedUp).toLocaleDateString()}</div>}
          {retour.dateCreditnotaReceived && <div><b>Creditnota ontvangen:</b> {new Date(retour.dateCreditnotaReceived).toLocaleDateString()}</div>}
          {retour.note && <div><b>Reden:</b> {retour.note}</div>}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        {retour.status === "created" && (
          <button className="bg-blue-600 text-white px-3 py-1 rounded"
            onClick={() => onStatusUpdate(retour.id, retour.status)}>
            Markeer als opgehaald
          </button>
        )}
        {retour.status === "pickedup" && (
          <button className="bg-green-600 text-white px-3 py-1 rounded"
            onClick={() => onStatusUpdate(retour.id, retour.status)}>
            Markeer als creditnota ontvangen
          </button>
        )}
      </div>
    </div>
  );
}
