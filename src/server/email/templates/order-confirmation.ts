import type { OrderWithItems } from "@/server/orders/orders";
import { formatRs } from "@/lib/format";
import { variantLabel } from "@/server/inventory/stock";

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

  const itemsHtml = order.items
    .map((item) => {
      const lineTotal = Number(item.priceAtSale) * item.quantity;
      const label = variantLabel(item);
      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4dcd2;">
            <div style="font-weight: 500; color: #141414;">${item.productName}</div>
            <div style="font-size: 12px; color: #8a8178; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px;">
              ${label} &times; ${item.quantity}
            </div>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4dcd2; text-align: right; vertical-align: top; color: #141414; font-variant-numeric: tabular-nums;">
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
  <title>Your Aurele Order #${order.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f1ea; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #141414; line-height: 1.5;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e4dcd2; border-radius: 4px; overflow: hidden;">
    
    <!-- Header -->
    <div style="padding: 32px 32px 24px; border-bottom: 1px solid #e4dcd2; text-align: center; background-color: #fbf8f4;">
      <h1 style="margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.42em; text-transform: uppercase; color: #141414;">AURELE</h1>
      <p style="margin: 6px 0 0; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #b8956c;">Fine Jewelry &middot; Lahore</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 500; color: #141414;">Thank you for your order, ${order.customerName}.</h2>
      <p style="margin: 0 0 24px; font-size: 14px; color: #8a8178; line-height: 1.6;">
        We have received your order <strong>#${order.orderNumber}</strong>. Our studio is preparing your pieces with care. Standard delivery across Pakistan takes 3 to 5 working days.
      </p>

      <!-- Order Summary Card -->
      <div style="background-color: #fbf8f4; border: 1px solid #e4dcd2; border-radius: 4px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8178;">Order #${order.orderNumber}</h3>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${itemsHtml}
        </table>

        <div style="margin-top: 16px; padding-top: 16px; font-size: 14px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #8a8178;">Subtotal</span>
            <span style="font-weight: 500;">${subtotalFormatted}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #8a8178;">Shipping (Standard)</span>
            <span style="font-weight: 500;">${shippingFormatted}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e4dcd2; font-size: 16px; font-weight: 600;">
            <span>Total</span>
            <span style="color: #141414;">${totalFormatted}</span>
          </div>
        </div>
      </div>

      <!-- Shipping & Payment Details -->
      <div style="display: table; width: 100%; font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
        <div style="display: table-cell; width: 50%; padding-right: 12px; vertical-align: top;">
          <div style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #8a8178; margin-bottom: 6px;">Delivery Address</div>
          <div style="font-weight: 500; color: #141414;">${order.customerName}</div>
          <div style="color: #141414;">${order.address}</div>
          <div style="color: #141414;">${order.city}${order.postalCode ? `, ${order.postalCode}` : ""}</div>
          <div style="color: #8a8178; margin-top: 4px;">Phone: ${order.phone}</div>
        </div>
        <div style="display: table-cell; width: 50%; padding-left: 12px; vertical-align: top;">
          <div style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #8a8178; margin-bottom: 6px;">Payment Method</div>
          <div style="font-weight: 500; color: #141414;">${paymentText}</div>
        </div>
      </div>

      <!-- Assistance Footer -->
      <div style="border-top: 1px solid #e4dcd2; padding-top: 20px; font-size: 12px; color: #8a8178; text-align: center;">
        If you have any questions or wish to amend your order, please reply to this email.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
AURELE — Fine Jewelry

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

Estimated delivery is 3 to 5 business days across Pakistan.
If you have questions about your order, please reply to this email.
  `.trim();

  return {
    subject: `Order Confirmed #${order.orderNumber} — Aurele`,
    html,
    text,
  };
}
