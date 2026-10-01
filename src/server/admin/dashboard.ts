import type { Category, OrderStatus, PrismaClient } from "@/generated/prisma/client";
import { getNumberSetting } from "../settings";

// Owner dashboard numbers. All dates are Pakistan time (PKT, UTC+5, no daylight saving).
//
// A "sale" = an order that is really happening: COD placed, or JazzCash paid —
// i.e. status NEW / PROCESSING / SHIPPED / DELIVERED. Cancelled, abandoned and
// unpaid JazzCash orders are not sales. Sales are dated by when the order was placed.

export const SALE_STATUSES: OrderStatus[] = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED"];
export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

const TZ = "Asia/Karachi";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }); // → YYYY-MM-DD
const pktMidnight = (key: string) => new Date(`${key}T00:00:00+05:00`);

/** The last `days` calendar days in PKT, oldest first, ending today. */
export function periodDays(days: number, now = new Date()) {
  const today = dayKey.format(now);
  const start = pktMidnight(today);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey.format(new Date(start.getTime() - i * 86400_000 + 12 * 3600_000)));
  return { keys, from: pktMidnight(keys[0]) };
}

export async function getDashboard(db: PrismaClient, opts: { days?: number; now?: Date } = {}) {
  const days: Period = (PERIODS as readonly number[]).includes(opts.days ?? 30) ? (opts.days as Period) ?? 30 : 30;
  const now = opts.now ?? new Date();
  const { keys, from } = periodDays(days, now);
  const threshold = await getNumberSetting(db, "low_stock_threshold");

  // ---- alerts (always "right now", not tied to the period) ----
  const sellable = { isActive: true, product: { isActive: true } };
  const [refundsNeeded, newOrders, outOfStock, lowStock, unpriced, noPhotos, awaitingPayment] = await Promise.all([
    db.order.count({ where: { paymentStatus: "REFUND_NEEDED" } }),
    db.order.count({ where: { status: "NEW" } }),
    db.variant.count({ where: { ...sellable, quantity: 0 } }),
    db.variant.count({ where: { ...sellable, quantity: { gt: 0, lte: threshold } } }),
    db.variant.count({ where: { sellingPrice: null } }),
    db.product.count({ where: { isActive: true, images: { none: {} } } }),
    db.order.count({ where: { status: "AWAITING_PAYMENT" } }),
  ]);

  // ---- sales in the period ----
  const orders = await db.order.findMany({
    where: { status: { in: SALE_STATUSES }, createdAt: { gte: from } },
    include: { items: { include: { variant: { select: { productId: true, product: { select: { category: true } } } } } } },
    orderBy: { createdAt: "asc" },
  });

  const money = (d: { toString(): string } | null) => (d === null ? 0 : Number(d.toString()));
  const daily = new Map(keys.map((k) => [k, { day: k, orders: 0, sales: 0 }]));
  const byDesign = new Map<number, { productId: number; name: string; pieces: number; sales: number }>();
  const byCategory = new Map<Category, { category: Category; pieces: number; sales: number }>();
  const byMethod = { COD: { orders: 0, sales: 0 }, JAZZCASH: { orders: 0, sales: 0 } };

  let productSales = 0;
  let shipping = 0;
  let pieces = 0;
  let cost = 0;
  let salesWithCost = 0;
  let piecesWithoutCost = 0;

  for (const o of orders) {
    const subtotal = money(o.subtotal);
    productSales += subtotal;
    shipping += money(o.shippingFee);
    byMethod[o.paymentMethod].orders++;
    byMethod[o.paymentMethod].sales += subtotal;
    const d = daily.get(dayKey.format(o.createdAt));
    if (d) {
      d.orders++;
      d.sales += subtotal;
    }
    for (const i of o.items) {
      const line = money(i.priceAtSale) * i.quantity;
      pieces += i.quantity;
      if (i.costAtSale === null) piecesWithoutCost += i.quantity;
      else {
        cost += money(i.costAtSale) * i.quantity;
        salesWithCost += line;
      }
      const pid = i.variant.productId;
      const design = byDesign.get(pid) ?? { productId: pid, name: i.productName, pieces: 0, sales: 0 };
      design.pieces += i.quantity;
      design.sales += line;
      byDesign.set(pid, design);
      const cat = i.variant.product.category;
      const c = byCategory.get(cat) ?? { category: cat, pieces: 0, sales: 0 };
      c.pieces += i.quantity;
      c.sales += line;
      byCategory.set(cat, c);
    }
  }

  const recent = await db.order.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    select: { id: true, orderNumber: true, customerName: true, city: true, total: true, status: true, paymentMethod: true, paymentStatus: true, createdAt: true },
  });

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    days,
    from,
    alerts: { refundsNeeded, newOrders, outOfStock, lowStock, unpriced, noPhotos, awaitingPayment, threshold },
    totals: {
      orders: orders.length,
      productSales: round(productSales),
      shipping: round(shipping),
      revenue: round(productSales + shipping),
      averageOrder: orders.length ? round((productSales + shipping) / orders.length) : 0,
      pieces,
      // Profit only over items whose cost price was known when sold
      grossProfit: round(salesWithCost - cost),
      margin: salesWithCost ? Math.round(((salesWithCost - cost) / salesWithCost) * 1000) / 10 : null,
      piecesWithoutCost,
    },
    byMethod,
    daily: [...daily.values()].map((d) => ({ ...d, sales: round(d.sales) })),
    topDesigns: [...byDesign.values()].sort((a, b) => b.pieces - a.pieces || b.sales - a.sales).slice(0, 5),
    byCategory: [...byCategory.values()].sort((a, b) => b.sales - a.sales),
    recent: recent.map((r) => ({ ...r, total: money(r.total) })),
  };
}
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
