import { dateRange } from "../lightspeed/lightspeedHelpers";
import { db, getDocs, collection } from "../../firebaseConfig";
import { collectionGroup, query, where } from "firebase/firestore";
import { getProductsIndexed } from "../../services/firebaseProducts";

// Placeholder service that generates dummy cost data
export async function getCostData(hotelUid, startDate, endDate) {
  if (!hotelUid) return [];
  const days = dateRange(startDate, endDate);
  return days.map(day => ({
    date: day,
    foodCost: Math.round(Math.random() * 80 + 20),
    beverageCost: Math.round(Math.random() * 40 + 10),
  }));
}

// Get total quantity of sold products between two dates based on
// receiptItemSummary documents
export async function getSoldProductsTotal(
  hotelUid,
  startDate,
  endDate,
  {
    selectedOutlet = "",
    selectedCategory = "",
    dataType = "Both",
    productCategories = {},
    categories = {},
  } = {},
) {
  if (!hotelUid || !startDate || !endDate) return 0;

  const products = await getProductsIndexed(hotelUid);
  const lsIdToCategory = {};
  (products || []).forEach(p => {
    if (p.lightspeedId !== undefined) {
      lsIdToCategory[String(p.lightspeedId).trim()] = p.category || "";
    }
  });

  const q = query(
    collectionGroup(db, "receiptItemSummary"),
    where("day", ">=", startDate),
    where("day", "<=", endDate)
  );
  const snap = await getDocs(q);

  let total = 0;
  snap.forEach(docSnap => {
    const pathParts = docSnap.ref.path.split("/");
    const hotelInPath = pathParts[1];
    if (hotelInPath !== hotelUid) return;

    const data = docSnap.data() || {};
    const items = data.items || {};
    Object.values(items).forEach(item => {
      const baseQty = Number(item.qty) || 0;
      let qty = baseQty;
      if (selectedOutlet) {
        qty = Number(item.perOutlet?.[selectedOutlet]) || 0;
      }
      if (qty <= 0) return;
      const pid = String(item.productId || "").trim();
      const cat = lsIdToCategory[pid] || item.category || "";
      if (selectedCategory && cat !== selectedCategory) return;
      const t =
        productCategories[cat]?.type || categories[cat]?.type || "";
      if (
        (dataType === "Food" && t !== "food") ||
        (dataType === "Beverage" && t !== "beverage") ||
        (dataType === "Both" && t !== "food" && t !== "beverage")
      )
        return;
      total += qty;
    });
  });

  return total;
}

export async function getBoughtItemsTotal(
  hotelUid,
  startDate,
  endDate,
  {
    selectedOutlet = "",
    selectedCategory = "",
    dataType = "Both",
    categories = {},
  } = {},
) {
  if (!hotelUid || !startDate || !endDate) return 0;

  function resolveType(catKey) {
    let key = catKey;
    while (key) {
      const t = categories[key]?.type;
      if (t) return t;
      key = categories[key]?.parentId || "";
    }
    return "";
  }

  const q = query(
    collection(db, `hotels/${hotelUid}/orders`),
    where("status", "in", ["received", "completed"]),
    where("deliveryDate", ">=", startDate),
    where("deliveryDate", "<=", endDate)
  );
  const snap = await getDocs(q);

  let total = 0;
  snap.forEach(docSnap => {
    const order = docSnap.data() || {};
    const items = Array.isArray(order.articles) ? order.articles : [];
    items.forEach(item => {
      let qty =
        item.received !== undefined
          ? Number(item.received) || 0
          : Math.max(0, Number(item.quantity) - Number(item.shortage || 0));
      if (selectedOutlet && item.outlet !== selectedOutlet) qty = 0;
      if (qty <= 0) return;
      const catKey = item.category || "";
      if (selectedCategory && catKey !== selectedCategory) return;
      const t = resolveType(catKey);
      if (dataType === "Food" && t !== "food") return;
      if (dataType === "Beverage" && t !== "beverage") return;
      if (dataType === "Both" && t !== "food" && t !== "beverage") return;
      const price = Number(item.pricePerPurchaseUnit ?? item.price) || 0;
      total += qty * price;
    });
  });

  return total;
}
