# Aurelé

Website for **Aurelé**, a contemporary jewellery brand in Pakistan — one Next.js 16 app (TypeScript, Tailwind) with the team's shared **Neon** PostgreSQL database via Prisma 7, and product photos on **Cloudinary**.

| Doc | For |
|---|---|
| **This README** | developers: setup, structure, rules |
| [docs/API.md](docs/API.md) | Tracks 1 & 3: every endpoint/function the storefront and checkout use |
| [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md) | the shop owner: how to use the admin panel |
| [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md) | everything to do before going live |
| `docs/Business Requirements Document.docx` | what the business asked for |

## Who builds what

| Track | Scope | Folders | Status |
|---|---|---|---|
| 1. Storefront | home, categories, search/filter, product page (Finish → Colour → Size), cart UI, policy pages | `src/app/(store)/`, `src/components/store/` | in progress |
| 2. Backend + Admin | schema, stock & order rules, storefront/checkout API, admin panel | `prisma/`, `src/server/`, `src/app/admin/`, `src/app/api/`, `scripts/` | done (see below) |
| 3. Checkout + Infra | checkout page, JazzCash, emails, deployment, SEO, analytics | `src/app/(store)/checkout/`, `src/server/payments/`, `src/server/email/` | COD live; JazzCash later |

`prisma/schema.prisma` is the shared contract — change it only after agreeing as a team. **Business rules live in `src/server/`**; pages and routes call those functions instead of querying the database directly.

### What Track 2 delivers
- **Catalog API** — product list with filters, product page option tree, cart validation ([docs/API.md](docs/API.md))
- **Orders** — COD + JazzCash, first-come-first-served stock with row locks (no overselling, no deadlocks), refunds, 24h abandonment
- **Admin panel** (`/admin`) — dashboard (sales, profit, alerts), orders (delivery/tracking, timeline, notes, packing slip), products (finish pricing, photos), inventory (stock counts, receiving, history, Excel export/import), homepage banner + scheduled promotions, mailing list, settings
- **Excel importer** for `data/Lunara_Inventory_System_FINAL.xlsx`

## Agreed business rules
- Payments: **Cash on Delivery** at launch; **JazzCash** later.
- **Stock is never reserved.** COD takes stock when placed; JazzCash when payment is confirmed. If it sold out meanwhile → order cancelled + **Refund needed** for the owner.
- "Only N left" shows at **1–3** in stock (owner can change); 0 → option shown greyed "Sold out" (can't be bought); whole design sold out → "Out of Stock".
- SKU = `EAR-001-GD` (category–article–finish); colour/size don't change it. Customers never see SKUs or cost prices.
- Items without a selling price are hidden from the website.
- Flat shipping **Rs 250** (owner can change).
- Prices are always taken from the database, never from the browser.

## Setup (new machine)

You need **Node.js 22+** and Git. **No database install is needed to run the site** — it uses the team's shared
**Neon** database in the cloud. (A local PostgreSQL is only needed to run the automated tests — see below.)

```bash
git clone https://github.com/Iman-06/Aurele.git
cd Aurele
npm install
cp .env.example .env    # (or .env.local) then fill it in — ask a teammate for the values (never commit .env)
npx prisma generate     # generate the database client
npm run dev             # http://localhost:3000 — admin at /admin
```

What goes in `.env` (see `.env.example` for the format):

| Variable | What | Needed for |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (host contains `-pooler`) | everything |
| `DIRECT_URL` | Neon **direct** connection string (no `-pooler`) | applying migrations |
| `AUTH_SECRET` | long random string — signs the admin login cookie and the order-confirmation links | admin, checkout |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | the shop's Cloudinary account (Settings → API Keys) | photo uploads. Without them, uploads are saved on your laptop only (`storage/uploads`) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ORDER_NOTIFICATION_EMAIL` | order emails (Resend) | checkout emails |
| `CRON_SECRET` | long random string for `/api/cron/*` | hosting |
| `TEST_DATABASE_URL` | **local** test database | `npm test` only |

Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
**Windows PowerShell:** if `npm` is blocked ("running scripts is disabled"), use `npm.cmd` instead.
**Your computer's clock must be right** (Windows: Settings → Time & language → "Set time automatically") — Cloudinary
refuses uploads from a clock that is more than an hour off.

**First admin login:** `npm run admin:create` creates an admin on the shared database (asks for email + password).
Run it again with the same email to reset a forgotten password. Signed-in admins change their password in Settings.

**Shared database rules.** Neon already has the tables and the inventory — **don't** run `npm run setup` or
`npm run db:seed` against it. Schema changes are agreed by the team first, then:
1. create the migration against a throwaway **local** database, e.g.
   `DIRECT_URL="postgresql://postgres:…@localhost:5432/aurele_dev" npm run db:migrate -- --name <change>`
2. commit + push it, and apply it to Neon with `npm run db:deploy`. Never run `db:migrate` against Neon — it can reset the database.
3. Everyone else: after pulling, run `npx prisma generate` and restart `npm run dev`.

### Running the automated tests (optional)
The tests wipe their database, so they **never** use Neon: they need a local PostgreSQL 16+ with an empty database
whose name ends in `_test` (e.g. `aurele_test`), set as `TEST_DATABASE_URL`. They refuse to start against anything
that isn't a local `*_test` database, and never upload to Cloudinary. Then `npm test`.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | start the site locally |
| `npm test` | all automated tests (local `*_test` database only — it gets wiped) |
| `npm run typecheck` / `npm run lint` | static checks |
| `npm run db:migrate -- --name <change>` | create a migration after editing the schema — **local DB only** (see Shared database rules) |
| `npm run db:deploy` | apply committed migrations to the shared Neon DB (non-interactive) |
| `npm run import:inventory -- --dry-run` | preview an Excel import (owner can also do this in the admin) |
| `npm run admin:create` | create an admin or reset a password (signs that admin out everywhere) |
| `npm run db:studio` | browse the database |

## Folder layout

```
data/          inventory workbook (source for the importer)
docs/          BRD, API guide, admin guide, launch checklist
prisma/        schema, migrations, seed
scripts/       importer, create-admin
src/app/       routes: (store)/ storefront + checkout, admin/, api/, media/
src/server/    business logic — catalog, inventory, orders, admin, auth, media
src/components/admin/   admin UI pieces
src/lib/       db client, formatting helpers
src/proxy.ts   fast first gate for /admin (Next.js 16's renamed middleware)
storage/       staged Excel imports, and photos uploaded without Cloudinary keys (git-ignored, local only)
tests/         integration tests against the test database
```

## Rules for code in this repo
- **Admin security:** every admin page, Server Action and `/api/admin/*` route must call `requireAdmin()` / `getAdmin()` (`src/server/auth/admin-session.ts`). `src/proxy.ts` is only a fast first gate.
- **Stock changes go through `src/server/`** (`takeStock`, `returnStock`, `adjustStock`, `receiveStock`, the importer) so every change is logged in the stock history.
- **Next.js 16 differs from older versions** (e.g. middleware is now `proxy.ts`, `params`/`searchParams`/`cookies()` are async) — check the docs bundled in `node_modules/next/dist/docs/` before writing Next code.
- **Restart `npm run dev` after any schema change.** In development the Prisma client is cached between hot reloads, so a running server keeps the old client (errors like `Cannot read properties of undefined (reading 'create')`). Production is not affected.
