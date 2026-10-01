# Lunara admin — owner's guide

Sign in at **`/admin`** (e.g. `https://yourdomain.pk/admin`). Five wrong passwords lock the login for 15 minutes. Forgot the password? A developer runs `npm run admin:create` with your email to set a new one (this signs you out on every device).

## Dashboard
The home page shows what needs attention (refunds, new orders, out-of-stock and low-stock items, items without a price, designs without photos) — click any box to go straight there. Below: sales, orders, average order, **gross profit** (sales minus the cost price at the time of sale), a daily sales chart, best sellers and the latest orders for the last 7 / 30 / 90 days. Cancelled and unpaid orders never count as sales.

## Getting products online
An item appears on the website only when **(1)** its design is *Visible*, **(2)** the item has a **selling price**, and **(3)** it is in stock.

- **Products → open a design → Price by finish:** one price for every colour and size of Gold (or Silver) at once. Change a single row's price underneath if one colour costs more.
- **Add a finish / colour / size** at the bottom of a design. New colours copy their finish's price.
- **Photos:** tag each photo with its finish + colour so the right one shows when a customer picks it. Untagged photos are general. JPG/PNG/WebP, up to 5 MB.
- **Hide from website** keeps the design and its history but takes it off the shop. Untick *Visible* on a single row to mark just that colour/size sold out.
- **New Arrival** puts a design in the website's New Arrivals section.
- Designs/rows can only be **deleted if never sold** — otherwise hide them.

## Stock
**Inventory** lists every item. Filters: out of stock, low stock, hidden, no price.
- **+ Received** — a delivery arrived: type how many and press the button (adds on top).
- **Set** — after a physical count, type the exact number. If a sale happened while you were typing, it refuses and shows the real number — check and try again.
- **History** — every change: sales, cancellations, your edits, imports.
- **Export to Excel** — the whole inventory in the same layout as the original workbook.
- **Import from Excel** — upload the workbook, read the preview, then press Apply. Once orders exist, quantities from the sheet are **not** applied unless you tick the box (the website already counted those sales).

Website sales and cancellations update stock automatically — you never need to subtract sold items yourself.

## Orders
**Orders → Needs action** shows new orders to pack and anything waiting for a refund.
1. **Start packing** → *Processing*.
2. **Mark as shipped** — choose *Our own delivery* (optional rider name/phone) or a *Courier* (TCS, Leopards, …) and paste the courier's tracking number if you have it. You can add it later under *Edit delivery details*.
3. **Delivered** — for COD this also records the cash as collected.

- **Cancel** (before shipping) asks for a reason and puts the items back in stock.
- **JazzCash orders** appear once paid. If a customer paid for something that sold out meanwhile, or you cancel a paid order, it shows **Refund needed** in red: refund in the JazzCash merchant portal, then press **Mark refunded** (add the refund reference).
- Unpaid JazzCash orders wait under *Awaiting payment* (no stock held) and become *Abandoned* after 24 hours.
- Use **Call / WhatsApp / Email** on the order to contact the customer, **notes** for anything the team should know (customers never see them), and **Print packing slip** for the parcel.

## Mailing list
**Subscribers** shows everyone who signed up in the website footer. **Export to Excel** to use with an email tool. **Remove** someone who asks to unsubscribe.

## Settings
Shipping fee (flat, anywhere in Pakistan) and the low-stock limit ("Only N left" shows at or below this number).
