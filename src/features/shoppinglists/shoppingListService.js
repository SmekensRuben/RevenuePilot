import {
  db,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "../../firebaseConfig";
import { deleteField } from "firebase/firestore";

export async function getShoppingLists(hotelUid) {
  if (!hotelUid) return [];
  const col = collection(db, `hotels/${hotelUid}/shoppingLists`);
  const snap = await getDocs(col);
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function addShoppingList(hotelUid, name) {
  if (!hotelUid || !name) return;
  const col = collection(db, `hotels/${hotelUid}/shoppingLists`);
  await addDoc(col, { name, outlet: "", items: {} });
}

export async function updateShoppingList(hotelUid, id, data) {
  if (!hotelUid || !id) return;
  const ref = doc(db, `hotels/${hotelUid}/shoppingLists`, id);
  await updateDoc(ref, data);
}

export async function addItemToList(
  hotelUid,
  listId,
  itemId,
  { min, max, location, articleId, ingredientId }
) {
  if (!hotelUid || !listId || !itemId) return;
  const ref = doc(db, `hotels/${hotelUid}/shoppingLists`, listId);
  const payload = {
    min: Number(min) || 0,
    max: Number(max) || 0,
    location: location || "",
  };
  if (articleId) payload.articleId = articleId;
  if (ingredientId) payload.ingredientId = ingredientId;
  await updateDoc(ref, {
    [`items.${itemId}`]: payload,
  });
}

export async function removeItemFromList(hotelUid, listId, itemId) {
  if (!hotelUid || !listId || !itemId) return;
  const ref = doc(db, `hotels/${hotelUid}/shoppingLists`, listId);
  await updateDoc(ref, {
    [`items.${itemId}`]: deleteField(),
  });
}

export async function deleteShoppingList(hotelUid, listId) {
  if (!hotelUid || !listId) return;
  const ref = doc(db, `hotels/${hotelUid}/shoppingLists`, listId);
  await deleteDoc(ref);
}
