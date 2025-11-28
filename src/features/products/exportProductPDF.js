// exportProductPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ALLERGENS } from "../../constants/allergens";

/* ===== Spacing & layout constants (makkelijk tunen) ===== */
const SECTION_GAP_AFTER_HEADER = 18;
const STEP_CARD_RADIUS = 6;
const STEP_CARD_PADDING = 12;
const STEP_TITLE_BAR_H = 24;
const STEP_DESC_LINE_H = 12;
const STEP_PHOTO_FRAME_H = 150;
const STEP_PHOTO_GUTTER = 12;
const STEP_CARD_GAP = 16;

/* ---------- helpers ---------- */
function fitRect(srcW, srcH, maxW, maxH) {
  const r = Math.min(maxW / srcW, maxH / srcH);
  return { w: srcW * r, h: srcH * r };
}

async function fetchImageMeta(url) {
  const bust = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  const res = await fetch(bust, { cache: "no-store" });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();

  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      const canvas = document.createElement("canvas");
      canvas.width = naturalW;
      canvas.height = naturalH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      URL.revokeObjectURL(objUrl);
      resolve({ dataUrl, width: naturalW, height: naturalH });
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(objUrl);
      reject(e);
    };
    img.src = objUrl;
  });
}

function drawSectionHeader(doc, text, x, y, w, brand) {
  doc.setFillColor(248);
  doc.rect(x, y - 2, w, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...brand.textDark);
  doc.text(text, x + 8, y + 14);
  return y + 24 + SECTION_GAP_AFTER_HEADER; // extra lucht na titel
}

function addFooters(doc, brandText = "Breakfast Pilot") {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const y = H - 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    const date = new Date().toLocaleString();
    const left = `${brandText} — ${date}`;
    const right = `Pagina ${i} / ${pages}`;
    doc.text(left, 36, y);
    doc.text(right, W - 36 - doc.getTextWidth(right), y);
  }
}

/* ---------- main ---------- */
export async function exportProductPDF({
  product,
  ingredients,
  recipes,
  productCategories,
  tIngredients,
  tProducts,
  branding = {}
}) {
  const tProd = tProducts || ((key, options) => key);
  const brand = {
    title: tProd("pdf.title"),
    primary: [163, 21, 21],
    primaryLight: [245, 236, 236],
    textDark: [30, 33, 37],
    brandText: tProd("pdf.brand"),
    ...branding,
  };
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  let y = M;
  const contentW = W - M * 2;

  /* Header */
  doc.setFillColor(...brand.primary);
  doc.rect(0, 0, W, 64, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255);
  doc.text(brand.title, M, 38);

  const rawName = product.name || tProd("pdf.untitled");
  const name = rawName;
  doc.setFontSize(20);
  doc.text(name, W - M - doc.getTextWidth(name), 38);

  doc.setDrawColor(230);
  doc.line(M, 64, W - M, 64);
  y = 80;

  /* Meta als tabel */
  doc.setTextColor(...brand.textDark);
  const catLabel =
    product.category ? (productCategories[product.category]?.label || product.category) : "-";
  const outlets = product.outlets?.length ? product.outlets.join(", ") : "-";

  const metaRows = [
    [tProd("pdf.category"), catLabel],
    [tProd("pdf.salesUnit"), product.saleUnit || "-"],
    [tProd("pdf.priceInclVat"), product.price != null ? `€${Number(product.price).toFixed(2)}` : "-"],
    [tProd("pdf.vat"), product.vat != null ? `${product.vat}%` : "-"],
    [tProd("pdf.active"), product.active !== false ? tProd("pdf.activeYes") : tProd("pdf.activeNo")],
    [tProd("pdf.outlets"), outlets],
    [tProd("pdf.lightspeedId"), product.lightspeedId || "-"]
  ];

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [[tProd("pdf.property"), tProd("pdf.value")]],
    body: metaRows,
    margin: { left: M, right: M },
    styles: { font: "helvetica", fontSize: 10, cellPadding: 6, lineColor: [230, 230, 230] },
    headStyles: { fillColor: brand.primary, textColor: [255, 255, 255], halign: "left" },
    columnStyles: { 0: { cellWidth: Math.min(180, contentW * 0.33), fontStyle: "bold" } },
    alternateRowStyles: { fillColor: [250, 250, 252] }
  });
  y = doc.lastAutoTable.finalY + 16;

  /* Allergenen */
  const productAllergens = ALLERGENS.filter(a =>
    (product.composition || []).some(row => {
      const ing = ingredients.find(i => i.id === row.ingredientId);
      return ing?.allergens?.[a];
    })
  );
  const allergenNames = productAllergens.map(a => tIngredients(`allergens.${a}`));

  y = drawSectionHeader(doc, tIngredients("allergensLabel"), M, y, contentW, brand);

  if (!allergenNames.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("-", M, y);
    y += 16;
  } else {
    let x = M, lineH = 0;
    const padX = 6, padY = 3, radius = 3;
    doc.setFontSize(10);
    for (const a of allergenNames) {
      const wTxt = doc.getTextWidth(a);
      const chipW = wTxt + padX * 2;
      const chipH = 10 + padY * 2;
      if (x + chipW > W - M) { x = M; y += lineH + 6; lineH = 0; }
      doc.setDrawColor(220, 205, 205);
      doc.setFillColor(...brand.primaryLight);
      doc.roundedRect(x, y, chipW, chipH, 3, 3, "FD");
      doc.setTextColor(...brand.textDark);
      doc.text(a, x + padX, y + chipH - padY - 1);
      x += chipW + 6;
      lineH = Math.max(lineH, chipH);
    }
    y += lineH + 14;
  }

  /* Ingrediënten */
  y = drawSectionHeader(doc, tProd("pdf.ingredients"), M, y, contentW, brand);
  const ingredientRows = (product.composition || []).map(r => {
    const ing = ingredients.find(i => i.id === r.ingredientId);
    const yieldValue =
      r.yield === undefined || r.yield === null || r.yield === ""
        ? 100
        : Number(r.yield);
    const yieldText = Number.isFinite(yieldValue)
      ? `${yieldValue % 1 === 0 ? yieldValue : yieldValue.toFixed(2)}%`
      : "-";
    return [
      ing?.name || r.ingredientId,
      r.quantity ?? "",
      yieldText,
      ing?.unit || "",
    ];
  });
  if (!ingredientRows.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text("-", M, y); y += 16;
  } else {
    autoTable(doc, {
      startY: y,
      head: [[
        tProd("pdf.ingredient"),
        tProd("pdf.quantity"),
        tProd("pdf.yield"),
        tProd("pdf.unit"),
      ]],
      body: ingredientRows,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6, textColor: [40, 44, 52] },
      headStyles: { fillColor: brand.primary, textColor: [255, 255, 255], halign: "left" },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 18;
  }

  /* Recepten */
  y = drawSectionHeader(doc, tProd("pdf.recipes"), M, y, contentW, brand);
  const recipeRows = (product.recipes || []).map(r => {
    const rec = recipes.find(x => x.id === r.recipeId);
    return [rec?.name || r.recipeId, r.quantity ?? "", rec?.contentUnit || ""];
  });
  if (!recipeRows.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text("-", M, y); y += 16;
  } else {
    autoTable(doc, {
      startY: y,
      head: [[tProd("pdf.recipe"), tProd("pdf.quantity"), tProd("pdf.unit")]],
      body: recipeRows,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6, textColor: [40, 44, 52] },
      headStyles: { fillColor: brand.primary, textColor: [255, 255, 255], halign: "left" },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 18;
  }

  /* ===== Bereidingsstappen (cards) ===== */
  y = drawSectionHeader(doc, tProd("pdf.steps"), M, y, contentW, brand);

  const addPageIfNeeded = (needed = 0) => {
    if (y + needed > H - M) {
      doc.addPage();
      y = M;
    }
  };

  if (product.steps?.length) {
    for (let i = 0; i < product.steps.length; i++) {
      const step = product.steps[i];
      const descLines = doc.splitTextToSize(step.description || "-", contentW - STEP_CARD_PADDING * 2);
      const descHeight = Math.max(STEP_DESC_LINE_H, descLines.length * STEP_DESC_LINE_H);
      const photoCount = step.photos?.length || 0;
      const photoRows = Math.ceil(photoCount / 2);
      const photosHeight = photoCount
        ? photoRows * STEP_PHOTO_FRAME_H + (photoRows - 1) * STEP_PHOTO_GUTTER + 10 /* top gap */
        : 0;

      const cardHeight =
        STEP_TITLE_BAR_H + STEP_CARD_PADDING + descHeight + (photoCount ? photosHeight : 0) + STEP_CARD_PADDING;

      // page break vóór de hele card
      addPageIfNeeded(cardHeight);

      // Card achtergrond + rand
      doc.setDrawColor(232, 232, 236);
      doc.setFillColor(252, 252, 253);
      doc.roundedRect(M, y, contentW, cardHeight, STEP_CARD_RADIUS, STEP_CARD_RADIUS, "FD");

      // Titelbalk
      doc.setFillColor(...brand.primary);
      doc.roundedRect(M, y, contentW, STEP_TITLE_BAR_H, STEP_CARD_RADIUS, STEP_CARD_RADIUS, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(tProd("pdf.step", { index: i + 1 }), M + STEP_CARD_PADDING, y + STEP_TITLE_BAR_H - 7);

      // Beschrijving
      let innerY = y + STEP_TITLE_BAR_H + STEP_CARD_PADDING;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...brand.textDark);
      doc.text(descLines, M + STEP_CARD_PADDING, innerY + 2);
      innerY += descHeight + 10;

      // Foto-grid (2 per rij, contain & centre)
      if (photoCount) {
        const innerW = contentW - STEP_CARD_PADDING * 2;
        const cellW = (innerW - STEP_PHOTO_GUTTER) / 2;

        for (let p = 0; p < photoCount; p += 2) {
          for (let col = 0; col < 2; col++) {
            const url = step.photos[p + col];
            if (!url) continue;

            const xPos = M + STEP_CARD_PADDING + col * (cellW + STEP_PHOTO_GUTTER);

            // frame
            doc.setDrawColor(230);
            doc.rect(xPos, innerY, cellW, STEP_PHOTO_FRAME_H);

            try {
              const meta = await fetchImageMeta(url);
              const maxW = cellW - 12;
              const maxH = STEP_PHOTO_FRAME_H - 12;
              const { w, h } = fitRect(meta.width, meta.height, maxW, maxH);
              const xImg = xPos + (cellW - w) / 2;
              const yImg = innerY + (STEP_PHOTO_FRAME_H - h) / 2;
              doc.addImage(meta.dataUrl, "JPEG", xImg, yImg, w, h, undefined, "FAST");
            } catch {
              doc.setFontSize(10);
              doc.setTextColor(150, 50, 50);
              doc.text(tProd("pdf.imageError"), xPos + 8, innerY + 18);
              doc.setTextColor(...brand.textDark);
            }
          }
          innerY += STEP_PHOTO_FRAME_H + STEP_PHOTO_GUTTER;
        }
      }

      // naar onder voor volgende card
      y += cardHeight + STEP_CARD_GAP;
    }
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text("-", M, y); y += 16;
  }

  addFooters(doc, brand.brandText || tProd("pdf.brand"));

  const safeName = (rawName || "Product").replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
  const fileName = tProd("pdf.fileName", { name: safeName });
  doc.save(fileName);
}
