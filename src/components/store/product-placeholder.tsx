import { BrandMark } from "@/components/store/brand-mark";
import { CATEGORY_LABELS } from "@/lib/format";

type Category = keyof typeof CATEGORY_LABELS;

/** Stand-in until a product photo is uploaded. */
export function ProductPlaceholder({ category }: { category: Category }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#f4f4f4] text-foreground">
      <BrandMark color="#c8c8c8" className="h-16 w-12" />
      <span className="text-[0.65rem] tracking-[0.18em] text-muted uppercase">{CATEGORY_LABELS[category]}</span>
    </div>
  );
}
