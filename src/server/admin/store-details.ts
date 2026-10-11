import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { STORE_DETAIL_KEYS } from "../settings";

// Owner edits the site-wide store details in /admin/settings. Empty = hide it on the website.

const text = (max: number, name: string) =>
  z.preprocess((v) => String(v ?? "").replace(/\s+/g, " ").trim(), z.string().max(max, `${name} can be at most ${max} characters`));

export const storeDetailsInput = z.object({
  announcement_text: text(120, "The announcement"),
  instagram_url: z.preprocess(
    (v) => String(v ?? "").trim(),
    z.union([
      z.literal(""),
      z
        .string()
        .max(200)
        .regex(/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/, "Instagram link must look like https://instagram.com/yourpage"),
    ]),
  ),
  support_email: z.preprocess(
    (v) => String(v ?? "").trim().toLowerCase(),
    z.union([z.literal(""), z.string().max(200).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid support email")]),
  ),
  about_blurb: text(500, "The About text"),
});

export async function updateStoreDetails(db: PrismaClient, input: Record<string, unknown>) {
  const r = storeDetailsInput.safeParse(input);
  if (!r.success) throw new DomainError("INVALID_INPUT", r.error.issues[0]?.message ?? "Invalid store details");
  await db.$transaction(
    STORE_DETAIL_KEYS.map((key) =>
      db.setting.upsert({ where: { key }, create: { key, value: r.data[key] }, update: { value: r.data[key] } }),
    ),
  );
  return r.data;
}
