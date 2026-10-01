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

/** Pakistani mobile "0300-1234567" / "+92 300 1234567" → "923001234567" (for WhatsApp links). */
export function toInternationalPk(phone: string): string | null {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  else if (d.startsWith("0")) d = `92${d.slice(1)}`;
  else if (d.length === 10 && d.startsWith("3")) d = `92${d}`;
  return /^92\d{10}$/.test(d) ? d : null;
}

export function whatsappLink(phone: string, text?: string): string | null {
  const n = toInternationalPk(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
