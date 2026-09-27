import type { Category, Finish } from "@/generated/prisma/client";

// Single source of truth for the inventory vocabulary from the workbook's "Lists" sheet.
// Admin dropdowns, the importer and the storefront all use these.

export const CATEGORY_CODES: Record<Category, string> = {
  EARRINGS: "EAR",
  RINGS: "RNG",
  BRACELETS: "BRC",
  NECKLACE: "NCK",
};

export const FINISH_CODES: Record<Finish, string> = {
  GOLD: "GD",
  SILVER: "SL",
};

export const FINISH_LABELS: Record<Finish, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
};

/** Colour value meaning "this design has no colour choice" — never shown as an option. */
export const NO_COLOUR = "None / Single";

export const COLOURS = [
  NO_COLOUR, "Black", "White", "Pearl White", "Cream", "Beige", "Red", "Maroon", "Pink", "Hot Pink",
  "Baby Pink", "Fuchsia", "Coral", "Orange", "Yellow", "Mustard", "Green", "Olive", "Mint", "Emerald",
  "Teal", "Blue", "Navy", "Royal Blue", "Sky Blue", "Turquoise", "Purple", "Lavender", "Lilac",
  "Multicolour", "Other",
] as const;

export const RING_SIZES = ["Adjustable", "6", "7", "8", "9", "10", "11", "12"] as const;

/** Stock at or below this (and above 0) shows "Only N left". Owner can change it in Settings. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

/** SKU = <CAT>-<article 3 digits>-<finish>, e.g. EAR-001-GD. Colour/size don't change it. */
export function generateSku(category: Category, articleNo: number, finish: Finish): string {
  return `${CATEGORY_CODES[category]}-${String(articleNo).padStart(3, "0")}-${FINISH_CODES[finish]}`;
}

/** URL slug for a design, e.g. "aveline-pearl-drop-ear-001". Includes category+article so it's always unique. */
export function generateSlug(name: string, category: Category, articleNo: number): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-");
  return `${base}-${CATEGORY_CODES[category].toLowerCase()}-${String(articleNo).padStart(3, "0")}`;
}

/** "aveline  pearl drop " → "Aveline Pearl Drop". Only the first letter of each word is changed. */
export function capitaliseName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Match a colour case-insensitively to the official list. Blank → NO_COLOUR. Unknown → null. */
export function normaliseColour(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!v) return NO_COLOUR;
  return COLOURS.find((c) => c.toLowerCase() === v.toLowerCase()) ?? null;
}

export function normaliseFinish(raw: string | null | undefined): Finish | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "gold" || v === "gd") return "GOLD";
  if (v === "silver" || v === "sl") return "SILVER";
  return null;
}

/** 8 / "8.0" / " 8 " → "8"; "adjustable" → "Adjustable". */
export function normaliseRingSize(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  const v = String(raw).trim();
  if (!v) return "";
  const n = Number(v);
  if (Number.isFinite(n)) return String(n);
  return RING_SIZES.find((s) => s.toLowerCase() === v.toLowerCase()) ?? v;
}
