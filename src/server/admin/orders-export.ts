import ExcelJS from "exceljs";
import type { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { orderFilters, parseOrderQuery, type orderListQuery } from "./orders";

// Excel export of the orders the owner is looking at (same tab / search / dates as the list).
// Sheet "Orders": one row per order — for courier bookings.
// Sheet "Items":  one row per item — for accounting (cost and profit).

export const MAX_EXPORT_ORDERS = 5000;

const STATUS = {
  AWAITING_PAYMENT: "Awaiting payment",
  NEW: "New",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  ABANDONED: "Abandoned",
} as const;
const PAYMENT = { UNPAID: "Unpaid", PAID: "Paid", REFUND_NEEDED: "Refund needed", REFUNDED: "Refunded" } as const;
const METHOD = { COD: "COD", JAZZCASH: "JazzCash" } as const;
const FINISH = { GOLD: "Gold", SILVER: "Silver" } as const;
const NO_COLOUR = "None / Single";

const pktFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const pkt = (d: Date | null) => (d ? pktFmt.format(d).replace(",", "") : "");
const money = (v: unknown) => (v == null ? null : Number(v));

/** "Gold / Blue / 8" — leaves out the no-colour sentinel and empty sizes. */
const optionText = (i: { finish: keyof typeof FINISH; colour: string; size: string }) =>
  [FINISH[i.finish], i.colour !== NO_COLOUR ? i.colour : "", i.size].filter(Boolean).join(" / ");

export async function ordersWorkbook(db: PrismaClient, query: z.input<typeof orderListQuery> = {}) {
  const { where } = orderFilters(parseOrderQuery(query));
  const count = await db.order.count({ where });
  if (count > MAX_EXPORT_ORDERS) {
    throw new DomainError("INVALID_INPUT", `That's ${count} orders — please pick a shorter date range (max ${MAX_EXPORT_ORDERS}).`);
  }
  const orders = await db.order.findMany({
    where,
    include: { items: { orderBy: { id: "asc" } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Aurele admin";

  const os = wb.addWorksheet("Orders", { views: [{ state: "frozen", ySplit: 1 }] });
  os.columns = [
    { header: "Order #", key: "orderNumber", width: 10 },
    { header: "Date (PKT)", key: "date", width: 17 },
    { header: "Status", key: "status", width: 16 },
    { header: "Payment", key: "method", width: 10 },
    { header: "Payment status", key: "paymentStatus", width: 15 },
    { header: "Customer", key: "customerName", width: 22 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Email", key: "email", width: 28 },
    { header: "Address", key: "address", width: 40 },
    { header: "City", key: "city", width: 14 },
    { header: "Postal code", key: "postalCode", width: 11 },
    { header: "Items", key: "items", width: 50 },
    { header: "Pieces", key: "pieces", width: 8 },
    { header: "Subtotal (Rs)", key: "subtotal", width: 13 },
    { header: "Shipping (Rs)", key: "shipping", width: 13 },
    { header: "Total (Rs)", key: "total", width: 12 },
    { header: "Delivery", key: "delivery", width: 10 },
    { header: "Courier", key: "courier", width: 12 },
    { header: "Tracking no.", key: "tracking", width: 18 },
    { header: "Shipped (PKT)", key: "shippedAt", width: 17 },
    { header: "Delivered (PKT)", key: "deliveredAt", width: 17 },
    { header: "Cancel reason", key: "cancelReason", width: 30 },
  ];

  const is = wb.addWorksheet("Items", { views: [{ state: "frozen", ySplit: 1 }] });
  is.columns = [
    { header: "Order #", key: "orderNumber", width: 10 },
    { header: "Date (PKT)", key: "date", width: 17 },
    { header: "Status", key: "status", width: 16 },
    { header: "SKU", key: "sku", width: 14 },
    { header: "Product", key: "product", width: 28 },
    { header: "Finish", key: "finish", width: 8 },
    { header: "Colour", key: "colour", width: 14 },
    { header: "Size", key: "size", width: 10 },
    { header: "Qty", key: "qty", width: 6 },
    { header: "Price each (Rs)", key: "price", width: 14 },
    { header: "Line total (Rs)", key: "lineTotal", width: 14 },
    { header: "Cost each (Rs)", key: "cost", width: 14 },
    { header: "Profit (Rs)", key: "profit", width: 12 },
  ];

  for (const o of orders) {
    const date = pkt(o.createdAt);
    os.addRow({
      orderNumber: o.orderNumber,
      date,
      status: STATUS[o.status],
      method: METHOD[o.paymentMethod],
      paymentStatus: PAYMENT[o.paymentStatus],
      customerName: o.customerName,
      phone: o.phone,
      email: o.email,
      address: o.address,
      city: o.city,
      postalCode: o.postalCode ?? "",
      items: o.items.map((i) => `${i.quantity} × ${i.productName} – ${optionText(i)}`).join("; "),
      pieces: o.items.reduce((s, i) => s + i.quantity, 0),
      subtotal: money(o.subtotal),
      shipping: money(o.shippingFee),
      total: money(o.total),
      delivery: o.deliveryMethod === "OWN" ? "Own" : o.deliveryMethod === "COURIER" ? "Courier" : "",
      courier: o.courier ?? "",
      tracking: o.trackingNumber ?? "",
      shippedAt: pkt(o.shippedAt),
      deliveredAt: pkt(o.deliveredAt),
      cancelReason: o.cancelReason ?? "",
    });
    for (const i of o.items) {
      const price = Number(i.priceAtSale);
      const cost = money(i.costAtSale);
      is.addRow({
        orderNumber: o.orderNumber,
        date,
        status: STATUS[o.status],
        sku: i.sku,
        product: i.productName,
        finish: FINISH[i.finish],
        colour: i.colour !== NO_COLOUR ? i.colour : "",
        size: i.size,
        qty: i.quantity,
        price,
        lineTotal: price * i.quantity,
        cost,
        profit: cost == null ? null : (price - cost) * i.quantity,
      });
    }
  }

  for (const ws of [os, is]) {
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => {
      if (String(c.header).includes("(Rs)")) c.numFmt = "#,##0";
    });
  }
  return { wb, count: orders.length };
}

export async function ordersWorkbookBuffer(db: PrismaClient, query: z.input<typeof orderListQuery> = {}) {
  const { wb } = await ordersWorkbook(db, query);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
