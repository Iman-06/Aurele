import { z } from "zod";
import type { PrismaClient, Promotion } from "@/generated/prisma/client";
import { DomainError } from "../errors";
import { removeImage, saveImage } from "../media/storage";

// Homepage banner + promotions: edited in /admin/homepage, read by the storefront
// through getHomeContent() / GET /api/store/home. Admin callers check requireAdmin() first.

// ------------------------------------------------------------
// Field rules
// ------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`).optional().transform((v) => v || null);

/** Only links to our own pages ("/…") or ordinary web addresses — never javascript: etc. */
const link = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (v.startsWith("/") && !v.startsWith("//")) return v;
    try {
      const u = new URL(v);
      if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
    } catch {
      /* fall through */
    }
    ctx.addIssue({ code: "custom", message: "Links must start with / (a page on this site) or https://" });
    return null;
  });

const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

/** "2026-10-20T09:00" from a datetime-local box, read as Pakistan time. */
const pktDateTime = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "Use the date picker for start/end times" });
      return null;
    }
    const d = new Date(`${v.length === 10 ? `${v}T00:00` : v}:00+05:00`);
    if (Number.isNaN(d.getTime())) ctx.addIssue({ code: "custom", message: "That date isn't valid" });
    return d;
  });

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new DomainError("INVALID_INPUT", r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}

// ------------------------------------------------------------
// Banner (single row, id = 1)
// ------------------------------------------------------------

const bannerInput = z
  .object({
    heading: text(80),
    subheading: text(200),
    buttonText: text(30),
    buttonLink: link,
    isActive: checkbox,
    removeMobileImage: checkbox,
  })
  .superRefine((d, ctx) => {
    if (d.buttonText && !d.buttonLink) ctx.addIssue({ code: "custom", message: "Add a link for the button (or leave the button text empty)" });
  });

export async function getBanner(db: PrismaClient) {
  return db.homeBanner.findUnique({ where: { id: 1 } });
}

/** Save banner text/switch, and optionally new photos (old files are deleted when replaced). */
export async function saveBanner(db: PrismaClient, input: Record<string, unknown>, files: { image?: File | null; mobileImage?: File | null } = {}) {
  const d = parse(bannerInput, input);
  const current = await getBanner(db);

  const hasFile = (f?: File | null): f is File => !!f && f.size > 0;
  // Check before saving any file, so a refused save never leaves orphan photos behind
  if (d.isActive && !hasFile(files.image) && !current?.imageUrl) {
    throw new DomainError("INVALID_INPUT", "Upload a banner photo before switching the banner on");
  }

  const imageUrl = hasFile(files.image) ? await saveImage(files.image) : (current?.imageUrl ?? null);
  let mobileImageUrl = current?.mobileImageUrl ?? null;
  try {
    if (hasFile(files.mobileImage)) mobileImageUrl = await saveImage(files.mobileImage);
    else if (d.removeMobileImage) mobileImageUrl = null;
  } catch (e) {
    if (imageUrl && imageUrl !== current?.imageUrl) await removeImage(imageUrl); // undo the first upload
    throw e;
  }

  const data = {
    heading: d.heading,
    subheading: d.subheading,
    buttonText: d.buttonText,
    buttonLink: d.buttonLink,
    isActive: d.isActive,
    imageUrl,
    mobileImageUrl,
  };
  const saved = await db.homeBanner.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });

  // Tidy up replaced photos only after the save succeeded
  if (current?.imageUrl && current.imageUrl !== imageUrl) await removeImage(current.imageUrl);
  if (current?.mobileImageUrl && current.mobileImageUrl !== mobileImageUrl) await removeImage(current.mobileImageUrl);
  return saved;
}

// ------------------------------------------------------------
// Promotions
// ------------------------------------------------------------

const promotionInput = z
  .object({
    title: z.string().trim().min(2, "Write the promotion headline").max(120, "Keep the headline under 120 characters"),
    details: text(300),
    linkText: text(30),
    linkUrl: link,
    isActive: checkbox,
    startsAt: pktDateTime,
    endsAt: pktDateTime,
  })
  .superRefine((d, ctx) => {
    if (d.linkText && !d.linkUrl) ctx.addIssue({ code: "custom", message: "Add a link for the button (or leave the button text empty)" });
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", message: "The end must be after the start" });
  });

export type PromotionState = "LIVE" | "SCHEDULED" | "ENDED" | "OFF";

export function promotionState(p: Pick<Promotion, "isActive" | "startsAt" | "endsAt">, now = new Date()): PromotionState {
  if (!p.isActive) return "OFF";
  if (p.endsAt && p.endsAt <= now) return "ENDED";
  if (p.startsAt && p.startsAt > now) return "SCHEDULED";
  return "LIVE";
}

export async function listPromotions(db: PrismaClient, now = new Date()) {
  const rows = await db.promotion.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const order: Record<PromotionState, number> = { LIVE: 0, SCHEDULED: 1, OFF: 2, ENDED: 3 };
  return rows
    .map((p) => ({ ...p, state: promotionState(p, now) }))
    .sort((a, b) => order[a.state] - order[b.state]);
}

export async function createPromotion(db: PrismaClient, input: Record<string, unknown>) {
  return db.promotion.create({ data: parse(promotionInput, input) });
}

export async function updatePromotion(db: PrismaClient, id: number, input: Record<string, unknown>) {
  const d = parse(promotionInput, input);
  const res = await db.promotion.updateMany({ where: { id }, data: d });
  if (res.count === 0) throw new DomainError("NOT_FOUND", "Promotion not found");
}

export async function deletePromotion(db: PrismaClient, id: number) {
  const res = await db.promotion.deleteMany({ where: { id } });
  if (res.count === 0) throw new DomainError("NOT_FOUND", "Promotion not found");
}

// ------------------------------------------------------------
// What the storefront shows
// ------------------------------------------------------------

export type HomeContent = {
  banner: {
    imageUrl: string;
    mobileImageUrl: string;
    heading: string | null;
    subheading: string | null;
    button: { text: string; link: string } | null;
  } | null;
  promotion: {
    title: string;
    details: string | null;
    link: { text: string; url: string } | null;
    url: string | null; // the whole strip can be clickable even without button text
    endsAt: string | null; // ISO — e.g. for "ends Sunday"
  } | null;
};

export async function getHomeContent(db: PrismaClient, now = new Date()): Promise<HomeContent> {
  const [b, promos] = await Promise.all([
    getBanner(db),
    db.promotion.findMany({
      where: {
        isActive: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      // If several overlap, the one that started most recently wins
      orderBy: [{ startsAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 1,
    }),
  ]);

  const banner =
    b?.isActive && b.imageUrl
      ? {
          imageUrl: b.imageUrl,
          mobileImageUrl: b.mobileImageUrl ?? b.imageUrl,
          heading: b.heading,
          subheading: b.subheading,
          button: b.buttonText && b.buttonLink ? { text: b.buttonText, link: b.buttonLink } : null,
        }
      : null;

  const p = promos[0];
  const promotion = p
    ? {
        title: p.title,
        details: p.details,
        link: p.linkText && p.linkUrl ? { text: p.linkText, url: p.linkUrl } : null,
        url: p.linkUrl,
        endsAt: p.endsAt?.toISOString() ?? null,
      }
    : null;

  return { banner, promotion };
}
