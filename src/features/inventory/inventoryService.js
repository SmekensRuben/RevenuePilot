// features/inventory/inventoryService.js
import {
  db,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  getDocs,
} from "../../firebaseConfig";

// Start een real-time listener en geef updates door via callback
export function listenInventory(hotelUid, callback) {
  if (!hotelUid) return () => {};
  const inventoryCol = collection(db, `hotels/${hotelUid}/inventory`);
  const q = query(inventoryCol);
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const arr = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(arr);
  });
  return unsubscribe;
}

// Haal alle inventory items op (eenmalige fetch)
export async function getInventory(hotelUid) {
  if (!hotelUid) return [];
  const inventoryCol = collection(db, `hotels/${hotelUid}/inventory`);
  const q = query(inventoryCol);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// Voeg een voorraadregel toe (met artikel-id)
export async function addInventoryItem(hotelUid, { articleId, quantity }) {
  if (!hotelUid || !articleId) return;
  const inventoryCol = collection(db, `hotels/${hotelUid}/inventory`);
  await addDoc(inventoryCol, { articleId, quantity: Number(quantity) });
}

// Pas quantity aan (edit)
export async function updateInventoryItem(hotelUid, id, { quantity }) {
  if (!hotelUid || !id) return;
  const itemDoc = doc(db, `hotels/${hotelUid}/inventory`, id);
  await updateDoc(itemDoc, { quantity: Number(quantity) });
}

// Verwijder voorraadregel
export async function removeInventoryItem(hotelUid, id) {
  if (!hotelUid || !id) return;
  const itemDoc = doc(db, `hotels/${hotelUid}/inventory`, id);
  await deleteDoc(itemDoc);
}
