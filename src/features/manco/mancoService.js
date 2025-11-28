// src/features/manco/mancoService.js
import { db, getDocs, collection, query } from "../../firebaseConfig";

function isSignificantShortage(product) {
  const shortage = Number(product.shortage) || 0;
  if (shortage <= 0) return false;
  if (product.isWeighed) {
    const ordered = Number(product.quantity) || 0;
    if (ordered <= 0) return false;
    return shortage / ordered > 0.25;
  }
  return true;
}
export { isSignificantShortage as _isSignificantShortage };

// Haal alle manco's (tekorten) uit orders
export async function getAllMancos(hotelUid) {
  if (!hotelUid) return [];
  const q = query(collection(db, `hotels/${hotelUid}/orders`));
  const snap = await getDocs(q);
  if (snap.empty) return [];

  let mancoList = [];

  snap.forEach((docSnap) => {
    const order = docSnap.data();
    const orderId = docSnap.id;
    if (!order.articles) return;
    order.articles.forEach((product, idx) => {
      if (!isSignificantShortage(product)) return;
      mancoList.push({
        id: `${orderId}_${idx}`,
        date: order.deliveryDate || order.orderDate || "",
        supplier: product.supplier || order.supplier || "",
        artikelnummer: product.articleNumber || product.artikelnummer || "",
        product: product.name || "",
        stockUnit: product.stockUnit || "",
        unitsPerPurchaseUnit: product.unitsPerPurchaseUnit || "",
        quantity: product.shortage,
        pricePerPurchaseUnit: product.pricePerPurchaseUnit || product.price || "",
        ...product,
      });
    });
  });

  return mancoList;
}

// Bereken leveringsstatistieken per leverancier
export async function getSupplyStatsPerSupplier(hotelUid) {
  if (!hotelUid) return [];
  const q = query(collection(db, `hotels/${hotelUid}/orders`));
  const snap = await getDocs(q);
  if (snap.empty) return [];

  // Verzamel stats per leverancier
  const stats = {};
  snap.forEach((docSnap) => {
    const order = docSnap.data();
    if (!order.supplier || !order.articles) return;
    const supplier = order.supplier;
    if (!stats[supplier]) {
      stats[supplier] = {
        supplier,
        totalSupplied: 0,
        totalOrdered: 0
      };
    }
    order.articles.forEach(prod => {
      const ordered = Number(prod.quantity) || 0;
      if (ordered > 0) {
        stats[supplier].totalOrdered += 1;
        if (!isSignificantShortage(prod)) {
          stats[supplier].totalSupplied += 1;
        }
      }
    });
  });

  // Percentages berekenen
  return Object.values(stats).map(stat => ({
    ...stat,
    percentSupplied: stat.totalOrdered
      ? (stat.totalSupplied / stat.totalOrdered) * 100
      : 100
  }));
}
