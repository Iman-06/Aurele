# Launch checklist

Everything that must be true before real customers use the site. Owner tasks are marked **(owner)**.

## 1. Content (owner)
- [ ] Every item has a **selling price** (Products → Price by finish). Unpriced items stay hidden.
- [ ] Photos uploaded and tagged by finish + colour.
- [ ] Cost prices filled in (needed for profit on the dashboard).
- [ ] Stock counted and correct (Inventory → Set / Import from Excel).
- [ ] Shipping fee and low-stock limit checked (Settings).

## 2. Hosting & database (Track 3 with Track 2)
- [ ] **Hosted PostgreSQL** (e.g. Neon or Supabase) — the laptop database is for development only. Turn on automatic **daily backups**.
- [ ] Host environment variables set (never commit them): `DATABASE_URL`, `AUTH_SECRET` (new, ≥ 32 chars — do **not** reuse the laptop one), `CRON_SECRET` (new). `TEST_DATABASE_URL` is not needed in production.
- [ ] Deploy runs `npm run db:deploy` (applies migrations) before starting.
- [ ] Production database seeded once: `npx prisma db seed` (settings + inventory import), then `npm run admin:create` for the owner's login.
- [ ] Site served over **HTTPS** only (admin cookie is `Secure` in production).

## 3. Photos → cloud storage (Track 2)
- [x] Cloudinary account created (theaurele.co@gmail.com).
- [x] `src/server/media/storage.ts` uploads to / deletes from Cloudinary when the `CLOUDINARY_*` keys are set (folders `aurele/products`, `aurele/homepage`).
- [x] `res.cloudinary.com/<cloud name>` allowed in `images.remotePatterns` (`next.config.ts`).
- [ ] Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` to the hosting environment variables.
- [ ] Any photos uploaded before the switch (`/media/…` URLs) exist only on the uploader's laptop — re-upload them in the admin.
- Hosting platforms like Vercel **do not keep files written to disk** — uploads would disappear without this step.

## 4. Scheduled job
- [ ] Hourly call to `GET /api/cron/abandon-orders` with header `Authorization: Bearer <CRON_SECRET>` (e.g. Vercel Cron in `vercel.json`). Marks unpaid JazzCash orders older than 24h as Abandoned.

## 5. Payments & email (Track 3)
- [ ] JazzCash merchant account live; callback verifies JazzCash's secure hash **before** calling `confirmJazzCashPayment()`.
- [ ] Order confirmation email (COD on placing, JazzCash on payment) and "shipped" email (uses `delivery.trackingNumber` when present).
- [ ] Refund-needed case tells the customer they'll be refunded.

## 6. Security
- [ ] Bot / abuse protection on public `POST` endpoints (`/api/orders`, `/api/subscribe`, `/admin/login`) at the hosting layer (e.g. Vercel Firewall per-IP rate limits). The app itself limits orders to 5/hour per phone or email and 20 of one item per order, but a determined bot can vary phone numbers — an IP limit is still needed.
- [x] Photos: EXIF/GPS location data is stripped — Cloudinary re-encodes every upload (max 2400px) so phone photos don't reveal where they were taken.
- [ ] `npm audit` re-checked. Known at handoff (2026-10-01): findings only in Prisma's CLI (bundled MySQL driver — unused, we use PostgreSQL; config merging of our own config file) and ExcelJS's `uuid` helper (affected function not used). The suggested "fix" downgrades both — don't apply; update when patched versions are released.
- [ ] If the site sits behind another proxy/CDN domain, add it to `experimental.serverActions.allowedOrigins` in `next.config.ts`.

## 7. Storefront polish (Track 1)
- [ ] Replace the starter home page and `metadata` ("Create Next App") in `src/app/layout.tsx`.
- [ ] Policy pages: FAQ, Shipping & Delivery, Returns & Exchanges, Contact, Terms, Privacy.
- [ ] Fonts: self-host (`next/font/local`) or confirm Google Fonts loads in production.

## 8. Final check
- [ ] Place one real COD order and one real JazzCash order end to end; cancel/refund one; confirm stock, emails and the admin all agree.
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass.
