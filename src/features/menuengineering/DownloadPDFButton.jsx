import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function DownloadPDFButton({ results, hotelName, dateFrom, dateTo }) {
  if (!results || results.length === 0) return null;

  const handleDownload = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Titel en subtitel
    doc.setFontSize(16);
    doc.text(hotelName || "Menu Engineering", pageWidth / 2, 14, { align: "center" });

    let dateStr = "";
    if (dateFrom || dateTo) {
      dateStr = `Periode: ${dateFrom || "?"} t/m ${dateTo || "?"}`;
      doc.setFontSize(11);
      doc.text(dateStr, pageWidth / 2, 21, { align: "center" });
    }

    // Kolommen/tabel
    const head = [
  [
    "Product",
    "Aantal verkocht",
    "Verkoopprijs",
    "Kostprijs",
    "Marge per stuk",
    "Foodcost %",
    "Totale marge",
    "Type"
  ]
];
const body = results.map(r => [
  r.product,
  r.sold,
  "€" + r.verkoopprijsExclBtw.toFixed(2),
  "€" + r.kostprijs.toFixed(2),
  "€" + r.marge.toFixed(2),
  r.foodcostPct.toFixed(1) + "%",
  "€" + r.totalMargin.toFixed(2),
  r.classification
]);

    autoTable(doc, {
      startY: dateStr ? 27 : 20,
      head,
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [53, 52, 53], textColor: 255 },
      theme: "grid"
    });

    const explanations = [
  ["Star", "Veel verkocht én hoge marge. Dit zijn je paradepaardjes. Koesteren!"],
  ["Plowhorse", "Veel verkocht, maar lage marge. Mogelijk prijshervorming of recept optimaliseren."],
  ["Puzzle", "Weinig verkocht, hoge marge. Meer promoten of op betere plek op de kaart zetten."],
  ["Dog", "Weinig verkocht én lage marge. Kandidaten om te schrappen of radicaal te verbeteren."]
];

autoTable(doc, {
  startY: doc.lastAutoTable.finalY + 10,
  head: [["Type", "Beschrijving"]],
  body: explanations,
  styles: { fontSize: 10 },
  headStyles: { fillColor: [245, 245, 245], textColor: 30 },
  theme: "grid",
  columnStyles: {
    0: { fontStyle: 'bold', textColor: [0,0,0] }
  }
});

    doc.save(
      `MenuEngineering_${hotelName ? hotelName.replace(/\s+/g, "_") + "_" : ""}${new Date().toISOString().slice(0,10)}.pdf`
    );
  };

  return (
    <button
      className="ml-auto mb-2 bg-marriott text-white font-semibold px-4 py-2 rounded hover:bg-marriott-dark transition shadow"
      onClick={handleDownload}
      title="Download resultaten als PDF"
    >
      Download PDF
    </button>
  );
}
