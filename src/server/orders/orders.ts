import { z } from "zod";
import { Prisma, type OrderStatus, type PrismaClient } from "@/generated/prisma/client";
import { DomainError, type Shortage } from "../errors";
import { getNumberSetting } from "../settings";
import { takeStock, returnStock, variantLabel, type StockLine } from "../inventory/stock";

// ------------------------------------------------------------
// ORDER RULES (agreed with the business):
//  • Stock is never reserved.
//  • COD: stock is taken the moment the order is placed. The order is final.
//  • JazzCash: placing the order takes nothing. Stock is taken when payment is
//    confirmed. If it sold out in between, the order is cancelled and flagged
//    REFUND_NEEDED for the owner.
//  • Last piece: whoever completes first (COD placed / JazzCash paid) gets it.
//  • Prices and shipping always come from the database, never from the browser.
// ------------------------------------------------------------

const ABANDON_AFTER_HOURS = 24;
const FLOW: OrderStatus[] = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED"];
const CANCELLABLE: OrderStatus[] = ["AWAITING_PAYMENT", "NEW", "PROCESSING"];
// Busy moments (a sale, an Instagram drop) queue many orders on the same rows — allow waiting.
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

const orderInclude = { items: { orderBy: { id: "asc" } } } satisfies Prisma.OrderInclude;
export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// ------------------------------------------------------------
// Place an order (called by checkout — Track 3)
// ------------------------------------------------------------

export const placeOrderInput = z.object({
  items: z
    .array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().min(1).max(20) }))
    .min(1, "Your cart is empty")
    .max(50),
  customer: z.object({
    name: z.string().trim().min(2, "Please enter your full name").max(100),
    email: z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email address")),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{8,16}$/, "Please enter a valid phone number"),
    address: z.string().trim().min(5, "Please enter your full address").max(500),
    city: z.string().trim().min(2, "Please enter your city").max(100),
    postalCode: z.string().trim().max(20).optional().transform((v) => v || null),
  }),
  paymentMethod: z.enum(["COD", "JAZZCASH"]),
  customerId: z.number().int().positive().optional(), // when signed in to an account
});
export type PlaceOrderInput = z.input<typeof placeOrderInput>;

export async function placeOrder(db: PrismaClient, rawInput: PlaceOrderInput): Promise<OrderWithItems> {
  const parsed = placeOrderInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new DomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid order", parsed.error.issues);
  }
  const input = parsed.data;

  // Same item added twice → one line
  const qtyByVariant = new Map<number, number>();
  for (const i of input.items) qtyByVariant.set(i.variantId, (qtyByVariant.get(i.variantId) ?? 0) + i.quantity);
  // Always handle items in id order — every transaction then locks stock rows in the
  // same order, which is what prevents two overlapping carts from deadlocking.
  const variantIds = [...qtyByVariant.keys()].sort((a, b) => a - b);

  const variants = await db.variant.findMany({ where: { id: { in: variantIds } }, include: { product: true } });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const notPurchasable: string[] = [];
  for (const id of variantIds) {
    const v = byId.get(id);
    if (!v) notPurchasable.push(`Item #${id} no longer exists`);
    else if (!v.isActive || !v.product.isActive || v.sellingPrice === null) {
      notPurchasable.push(variantLabel({ ...v, productName: v.product.name }));
    }
  }
  if (notPurchasable.length) {
    throw new DomainError("NOT_PURCHASABLE", `Not available: ${notPurchasable.join("; ")}`, { items: notPurchasable });
  }

  const lines: (StockLine & { v: (typeof variants)[number] })[] = variantIds.map((id) => {
    const v = byId.get(id)!;
    return { variantId: id, quantity: qtyByVariant.get(id)!, label: variantLabel({ ...v, productName: v.product.name }), v };
  });

  // Early check for both methods — for JazzCash this stops people paying for something already gone.
  const early: Shortage[] = lines
    .filter((l) => l.v.quantity < l.quantity)
    .map((l) => ({ variantId: l.variantId, label: l.label, requested: l.quantity, available: l.v.quantity }));
  if (early.length) throw outOfStock(early);

  const subtotal = lines.reduce((sum, l) => sum.add(l.v.sellingPrice!.mul(l.quantity)), new Prisma.Decimal(0));
  const shippingFee = new Prisma.Decimal(await getNumberSetting(db, "shipping_fee"));
  const isCod = input.paymentMethod === "COD";

  return db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        customerId: input.customerId,
        customerName: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        address: input.customer.address,
        city: input.customer.city,
        postalCode: input.customer.postalCode,
        paymentMethod: input.paymentMethod,
        status: isCod ? "NEW" : "AWAITING_PAYMENT",
        subtotal,
        shippingFee,
        total: subtotal.add(shippingFee),
        stockDeductedAt: isCod ? new Date() : null,
      },
    });

    if (isCod) {
      // Lock + take stock BEFORE inserting the items (inserting them also touches the stock
      // rows). Re-checked under lock: someone may have taken the last piece since the early check.
      const shortages = await takeStock(tx, lines, order.id);
      if (shortages.length) throw outOfStock(shortages); // rolls back the whole order
    }

    await tx.orderItem.createMany({
      data: lines.map((l) => ({
        orderId: order.id,
        variantId: l.variantId,
        quantity: l.quantity,
        priceAtSale: l.v.sellingPrice!,
        productName: l.v.product.name,
        sku: l.v.sku,
        finish: l.v.finish,
        colour: l.v.colour,
        size: l.v.size,
      })),
    });

    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  }, TX_OPTIONS);
}


function outOfStock(shortages: Shortage[]) {
  const msg = shortages
    .map((s) => (s.available === 0 ? `${s.label} is sold out` : `Only ${s.available} left of ${s.label}`))
    .join("; ");
  return new DomainError("OUT_OF_STOCK", msg, { shortages });
}

// ------------------------------------------------------------
// JazzCash payment confirmed (called by Track 3's JazzCash callback)
// ------------------------------------------------------------

export type PaymentOutcome =
  | { outcome: "PAID"; order: OrderWithItems }
  | { outcome: "REFUND_NEEDED"; order: OrderWithItems; shortages: Shortage[] }
  | { outcome: "ALREADY_PROCESSED"; order: OrderWithItems };

export async function confirmJazzCashPayment(
  db: PrismaClient,
  input: { orderNumber: string; paymentRef: string; amountPaid: number | string },
): Promise<PaymentOutcome> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Order" WHERE "orderNumber" = ${input.orderNumber} FOR UPDATE`;
    if (!locked.length) throw new DomainError("NOT_FOUND", `Order ${input.orderNumber} not found`);
    const order = await tx.order.findUniqueOrThrow({ where: { id: locked[0].id }, include: orderInclude });

    if (order.paymentMethod !== "JAZZCASH") {
      throw new DomainError("INVALID_TRANSITION", "This is not a JazzCash order");
    }
    // JazzCash can send the same notification more than once — handle it once.
    if (order.paymentStatus !== "UNPAID") {
      if (order.paymentRef === input.paymentRef) return { outcome: "ALREADY_PROCESSED", order };
      throw new DomainError("INVALID_TRANSITION", `Order ${order.orderNumber} is already ${order.paymentStatus}`);
    }
    if (order.status !== "AWAITING_PAYMENT" && order.status !== "ABANDONED") {
      throw new DomainError("INVALID_TRANSITION", `Order ${order.orderNumber} is ${order.status}, not awaiting payment`);
    }
    if (!new Prisma.Decimal(input.amountPaid).equals(order.total)) {
      throw new DomainError(
        "AMOUNT_MISMATCH",
        `Paid ${input.amountPaid} but order ${order.orderNumber} total is ${order.total.toString()}`,
      );
    }

    const lines: StockLine[] = order.items.map((i) => ({
      variantId: i.variantId,
      quantity: i.quantity,
      label: variantLabel(i),
    }));
    const shortages = await takeStock(tx, lines, order.id);
    const now = new Date();

    if (!shortages.length) {
      const paid = await tx.order.update({
        where: { id: order.id },
        data: { status: "NEW", paymentStatus: "PAID", paidAt: now, paymentRef: input.paymentRef, stockDeductedAt: now },
        include: orderInclude,
      });
      return { outcome: "PAID", order: paid };
    }

    const refund = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        paymentStatus: "REFUND_NEEDED",
        paidAt: now,
        paymentRef: input.paymentRef,
        cancelledAt: now,
        cancelReason: `Sold out before payment completed: ${outOfStock(shortages).message}`,
      },
      include: orderInclude,
    });
    return { outcome: "REFUND_NEEDED", order: refund, shortages };
  }, TX_OPTIONS);
}

/** JazzCash orders never paid within 24h → ABANDONED (no stock involved). Run on a timer. */
export async function abandonUnpaidOrders(db: PrismaClient, now = new Date()) {
  const cutoff = new Date(now.getTime() - ABANDON_AFTER_HOURS * 3600_000);
  const res = await db.order.updateMany({
    where: { status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", createdAt: { lt: cutoff } },
    data: { status: "ABANDONED" },
  });
  return res.count;
}

// ------------------------------------------------------------
// Owner actions (admin panel)
// ------------------------------------------------------------

/** New → Processing → Shipped → Delivered. Forward only (skipping ahead is allowed). */
export async function updateOrderStatus(
  db: PrismaClient,
  input: { orderId: number; status: "PROCESSING" | "SHIPPED" | "DELIVERED" },
) {
  const order = await db.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new DomainError("NOT_FOUND", "Order not found");

  const from = FLOW.indexOf(order.status);
  const to = FLOW.indexOf(input.status);
  if (from === -1 || to <= from) {
    throw new DomainError("INVALID_TRANSITION", `Can't move an order from ${order.status} to ${input.status}`);
  }

  // COD money is collected on delivery
  const codCollected = input.status === "DELIVERED" && order.paymentMethod === "COD" && order.paymentStatus === "UNPAID";
  const res = await db.order.updateMany({
    where: { id: order.id, status: order.status }, // fails if someone else changed it meanwhile
    data: { status: input.status, ...(codCollected ? { paymentStatus: "PAID", paidAt: new Date() } : {}) },
  });
  if (res.count === 0) throw new DomainError("INVALID_TRANSITION", "Order was changed by someone else — please reload");
  return db.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
}

/** Cancel before shipping. Returns stock if it was taken; paid JazzCash orders become REFUND_NEEDED. */
export async function cancelOrder(db: PrismaClient, input: { orderId: number; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new DomainError("INVALID_INPUT", "Please give a reason for cancelling");

  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Order" WHERE id = ${input.orderId} FOR UPDATE`;
    if (!locked.length) throw new DomainError("NOT_FOUND", "Order not found");
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });

    if (!CANCELLABLE.includes(order.status)) {
      throw new DomainError("INVALID_TRANSITION", `A ${order.status.toLowerCase()} order can't be cancelled`);
    }
    if (order.stockDeductedAt) await returnStock(tx, order.id, reason);

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        cancelReason: reason,
        cancelledAt: new Date(),
        stockDeductedAt: null,
        ...(order.paymentStatus === "PAID" ? { paymentStatus: "REFUND_NEEDED" as const } : {}),
      },
      include: orderInclude,
    });
  }, TX_OPTIONS);
}

/** Owner has refunded the customer (e.g. via the JazzCash merchant portal). */
export async function markRefunded(db: PrismaClient, input: { orderId: number }) {
  const res = await db.order.updateMany({
    where: { id: input.orderId, paymentStatus: "REFUND_NEEDED" },
    data: { paymentStatus: "REFUNDED" },
  });
  if (res.count === 0) throw new DomainError("INVALID_TRANSITION", "This order is not waiting for a refund");
  return db.order.findUniqueOrThrow({ where: { id: input.orderId }, include: orderInclude });
}
