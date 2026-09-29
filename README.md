# Lunara

Source code for the Lunara jewellery e-commerce website — one Next.js app (TypeScript + Tailwind) with a PostgreSQL database via Prisma.

## Tracks & where code lives

| Track | Owner | Folders |
|---|---|---|
| 1. Storefront (browse, product page, cart UI) | teammate | `src/app/(store)/`, `src/components/store/` |
| 2. Backend + Admin (schema, inventory, orders, admin panel) | Track 2 | `prisma/`, `src/server/`, `src/app/admin/`, `src/app/api/`, `scripts/` |
| 3. Checkout + Infra (checkout, payments, emails, deploy, SEO) | teammate | `src/app/(store)/checkout/`, `src/server/payments/`, `src/server/email/` |

Shared: `src/lib/` (small helpers), `prisma/schema.prisma` (the shared data contract — change it only after agreeing as a team).

**Business logic lives in `src/server/`** (catalog, inventory, orders). Pages and API routes call those functions rather than touching the database directly, so stock rules (reservations, "Only N left", first-come-first-served) are enforced in one place.

## Payments & stock rules (agreed)

- Payment methods: **Cash on Delivery** and **JazzCash** (merchant). No bank transfer, no other gateway.
- **Stock is never reserved.** COD takes stock when the order is placed. JazzCash takes stock only when payment is confirmed.
- Last piece → whoever completes first. If a JazzCash payment arrives for something that sold out meanwhile, the order is cancelled and flagged **REFUND_NEEDED** for the owner.
- Unpaid JazzCash orders become **ABANDONED** after 24h (no stock involved).

**Full API guide for Tracks 1 and 3: [docs/API.md](docs/API.md).**

### Order functions for checkout (Track 3) — `src/server/orders/orders.ts`

| Function | Call it when | Result |
|---|---|---|
| `placeOrder(db, { items, customer, paymentMethod })` | customer submits checkout | COD → `NEW` order, stock taken. JazzCash → `AWAITING_PAYMENT`, then redirect to JazzCash with `order.orderNumber` + `order.total` |
| `confirmJazzCashPayment(db, { orderNumber, paymentRef, amountPaid })` | JazzCash reports a **successful** payment (after verifying its signature) | `{ outcome: "PAID" }` → send confirmation email. `"REFUND_NEEDED"` → tell the customer it sold out and they'll be refunded. `"ALREADY_PROCESSED"` → duplicate notification, ignore |
| `abandonUnpaidOrders(db)` | on a timer (e.g. hourly cron) | marks 24h-old unpaid JazzCash orders ABANDONED |

A failed/cancelled JazzCash payment needs no call — the order simply stays unpaid (the customer can retry) until abandoned.

Errors are thrown as `DomainError` (`src/server/errors.ts`) with a `code` (`OUT_OF_STOCK`, `NOT_PURCHASABLE`, `INVALID_INPUT`, `AMOUNT_MISMATCH`, …) and a customer-friendly `message`. Never send prices from the browser — they are always read from the database.

## Folder layout

```
data/         Lunara_Inventory_System_FINAL.xlsx (inventory source for the importer)
docs/         Business Requirements Document
prisma/       schema.prisma, migrations, seed
scripts/      one-off tools (Excel importer, etc.)
src/app/      Next.js routes (pages + API)
src/server/   business logic (Track 2)
src/lib/      shared helpers
tests/        integration tests (run against a separate test database)
```

## Getting started

Requirements: Node.js 22+ (LTS), PostgreSQL 16+ running locally.

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL etc.
npm run db:migrate          # create tables
npm run db:seed             # default settings + inventory import
npm run admin:create        # create the owner's admin login (interactive)
npm run dev                 # http://localhost:3000
```

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run db:studio` (browse the DB).

## Admin login

- Create the owner's login (or reset a password) — run it yourself in a terminal: `npm run admin:create`
- Sign in at `/admin/login`. Sessions last 7 days; 5 wrong passwords lock the account for 15 minutes.
- Protect every admin page / Server Action / API route with `requireAdmin()` or `getAdmin()` from `src/server/auth/admin-session.ts`. `src/proxy.ts` is only a fast first gate.
