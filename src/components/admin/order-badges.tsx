import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/client";
import { badge } from "./ui";

const STATUS: Record<OrderStatus, [string, string]> = {
  AWAITING_PAYMENT: ["Awaiting payment", "bg-sky-50 text-sky-700"],
  NEW: ["New", "bg-violet-50 text-violet-700"],
  PROCESSING: ["Processing", "bg-amber-50 text-amber-800"],
  SHIPPED: ["Shipped", "bg-blue-50 text-blue-700"],
  DELIVERED: ["Delivered", "bg-emerald-50 text-emerald-700"],
  CANCELLED: ["Cancelled", "bg-stone-100 text-stone-600"],
  ABANDONED: ["Abandoned", "bg-stone-100 text-stone-500"],
};

const PAYMENT: Record<PaymentStatus, [string, string]> = {
  UNPAID: ["Unpaid", "bg-stone-100 text-stone-600"],
  PAID: ["Paid", "bg-emerald-50 text-emerald-700"],
  REFUND_NEEDED: ["Refund needed", "bg-red-100 text-red-800"],
  REFUNDED: ["Refunded", "bg-stone-100 text-stone-600"],
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const [text, color] = STATUS[status];
  return <span className={`${badge} ${color}`}>{text}</span>;
}

export function PaymentBadge({ method, status }: { method: PaymentMethod; status: PaymentStatus }) {
  const [text, color] = PAYMENT[status];
  return (
    <span className={`${badge} ${color}`}>
      {method === "COD" ? "COD" : "JazzCash"} · {text}
    </span>
  );
}

export const pkt = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
