"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth/admin-session";
import { addOrderNote, cancelOrder, markRefunded, updateDelivery, updateOrderStatus } from "@/server/orders/orders";
import { run, type ActionState } from "../action-state";

const refresh = (orderId: number) => {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/inventory"); // cancellations return stock
};

const deliveryFrom = (fd: FormData) => ({
  method: fd.get("method") ?? undefined,
  courier: fd.get("courier") ?? undefined,
  trackingNumber: fd.get("trackingNumber") ?? undefined,
  riderInfo: fd.get("riderInfo") ?? undefined,
});

export async function setStatusAction(orderId: number, status: "PROCESSING" | "SHIPPED" | "DELIVERED", _s: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  return run(async () => {
    await updateOrderStatus(db, { orderId, status, delivery: status === "SHIPPED" ? deliveryFrom(fd) : undefined }, admin.email);
    refresh(orderId);
    return { PROCESSING: "Marked as processing", SHIPPED: "Marked as shipped", DELIVERED: "Marked as delivered" }[status];
  });
}

export async function updateDeliveryAction(orderId: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  return run(async () => {
    await updateDelivery(db, { orderId, delivery: deliveryFrom(fd) }, admin.email);
    refresh(orderId);
    return "Delivery details saved";
  });
}

export async function cancelOrderAction(orderId: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  return run(async () => {
    const o = await cancelOrder(db, { orderId, reason: String(fd.get("reason") ?? "") }, admin.email);
    refresh(orderId);
    return o.paymentStatus === "REFUND_NEEDED" ? "Cancelled — now refund the customer" : "Order cancelled";
  });
}

export async function markRefundedAction(orderId: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  return run(async () => {
    await markRefunded(db, { orderId, note: String(fd.get("note") ?? "") }, admin.email);
    refresh(orderId);
    return "Marked as refunded";
  });
}

export async function addNoteAction(orderId: number, _s: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  return run(async () => {
    await addOrderNote(db, { orderId, note: String(fd.get("note") ?? "") }, admin.email);
    revalidatePath(`/admin/orders/${orderId}`);
    return "Note added";
  });
}
