# Deployment Runbook — Railway & Neon

This guide covers setting up, deploying, and maintaining the **Aurele** store on Railway (Hobby plan) and Neon PostgreSQL in Singapore (`ap-southeast-1`).

---

## 1. Architecture Overview

| Component | Service | Region | Notes |
| :--- | :--- | :--- | :--- |
| **Hosting** | Railway (Hobby) | Southeast Asia (Singapore) | Single service, 1 replica |
| **Database** | Neon PostgreSQL | AWS Singapore (`ap-southeast-1`) | Pooled runtime + direct migrations |
| **DNS / Domain** | GoDaddy | Global | `www.aurele.pk` & root forwarding |
| **Transactional Email** | Resend | Global | DKIM & SPF configured on GoDaddy |
| **Payments** | COD + JazzCash | Pakistan | COD active; JazzCash in Phase 5 |

---

## 2. Environment Variables Reference

Configure these in the Railway service settings (**Variables** tab):

| Variable | Purpose | Example / Dev | Production | Secret? |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Neon pooled connection string (with `-pooler`) | `postgresql://...@...-pooler.../neondb` | Neon `main` pooled branch | **Yes** |
| `DIRECT_URL` | Neon direct connection string (unpooled) | `postgresql://...@ep-.../neondb` | Neon `main` direct branch | **Yes** |
| `AUTH_SECRET` | Admin session JWT cookie signing | Long random 32+ char string | Long random 64 char string | **Yes** |
| `CRON_SECRET` | Protects `/api/cron/abandon-orders` | Random alphanumeric string | Random alphanumeric string | **Yes** |
| `RESEND_API_KEY` | Resend transactional email API key | `re_test_...` | `re_live_...` | **Yes** |
| `EMAIL_FROM` | Verified sender email address | `orders@yourdomain.com` | `orders@yourdomain.com` | No |
| `ORDER_NOTIFICATION_EMAIL` | Merchant inbox receiving new orders | `owner@yourdomain.com` | `owner@yourdomain.com` | No |
| `NEXT_PUBLIC_SITE_URL` | Base canonical URL | `http://localhost:3000` | `https://www.yourdomain.com` | No |
| `JAZZCASH_MERCHANT_ID` | JazzCash Merchant ID | (Pending Phase 5) | Provided by JazzCash | **Yes** |
| `JAZZCASH_PASSWORD` | JazzCash API Password | (Pending Phase 5) | Provided by JazzCash | **Yes** |
| `JAZZCASH_INTEGRITY_SALT` | JazzCash HMAC Salt | (Pending Phase 5) | Provided by JazzCash | **Yes** |
| `JAZZCASH_ENV` | Gateway environment | `sandbox` | `production` | No |
| `JAZZCASH_RETURN_URL` | Customer redirect URL | `http://localhost:3000/...` | `https://www.yourdomain.com/api/payments/jazzcash/return` | No |

---

## 3. Step-by-Step Railway Setup

1. **Create Project**:
   - In [railway.com](https://railway.com), click **New Project** &rarr; **Deploy from GitHub repo**.
   - Select the `Aurele` repository.
2. **Configure Service Settings**:
   - Go to your service &rarr; **Settings**:
     - **Region**: `Southeast Asia (Singapore)`
     - **Healthcheck Path**: `/api/health`
     - **Healthcheck Timeout**: `100` seconds
     - **Pre-deploy Command**: `npx prisma migrate deploy`
     - **Replicas**: `1`
3. **Variables**:
   - Add all environment variables listed above.
4. **Generate Railway Domain**:
   - Under **Networking**, click **Generate Domain** (e.g. `aurele-production.up.railway.app`).
   - Open `/api/health` on that domain to verify it returns `{"status":"ok"}`.

---

## 4. GoDaddy DNS Setup

1. **Primary Subdomain (`www.yourdomain.com`)**:
   - In Railway &rarr; **Settings** &rarr; **Networking** &rarr; **Custom Domain**, add `www.yourdomain.com`.
   - Copy the CNAME target value provided by Railway (e.g. `xyz.up.railway.app`).
   - In GoDaddy DNS management:
     - **Type**: `CNAME`
     - **Name**: `www`
     - **Value**: Railway target
     - **TTL**: `1 Hour` (or 1/2 hour)
2. **Apex / Root Domain (`yourdomain.com`)**:
   - In GoDaddy domain settings &rarr; **Forwarding** &rarr; **Domain**:
     - Forward `http://yourdomain.com` to `https://www.yourdomain.com` (Permanent 301 redirect).

---

## 5. Cost Control & Usage Safeguards

On the Railway Hobby Plan ($5 base + usage):
1. In Railway &rarr; Workspace &rarr; **Usage / Billing**:
   - Set a hard usage limit (e.g. **$10 / month**).
   - This ensures unforeseen traffic spikes never incur unwanted charges.
2. Neon Database:
   - Stay on the Free / Launch tier with auto-suspend enabled for dev branches.
   - Run tests only against local or dedicated test branches; never wipe `main`.

---

## 6. Rollback & Troubleshooting

- **Instant Rollback**:
  - In Railway &rarr; **Deployments** tab.
  - Hover over the last known working deployment and click **Redeploy** or **Rollback**.
- **Database Migration Rollback**:
  - Migrations are strictly additive. If an issue occurs, deploy a fix commit with an additive forward migration rather than running destructive commands.
