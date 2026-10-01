import { formatRs } from "@/lib/format";

// Daily sales column chart, rendered on the server as SVG (no chart library).
// Single series → one validated hue (#a0742a, passes contrast/chroma checks), no legend.
// Hover: each day has a full-height hit area with a native tooltip + highlight.
// A table view of the same numbers sits underneath for screen readers / exact values.

const BAR = "#a0742a";

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-PK", { ...opts, timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));

export function SalesChart({ daily }: { daily: { day: string; orders: number; sales: number }[] }) {
  const W = 720;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...daily.map((d) => d.sales)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const slot = plotW / daily.length;
  const barW = Math.min(24, Math.max(2, slot - 2)); // ≤24px, 2px gap between neighbours
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(daily.length / 8);
  const total = daily.reduce((s, d) => s + d.sales, 0);

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Daily product sales, total ${formatRs(total)}`}>
        <style>{`.day:hover .hl{opacity:1}.day:hover .bar{opacity:.85}`}</style>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#e7e5e4" strokeWidth={1} />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#78716c">
              {t >= 1000 ? `${(t / 1000).toLocaleString("en-PK")}k` : t}
            </text>
          </g>
        ))}
        {daily.map((d, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const h = Math.max(0, (d.sales / max) * plotH);
          const r = Math.min(4, barW / 2, h);
          const x = cx - barW / 2;
          const base = pad.top + plotH;
          // 4px rounded top, square at the baseline
          const path = h > 0 ? `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z` : "";
          return (
            <g key={d.day} className="day">
              <title>{`${dayLabel(d.day, { weekday: "short", day: "numeric", month: "short" })}: ${formatRs(d.sales)} · ${d.orders} order${d.orders === 1 ? "" : "s"}`}</title>
              <rect className="hl" x={pad.left + slot * i} y={pad.top} width={slot} height={plotH} fill="#f5f5f4" opacity={0} />
              {path && <path className="bar" d={path} fill={BAR} />}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#78716c">
                  {dayLabel(d.day, { day: "numeric", month: "short" })}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#d6d3d1" strokeWidth={1} />
      </svg>
      <details className="text-sm">
        <summary className="cursor-pointer text-stone-500">Show as table</summary>
        <table className="mt-2 w-full max-w-md text-sm">
          <thead className="text-left text-xs uppercase text-stone-500">
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
          <div className="flex justify-between gap-3">
            {r.href ? (
              <a href={r.href} className="font-medium hover:underline">
                {r.label}
              </a>
            ) : (
              <span className="font-medium">{r.label}</span>
            )}
            <span className="text-stone-600">{r.sub}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: BAR }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
