// src/features/returns/returnsService.js
import {
  db,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  collection as fsCollection,
} from "../../firebaseConfig";

// Retouren ophalen per hotel
export async function getReturns(hotelUid) {
  if (!hotelUid) return [];
  const returnsCol = collection(db, `hotels/${hotelUid}/returns`);
  const snap = await getDocs(returnsCol);
  return snap.docs.map(docSnap => ({
    ...docSnap.data(),
    id: docSnap.id,
  }));
}

// Retour toevoegen
export async function addReturn(hotelUid, returnData) {
  if (!hotelUid) return;
  const returnsCol = collection(db, `hotels/${hotelUid}/returns`);
  await addDoc(returnsCol, returnData);
}

// Retour updaten
export async function updateReturn(hotelUid, returnId, updateFields) {
  if (!hotelUid || !returnId) return;
  const retourDoc = doc(db, `hotels/${hotelUid}/returns`, returnId);
  await updateDoc(retourDoc, updateFields);
}

// Ingrediënten ophalen per hotel
export async function getIngredients(hotelUid) {
  if (!hotelUid) return [];
  const ingredientsCol = collection(db, `hotels/${hotelUid}/ingredients`);
  const snap = await getDocs(ingredientsCol);
  const lang = localStorage.getItem("lang") || "nl";
  return snap.docs.map(docSnap => {
    const ing = docSnap.data();
    const base = ing.aliases?.[lang] || ing.name;
    return {
      ...ing,
      id: docSnap.id,
      label: ing.brand ? `${base} (${ing.brand})` : base,
    };
  });
}

// Orders ophalen per hotel
export async function getAllOrderProducts(hotelUid) {
  if (!hotelUid) return [];
  const q = query(fsCollection(db, `hotels/${hotelUid}/orders`));
  const snap = await getDocs(q);
  const productsList = [];
  snap.forEach(docSnap => {
    const order = docSnap.data();
    const date = order.deliveryDate || order.orderDate || '';
    (order.articles || []).forEach(prod => {
      productsList.push({
        ...prod,
        ingredientId: prod.ingredientId,
        name: prod.name,
        brand: prod.brand,
        supplier: prod.supplier || order.supplier,
        artikelnummer: prod.artikelnummer || prod.articleNumber || '',
        deliveryDate: date,
      });
    });
  });
  return productsList;
}
