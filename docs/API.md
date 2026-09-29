# Lunara API — for the storefront (Track 1) and checkout (Track 3)

All endpoints return JSON. Prices are in **PKR** as plain numbers. Errors always look like:

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "Aveline Pearl Drop — Gold, Blue is sold out", "details": { } } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `INVALID_INPUT` | bad query/body — show `message` next to the form |
| 404 | `NOT_FOUND` | unknown product/order |
| 409 | `OUT_OF_STOCK`, `NOT_PURCHASABLE` | someone bought it / owner hid it — show `message`, refresh the cart |
| 500 | `SERVER_ERROR` | generic "please try again" |

You can also call the functions directly from Server Components / Server Actions instead of `fetch` — each endpoint is a thin wrapper over a function in `src/server/` (named below).

**Rules the backend already enforces** (don't re-implement): only priced + active items are visible; sold-out combinations are never offered; stock is never reserved; COD takes stock when placed, JazzCash when paid; prices always come from the database; the SKU is never exposed.

---

## Storefront (Track 1)

### `GET /api/products` — shop, category, search, New Arrivals
`listProducts()` in `src/server/catalog/catalog.ts`

Query (all optional): `category` (`earrings` · `rings` · `bracelets` · `necklace`), `q` (search name/description), `finish` (`gold`/`silver`), `colour`, `minPrice`, `maxPrice`, `inStock=true`, `newArrivals=true`, `sort` (`newest` default · `price_asc` · `price_desc` · `name`), `page` (1…), `pageSize` (≤ 48, default 24).

```json
{
  "items": [{
    "id": 3, "slug": "aveline-pearl-drop-ear-001", "name": "Aveline Pearl Drop", "category": "EARRINGS",
    "isNewArrival": false, "priceFrom": 2200, "priceTo": 2500,
    "finishes": ["GOLD", "SILVER"], "colours": ["Green", "Blue"],
    "inStock": true, "image": { "url": "…", "alt": "Aveline Pearl Drop — Gold — Blue" }
  }],
  "total": 9, "page": 1, "pageSize": 24, "totalPages": 1
}
```
Sold-out designs are included (`inStock: false`, sorted last) — show "Out of Stock". Use `?inStock=true` to hide them.

### `GET /api/products/{slug}` — product page
`getProductDetail()` — 404 if the design is hidden or has nothing priced.

```json
{
  "name": "Aveline Pearl Drop", "category": "EARRINGS", "priceFrom": 2500, "priceTo": 2500,
  "inStock": true,
  "showFinishSelector": true,
  "finishes": [{
    "finish": "GOLD", "label": "Gold",
    "showColourSelector": true,
    "colours": [{
      "colour": "Blue",
      "images": [{ "url": "…", "alt": "…" }],
      "showSizeSelector": false,
      "variants": [{ "variantId": 12, "size": "", "price": 2500, "stock": { "status": "LOW_STOCK", "left": 2 } }]
    }]
  }],
  "images": [ ]
}
```
How to render:
1. Show the Finish selector only if `showFinishSelector`; otherwise pre-select `finishes[0]`.
2. For the chosen finish, show the Colour selector only if `showColourSelector`; otherwise pre-select `colours[0]`. `"None / Single"` means "no colour" — never display that text.
3. Rings (`showSizeSelector`): pick a size from `variants` (sorted, "Adjustable" last). Otherwise use `variants[0]`.
4. The chosen `variant` gives `variantId` (put this in the cart), `price` and `stock`: `LOW_STOCK` → **"Only {left} left"**, `IN_STOCK` → nothing.
5. Swap the gallery to `colours[i].images` when the finish/colour changes.
6. `inStock: false` → show "Out of Stock", no Add to Cart (`finishes` is empty).

### `POST /api/cart/validate` — refresh a saved cart
`validateCart()`. Keep the cart in `localStorage` as `[{ variantId, quantity, price }]` (price = what the customer saw). Call this when the cart/checkout page opens.

Body: `{ "items": [{ "variantId": 12, "quantity": 2, "price": 2500 }] }`

Each line returns `name`, `label` ("Aveline Pearl Drop — Gold, Blue"), `finish`, `colour`, `size`, `image`, `unitPrice`, `quantity` (clamped to what's available), `lineTotal`, `stock`, `priceChanged`, and `problem`:
`null` · `"OUT_OF_STOCK"` · `"QUANTITY_REDUCED"` · `"UNAVAILABLE"` (hidden/unpriced/deleted — remove it). Plus `subtotal`, `shippingFee` (Rs 250; 0 for an empty cart), `total`, `hasProblems`.

### `POST /api/subscribe` — footer mailing list
Body `{ "email": "…" }` → `200 { "ok": true }` (also for repeat sign-ups), `400` for an invalid email.

### `GET /api/store/settings`
`{ "currency": "PKR", "shippingFee": 250, "paymentMethods": ["COD", "JAZZCASH"] }`

---

## Checkout (Track 3)

### `POST /api/orders` — place an order
`placeOrder()` in `src/server/orders/orders.ts`

```json
{
  "items": [{ "variantId": 12, "quantity": 1 }],
  "customer": { "name": "Sara Ahmed", "email": "sara@example.com", "phone": "0321 1234567",
                "address": "12 Mall Road", "city": "Lahore", "postalCode": "54000" },
  "paymentMethod": "COD"
}
```
→ `201` with the order (no internal ids): `orderNumber`, `status`, `paymentMethod`, `paymentStatus`, `customer`, `items[] {name,label,finish,colour,size,quantity,unitPrice,lineTotal}`, `subtotal`, `shippingFee`, `total`.

- **COD** → `status: "NEW"`, stock already taken → show confirmation + send the confirmation email.
- **JAZZCASH** → `status: "AWAITING_PAYMENT"`, nothing taken → redirect to JazzCash with `orderNumber` as the bill reference and `total` as the amount.
- `409 OUT_OF_STOCK` → show `message`, send the customer back to the refreshed cart.

⚠️ Order numbers are sequential — **never** build a public "look up order by number" page without a secret token.

### JazzCash return / IPN handler (you build the route)
After verifying JazzCash's secure hash, for a **successful** payment call:

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
