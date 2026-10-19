import type { OrderWithItems } from "@/server/orders/orders";
import { formatRs } from "@/lib/format";
import { variantLabel } from "@/server/inventory/stock";
import { generateOrderToken } from "@/server/orders/order-token";

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function renderCustomerOrderConfirmation(order: OrderWithItems): EmailContent {
  const isCod = order.paymentMethod === "COD";
  const paymentText = isCod
    ? "Cash on Delivery (COD) — Please have the exact amount ready upon delivery."
    : "Online Payment (JazzCash)";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.aurele.pk";
  const token = generateOrderToken(order.orderNumber);
  const secureOrderUrl = `${siteUrl}/order/${order.orderNumber}?token=${encodeURIComponent(token)}`;

  const itemsHtml = order.items
    .map((item) => {
      const lineTotal = Number(item.priceAtSale) * item.quantity;
      const label = variantLabel(item);
      return `
        <tr>
          <td style="padding: 14px 0; border-bottom: 1px solid #e5e5e5;">
            <div style="font-weight: 500; color: #111111; font-size: 14px;">${item.productName}</div>
            <div style="font-size: 12px; color: #737373; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 3px;">
              ${label} &times; ${item.quantity}
            </div>
          </td>
          <td style="padding: 14px 0; border-bottom: 1px solid #e5e5e5; text-align: right; vertical-align: top; color: #111111; font-variant-numeric: tabular-nums; font-size: 14px;">
            ${formatRs(lineTotal)}
          </td>
        </tr>
      `;
    })
    .join("");

  const itemsText = order.items
    .map((item) => {
      const lineTotal = Number(item.priceAtSale) * item.quantity;
      const label = variantLabel(item);
      return `- ${item.productName} (${label}) x ${item.quantity}: ${formatRs(lineTotal)}`;
    })
    .join("\n");

  const subtotalFormatted = formatRs(order.subtotal);
  const shippingFormatted = formatRs(order.shippingFee);
  const totalFormatted = formatRs(order.total);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Aurelé Order #${order.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111111; line-height: 1.5;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 2px; overflow: hidden;">
    
    <!-- Header -->
    <div style="padding: 36px 32px 28px; border-bottom: 1px solid #e5e5e5; text-align: center; background-color: #ffffff;">
      <h1 style="margin: 0; font-size: 18px; font-weight: 500; letter-spacing: 0.35em; text-transform: uppercase; color: #111111;">AURELÉ</h1>
      <p style="margin: 6px 0 0; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #b8956c;">Fine Jewelry &middot; Lahore</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 400; color: #111111;">Thank you for your order, ${order.customerName}.</h2>
      <p style="margin: 0 0 24px; font-size: 14px; color: #737373; line-height: 1.6;">
        We have received your order <strong>#${order.orderNumber}</strong>. Our studio is preparing your pieces with care. Standard delivery across Pakistan takes 3 to 5 working days.
      </p>

      <!-- Order Summary Card -->
      <div style="background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 2px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #737373;">Order #${order.orderNumber}</h3>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${itemsHtml}
        </table>

        <div style="margin-top: 16px; padding-top: 16px; font-size: 14px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #737373;">Subtotal</span>
            <span style="font-weight: 500;">${subtotalFormatted}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #737373;">Shipping (Standard)</span>
            <span style="font-weight: 500;">${shippingFormatted}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 16px; font-weight: 600;">
            <span>Total</span>
            <span style="color: #111111;">${totalFormatted}</span>
          </div>
        </div>
      </div>

      <!-- Shipping & Payment Details -->
      <div style="display: table; width: 100%; font-size: 13px; line-height: 1.6; margin-bottom: 28px;">
        <div style="display: table-cell; width: 50%; padding-right: 12px; vertical-align: top;">
          <div style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #737373; margin-bottom: 6px;">Delivery Address</div>
          <div style="font-weight: 500; color: #111111;">${order.customerName}</div>
          <div style="color: #111111;">${order.address}</div>
          <div style="color: #111111;">${order.city}${order.postalCode ? `, ${order.postalCode}` : ""}</div>
          <div style="color: #737373; margin-top: 4px;">Phone: ${order.phone}</div>
        </div>
        <div style="display: table-cell; width: 50%; padding-left: 12px; vertical-align: top;">
          <div style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #737373; margin-bottom: 6px;">Payment Method</div>
          <div style="font-weight: 500; color: #111111;">${paymentText}</div>
        </div>
      </div>

      <!-- Secure Tracking Button -->
      <div style="text-align: center; margin: 32px 0 24px;">
        <a href="${secureOrderUrl}" style="display: inline-block; background-color: #111111; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 500;">
          View Order Status Online
        </a>
      </div>

      <!-- Assistance Footer -->
      <div style="border-top: 1px solid #e5e5e5; padding-top: 20px; font-size: 12px; color: #737373; text-align: center;">
        If you have questions or wish to amend your order, please reply to this email.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
AURELÉ — Fine Jewelry

Thank you for your order, ${order.customerName}!
Order Number: #${order.orderNumber}

ITEMS:
${itemsText}

Subtotal: ${subtotalFormatted}
Shipping: ${shippingFormatted}
Total: ${totalFormatted}

DELIVERY ADDRESS:
${order.customerName}
${order.address}
${order.city}${order.postalCode ? `, ${order.postalCode}` : ""}
Phone: ${order.phone}

PAYMENT:
${paymentText}

View your order status securely online:
${secureOrderUrl}

Estimated delivery is 3 to 5 business days across Pakistan.
If you have questions about your order, please reply to this email.
  `.trim();

  return {
    subject: `Order Confirmed #${order.orderNumber} — Aurelé`,
    html,
    text,
  };
}
