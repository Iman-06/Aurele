const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 });

/** 2800 → "Rs 2,800"; null → "—" */
export function formatRs(amount: number | string | { toString(): string } | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `Rs ${pkr.format(Number(amount.toString()))}`;
}

/** Earrings 1 → "EAR-001" (design code shown in admin) */
export function designCode(category: "EARRINGS" | "RINGS" | "BRACELETS" | "NECKLACE", articleNo: number) {
  const code = { EARRINGS: "EAR", RINGS: "RNG", BRACELETS: "BRC", NECKLACE: "NCK" }[category];
  return `${code}-${String(articleNo).padStart(3, "0")}`;
}

export const CATEGORY_LABELS = {
  EARRINGS: "Earrings",
  RINGS: "Rings",
  BRACELETS: "Bracelets",
  NECKLACE: "Necklace",
} as const;
