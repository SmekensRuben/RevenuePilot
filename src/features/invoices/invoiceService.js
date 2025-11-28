import { db, collection, getDocs, addDoc } from "../../firebaseConfig";

export async function getInvoices(hotelUid) {
  if (!hotelUid) return [];
  const col = collection(db, `hotels/${hotelUid}/invoices`);
  const snap = await getDocs(col);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createInvoice(hotelUid, orders) {
  if (!hotelUid || !orders?.length) return;
  const col = collection(db, `hotels/${hotelUid}/invoices`);
  const items = [];
  orders.forEach(order => {
    (order.articles || []).forEach(prod => {
      items.push({ orderId: order.id, ...prod });
    });
  });
  await addDoc(col, {
    orders: orders.map(o => ({
      id: o.id,
      supplier: o.supplier,
      orderDate: o.orderDate,
      deliveryDate: o.deliveryDate,
    })),
    items,
    createdAt: new Date().toISOString(),
  });
}
