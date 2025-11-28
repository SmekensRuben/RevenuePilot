// src/features/orders/orderService.js
import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
} from "../../firebaseConfig";
import { getIngredientsIndexed as getIngredientsFromIndex } from "../../services/firebaseIngredients";
import { query, where } from "firebase/firestore";

function sanitizeFirestoreData(data) {
  if (Array.isArray(data)) {
    return data.map(item => sanitizeFirestoreData(item));
  }

  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, sanitizeFirestoreData(value)])
    );
  }

  return data;
}

function getOrderRef(hotelUid, orderId) {
  return doc(db, `hotels/${hotelUid}/orders/${orderId}`);
}

// Haal alle orders op voor een hotel
export async function getOrders(hotelUid) {
  if (!hotelUid) return [];
  const snap = await getDocs(collection(db, `hotels/${hotelUid}/orders`));
  const result = [];
  snap.forEach(docSnap => {
    result.push({ id: docSnap.id, ...docSnap.data() });
  });
  return result;
}

// Voeg een nieuwe order toe
export async function addOrder(hotelUid, orderData) {
  if (!hotelUid) return;
  const ordersCol = collection(db, `hotels/${hotelUid}/orders`);
  await addDoc(ordersCol, sanitizeFirestoreData(orderData));
}

// Update een bestaande order
export async function updateOrder(hotelUid, orderId, updateFields) {
  if (!hotelUid || !orderId) return;
  const ref = getOrderRef(hotelUid, orderId);
  await updateDoc(ref, sanitizeFirestoreData(updateFields));
}

// Haal één order op
export async function getOrder(hotelUid, orderId) {
  if (!hotelUid || !orderId) return null;
  const ref = getOrderRef(hotelUid, orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...snap.data(), id: orderId };
}

// Status van order wijzigen
export async function setOrderStatus(hotelUid, orderId, status) {
  if (!hotelUid || !orderId) return;
  const ref = getOrderRef(hotelUid, orderId);
  await updateDoc(ref, { status });
}

// Verwijder een order
export async function deleteOrder(hotelUid, orderId) {
  if (!hotelUid || !orderId) return;
  const ref = getOrderRef(hotelUid, orderId);
  await deleteDoc(ref);
}

// Haal alle ingrediënten op voor een hotel
export async function getIngredients(hotelUid) {
  if (!hotelUid) return [];
  const arr = await getIngredientsFromIndex(hotelUid);
  const lang = localStorage.getItem("lang") || "nl";
  return arr
    .filter(ing => ing.active !== false)
    .map(ing => ({
      ...ing,
      label: ing.brand
        ? `${ing.aliases?.[lang] || ing.name} (${ing.brand})`
        : ing.aliases?.[lang] || ing.name,
    }));
}

// Haal alle "created" orders op voor een hotel
export async function getCreatedOrders(hotelUid) {
  const q = query(
    collection(db, `hotels/${hotelUid}/orders`),
    where("status", "==", "created")
  );
  const snap = await getDocs(q);
  const result = [];
  snap.forEach(docSnap => result.push({ id: docSnap.id, ...docSnap.data() }));
  return result;
}

// Order ontvangen zetten
export async function setOrderReceived(
  hotelUid,
  orderId,
  articles,
  deliveryDay = ""
) {
  if (!hotelUid || !orderId) return;
  const ref = getOrderRef(hotelUid, orderId);
  await updateDoc(ref, {
    status: "received",
    articles: sanitizeFirestoreData(articles),
  });
}

