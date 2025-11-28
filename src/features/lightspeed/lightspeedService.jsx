// src/features/lightspeed/lightspeedService.js
import { db, collection, doc, getDocs, getDoc, setDoc } from "../../firebaseConfig";

// Haal alle receipts (per hotel)
export async function getReceipts(hotelUid) {
  if (!hotelUid) return {};

  // Bovenste collectie bevat een document per dag. Onder elke dag staat een
  // subcollectie `receiptList` met de daadwerkelijke receipts.
  const receiptsCol = collection(db, `hotels/${hotelUid}/receipts`);
  const daySnapshot = await getDocs(receiptsCol);

  const result = {};
  for (const dayDoc of daySnapshot.docs) {
    const day = dayDoc.id; // doc-id is de dag
    const listCol = collection(db, `hotels/${hotelUid}/receipts/${day}/receiptList`);
    const listSnap = await getDocs(listCol);

    result[day] = {};
    listSnap.forEach(receiptSnap => {
      result[day][receiptSnap.id] = receiptSnap.data();
    });
  }

  return result;
}

// Haal alle producten (per hotel)
export async function getProducts(hotelUid) {
  if (!hotelUid) return [];
  const productsCol = collection(db, `hotels/${hotelUid}/products`);
  const snapshot = await getDocs(productsCol);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Receipt(s) toevoegen (per dag per receiptId)
export async function addReceipts(hotelUid, groupedReceipts, onProgress = () => {}) {
  if (!hotelUid) return 0;
  let totalReceipts = 0;

  const receiptCount = Object.values(groupedReceipts)
    .reduce((sum, dayObj) => sum + Object.keys(dayObj).length, 0);
  let processed = 0;

  for (const [day, receiptsOfDay] of Object.entries(groupedReceipts)) {
    // Zorg dat het document voor deze dag bestaat zodat de subcollectie kan worden aangemaakt.
    const dayDoc = doc(db, `hotels/${hotelUid}/receipts/${day}`);
    await setDoc(dayDoc, { day }, { merge: true });


    for (const [receiptId, receiptObj] of Object.entries(receiptsOfDay)) {
      const receiptDoc = doc(
        db,
        `hotels/${hotelUid}/receipts/${day}/receiptList`,
        receiptId
      );
      await setDoc(receiptDoc, receiptObj);
      totalReceipts++;
      processed++;
      onProgress(Math.round((processed / receiptCount) * 100));
    }
  }

  return totalReceipts;
}

// Haal alle receipt indexes (per dag)
export async function getReceiptIndexes(hotelUid) {
  if (!hotelUid) return {};
  const indexesCol = collection(db, `hotels/${hotelUid}/indexes/receiptMasterIndex/receiptsForLightspeedSync`);
  const snap = await getDocs(indexesCol);
  const result = {};
  snap.forEach(docSnap => {
    result[docSnap.id] = docSnap.data();
  });
  return result;
}
