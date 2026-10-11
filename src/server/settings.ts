import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "./inventory/catalog-rules";

// Owner-editable settings stored in the Setting table (key → string value).
// A key that was never saved falls back to its default here.
export const SETTING_DEFAULTS = {
  shipping_fee: "250", // flat, Rs, anywhere in Pakistan
  low_stock_threshold: String(DEFAULT_LOW_STOCK_THRESHOLD),
  // Store details shown across the website (edited in /admin/settings). "" = don't show.
  announcement_text: "New pieces, made to be worn every day",
  instagram_url: "https://instagram.com/aurele",
  support_email: "",
  about_blurb:
    "Aurelé is everyday elegance. Pieces meant to be worn, given, and kept — quiet enough for every day, finished with care.",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** Insert any missing settings with their defaults; never overwrites values the owner changed. */
export async function ensureDefaultSettings(db: PrismaClient) {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

export async function getSetting(db: PrismaClient | Prisma.TransactionClient, key: SettingKey): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key];
}

export async function getNumberSetting(db: PrismaClient | Prisma.TransactionClient, key: SettingKey): Promise<number> {
  const n = Number(await getSetting(db, key));
  return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[key]);
}

export const STORE_DETAIL_KEYS = ["announcement_text", "instagram_url", "support_email", "about_blurb"] as const;

/** Site-wide text for the storefront (announcement bar, footer, policy pages). null = don't show. */
export type StoreDetails = {
  announcement: string | null;
  instagramUrl: string | null;
  supportEmail: string | null;
  aboutBlurb: string | null;
};

export async function getStoreDetails(db: PrismaClient | Prisma.TransactionClient): Promise<StoreDetails> {
  const rows = await db.setting.findMany({ where: { key: { in: [...STORE_DETAIL_KEYS] } } });
  const value = (key: (typeof STORE_DETAIL_KEYS)[number]) =>
    (rows.find((r) => r.key === key)?.value ?? SETTING_DEFAULTS[key]).trim() || null;
  return {
    announcement: value("announcement_text"),
    instagramUrl: value("instagram_url"),
    supportEmail: value("support_email"),
    aboutBlurb: value("about_blurb"),
  };
}
