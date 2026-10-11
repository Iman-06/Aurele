# Track 2 (backend + admin) — pre-launch checklist

Brand is now **Aurelé** (files and identifiers use `Aurele`). Database is the shared Neon Postgres.

## My work

- [x] **1. Rename Lunara → Aurele** — download filenames (`Aurele_Inventory_…xlsx`, `Aurele_Subscribers_…xlsx`),
      Excel creator string, admin cookie name, README / API docs. *(Admin UI text already done by Iman in `aa5cfac`.)*
- [x] **2. Shared Neon DB setup** — Prisma migrations use `DIRECT_URL` (unpooled); tests stay on a local `*_test`
      DB and refuse to run against anything else.
- [x] **3. Change password in the admin** — Settings → "Change password" (current + new). Logs out other devices.
- [x] **4. Owner-editable settings** — announcement bar text, Instagram URL, support email, About blurb.
      Stored in `Setting`, edited in `/admin/settings`, served by a public store API.
- [x] **5. Orders: date filter + Excel export** — from/to date on the orders list; "Export to Excel" exports
      the currently filtered orders. *(Search by number/name/phone/email + status tabs already exist.)*
- [x] **6. `hasMultipleOptions` on the product list API** — true when more than one sellable variant
      (finish / colour / size).
- [x] **7. One of a Kind** — `isOneOfAKind Boolean @default(false)` on Product (team agreed), admin checkbox,
      returned on list + detail, `?oneOfAKind=true` filter. Migration applied to Neon with `migrate deploy`.
- [x] **8. Lint: Excel download links** — add `eslint-disable-next-line @next/next/no-html-link-for-pages`
      on the plain `<a>` download links (they must stay plain links so the file downloads).
- [x] **9. Admin on a phone — final check** — Iman already did the mobile admin layout (`aa5cfac`);
      I check every admin page at phone width and fix leftovers (wide tables, forms).
- [x] **10. Admin loading + not-found pages** — `loading.tsx` for the admin panel and an admin 404.

## Deferred (mine, not for launch)

- [ ] Unused arguments lint in the JazzCash routes — JazzCash is a month or two away; fix when it goes live.
- [ ] Discount codes.
- [ ] Customers list.

## Teammates' work (pass on)

- **Checkout (Track 3):** owner alert on new order (email exists in `src/server/email/templates/owner-notification.ts`;
  WhatsApp optional); lint error — state update in the checkout form.
- **Storefront (Track 1):** use `hasMultipleOptions` for Add vs Choose; read the new settings API instead of
  constants; One of a Kind badge + filter; storefront 404 / error / loading pages; policy pages.
