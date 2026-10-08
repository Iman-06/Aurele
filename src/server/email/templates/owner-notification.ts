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
        <td style="padding: 8px; border-bottom: 1px solid #e4dcd2;">${item.productName} (${variantLabel(item)})</td>
        <td style="padding: 8px; border-bottom: 1px solid #e4dcd2; font-family: monospace;">${item.sku}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e4dcd2; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e4dcd2; text-align: right;">${formatRs(Number(item.priceAtSale) * item.quantity)}</td>
      </tr>
    `,
    )
    .join("");

  const totalFormatted = formatRs(order.total);

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #141414; line-height: 1.5; padding: 20px;">
  <h2>New Order Received: #${order.orderNumber}</h2>
  <p><strong>Total:</strong> ${totalFormatted} (${order.paymentMethod})</p>
  
  <h3>Customer Details</h3>
  <p>
    <strong>Name:</strong> ${order.customerName}<br>
    <strong>Phone:</strong> ${order.phone}<br>
    <strong>Email:</strong> ${order.email}<br>
    <strong>Address:</strong> ${order.address}, ${order.city} ${order.postalCode ?? ""}
  </p>

  <h3>Items</h3>
  <table style="width: 100%; max-width: 600px; border-collapse: collapse; text-align: left; font-size: 14px;">
    <thead>
      <tr style="background: #fbf8f4;">
        <th style="padding: 8px; border-bottom: 2px solid #e4dcd2;">Item</th>
        <th style="padding: 8px; border-bottom: 2px solid #e4dcd2;">SKU</th>
        <th style="padding: 8px; border-bottom: 2px solid #e4dcd2; text-align: center;">Qty</th>
        <th style="padding: 8px; border-bottom: 2px solid #e4dcd2; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  <p style="margin-top: 20px;">
    Log in to the Admin Dashboard to manage fulfillment.
  </p>
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
    subject: `[New Order] #${order.orderNumber} - ${order.customerName} (${totalFormatted})`,
    html,
    text,
  };
}
