// src/features/stockcount/stockCountService.js

import {
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "../../firebaseConfig";
import { getArticles } from "services/firebaseArticles";
import { getRecipes } from "services/firebaseRecipes";
import { getIngredients } from "services/firebaseIngredients";
import { calculateRecipeCost } from "../recipes/recipeHelpers";

// Haal actieve telling id op
export async function getActiveStockCountId(hotelUid) {
  if (!hotelUid) return null;
  const hotelDoc = doc(db, "hotels", hotelUid);
  const snap = await getDoc(hotelDoc);
  return snap.exists() ? snap.data().activeStockCount || null : null;
}

export async function resyncInventoryWithStockCount({
  hotelUid,
  tellingId,
  report,
  categories,
  locations,
}) {
  if (!hotelUid || !tellingId || !report) throw new Error("hotelUid, tellingId en report verplicht!");

  // 1. Artikels en recepten ophalen voor categoriebepaling
  const [articlesArr, recipesArr] = await Promise.all([
    getArticles(hotelUid),
    getRecipes(hotelUid),
  ]);
  const articles = {};
  for (const art of articlesArr) articles[art.id] = art;
  for (const rec of recipesArr) articles[rec.id] = { ...rec, stockUnit: rec.contentUnit || "" };

  // 2. Oude inventory ophalen
  const inventoryCol = collection(db, `hotels/${hotelUid}/inventory`);
  const invSnap = await getDocs(inventoryCol);
  const oldInventory = {};
  invSnap.forEach(docSnap => {
    oldInventory[docSnap.id] = docSnap.data();
  });

  // 3. Filter categorieën
  const categorySet = new Set(categories);

  // 4. Tel per product de som over alle locaties (enkel voor geselecteerde categorieën)
  const totalCounts = {};
  const stockLocations = report.locations || {};
  for (const loc of locations) {
    const locData = stockLocations[loc] || {};
    for (const [prodId, prodInfo] of Object.entries(locData)) {
      if (prodId === "status") continue;
      const art = articles[prodId];
      if (art && categorySet.has(art.category)) {
        totalCounts[prodId] = (totalCounts[prodId] || 0) + (Number(prodInfo.amount) || 0);
      }
    }
  }

  // 5. Maak nieuwe inventory: oude (voor niet-getelde categorieën), nieuwe voor de getelde
  const batch = writeBatch(db);
  // a) Verwijder oude producten van de geselecteerde categorieën
  for (const prodId in oldInventory) {
    const art = articles[prodId];
    if (art && categorySet.has(art.category)) {
      batch.delete(doc(inventoryCol, prodId));
    }
  }
  // b) Voeg de nieuwe producten (alleen getelde) toe
  for (const [prodId, quantity] of Object.entries(totalCounts)) {
    batch.set(doc(inventoryCol, prodId), {
      articleId: prodId,
      quantity,
      lastCountDate: Date.now(),
    });
  }

  await batch.commit();
}

// Haal alle afgesloten tellingen (history)
export async function getStockCountHistory(hotelUid) {
  if (!hotelUid) return [];
  const stockCountsCol = collection(db, `hotels/${hotelUid}/stockCounts`);
  const snap = await getDocs(stockCountsCol);
  let result = [];
  snap.forEach(docSnap => {
    const t = docSnap.data();
    result.push({
      tellingId: docSnap.id,
      status: t.status || "Active",
      startedAt: t.startedAt || docSnap.id,
      closedAt: t.closedAt || null,
      date: t.date || null,
    });
  });
  result = result.filter(r => r.status === "Closed");
  result.sort((a, b) =>
    (b.closedAt || b.startedAt).toString().localeCompare(
      (a.closedAt || a.startedAt).toString()
    )
  );
  return result;
}

// Haal data voor één telling/rapport
export async function getStockCountReport(hotelUid, tellingId) {
  if (!hotelUid || !tellingId) return null;
  const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
  const snap = await getDoc(stockCountDoc);
  return snap.exists() ? snap.data() : null;
}

// Haal categorieën van een telling
export async function getTellingCategories(hotelUid, tellingId) {
  if (!hotelUid || !tellingId) return [];
  const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
  const snap = await getDoc(stockCountDoc);
  return snap.exists() && Array.isArray(snap.data().categories)
    ? snap.data().categories
    : [];
}

// Haal locatie-data binnen een telling
export async function getTellingLocationData(hotelUid, tellingId, locationId) {
  if (!hotelUid || !tellingId || !locationId) return {};
  const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
  const snap = await getDoc(stockCountDoc);
  if (!snap.exists()) return {};
  const data = snap.data();
  return data.locations?.[locationId] || {};
}

// Voeg product toe aan locatie
export async function addProductToLocation(hotelUid, tellingId, locationId, productId, data) {
  if (!hotelUid || !tellingId || !locationId || !productId) return;
  const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
  await updateDoc(stockCountDoc, {
  [`locations.${locationId}.${productId}`]: data
});
}

// Sluit locatie af
export async function finishLocation(hotelUid, tellingId, locationId) {
  if (!hotelUid || !tellingId || !locationId) return;
  const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
  await updateDoc(stockCountDoc, {
  [`locations.${locationId}.status`]: "Finished"
});
}

// Start een nieuwe telling
export async function startNewTelling(hotelUid, selectedCategories, locations, date = new Date()) {
  if (!hotelUid) return null;
  const stockCountsCol = collection(db, `hotels/${hotelUid}/stockCounts`);
  const tellingId = Date.now().toString();
  let initData = { locations: {} };
for (const loc of locations) {
  initData.locations[loc] = {};
}
initData.status = "Active";
  initData.startedAt = date.getTime();
  initData.date = date.toISOString();
  initData.categories = selectedCategories;

  // Voeg nieuwe telling toe
  await setDoc(doc(stockCountsCol, tellingId), initData);

  // Zet actieve telling op hotel-document
  const hotelDoc = doc(db, "hotels", hotelUid);
  await updateDoc(hotelDoc, { activeStockCount: tellingId });

  return tellingId;
}

// Telling volledig afsluiten, inventory bijwerken enz.
export async function closeTelling(hotelUid, tellingId, newInventory, oldInventory) {
  if (!hotelUid || !tellingId) return;

  // 1. Haal actuele artikels en recepten op voor correcte prijs/naam snapshot in inventoryBeforeUpdate
  const [articlesArr, recipesArr, ingredientsArr] = await Promise.all([
    getArticles(hotelUid),
    getRecipes(hotelUid),
    getIngredients(hotelUid),
  ]);
  const articlesData = {};
  for (const art of articlesArr) {
    articlesData[art.id] = {
      pricePerStockUnit: art.pricePerStockUnit ?? 0,
      name: art.name,
      unit: art.stockUnit || "",
    };
  }
  for (const rec of recipesArr) {
    articlesData[rec.id] = {
      pricePerStockUnit:
        calculateRecipeCost(rec, ingredientsArr, articlesArr) /
        Number(rec.content || 1),
      name: rec.name,
      unit: rec.contentUnit || "",
    };
  }

  // 2. Voeg prijs en naam toe aan alle producten in oldInventory
  for (const prodId in oldInventory) {
    const art = articlesData[prodId];
    if (art) {
      oldInventory[prodId].pricePerStockUnitAtCount = art.pricePerStockUnit || 0;
      oldInventory[prodId].nameAtCount = art.name;
      oldInventory[prodId].unit = art.unit || "";
    }
  }

  // 3. Inventory vervangen: eerst alles deleten, dan nieuwe toevoegen (batch)
  const inventoryCol = collection(db, `hotels/${hotelUid}/inventory`);
  const batch = writeBatch(db);

  // 4. Delete bestaande inventory
  const oldSnap = await getDocs(inventoryCol);
  oldSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  // 5. Voeg nieuwe inventory toe
  Object.entries(newInventory).forEach(([prodId, inv]) => {
    batch.set(doc(inventoryCol, prodId), inv);
  });

  // 6. Update telling-status en andere velden
  const stockCountDoc = doc(db, `hotels/${hotelUid}/stockCounts`, tellingId);
  batch.update(stockCountDoc, {
    status: "Closed",
    closedAt: Date.now(),
    inventoryBeforeUpdate: oldInventory, // <-- Nu correct uitgebreid!
  });

  // 7. Reset actieve telling op hotel-doc
  const hotelDoc = doc(db, "hotels", hotelUid);
  batch.update(hotelDoc, { activeStockCount: null });

  await batch.commit();
}

// ===================
// RAPPORTAGE HELPERS
// ===================

// Zoek vorige telling-id obv huidige telling-id
export async function getPreviousStockCountId(hotelUid, currentTellingId) {
  if (!hotelUid || !currentTellingId) return null;
  const stockCountsCol = collection(db, `hotels/${hotelUid}/stockCounts`);
  const snap = await getDocs(stockCountsCol);
  let list = [];
  snap.forEach(docSnap => {
    const d = docSnap.data();
    if (d.status === "Closed") {
      list.push({
        tellingId: docSnap.id,
        closedAt: d.closedAt || d.startedAt || Number(docSnap.id),
      });
    }
  });
  list.sort((a, b) => b.closedAt - a.closedAt);
  const idx = list.findIndex(x => x.tellingId === currentTellingId);
  if (idx === -1 || idx === list.length - 1) return null;
  return list[idx + 1].tellingId;
}

// Haal volledig rapport van vorige telling op
export async function getPreviousStockCountReport(hotelUid, currentTellingId) {
  const prevId = await getPreviousStockCountId(hotelUid, currentTellingId);
  if (!prevId) return null;
  return await getStockCountReport(hotelUid, prevId);
}
