# Lunara

Website for **Lunara**, a contemporary jewellery brand in Pakistan — one Next.js 16 app (TypeScript, Tailwind) with a PostgreSQL database via Prisma 7.

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
| 1. Storefront | home, categories, search/filter, product page (Finish → Colour → Size), cart UI, policy pages | `src/app/(store)/`, `src/components/store/` | not started |
| 2. Backend + Admin | schema, stock & order rules, storefront/checkout API, admin panel | `prisma/`, `src/server/`, `src/app/admin/`, `src/app/api/`, `scripts/` | done (see below) |
| 3. Checkout + Infra | checkout page, JazzCash, emails, deployment, SEO, analytics | `src/app/(store)/checkout/`, `src/server/payments/`, `src/server/email/` | not started |

`prisma/schema.prisma` is the shared contract — change it only after agreeing as a team. **Business rules live in `src/server/`**; pages and routes call those functions instead of querying the database directly.

### What Track 2 delivers
- **Catalog API** — product list with filters, product page option tree, cart validation ([docs/API.md](docs/API.md))
- **Orders** — COD + JazzCash, first-come-first-served stock with row locks (no overselling, no deadlocks), refunds, 24h abandonment
- **Admin panel** (`/admin`) — dashboard (sales, profit, alerts), orders (delivery/tracking, timeline, notes, packing slip), products (finish pricing, photos), inventory (stock counts, receiving, history, Excel export/import), mailing list, settings
- **Excel importer** for `data/Lunara_Inventory_System_FINAL.xlsx`

## Agreed business rules
- Payments: **Cash on Delivery** and **JazzCash** only.
- **Stock is never reserved.** COD takes stock when placed; JazzCash when payment is confirmed. If it sold out meanwhile → order cancelled + **Refund needed** for the owner.
- "Only N left" shows at **1–3** in stock (owner can change); 0 → option hidden; whole design sold out → "Out of Stock".
- SKU = `EAR-001-GD` (category–article–finish); colour/size don't change it. Customers never see SKUs or cost prices.
- Items without a selling price are hidden from the website.
- Flat shipping **Rs 250** (owner can change).
- Prices are always taken from the database, never from the browser.

## Setup (new machine)

Requirements: **Node.js 22+**, **PostgreSQL 16+**, Git.

```bash
git clone https://github.com/Iman-06/Lunara.git
cd Lunara
npm install
cp .env.example .env   # fill in DATABASE_URL, TEST_DATABASE_URL, AUTH_SECRET, CRON_SECRET
```

Create two empty databases (e.g. `lunara` and `lunara_test`) in PostgreSQL, then:

```bash
npm run setup          # generate client + create tables + default settings + import the inventory workbook
npm run admin:create   # create your admin login (asks for email + password in the terminal)
npm run dev            # http://localhost:3000  — admin at /admin
```

Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
**Windows PowerShell:** if `npm` is blocked ("running scripts is disabled"), use `npm.cmd` instead.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | start the site locally |
| `npm test` | all automated tests (uses `TEST_DATABASE_URL`, which gets wiped — never point it at real data) |
| `npm run typecheck` / `npm run lint` | static checks |
| `npm run db:migrate -- --name <change>` | create a migration after editing the schema (interactive) |
| `npm run db:deploy` | apply existing migrations (non-interactive — use on servers) |
| `npm run import:inventory -- --dry-run` | preview an Excel import (owner can also do this in the admin) |
| `npm run admin:create` | create an admin or reset a password (signs that admin out everywhere) |
| `npm run db:studio` | browse the database |

## Folder layout

```
data/          inventory workbook (source for the importer)
docs/          BRD, API guide, admin guide, launch checklist
prisma/        schema, migrations, seed
scripts/       importer, create-admin
src/app/       routes: admin/, api/, media/ (+ storefront/checkout to come)
src/server/    business logic — catalog, inventory, orders, admin, auth, media
src/components/admin/   admin UI pieces
src/lib/       db client, formatting helpers
src/proxy.ts   fast first gate for /admin (Next.js 16's renamed middleware)
storage/       uploaded photos + staged imports (git-ignored, local only)
tests/         integration tests against the test database
```

## Rules for code in this repo
- **Admin security:** every admin page, Server Action and `/api/admin/*` route must call `requireAdmin()` / `getAdmin()` (`src/server/auth/admin-session.ts`). `src/proxy.ts` is only a fast first gate.
- **Stock changes go through `src/server/`** (`takeStock`, `returnStock`, `adjustStock`, `receiveStock`, the importer) so every change is logged in the stock history.
- **Next.js 16 differs from older versions** — read `node_modules/next/dist/docs/` before writing Next code (see `AGENTS.md`).
- **Restart `npm run dev` after any schema change.** In development the Prisma client is cached between hot reloads, so a running server keeps the old client (errors like `Cannot read properties of undefined (reading 'create')`). Production is not affected.
