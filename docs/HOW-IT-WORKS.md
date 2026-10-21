# How Aurelé works

## Part 1 — for the shop owner

Aurelé is the jewellery website and the private admin behind it. Customers browse, choose a finish, colour, or ring size, and place a Cash on Delivery order. You pack it from the admin.

### Where things live

- **Products, stock, orders, and settings** are in the shared Neon database. The live site and a developer’s laptop both read that same database, so a change in the admin shows on the real website.
- **Photos** are in Cloudinary. Always upload them from the admin (Products → the design → Photos, or Homepage → banner). The admin both stores the photo and attaches it to the product. Uploading on cloudinary.com alone does not put the photo on a product. See [ADMIN-GUIDE.md](ADMIN-GUIDE.md).
- **Emails** go out through Resend: one to the customer and one to the shop inbox when a Cash on Delivery order is placed.

### What you do in the admin

Sign in at `/admin`. The dashboard lists what needs attention, including designs without photos.

- **Products** — prices, photos, Visible, New Arrival, One of a Kind.
- **Inventory** — counts, receiving stock, Excel export and import.
- **Orders** — pack, ship, deliver, cancel. Tabs are Needs action, Processing, Shipped, Delivered, Cancelled, Awaiting payment, Abandoned, and All.
- **Homepage** — the main banner and the promotion strip. Category pictures on the home page are files in the project, not an admin screen.
- **Subscribers** — the newsletter list. Export it to Excel. Signing up does not send the person an email.
- **Settings** — shipping fee, low-stock limit, announcement, Instagram, support email, About text, and your password.

### What happens when someone orders

1. They add pieces to the cart. The site checks the current price and stock.
2. At checkout they enter a name, phone, email, and address, and choose Cash on Delivery.
3. The server sets the price from the database and takes the stock.
4. They see an order confirmation page. The link includes a private token so a stranger cannot open the order by guessing the number.
5. The customer and the shop inbox each get an email, when email is configured.
6. You see the order under **Needs action**, pack it, mark it shipped, then delivered. Delivered records the cash as collected. Cancelling before shipping puts the items back in stock.

JazzCash is not available at checkout yet. Unpaid online orders are not part of launch.

### Who to call

| Question | Who |
|---|---|
| Prices, photos, stock, packing, the wording in Settings | You, in the admin |
| The site is down, email is not arriving, a photo upload fails, or a password is forgotten | A developer |
| A refund for a future online payment | You, in the JazzCash portal, then **Mark refunded** in the order |

A forgotten password is reset by a developer with `npm run admin:create` using your email. That signs you out on every device.

## Part 2 — for developers

One Next.js 16 app (App Router, TypeScript, Tailwind). Prisma 7 talks to Neon Postgres. Photos use the Cloudinary upload API from `src/server/media/storage.ts`. Order email uses Resend. There is no separate backend service.

### Folder map

| Track | Folders |
|---|---|
| Storefront | `src/app/(store)/` except `checkout/`, `src/components/store/`, `src/components/cart/`, `src/lib/storefront.ts` |
| Backend and admin | `prisma/`, `src/server/`, `src/app/admin/`, `src/app/api/` |
| Checkout and email | `src/app/(store)/checkout/`, `src/server/payments/`, `src/server/email/` |

Business rules stay in `src/server/`. Pages call those functions. `prisma/schema.prisma` is the shared contract.

### Run, build, deploy

```bash
npm install
npx prisma generate
npm run dev          # http://localhost:3000
npm run typecheck
npm run lint
npm run build
```

On Windows, if `npm` is blocked, use `npm.cmd`.

Deploy applies committed migrations with `npm run db:deploy` (uses `DIRECT_URL`), then starts the app with `DATABASE_URL`. Details are in [DEPLOYMENT.md](DEPLOYMENT.md) and [README.md](README.md).

### Environment variables

Names and purpose only. Real values stay in `.env` and the host. `.env.example` is the committed template.

| Name | Purpose | Required in production | In `.env.example` |
|---|---|---|---|
| `DATABASE_URL` | Pooled Neon connection the app uses | Yes | Yes |
| `DIRECT_URL` | Unpooled Neon connection for migrations | Yes, for deploys | Yes |
| `AUTH_SECRET` | Signs the admin cookie and the order-confirmation token | Yes | Yes |
| `CRON_SECRET` | Bearer token for `/api/cron/abandon-orders` | Only when JazzCash is live | Yes |
| `NEXT_PUBLIC_SITE_URL` | Public site URL used in emails, sitemap, and social tags | Yes | Yes |
| `RESEND_API_KEY` | Sends order email. Checkout still succeeds if it is missing; the email is skipped | Yes, if email should send | Yes |
| `EMAIL_FROM` | From address. Falls back to `orders@aurele.pk` | Yes, and the domain must be verified in Resend | Yes |
| `ORDER_NOTIFICATION_EMAIL` | Shop inbox for the new-order email | Yes, or the owner email is skipped | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud | Yes, or uploads stay on the laptop | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes, with the other Cloudinary values | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes, with the other Cloudinary values | Yes |
| `CLOUDINARY_URL` | Optional single-string substitute for the three Cloudinary values | No | Mentioned |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Fallback support address when Settings has none | No | No |
| `MEDIA_DIR` | Local folder when Cloudinary is not configured | No | No |
| `IMPORT_DIR` | Staging folder for Excel imports | No | No |
| `TEST_DATABASE_URL` | Local database whose name ends in `_test`. Tests wipe it | No | Yes |
| `NODE_ENV` | Set by Next.js. Production makes the admin cookie Secure | Set by the host | No |

`JAZZCASH_MERCHANT_ID`, `JAZZCASH_PASSWORD`, `JAZZCASH_INTEGRITY_SALT`, `JAZZCASH_ENV`, and `JAZZCASH_RETURN_URL` are listed in [DEPLOYMENT.md](DEPLOYMENT.md). The application code does not read them yet.

The computer clock must be correct. Cloudinary rejects uploads from a clock that is more than about an hour off.

### Cron

`GET /api/cron/abandon-orders` with `Authorization: Bearer <CRON_SECRET>` marks unpaid JazzCash orders older than 24 hours as Abandoned. Cash on Delivery does not use it. It is not needed for launch.

### Backups and the database

Neon `main` is the live shop. Do not run `prisma migrate dev`, `migrate reset`, `db seed`, or the inventory import against it. Schema changes are created on a throwaway local database, committed, then applied with `npm run db:deploy`. Turn on Neon’s backups (or point-in-time restore) for `main`. `npm test` refuses any URL that is not a local `*_test` database.

A developer laptop using the shared `DATABASE_URL` is looking at live products and live orders.

### Known limitations

- JazzCash checkout is disabled. The provider throws “not available yet.” The return and IPN routes answer that they are waiting.
- There is no “shipped” email and no subscriber welcome email.
- Category tiles (`public/tiles/`) are not editable in the admin. The homepage banner is.
- A tile appears only when that category has at least one visible, priced product. Bracelets stay hidden until one exists.
- Photos saved before Cloudinary (`/media/…`) live on the laptop that uploaded them. Re-upload those through the admin for the live site.
- An empty announcement, Instagram URL, or About box falls back to the constants in `src/lib/storefront.ts`. An empty support email hides the mailto.
- `/order/{orderNumber}` requires `?token=`. A signed-in admin can open it without the token.
- Order email headers say **AURELÉ** on a white card. The tagline is gold (`#b8956c`). The page background is `#fafafa`, not the older cream.
