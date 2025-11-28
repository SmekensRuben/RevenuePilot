// src/features/products/productsService.js
import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "../../firebaseConfig";
import {
  rebuildProductCategoryIndex,
  clearProductsIndexedCache,
} from "../../services/firebaseProducts";

async function refreshSalesSnapshotsForProduct(hotelUid, lightspeedId) {
  if (!hotelUid || !lightspeedId) return;
  const indexesCol = collection(
    db,
    `hotels/${hotelUid}/indexes/receiptMasterIndex/receiptsForLightspeedSync`
  );
  const snap = await getDocs(indexesCol);
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const productIndex = data.productIndex || {};
    if (productIndex[String(lightspeedId)]) {
      // no-op: analytics snapshots removed
    }
  }
}

// Haal alle producten
export async function getProducts(hotelUid) {
  if (!hotelUid) return [];
  const productsCol = collection(db, `hotels/${hotelUid}/products`);
  const snap = await getDocs(productsCol);
  return snap.docs.map(docSnap => ({
    ...docSnap.data(),
    id: docSnap.id
  }));
}

// Product toevoegen
export async function addProduct(hotelUid, data) {
  if (!hotelUid) return;
  const productsCol = collection(db, `hotels/${hotelUid}/products`);
  const docRef = await addDoc(productsCol, data);
  await refreshSalesSnapshotsForProduct(hotelUid, data.lightspeedId);
  await rebuildProductCategoryIndex(hotelUid, data.category || "");
  clearProductsIndexedCache(hotelUid);
  return docRef.id;
}

// Product bijwerken
export async function updateProduct(hotelUid, id, data) {
  if (!hotelUid || !id) return;
  const productDoc = doc(db, `hotels/${hotelUid}/products`, id);
  const currentSnap = await getDoc(productDoc);
  let oldCategory = "";
  if (currentSnap.exists()) {
    const current = currentSnap.data();
    oldCategory = current.category || "";
  }

  await updateDoc(productDoc, data);
  await refreshSalesSnapshotsForProduct(hotelUid, data.lightspeedId);

  const newCategory = data.category !== undefined ? data.category : oldCategory;
  await rebuildProductCategoryIndex(hotelUid, newCategory);
  if (oldCategory !== newCategory) {
    await rebuildProductCategoryIndex(hotelUid, oldCategory);
  }
  clearProductsIndexedCache(hotelUid);
}

// Product verwijderen
export async function deleteProduct(hotelUid, id) {
  if (!hotelUid || !id) return;
  const productDoc = doc(db, `hotels/${hotelUid}/products`, id);
  const snap = await getDoc(productDoc);
  const category = snap.exists() ? snap.data().category || "" : "";
  await deleteDoc(productDoc);
  await rebuildProductCategoryIndex(hotelUid, category);
  clearProductsIndexedCache(hotelUid);
}
