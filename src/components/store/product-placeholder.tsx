import { CATEGORY_LABELS } from "@/lib/format";

type Category = keyof typeof CATEGORY_LABELS;

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Stand-in until a product photo is uploaded. Uses the existing surface, gold, and type styles. */
export function ProductPlaceholder({ category }: { category: Category }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface text-gold">
      <CategoryMark category={category} />
      <span className="text-[0.65rem] tracking-[0.18em] text-muted uppercase">{CATEGORY_LABELS[category]}</span>
    </div>
  );
}

function CategoryMark({ category }: { category: Category }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-12">
      {category === "EARRINGS" && (
        <>
          <path {...stroke} d="M18 6v4M30 6v4" />
          <circle {...stroke} cx="18" cy="14" r="3" />
          <circle {...stroke} cx="30" cy="14" r="3" />
          <path {...stroke} d="M16 18c0 7 4 9 4 16M28 18c0 7 4 9 4 16" />
        </>
      )}
      {category === "RINGS" && (
        <>
          <circle {...stroke} cx="24" cy="27" r="10" />
          <path {...stroke} d="M20 18c1.2-4 6.8-4 8 0" />
        </>
      )}
      {category === "BRACELETS" && <ellipse {...stroke} cx="24" cy="26" rx="14" ry="10" />}
      {category === "NECKLACE" && (
        <>
          <path {...stroke} d="M10 16c4 14 24 14 28 0" />
          <path {...stroke} d="M24 30v6" />
          <circle {...stroke} cx="24" cy="39" r="2.5" />
        </>
      )}
    </svg>
  );
}
