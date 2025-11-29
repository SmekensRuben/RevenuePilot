import {
  addDoc,
  collection,
  db,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "../firebaseConfig";
import { getSelectedHotelUid } from "../utils/hotelUtils";

export function subscribeToLocalEvents(callback) {
  const hotelUid = getSelectedHotelUid();
  if (!hotelUid) return () => {};

  const eventsRef = collection(db, `hotels/${hotelUid}/localEvents`);
  const q = query(eventsRef, orderBy("startDate", "asc"));

  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    callback(events);
  });
}

export async function addLocalEvent(event) {
  const hotelUid = getSelectedHotelUid();
  if (!hotelUid) {
    throw new Error("No hotel selected");
  }

  const eventsRef = collection(db, `hotels/${hotelUid}/localEvents`);
  await addDoc(eventsRef, {
    ...event,
    createdAt: serverTimestamp(),
  });
}
