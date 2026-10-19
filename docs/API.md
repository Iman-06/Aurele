# Aurelé API — for the storefront (Track 1) and checkout (Track 3)

All endpoints return JSON. Prices are in **PKR** as plain numbers. Errors always look like:

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "Aveline Pearl Drop — Gold, Blue is sold out", "details": { } } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `INVALID_INPUT` | bad query/body — show `message` next to the form |
| 404 | `NOT_FOUND` | unknown product/order |
| 409 | `OUT_OF_STOCK`, `NOT_PURCHASABLE` | someone bought it / owner hid it — show `message`, refresh the cart |
| 429 | `TOO_MANY_REQUESTS` | more than 5 orders in an hour from the same phone or email — show `message` (it suggests WhatsApp) |
| 500 | `SERVER_ERROR` | generic "please try again" |

**Image URLs** (`image.url`, `images[].url`, banner photos) are either `https://res.cloudinary.com/<shop cloud>/…` (live photos) or `/media/…` (photos saved locally on a laptop without the Cloudinary keys). Both work with `next/image` — Cloudinary is allowed in `next.config.ts`.

You can also call the functions directly from Server Components / Server Actions instead of `fetch` — each endpoint is a thin wrapper over a function in `src/server/` (named below).

**Rules the backend already enforces** (don't re-implement): only priced + active items are visible; sold-out combinations are shown but can never be bought; stock is never reserved; COD takes stock when placed, JazzCash when paid; prices always come from the database; the SKU is never exposed.

---

## Storefront (Track 1)

### `GET /api/products` — shop, category, search, New Arrivals
`listProducts()` in `src/server/catalog/catalog.ts`

Query (all optional): `category` (`earrings` · `rings` · `bracelets` · `necklace`), `q` (search name/description), `finish` (`gold`/`silver`), `colour`, `minPrice`, `maxPrice`, `inStock=true`, `newArrivals=true`, `oneOfAKind=true` (only One of a Kind pieces), `sort` (`newest` default · `price_asc` · `price_desc` · `name`), `page` (1…), `pageSize` (≤ 48, default 24).

```json
{
  "items": [{
    "id": 3, "slug": "aveline-pearl-drop-ear-001", "name": "Aveline Pearl Drop", "category": "EARRINGS",
    "isNewArrival": false, "isOneOfAKind": false, "priceFrom": 2200, "priceTo": 2500,
    "finishes": ["GOLD", "SILVER"], "colours": ["Green", "Blue"],
    "inStock": true, "hasMultipleOptions": true, "image": { "url": "…", "alt": "Aveline Pearl Drop — Gold — Blue" }
  }],
  "total": 9, "page": 1, "pageSize": 24, "totalPages": 1
}
```
Sold-out designs are included (`inStock: false`, sorted last) — show "Out of Stock". Use `?inStock=true` to hide them.
`image` is the design's **cover photo** — the first photo in the owner's order in the admin (filters don't change it); `null` when it has no photos yet.
`hasMultipleOptions: true` → the design has more than one finish, colour or ring size: show **Choose** (link to the product page). `false` → a single option, so **Add** can put it straight in the cart. Sold-out options count too (the product page shows them greyed out); options without a price or switched off by the owner don't. List filters don't change it.

### `GET /api/products/{slug}` — product page
`getProductDetail()` — 404 if the design is hidden or has nothing priced.

```json
{
  "name": "Aveline Pearl Drop", "category": "EARRINGS", "isNewArrival": false, "isOneOfAKind": false, "priceFrom": 2500, "priceTo": 2500,
  "inStock": true,
  "showFinishSelector": true,
  "finishes": [{
    "finish": "GOLD", "label": "Gold", "inStock": true,
    "showColourSelector": true,
    "colours": [{
      "colour": "Blue", "inStock": true,
      "images": [{ "url": "…", "alt": "…" }],
      "showSizeSelector": false,
      "variants": [{ "variantId": 12, "size": "", "price": 2500, "stock": { "status": "LOW_STOCK", "left": 2 } }]
    }]
  }],
  "defaultVariantId": 12,
  "images": [ ]
}
```
**Sold-out options are included** (since 2026-10-11): every priced, switched-on finish / colour / size is listed, and
sold-out ones have `stock: { "status": "OUT_OF_STOCK" }` (and `inStock: false` on a finish or colour whose options are all sold out).
Show them **greyed out with "Sold out" and don't let the customer select them**. The cart check and checkout refuse them anyway.

How to render:
0. **Start on `defaultVariantId`** — the first in-stock option — not on index 0 (index 0 may be sold out). It is `null` when everything is sold out.
1. Show the Finish selector only if `showFinishSelector`; otherwise pre-select `finishes[0]`.
2. For the chosen finish, show the Colour selector only if `showColourSelector`; otherwise pre-select `colours[0]`. `"None / Single"` means "no colour" — never display that text.
3. Rings (`showSizeSelector`): pick a size from `variants` (sorted, "Adjustable" last). Otherwise use `variants[0]`.
4. The chosen `variant` gives `variantId` (put this in the cart), `price` and `stock`: `LOW_STOCK` → **"Only {left} left"**, `IN_STOCK` → nothing, `OUT_OF_STOCK` → "Sold out", Add to Cart disabled.
5. Swap the gallery to `colours[i].images` when the finish/colour changes.
6. `inStock: false` → show "Out of Stock", no Add to Cart. The options are still listed, all greyed.

### `POST /api/cart/validate` — refresh a saved cart
`validateCart()`. Keep the cart in `localStorage` as `[{ variantId, quantity, price }]` (price = what the customer saw). Call this when the cart/checkout page opens.

Body: `{ "items": [{ "variantId": 12, "quantity": 2, "price": 2500 }] }`

Each line returns `name`, `label` ("Aveline Pearl Drop — Gold, Blue"), `finish`, `colour`, `size`, `image`, `unitPrice`, `quantity` (clamped to what's available), `lineTotal`, `stock`, `priceChanged`, and `problem`:
`null` · `"OUT_OF_STOCK"` · `"QUANTITY_REDUCED"` · `"UNAVAILABLE"` (hidden/unpriced/deleted — remove it). Plus `subtotal`, `shippingFee` (Rs 250; 0 for an empty cart), `total`, `hasProblems`.

### `POST /api/subscribe` — footer mailing list
Body `{ "email": "…" }` → `200 { "ok": true }` (also for repeat sign-ups), `400` for an invalid email.

### `GET /api/store/home` — homepage banner + promotion
`getHomeContent()` in `src/server/content/homepage.ts`. The owner edits both in **/admin/homepage**; either can be `null` → don't render that section.

```json
{
  "banner": {
    "imageUrl": "/media/….jpg", "mobileImageUrl": "/media/….jpg",
    "heading": "The Eid Edit", "subheading": "Pearls and gold for every celebration",
    "button": { "text": "Shop now", "link": "/new-arrivals" }
  },
  "promotion": {
    "title": "Eid Sale — 20% off earrings", "details": "Ends Sunday",
    "link": { "text": "Shop the sale", "url": "/category/earrings" },
    "url": "/category/earrings", "endsAt": "2026-10-19T19:00:00.000Z"
  }
}
```
- `mobileImageUrl` falls back to `imageUrl` — use it below ~640px. `button` / `link` are `null` when the owner didn't add one; `promotion.url` can make the whole strip clickable.
- Links are always `/…` (this site) or `http(s)://` — safe to put in `href`.
- Scheduling is handled by the backend: a promotion appears and disappears on its own dates. The response changes over time, so don't cache it for long (a minute is fine).

### `GET /api/store/settings`
```json
{
  "currency": "PKR", "shippingFee": 250, "paymentMethods": ["COD", "JAZZCASH"],
  "announcement": "New pieces, made to be worn every day",
  "instagramUrl": "https://instagram.com/aurele",
  "supportEmail": "hello@aurele.pk",
  "aboutBlurb": "Aurelé is everyday elegance. …"
}
```
`announcement`, `instagramUrl`, `supportEmail` and `aboutBlurb` are edited by the owner in **Admin → Settings → Store details**.
Each is `null` when the owner left it empty — **hide that element** (announcement bar, Instagram icon, contact line, About block).
Server components can call `getStoreDetails(db)` from `src/server/settings.ts` directly instead of fetching —
this replaces the `ANNOUNCEMENT`, `INSTAGRAM_URL`, `ABOUT_BLURB` constants in `src/lib/storefront.ts` and `SUPPORT_EMAIL` in `src/lib/site.ts`.

---

## Checkout (Track 3)

### `POST /api/checkout` — place an order (what the checkout page calls)
`src/app/api/checkout/route.ts` → the payment provider for `paymentMethod` (`src/server/payments/`) → `placeOrder()`.

```json
{
  "items": [{ "variantId": 12, "quantity": 1 }],
  "customer": {
    "name": "Sara Ahmed",
    "email": "sara@example.com",
    "phone": "0321 1234567",
    "address": "12 Mall Road",
    "city": "Lahore",
    "postalCode": "54000"
  },
  "paymentMethod": "COD"
}
```
`postalCode` is optional (`null` or left out). Prices, totals and stock are always worked out on the server — never send prices.

→ `201`:
```json
{
  "order": {
    "orderNumber": "10001",
    "token": "4a7f23c91d84b5e28a903c7e411b9821",
    "status": "NEW",
    "paymentMethod": "COD",
    "paymentStatus": "UNPAID",
    "customer": { "name": "Sara Ahmed", "email": "sara@example.com", "phone": "0321 1234567",
                  "address": "12 Mall Road", "city": "Lahore", "postalCode": "54000" },
    "items": [{ "name": "Aveline Pearl Drop", "label": "Aveline Pearl Drop — Gold, Blue", "finish": "GOLD", "colour": "Blue",
                "size": "", "quantity": 1, "unitPrice": 2500, "lineTotal": 2500 }],
    "delivery": null,
    "subtotal": 2500, "shippingFee": 250, "total": 2750,
    "createdAt": "2026-10-17T10:15:00.000Z"
  },
  "next": { "type": "CONFIRMATION" }
}
```
- `next.type === "CONFIRMATION"` → clear the cart and go to **`/order/{orderNumber}?token={token}`**. (Later, JazzCash will answer
  `{ "type": "REDIRECT", "url": "…", "formFields": { … } }` → send the customer to the payment page.)
- **COD** (the only method switched on now): `status: "NEW"`, stock is taken immediately. The customer's confirmation
  email and the owner's new-order email are sent in the background (Resend; a failed email never fails the order).
- **JAZZCASH**: not available yet → `400 INVALID_INPUT` "JazzCash is not available yet. Please choose Cash on Delivery."
- Once the owner marks the order shipped, `delivery` becomes `{ "method": "OWN" | "COURIER", "courier", "trackingNumber", "shippedAt" }`
  (`trackingNumber` may be `null` — own delivery never has one).

- **`order.token`** — order numbers are sequential, so the confirmation page `/order/{orderNumber}` only shows the
  order with the matching `?token=` (an HMAC of the order number signed with `AUTH_SECRET`, `src/server/orders/order-token.ts`);
  without it → 404. Changing `AUTH_SECRET` makes old confirmation links stop working.

Errors (same body format as above):
- `400 INVALID_INPUT` — a form field is wrong; `message` says which, `details` has the field issues.
- `409 OUT_OF_STOCK` → show `message`, send the customer back to the refreshed cart. Exact numbers appear only at or below
  the low-stock limit ("Only 2 left of …"); above it the message says "Not enough stock … choose a smaller quantity".
- `409 NOT_PURCHASABLE` → an item was hidden/unpriced since it was added; `details.variantIds` lists which cart lines to remove.
- `429 TOO_MANY_REQUESTS` → more than 5 orders in an hour from the same phone or email.
- At most **20 of one item** per order (repeated lines are added together). Request bodies over 64 KB are rejected.
- Signed-in customers: link the order on the server from your session (`CreatePaymentContext.customerId`) — a
  `customerId` in the request body is ignored.

### `POST /api/orders` — low-level order placement (no emails)
Same body and errors as `/api/checkout`, but returns the bare order object (the `order` above, without `next`) and
sends **no** emails. Kept for scripts and tests — **the storefront should use `/api/checkout`**.

⚠️ Order numbers are sequential (10001, 10002, …) — anyone can guess them. Never show an order's customer details on a
page that only checks the order number — require the order `token` (see above).

### JazzCash return / IPN handler (Phase 5 — not live yet)
`/api/payments/jazzcash/return` and `/api/payments/jazzcash/ipn` exist as placeholders and answer `501` until the
official JazzCash documentation and sandbox credentials arrive. When building them: after verifying JazzCash's secure hash, for a **successful** payment call:

```ts
import { confirmJazzCashPayment } from "@/server/orders/orders";
const r = await confirmJazzCashPayment(db, { orderNumber, paymentRef: pp_TxnRefNo, amountPaid });
// r.outcome === "PAID"              → send confirmation email
// r.outcome === "REFUND_NEEDED"     → sold out meanwhile: tell the customer they'll be refunded (owner is alerted in admin)
// r.outcome === "ALREADY_PROCESSED" → duplicate notification, ignore
// throws AMOUNT_MISMATCH            → do NOT fulfil; log it for the owner
```
Failed/cancelled payments: do nothing — the order stays unpaid (customer may retry) and becomes `ABANDONED` after 24h.

### Scheduled job
`GET /api/cron/abandon-orders` with header `Authorization: Bearer $CRON_SECRET` — run hourly (e.g. Vercel Cron). Returns `{ "abandoned": n }`.
