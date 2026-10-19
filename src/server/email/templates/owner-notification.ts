import type { OrderWithItems } from "@/server/orders/orders";
import { formatRs } from "@/lib/format";
import { variantLabel } from "@/server/inventory/stock";
import type { EmailContent } from "./order-confirmation";

export function renderOwnerOrderNotification(order: OrderWithItems): EmailContent {
  const itemsText = order.items
    .map((item) => `- ${item.productName} [SKU: ${item.sku}] (${variantLabel(item)}) x ${item.quantity}: ${formatRs(Number(item.priceAtSale) * item.quantity)}`)
    .join("\n");

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e5e5; font-size: 13px;">${item.productName} (${variantLabel(item)})</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e5e5; font-family: monospace; font-size: 12px; color: #737373;">${item.sku}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e5e5; text-align: center; font-size: 13px;">${item.quantity}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e5e5; text-align: right; font-variant-numeric: tabular-nums; font-size: 13px;">${formatRs(Number(item.priceAtSale) * item.quantity)}</td>
      </tr>
    `,
    )
    .join("");

  const totalFormatted = formatRs(order.total);

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111111; line-height: 1.5; padding: 24px; background-color: #fafafa;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e5e5; padding: 28px;">
    <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 600;">New Order Received: #${order.orderNumber}</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #737373;">
      <strong>Total:</strong> ${totalFormatted} &middot; Payment: <strong>${order.paymentMethod}</strong>
    </p>
    
    <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #737373; margin: 20px 0 8px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">Customer Details</h3>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
      <strong>Name:</strong> ${order.customerName}<br>
      <strong>Phone:</strong> ${order.phone}<br>
      <strong>Email:</strong> ${order.email}<br>
      <strong>Address:</strong> ${order.address}, ${order.city} ${order.postalCode ?? ""}
    </p>

    <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #737373; margin: 20px 0 8px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">Ordered Items</h3>
    <table style="width: 100%; border-collapse: collapse; text-align: left;">
      <thead>
        <tr style="background: #f5f5f5;">
          <th style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-size: 12px; font-weight: 500;">Item</th>
          <th style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-size: 12px; font-weight: 500;">SKU</th>
          <th style="padding: 8px; border-bottom: 1px solid #e5e5e5; text-align: center; font-size: 12px; font-weight: 500;">Qty</th>
          <th style="padding: 8px; border-bottom: 1px solid #e5e5e5; text-align: right; font-size: 12px; font-weight: 500;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div style="margin-top: 24px; text-align: center;">
      <a href="/admin/orders/${order.id}" style="display: inline-block; background-color: #111111; color: #ffffff; text-decoration: none; padding: 10px 20px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">
        Manage in Admin Panel
      </a>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
NEW ORDER RECEIVED: #${order.orderNumber}
Total: ${totalFormatted} (${order.paymentMethod})

CUSTOMER:
Name: ${order.customerName}
Phone: ${order.phone}
Email: ${order.email}
Address: ${order.address}, ${order.city} ${order.postalCode ?? ""}

ITEMS:
${itemsText}
  `.trim();

  return {
    subject: `[Aurelé] New Order #${order.orderNumber} — ${order.customerName} (${totalFormatted})`,
    html,
    text,
  };
}
