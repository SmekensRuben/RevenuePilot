import * as XLSX from "xlsx";

export function exportOrdersToExcel(orders, { fileName = "orders_export" } = {}) {
  if (!Array.isArray(orders) || orders.length === 0) return;

  const header = [
    "Order Date",
    "Delivery Date",
    "Supplier",
    "Status",
    "Article",
    "Brand",
    "Outlet",
    "Quantity Ordered",
    "Quantity Received",
    "Quantity Shortage",
    "Stock Unit",
    "Units Per Purchase Unit",
    "Purchase Unit",
    "Price",
    "Total",
    "Note",
  ];

  const rows = [];

  orders.forEach(o => {
    (o.articles || []).forEach(p => {
      const unitPrice = Number(
        p.invoicedPricePerPurchaseUnit
        ?? p.price
        ?? p.pricePerPurchaseUnit
        ?? 0
      );

      rows.push([
        o.orderDate || "",
        o.deliveryDate || "",
        o.supplier || "",
        o.status || "",
        p.name || "",
        p.brand || "",
        p.outlet || "",
        p.quantity ?? "",
        p.received ?? "",
        p.shortage ?? "",
        p.stockUnit ?? "",
        p.unitsPerPurchaseUnit ?? "",
        p.purchaseUnit ?? "",
        unitPrice,
        (Number(p.quantity) || 0) * unitPrice,
        o.note || "",
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
