import type { PrismaClient } from "@/generated/prisma/client";
import type { OrderWithItems } from "@/server/orders/orders";
import { renderCustomerOrderConfirmation } from "./templates/order-confirmation";
import { renderOwnerOrderNotification } from "./templates/owner-notification";

interface ResendPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

async function callResend(apiKey: string, payload: ResendPayload): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Resend API HTTP ${res.status}: ${errorBody}`);
  }

  return (await res.json()) as { id: string };
}

/**
 * Sends customer order confirmation and store owner notification emails via Resend.
 *
 * Designed to NEVER break order creation:
 * - Missing API key is logged as a warning.
 * - Network or provider errors are logged and recorded to OrderEvent (timeline).
 * - The function never rejects or throws to the checkout caller.
 */
export async function sendOrderCreatedEmails(order: OrderWithItems, db?: PrismaClient): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "orders@aurele.pk";
  const ownerEmail = process.env.ORDER_NOTIFICATION_EMAIL;

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY is not configured. Email skipped for order #${order.orderNumber}.`,
    );
    return;
  }

  // 1. Send confirmation email to customer
  try {
    const customerContent = renderCustomerOrderConfirmation(order);
    await callResend(apiKey, {
      from: fromEmail,
      to: order.email,
      subject: customerContent.subject,
      html: customerContent.html,
      text: customerContent.text,
    });
    console.info(`[email] Order confirmation sent to ${order.email} (order #${order.orderNumber})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send customer confirmation for order #${order.orderNumber}:`, msg);

    if (db) {
      try {
        await db.orderEvent.create({
          data: {
            orderId: order.id,
            type: "NOTE",
            actor: "system",
            message: `Email delivery to customer failed: ${msg}`,
          },
        });
      } catch (logErr) {
        console.error("[email] Could not record email failure event:", logErr);
      }
    }
  }

  // 2. Send notification email to shop owner (if configured)
  if (ownerEmail) {
    try {
      const ownerContent = renderOwnerOrderNotification(order);
      await callResend(apiKey, {
        from: fromEmail,
        to: ownerEmail,
        subject: ownerContent.subject,
        html: ownerContent.html,
        text: ownerContent.text,
      });
      console.info(`[email] Owner notification sent to ${ownerEmail} (order #${order.orderNumber})`);
    } catch (err) {
      console.error(
        `[email] Failed to send owner notification for order #${order.orderNumber}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/**
 * Extension point for future SMS notifications (e.g. via local Pakistani SMS gateway).
 */
export async function sendOrderSmsNotification(_order: OrderWithItems): Promise<void> {
  // Hook for SMS provider (e.g. TeleStax / Zong / BrandSMS)
}

/**
 * Extension point for future WhatsApp business notifications.
 */
export async function sendOrderWhatsAppNotification(_order: OrderWithItems): Promise<void> {
  // Hook for WhatsApp Cloud API
}
