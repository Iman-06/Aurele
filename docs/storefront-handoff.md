# Storefront handoff — cart

Checkout can build on the cart that is already in the browser. Prices charged on an order still come from the database. `priceAtAdd` is only what the customer saw.

## Store

`src/lib/cart-store.ts` — Zustand store `useCartStore`, persisted to `localStorage` under `aurele-cart`.

`src/lib/cart-types.ts` — the shared `CartItem` type. Safe to import from server or client code.

```ts
{
  variantId: number
  productId: number
  name: string
  finish: "GOLD" | "SILVER"
  colour: string       // "None / Single" means no colour — do not display that text
  size: string         // "" when it is not a ring
  photoRef: string | null
  quantity: number
  priceAtAdd: number   // display only — do not send this as the amount to charge
}
```

Actions: `addItem`, `removeItem`, `updateQuantity`, `clearCart`. `subtotal()` and `itemCount()` are computed from the stored lines. Selectors: `selectItems`, `selectSubtotal`, `selectItemCount`. Use `useCartHydrated()` before rendering a count, so the server render and the first client render agree.

`MAX_PER_ITEM` is 20 and `MAX_LINES` is 50, matching what `POST /api/orders` accepts.

## Cart page

Route: `/cart` (`src/app/(store)/cart/page.tsx`).

When the page opens, and again whenever a quantity changes, it `POST`s the stored lines to `/api/cart/validate` as `{ variantId, quantity, price: priceAtAdd }`. The response is what the page shows: current `unitPrice`, `subtotal`, `shippingFee` (Rs 250 when the cart is not empty), and `total`. If the server clamps a line (`QUANTITY_REDUCED`), that lower quantity is written back into the store. `OUT_OF_STOCK` and `UNAVAILABLE` lines stay visible with a message, and checkout stays blocked until they are removed.

Place the order from `items` as `{ variantId, quantity }` only. Ignore `priceAtAdd`.
