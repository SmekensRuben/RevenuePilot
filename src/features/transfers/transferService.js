import {
  db,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc
} from "../../firebaseConfig";

export async function getTransfers(hotelUid) {
  if (!hotelUid) return [];
  const col = collection(db, `hotels/${hotelUid}/transfers`);
  const snap = await getDocs(col);
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function addTransfer(hotelUid, transferData) {
  if (!hotelUid) return;
  const col = collection(db, `hotels/${hotelUid}/transfers`);
  await addDoc(col, transferData);
}

export async function getTransfer(hotelUid, transferId) {
  if (!hotelUid || !transferId) return null;
  const ref = doc(db, `hotels/${hotelUid}/transfers`, transferId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateTransfer(hotelUid, transferId, fields) {
  if (!hotelUid || !transferId) return;
  const ref = doc(db, `hotels/${hotelUid}/transfers`, transferId);
  await updateDoc(ref, fields);
}

export async function setTransferStatus(hotelUid, transferId, status) {
  await updateTransfer(hotelUid, transferId, { status });
}

export async function deleteTransfer(hotelUid, transferId) {
  if (!hotelUid || !transferId) return;
  const ref = doc(db, `hotels/${hotelUid}/transfers`, transferId);
  await deleteDoc(ref);
}

