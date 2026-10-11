import { formatRs } from "@/lib/format";

// Daily sales column chart, rendered on the server as SVG (no chart library).
// Columns are near-black; ranked bars use one gold accent. No legend.
// Hover: each day has a full-height hit area with a native tooltip + highlight.
// A table view of the same numbers sits underneath for screen readers / exact values.

const BAR = "#1c1c1c";
const ACCENT = "#a0742a";

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-PK", { ...opts, timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));

export function SalesChart({ daily }: { daily: { day: string; orders: number; sales: number }[] }) {
  const W = 640;
  const pad = { top: 18, bottom: 10 };
  const plotH = 160;
  const H = plotH + pad.top + pad.bottom;
  const max = niceMax(Math.max(...daily.map((d) => d.sales)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const slot = W / daily.length;
  const barW = Math.min(24, Math.max(2, slot - 2)); // ≤24px, 2px gap between neighbours
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(daily.length / 8);
  const total = daily.reduce((s, d) => s + d.sales, 0);

  const tickLabel = (t: number) => (t >= 1000 ? `${(t / 1000).toLocaleString("en-PK")}k` : String(t));

  return (
    <figure className="min-w-0 space-y-2">
      <div className="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] gap-x-1">
        <div className="relative col-start-1 row-start-1 text-[13px] leading-none text-[#6b6b6b]" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${(y(t) / H) * 100}%` }}>
              {tickLabel(t)}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="col-start-2 row-start-1 block h-auto w-full" role="img" aria-label={`Daily product sales, total ${formatRs(total)}`}>
          <style>{`.day:hover .hl{opacity:1}.day:hover .bar{opacity:.85}`}</style>
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="#e6e6e6" strokeWidth={1} />
          ))}
          {daily.map((d, i) => {
            const cx = slot * i + slot / 2;
            const h = Math.max(0, (d.sales / max) * plotH);
            const r = Math.min(4, barW / 2, h);
            const x = cx - barW / 2;
            const base = pad.top + plotH;
            const path = h > 0 ? `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z` : "";
            return (
              <g key={d.day} className="day">
                <title>{`${dayLabel(d.day, { weekday: "short", day: "numeric", month: "short" })}: ${formatRs(d.sales)} · ${d.orders} order${d.orders === 1 ? "" : "s"}`}</title>
                <rect className="hl" x={slot * i} y={pad.top} width={slot} height={plotH} fill="#f4f4f4" opacity={0} />
                {path && <path className="bar" d={path} fill={BAR} />}
              </g>
            );
          })}
          <line x1={0} x2={W} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#e6e6e6" strokeWidth={1} />
        </svg>
        <div className="relative col-start-2 row-start-2 mt-2 h-5 text-[13px] leading-none text-[#6b6b6b]" aria-hidden="true">
          {daily.map((d, i) => {
            if (i % labelEvery !== 0) return null;
            const pos = (i + 0.5) / daily.length;
            const edge = pos < 0.08 ? "start" : pos > 0.92 ? "end" : "mid";
            return (
              <span
                key={d.day}
                className={`absolute whitespace-nowrap ${edge === "start" ? "left-0" : edge === "end" ? "right-0" : "-translate-x-1/2"}`}
                style={edge === "mid" ? { left: `${pos * 100}%` } : edge === "end" ? { right: `${(1 - pos) * 100}%` } : undefined}
              >
                {dayLabel(d.day, { day: "numeric", month: "short" })}
              </span>
            );
          })}
        </div>
      </div>
      <details className="text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-stone-500">Show as table</summary>
        <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[16rem] max-w-md text-sm">
          <thead className="text-left text-[13px] uppercase text-stone-500">
            <tr>
              <th className="py-1">Day</th>
              <th className="py-1 text-right">Orders</th>
              <th className="py-1 text-right">Sales</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day} className="border-t border-stone-100">
                <td className="py-1">{dayLabel(d.day, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td className="py-1 text-right">{d.orders}</td>
                <td className="py-1 text-right">{formatRs(d.sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>
    </figure>
  );
}

/** Ranked list with a thin inline bar (single hue), value as text. */
export function RankBars({ rows }: { rows: { label: string; value: number; sub?: string; href?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="space-y-1 text-sm">
          <div className="flex min-w-0 items-center justify-between gap-3">
            {r.href ? (
              <a href={r.href} className="inline-flex min-h-11 min-w-0 items-center font-medium break-words hover:underline">
                {r.label}
              </a>
            ) : (
              <span className="inline-flex min-h-11 min-w-0 items-center font-medium break-words">{r.label}</span>
            )}
            <span className="shrink-0 text-[13px] text-stone-600">{r.sub}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: ACCENT }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
