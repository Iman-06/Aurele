# Aurelé admin — owner's guide

Sign in at **`/admin`** (e.g. `https://yourdomain.pk/admin`). Five wrong passwords lock the login for 15 minutes. To change your password, use **Settings → Change password**. Forgot it completely? A developer runs `npm run admin:create` with your email to set a new one (this signs you out on every device).

## Dashboard
The home page shows what needs attention (refunds, new orders, out-of-stock and low-stock items, items without a price, designs without photos) — click any box to go straight there. Below: sales, orders, average order, **gross profit** (sales minus the cost price at the time of sale), a daily sales chart, best sellers and the latest orders for the last 7 / 30 / 90 days. Cancelled and unpaid orders never count as sales.

## Getting products online
An item appears on the website only when **(1)** its design is *Visible*, **(2)** the item has a **selling price**, and **(3)** it is in stock.

- **Products → open a design → Price by finish:** one price for every colour and size of Gold (or Silver) at once. Change a single row's price underneath if one colour costs more.
- **Add a finish / colour / size** at the bottom of a design. New colours copy their finish's price.
- **Photos:** always upload through this admin, not through cloudinary.com. The admin sends the file to Cloudinary and attaches it to the design. Open the design, then **Photos**: choose a JPG, PNG, or WebP up to 5 MB, set **Finish** (Gold, Silver, or Any) and **Colour** (or Any), add an optional description, and click **Upload photo**. The arrows reorder the photos. The first photo is the one on the product card. **Delete** removes it from the product and from Cloudinary. Use square photos around 1200×1200; they are resized automatically. Everything you upload goes to the shared database and shows on the real website, so upload real photos only. The dashboard box **designs without photos** links to whatever is still missing.
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
- **Find orders:** search by order number, name, phone, email or tracking number, and pick **From / To** dates (Pakistan time). **Clear filters** shows everything again.
- **Export to Excel** downloads the orders you're looking at (same tab, search and dates): an *Orders* sheet with one row per order (address, phone, items, totals — handy for courier bookings) and an *Items* sheet with one row per piece (price, cost and profit — for accounts). Cancelled orders are included when the tab shows them; check the *Status* column.
- Use **Call / WhatsApp / Email** on the order to contact the customer, **notes** for anything the team should know (customers never see them), and **Print packing slip** for the parcel.

## Homepage
**Homepage** controls the website's main banner and promotion strip.
- **Banner:** upload a wide photo, and optionally a tall photo for phones. Write a heading, subheading and button, then tick *Show the banner on the website*. Untick it to hide the banner without losing it. Upload the banner here too, not on cloudinary.com.
- **Promotions:** add a headline (e.g. "Eid Sale — 20% off earrings"), an optional extra line and button link, and optional **start/end dates** (Pakistan time). A scheduled promotion appears and disappears by itself — you can set up a sale days in advance. *Live now / Scheduled / Ended / Switched off* shows each one's state. If two are live at once, the newer one shows.
- Links: start with `/` for a page on the site (e.g. `/category/earrings`) or paste a full `https://` address (e.g. your Instagram).

## Mailing list
**Subscribers** shows everyone who signed up in the website footer. **Export to Excel** to use with an email tool. **Remove** someone who asks to unsubscribe.

## Settings
Shipping fee (flat, anywhere in Pakistan) and the low-stock limit ("Only N left" shows at or below this number).

**Store details:** the announcement bar at the top of the website, your Instagram link, the support email customers see on the policy pages, and the About text in the footer. Changes show on the website straight away. If the announcement, Instagram, or About box is left empty, the website keeps its built-in wording. An empty support email hides the email link on the returns page.

## For the developer
Photo uploads need the `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` values in `.env` (or one `CLOUDINARY_URL`). The computer’s clock has to be correct, or Cloudinary rejects the upload. Without those values, a photo is saved only on that laptop and will not appear on the live site.

**Change password:** Settings → Change password (current password + new one twice). You stay signed in on this device; every other device is signed out. **Sign out everywhere** is there too, for a lost phone.
