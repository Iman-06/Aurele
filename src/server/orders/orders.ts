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
export const MAX_ORDERS_PER_HOUR = 5; // per phone number or email
const MAX_PER_ITEM = 20; // per variant per order, after merging repeated lines
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
});
export type PlaceOrderInput = z.input<typeof placeOrderInput>;

/**
 * `opts.customerId` links the order to a signed-in customer account. It must come from the
 * server-side session — never from the request body.
 */
export async function placeOrder(db: PrismaClient, rawInput: PlaceOrderInput, opts: { customerId?: number } = {}): Promise<OrderWithItems> {
  const parsed = placeOrderInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new DomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid order", parsed.error.issues);
  }
  const input = parsed.data;

  // Abuse guard: COD orders take stock immediately, so a script placing fake orders could
  // empty the shop. Real customers never need more than a few orders an hour.
  const phoneDigits = input.customer.phone.replace(/\D/g, "").slice(-10);
  const since = new Date(Date.now() - 3600_000);
  const [recent] = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "Order"
    WHERE "createdAt" > ${since}
      AND (lower(email) = ${input.customer.email}
           OR right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${phoneDigits})`;
  if (Number(recent.n) >= MAX_ORDERS_PER_HOUR) {
    throw new DomainError("TOO_MANY_REQUESTS", "You've placed several orders in the last hour. Please contact us on WhatsApp to order more.");
  }

  // Same item added twice → one line
  const qtyByVariant = new Map<number, number>();
  for (const i of input.items) qtyByVariant.set(i.variantId, (qtyByVariant.get(i.variantId) ?? 0) + i.quantity);
  if ([...qtyByVariant.values()].some((q) => q > MAX_PER_ITEM)) {
    throw new DomainError("INVALID_INPUT", `You can order at most ${MAX_PER_ITEM} of one item`);
  }
  // Always handle items in id order — every transaction then locks stock rows in the
  // same order, which is what prevents two overlapping carts from deadlocking.
  const variantIds = [...qtyByVariant.keys()].sort((a, b) => a - b);

  const variants = await db.variant.findMany({ where: { id: { in: variantIds } }, include: { product: true } });
  const byId = new Map(variants.map((v) => [v.id, v]));

  // Hidden / unpriced / deleted items: don't reveal their names (could be unreleased designs).
  const notPurchasable = variantIds.filter((id) => {
    const v = byId.get(id);
    return !v || !v.isActive || !v.product.isActive || v.sellingPrice === null;
  });
  if (notPurchasable.length) {
    throw new DomainError(
      "NOT_PURCHASABLE",
      notPurchasable.length === 1 ? "An item in your cart is no longer available" : "Some items in your cart are no longer available",
      { variantIds: notPurchasable },
    );
  }
  const threshold = await getNumberSetting(db, "low_stock_threshold");

  const lines: (StockLine & { v: (typeof variants)[number] })[] = variantIds.map((id) => {
    const v = byId.get(id)!;
    return { variantId: id, quantity: qtyByVariant.get(id)!, label: variantLabel({ ...v, productName: v.product.name }), v };
  });

  // Early check for both methods — for JazzCash this stops people paying for something already gone.
  const early: Shortage[] = lines
    .filter((l) => l.v.quantity < l.quantity)
    .map((l) => ({ variantId: l.variantId, label: l.label, requested: l.quantity, available: l.v.quantity }));
  if (early.length) throw outOfStock(early, threshold);

  const subtotal = lines.reduce((sum, l) => sum.add(l.v.sellingPrice!.mul(l.quantity)), new Prisma.Decimal(0));
  const shippingFee = new Prisma.Decimal(await getNumberSetting(db, "shipping_fee"));
  const isCod = input.paymentMethod === "COD";

  return db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        customerId: opts.customerId,
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
      if (shortages.length) throw outOfStock(shortages, threshold); // rolls back the whole order
    }

    await tx.orderItem.createMany({
      data: lines.map((l) => ({
        orderId: order.id,
        variantId: l.variantId,
        quantity: l.quantity,
        priceAtSale: l.v.sellingPrice!,
        costAtSale: l.v.costPrice,
        productName: l.v.product.name,
        sku: l.v.sku,
        finish: l.v.finish,
        colour: l.v.colour,
        size: l.v.size,
      })),
    });
    await tx.orderEvent.create({
      data: { orderId: order.id, type: "PLACED", actor: "customer", message: isCod ? "Cash on Delivery" : "JazzCash — waiting for payment" },
    });

    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  }, TX_OPTIONS);
}


/**
 * Customer-facing (threshold given): exact counts are only revealed at or below the low-stock
 * limit — the same rule as "Only N left" — so stock levels can't be probed with huge quantities.
 * Admin/internal (no threshold): always exact.
 */
function outOfStock(shortages: Shortage[], threshold?: number) {
  const visible = (n: number) => threshold === undefined || n <= threshold;
  const msg = shortages
    .map((s) =>
      s.available === 0
        ? `${s.label} is sold out`
        : visible(s.available)
          ? `Only ${s.available} left of ${s.label}`
          : `Not enough stock of ${s.label} — please choose a smaller quantity`,
    )
    .join("; ");
  return new DomainError("OUT_OF_STOCK", msg, {
    shortages: shortages.map((s) => ({ ...s, available: visible(s.available) ? s.available : null })),
  });
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
      await tx.orderEvent.create({ data: { orderId: order.id, type: "PAID", actor: "JazzCash", message: `Paid ${order.total.toString()} · ref ${input.paymentRef}` } });
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
    await tx.orderEvent.create({
      data: { orderId: order.id, type: "REFUND_NEEDED", actor: "JazzCash", message: `Paid (ref ${input.paymentRef}) but ${outOfStock(shortages).message}. Refund the customer.` },
    });
    return { outcome: "REFUND_NEEDED", order: refund, shortages };
  }, TX_OPTIONS);
}


/** JazzCash orders never paid within 24h → ABANDONED (no stock involved). Run on a timer. */
export async function abandonUnpaidOrders(db: PrismaClient, now = new Date()) {
  const cutoff = new Date(now.getTime() - ABANDON_AFTER_HOURS * 3600_000);
  return db.$transaction(async (tx) => {
    const stale = await tx.order.findMany({
      where: { status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", createdAt: { lt: cutoff } },
      select: { id: true },
    });
    if (!stale.length) return 0;
    const ids = stale.map((o) => o.id);
    const res = await tx.order.updateMany({ where: { id: { in: ids }, status: "AWAITING_PAYMENT" }, data: { status: "ABANDONED" } });
    await tx.orderEvent.createMany({
      data: ids.map((orderId) => ({ orderId, type: "ABANDONED" as const, actor: "system", message: `Not paid within ${ABANDON_AFTER_HOURS} hours` })),
    });
    return res.count;
  });
}

// ------------------------------------------------------------
// Owner actions (admin panel). `actor` = the admin's email, shown in the timeline.
// ------------------------------------------------------------

export const COURIERS = ["TCS", "Leopards", "M&P", "PostEx", "Trax", "Call Courier", "BlueEx", "Pakistan Post", "Other"] as const;

export const deliveryInput = z
  .object({
    method: z.enum(["OWN", "COURIER"], { error: "Choose own delivery or a courier" }),
    courier: z.string().trim().max(60).optional().transform((v) => v || null),
    trackingNumber: z.string().trim().max(60).optional().transform((v) => v || null),
    riderInfo: z.string().trim().max(120).optional().transform((v) => v || null),
  })
  .superRefine((d, ctx) => {
    if (d.method === "COURIER" && !d.courier) ctx.addIssue({ code: "custom", message: "Choose the courier company" });
  })
  .transform((d) =>
    d.method === "OWN"
      ? { deliveryMethod: "OWN" as const, courier: null, trackingNumber: null, riderInfo: d.riderInfo }
      : { deliveryMethod: "COURIER" as const, courier: d.courier, trackingNumber: d.trackingNumber, riderInfo: null },
  );
export type DeliveryInput = z.input<typeof deliveryInput>;

function parseDelivery(raw: unknown) {
  const r = deliveryInput.safeParse(raw ?? {}); // nothing chosen → "Choose own delivery or a courier"
  if (!r.success) throw new DomainError("INVALID_INPUT", r.error.issues[0]?.message ?? "Invalid delivery details");
  return r.data;
}

function describeDelivery(d: ReturnType<typeof parseDelivery>) {
  if (d.deliveryMethod === "OWN") return `Own delivery${d.riderInfo ? ` (${d.riderInfo})` : ""}`;
  return `${d.courier}${d.trackingNumber ? ` · tracking ${d.trackingNumber}` : " · no tracking number yet"}`;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  NEW: "New",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  ABANDONED: "Abandoned",
};

/**
 * New → Processing → Shipped → Delivered. Forward only (skipping ahead is allowed).
 * Marking Shipped needs the delivery details (own delivery, or courier + optional tracking).
 */
export async function updateOrderStatus(
  db: PrismaClient,
  input: { orderId: number; status: "PROCESSING" | "SHIPPED" | "DELIVERED"; delivery?: unknown },
  actor = "admin",
) {
  const order = await db.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new DomainError("NOT_FOUND", "Order not found");

  const from = FLOW.indexOf(order.status);
  const to = FLOW.indexOf(input.status);
  if (from === -1 || to <= from) {
    throw new DomainError("INVALID_TRANSITION", `Can't move an order from ${STATUS_LABEL[order.status]} to ${STATUS_LABEL[input.status]}`);
  }

  const now = new Date();
  const delivery = input.status === "SHIPPED" ? parseDelivery(input.delivery) : null;
  const data: Prisma.OrderUpdateManyMutationInput = { status: input.status };
  if (delivery) Object.assign(data, delivery, { shippedAt: now });
  if (input.status === "DELIVERED") {
    data.deliveredAt = now;
    if (!order.shippedAt) data.shippedAt = now;
    // COD money is collected on delivery
    if (order.paymentMethod === "COD" && order.paymentStatus === "UNPAID") Object.assign(data, { paymentStatus: "PAID", paidAt: now });
  }

  return db.$transaction(async (tx) => {
    const res = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data }); // fails if changed meanwhile
    if (res.count === 0) throw new DomainError("INVALID_TRANSITION", "Order was changed by someone else — please reload");
    const extra = delivery
      ? ` — ${describeDelivery(delivery)}`
      : input.status === "DELIVERED" && order.paymentMethod === "COD"
        ? " — cash collected"
        : "";
    await tx.orderEvent.create({
      data: { orderId: order.id, type: "STATUS_CHANGED", actor, message: `${STATUS_LABEL[order.status]} → ${STATUS_LABEL[input.status]}${extra}` },
    });
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  });
}

/** Change delivery details after shipping (e.g. add the courier's tracking number later). */
export async function updateDelivery(db: PrismaClient, input: { orderId: number; delivery: unknown }, actor = "admin") {
  const delivery = parseDelivery(input.delivery);
  const order = await db.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new DomainError("NOT_FOUND", "Order not found");
  if (order.status !== "SHIPPED" && order.status !== "DELIVERED") {
    throw new DomainError("INVALID_TRANSITION", "Delivery details can be added once the order is shipped");
  }
  return db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: delivery });
    await tx.orderEvent.create({ data: { orderId: order.id, type: "SHIPPING_UPDATED", actor, message: describeDelivery(delivery) } });
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  });
}

/** Cancel before shipping. Returns stock if it was taken; paid JazzCash orders become REFUND_NEEDED. */
export async function cancelOrder(db: PrismaClient, input: { orderId: number; reason: string }, actor = "admin") {
  const reason = input.reason.trim();
  if (!reason) throw new DomainError("INVALID_INPUT", "Please give a reason for cancelling");

  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Order" WHERE id = ${input.orderId} FOR UPDATE`;
    if (!locked.length) throw new DomainError("NOT_FOUND", "Order not found");
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });

    if (!CANCELLABLE.includes(order.status)) {
      throw new DomainError("INVALID_TRANSITION", `A ${STATUS_LABEL[order.status].toLowerCase()} order can't be cancelled`);
    }
    if (order.stockDeductedAt) await returnStock(tx, order.id, reason);
    const refund = order.paymentStatus === "PAID";

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        cancelReason: reason,
        cancelledAt: new Date(),
        stockDeductedAt: null,
        ...(refund ? { paymentStatus: "REFUND_NEEDED" as const } : {}),
      },
      include: orderInclude,
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "CANCELLED",
        actor,
        message: `${reason}${order.stockDeductedAt ? " — items returned to stock" : ""}${refund ? " — refund needed" : ""}`,
      },
    });
    return updated;
  }, TX_OPTIONS);
}

/** Owner has refunded the customer (e.g. via the JazzCash merchant portal). */
export async function markRefunded(db: PrismaClient, input: { orderId: number; note?: string }, actor = "admin") {
  return db.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: input.orderId, paymentStatus: "REFUND_NEEDED" },
      data: { paymentStatus: "REFUNDED" },
    });
    if (res.count === 0) throw new DomainError("INVALID_TRANSITION", "This order is not waiting for a refund");
    await tx.orderEvent.create({ data: { orderId: input.orderId, type: "REFUNDED", actor, message: input.note?.trim() || null } });
    return tx.order.findUniqueOrThrow({ where: { id: input.orderId }, include: orderInclude });
  });
}

/** Internal note on the order timeline (never shown to the customer). */
export async function addOrderNote(db: PrismaClient, input: { orderId: number; note: string }, actor = "admin") {
  const note = input.note.trim();
  if (!note) throw new DomainError("INVALID_INPUT", "Write a note first");
  if (note.length > 2000) throw new DomainError("INVALID_INPUT", "Note is too long");
  const exists = await db.order.findUnique({ where: { id: input.orderId }, select: { id: true } });
  if (!exists) throw new DomainError("NOT_FOUND", "Order not found");
  return db.orderEvent.create({ data: { orderId: input.orderId, type: "NOTE", actor, message: note } });
}
