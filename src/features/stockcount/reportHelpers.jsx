// src/features/stockcount/reportHelpers.js

import { doc, getDoc } from "../../firebaseConfig";
import * as XLSX from "xlsx";

// Genereer Excel-export

function round(num, decimals = 2) {
  return Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// rows: array met alle rijen (zoals nu), locaties: array met locatie-namen, meta: { date, categories }

// Verwacht een object met report, articles, categoryLabels, categories, locaties, meta
export function exportRowsToExcel({
  report,
  articles,
  categoryLabels,
  categories,
  locaties,
  meta = {},
}) {
  const { date, categories: catsForHeader } = meta || {};

  function rowStatus(row) {
    if (row.nowAmount === 0 && row.expectedAmount > 0) return "Verdwenen";
    if (row.nowAmount > 0 && row.expectedAmount === 0) return "Nieuw";
    if (row.nowAmount !== row.expectedAmount) return "Ongelijk";
    return "OK";
  }

  function makeSheetData(locatie) {
  let rows = buildRows({
    report,
    ingredients: articles,
    categoryLabels,
    categories,
    selectedLocation: locatie === "ALLE" ? undefined : locatie,
  });
  if (locatie !== "ALLE") {
    rows = rows.filter(row => row.nowAmount > 0);
  }

    // Titel en categorieën
    const title = [`Stocktelling ${date || ""}`];
    const cats = [`Categorieën: ${(catsForHeader && catsForHeader.length) ? catsForHeader.join(", ") : "-"}`];
    const empty = [""];

    // Header van de tabel
    const header = [
      "Product",
      "Categorie",
      "Verwacht aantal",
      "Geteld",
      "Verschil (aantal)",
      "Verschil (%)",
      "Eenheidsprijs",
      "Totale waarde (geteld)",
      "Verschil totale waarde",
      "Eenheid",
      "Status"
    ];

    // Data
    const data = rows.map(row => [
      row.name,
      row.category,
      row.expectedAmount,
      row.nowAmount,
      row.diff,
      row.percent ? row.percent.toFixed(1) + "%" : "0%",
      row.countedPrice.toFixed(2),
      row.value.toFixed(2),
      (row.value - ((row.expectedAmount || 0)*row.expectedPrice)).toFixed(2),
      row.unit,
      rowStatus(row)
    ]);

    return [title, cats, empty, header, ...data];
  }

  const wb = XLSX.utils.book_new();
  (locaties || []).forEach(locatie => {
    const ws_data = makeSheetData(locatie);
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, locatie);
  });

  XLSX.writeFile(wb, `stocktelling_${date || "export"}.xlsx`);
}

// Haal een map met { categoryKey: label } uit settings
export async function getCategoryLabels(db, hotelUid) {
  const settingsDoc = doc(db, `hotels/${hotelUid}/settings`, hotelUid);
  const snap = await getDoc(settingsDoc);
  const categoryLabelsMap = {};
  if (snap.exists() && snap.data().categories) {
    const allCats = snap.data().categories;
    Object.entries(allCats).forEach(([key, val]) => {
      categoryLabelsMap[key] = val.label || key;
    });
  }
  return categoryLabelsMap;
}

// Haal alle productIDs uit telling én inventoryBeforeUpdate, alleen voor gekozen categorieën
export function getRelevantProductIds(report, articles, categories) {
  // Verzamel alle productIDs uit telling (alle locaties) + inventoryBeforeUpdate
  const data = {};
  Object.keys(report || {}).forEach(key => {
    if (
      key !== "status" &&
      key !== "categories" &&
      key !== "inventoryBeforeUpdate" &&
      key !== "date" &&
      key !== "startedAt" &&
      key !== "closedAt"
    ) {
      const loc = report[key] || {};
      Object.entries(loc).forEach(([prodId, prod]) => {
        if (prodId !== "status") {
          data[prodId] = prod;
        }
      });
    }
  });
  const expectedData = report.inventoryBeforeUpdate || {};
  return Array.from(
    new Set([
      ...Object.keys(data),
      ...Object.keys(expectedData),
    ])
  ).filter(prodId => {
    const art = articles[prodId] || {};
    return categories.includes(art.category);
  });
}

// Bouw rijen voor de tabel, nu per locatie (volledige en correcte versie)
// Bouw geaggregeerde rijen: telt per product over alle locaties samen
export function buildRows({ report, ingredients: articles, categoryLabels, categories, selectedLocation }) {
  let productPerLocation = {};

  // Verzamel per locatie alle producten
  if (report.locations) {
    Object.entries(report.locations).forEach(([locId, locData]) => {
      Object.entries(locData)
        .filter(([prodId]) => prodId !== "status" && prodId !== "name")
        .forEach(([prodId, prod]) => {
          if (!productPerLocation[prodId]) productPerLocation[prodId] = [];
          productPerLocation[prodId].push({ ...prod, location: locId });
        });
    });
  } else {
    // Fallback voor oude structuur
    Object.keys(report || {}).forEach(key => {
      if (
        key !== "status" &&
        key !== "categories" &&
        key !== "inventoryBeforeUpdate" &&
        key !== "date" &&
        key !== "startedAt" &&
        key !== "closedAt"
      ) {
        const loc = report[key] || {};
        Object.entries(loc).forEach(([prodId, prod]) => {
          if (!productPerLocation[prodId]) productPerLocation[prodId] = [];
          productPerLocation[prodId].push({ ...prod, location: key });
        });
      }
    });
  }

  const expectedData = report.inventoryBeforeUpdate || {};
  const categoriesToShow = categories || [];

  const allProdIds = Array.from(
    new Set([
      ...Object.keys(productPerLocation),
      ...Object.keys(expectedData),
    ])
  ).filter(prodId => {
    const art = articles[prodId] || {};
    return categoriesToShow.includes(art.category);
  });

  const rowsPerProduct = [];
  for (const prodId of allProdIds) {
    const art = articles[prodId] || {};
    const expected = expectedData[prodId] || {};
    const allLocs = (productPerLocation[prodId] || []).filter(prod =>
  !selectedLocation || selectedLocation === "ALLE" || prod.location === selectedLocation
);


    // Sommeer per product
    let nowAmount = 0;
    let value = 0;
    let locaties = [];
    let countedPrice = 0;

    allLocs.forEach(prod => {
      nowAmount += prod.amount || 0;
      value += (prod.amount || 0) * (prod.pricePerStockUnitAtCount ?? art.price ?? 0);
      countedPrice = prod.pricePerStockUnitAtCount ?? art.price ?? 0; // laatst geldende prijs
      locaties.push(prod.location);
    });

    nowAmount = round(nowAmount, 2);
    value = round(value, 2);

    const expectedAmount = round(expected.quantity || 0, 2);
    const expectedPrice = expected.pricePerStockUnitAtCount ?? art.price ?? 0;
    const expectedValue = round(expectedAmount * countedPrice, 2);
    const diff = round(nowAmount - expectedAmount, 2);
    const percent = expectedAmount ? round((diff / expectedAmount) * 100, 1) : 0;
    const valueDiff = round(value - expectedValue, 2);

    rowsPerProduct.push({
      id: prodId,
      name: art.name || prodId,
      category: categoryLabels[art.category] || art.category || "-",
      expectedAmount,
      nowAmount,
      diff,
      percent,
      countedPrice: round(countedPrice, 2),
      expectedPrice: round(expectedPrice, 2),
      value,
      expectedValue,
      valueDiff,
      unit: art.stockUnit || "",
      locations: locaties, // optioneel: lijst met locaties waar geteld
    });
  }

  return rowsPerProduct;
}




// Bereken KPI's
export function calculateKpi(rows) {
  let totalValue = 0;
  let totalProducts = 0;
  let totalDeviations = 0;
  let biggestDeviation = { name: "", diff: 0, percent: 0 };

  for (const row of rows) {
    totalValue += row.value;
    totalProducts += 1;
    if (Math.abs(row.percent) >= 10) totalDeviations += 1;
    if (Math.abs(row.percent) > Math.abs(biggestDeviation.percent)) {
      biggestDeviation = { name: row.name, diff: row.diff, percent: row.percent };
    }
  }

  return {
    totalValue,
    totalProducts,
    totalDeviations,
    biggestDeviation
  };
}
