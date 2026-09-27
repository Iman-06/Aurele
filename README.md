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
npm run db:seed             # admin user + inventory import
npm run dev                 # http://localhost:3000
```

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run db:studio` (browse the DB).
