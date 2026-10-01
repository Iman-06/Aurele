import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// Admin order queries (list + detail). Mutations live in src/server/orders/orders.ts.

export const ORDER_TABS = [
  ["action", "Needs action"],
  ["processing", "Processing"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
  ["awaiting", "Awaiting payment"],
  ["abandoned", "Abandoned"],
  ["all", "All"],
] as const;
export type OrderTab = (typeof ORDER_TABS)[number][0];

const TAB_WHERE: Record<OrderTab, Prisma.OrderWhereInput> = {
  // New orders to pack + paid orders that must be refunded
  action: { OR: [{ status: "NEW" }, { paymentStatus: "REFUND_NEEDED" }] },
  processing: { status: "PROCESSING" },
  shipped: { status: "SHIPPED" },
  delivered: { status: "DELIVERED" },
  cancelled: { status: "CANCELLED" },
  awaiting: { status: "AWAITING_PAYMENT" },
  abandoned: { status: "ABANDONED" },
  all: {},
};

export const orderListQuery = z.object({
  tab: z.enum(ORDER_TABS.map((t) => t[0]) as [OrderTab, ...OrderTab[]]).default("action").catch("action"),
  q: z.string().trim().optional(),
  method: z.enum(["COD", "JAZZCASH"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

const PAGE_SIZE = 30;

export async function listAdminOrders(db: PrismaClient, query: z.input<typeof orderListQuery> = {}) {
  const q = orderListQuery.parse(query);
  const digits = q.q?.replace(/\D/g, "") ?? "";
  const search: Prisma.OrderWhereInput = q.q
    ? {
        OR: [
          { orderNumber: q.q.replace(/^#/, "") },
          { customerName: { contains: q.q, mode: "insensitive" } },
          { email: { contains: q.q, mode: "insensitive" } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits.slice(-7) } }] : []),
          { trackingNumber: { contains: q.q, mode: "insensitive" } },
        ],
      }
    : {};
  const base: Prisma.OrderWhereInput = { ...search, ...(q.method ? { paymentMethod: q.method } : {}) };
  const where: Prisma.OrderWhereInput = { AND: [base, TAB_WHERE[q.tab]] };

  const [orders, total, counts] = await Promise.all([
    db.order.findMany({
      where,
      include: { _count: { select: { items: true } }, items: { select: { quantity: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (q.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
    Promise.all(ORDER_TABS.map(async ([tab]) => [tab, await db.order.count({ where: { AND: [base, TAB_WHERE[tab]] } })] as const)),
  ]);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      customerName: o.customerName,
      city: o.city,
      phone: o.phone,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      status: o.status,
      total: Number(o.total),
      pieces: o.items.reduce((s, i) => s + i.quantity, 0),
      courier: o.courier,
      trackingNumber: o.trackingNumber,
    })),
    total,
    page: q.page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: Object.fromEntries(counts) as Record<OrderTab, number>,
    refundsNeeded: await db.order.count({ where: { paymentStatus: "REFUND_NEEDED" } }),
    query: q,
  };
}

export async function getAdminOrder(db: PrismaClient, id: number) {
  return db.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: "asc" }, include: { variant: { select: { productId: true, quantity: true } } } },
      events: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
      customer: { select: { id: true, email: true, name: true } },
    },
  });
}
export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;
