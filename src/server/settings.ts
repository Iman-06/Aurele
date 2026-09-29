import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "./inventory/catalog-rules";

// Owner-editable settings stored in the Setting table (key → string value).
export const SETTING_DEFAULTS = {
  shipping_fee: "250", // flat, Rs, anywhere in Pakistan
  low_stock_threshold: String(DEFAULT_LOW_STOCK_THRESHOLD),
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
