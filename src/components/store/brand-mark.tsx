/** The traced files are 2000px squares. These boxes keep the word, or the flower plus the word. */
const VIEWBOX = {
  word: "490 780 1030 320",
  lockup: "490 360 1040 900",
};

export function Wordmark({
  variant,
  crop = "word",
  className = "",
}: {
  variant: "dark" | "light";
  crop?: "word" | "lockup";
  className?: string;
}) {
  const light = variant === "light";
  return (
    <svg
      viewBox={VIEWBOX[crop]}
      aria-hidden="true"
      className={`w-auto ${light ? "mix-blend-screen" : "mix-blend-multiply"} ${className}`}
    >
      <image
        href={light ? "/brand/logo-wordmark-light.svg" : "/brand/logo-wordmark-dark.svg"}
        width="2000"
        height="2000"
      />
    </svg>
  );
}

/** White mark, tinted with a mask so it can sit on white or on the grey placeholder. */
export function BrandMark({ className = "", color = "#1c1c1c" }: { className?: string; color?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block ${className}`}
      style={{
        backgroundColor: color,
        WebkitMask: "url(/brand/mark-light.svg) center / contain no-repeat",
        mask: "url(/brand/mark-light.svg) center / contain no-repeat",
      }}
    />
  );
}
