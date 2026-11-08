/**
 * Lightweight SVG charts (no dependency): thin marks, recessive grid, one y-axis,
 * hover tooltips, legend for >= 2 series. Colours come from fixed series slots.
 */
import { ReactNode, useRef, useState } from 'react';

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (!(hi > lo)) return [lo];
  const span = hi - lo;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const show = (e: React.MouseEvent | React.PointerEvent, content: ReactNode) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, content });
  };
  const el = tip ? (
    <div className="tooltip" style={{ left: Math.min(tip.x + 12, (ref.current?.clientWidth ?? 300) - 180), top: Math.max(0, tip.y - 40) }}>
      {tip.content}
    </div>
  ) : null;
  return { ref, show, hide: () => setTip(null), el };
}

export interface LineSeries {
  name: string;
  color?: string;
  points: [number, number][];
  band?: [number, number, number][];
}

export function LineChart({
  series,
  height = 240,
  logX = false,
  yFmt = (v: number) => v.toFixed(2),
  xFmt = (v: number) => String(Math.round(v)),
  refLines = [],
  yLabel,
  xLabel,
  legend = true,
}: {
  legend?: boolean;
  series: LineSeries[];
  height?: number;
  logX?: boolean;
  yFmt?: (v: number) => string;
  xFmt?: (v: number) => string;
  refLines?: { y: number; label: string }[];
  yLabel?: string;
  xLabel?: string;
}) {
  const t = useTip();
  const W = 640;
  const H = height;
  const m = { l: 58, r: 14, t: 12, b: 34 };
  const all = series.flatMap((s) => s.points);
  if (!all.length) return <div className="empty">Noch keine Daten</div>;
  const xs = all.map((p) => p[0]);
  let ys = all.map((p) => p[1]);
  series.forEach((s) => s.band?.forEach((b) => ys.push(b[1], b[2])));
  refLines.forEach((r) => ys.push(r.y));
  ys = ys.filter(Number.isFinite);
  const tx = (v: number) => (logX ? Math.log10(Math.max(1, v)) : v);
  const x0 = tx(Math.min(...xs));
  const x1 = tx(Math.max(...xs));
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.08 || Math.abs(y0) * 0.1 || 1;
  y0 -= pad;
  y1 += pad;
  const sx = (v: number) => m.l + ((tx(v) - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
  const sy = (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const yt = niceTicks(y0, y1, 5);
  const xt = logX
    ? Array.from({ length: Math.floor(x1) - Math.ceil(x0) + 1 }, (_, i) => Math.pow(10, Math.ceil(x0) + i))
    : niceTicks(Math.min(...xs), Math.max(...xs), 6);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const xv = x0 + ((px - m.l) / (W - m.l - m.r)) * (x1 - x0);
    const rows = series.map((s) => {
      let best = s.points[0];
      for (const p of s.points) if (Math.abs(tx(p[0]) - xv) < Math.abs(tx(best[0]) - xv)) best = p;
      return { s, p: best };
    });
    t.show(
      e,
      <div>
        <div className="muted">{xLabel ?? 'x'}: {xFmt(rows[0]?.p?.[0] ?? 0)}</div>
        {rows.map(({ s, p }, i) => (
          <div key={i}>
            <span style={{ color: s.color ?? SERIES[i % 8] }}>■</span> {s.name}: <b>{p ? yFmt(p[1]) : '–'}</b>
          </div>
        ))}
      </div>,
    );
  };
  return (
    <div className="chart-wrap" ref={t.ref}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={t.hide} role="img" aria-label={yLabel ?? 'Liniendiagramm'}>
        <g className="grid">
          {yt.map((v) => (
            <line key={v} x1={m.l} x2={W - m.r} y1={sy(v)} y2={sy(v)} />
          ))}
        </g>
        {yt.map((v) => (
          <text key={'t' + v} x={m.l - 6} y={sy(v) + 4} textAnchor="end">
            {yFmt(v)}
          </text>
        ))}
        {xt.map((v) => (
          <text key={'x' + v} x={sx(v)} y={H - 12} textAnchor="middle">
            {xFmt(v)}
          </text>
        ))}
        {yLabel && (
          <text x={12} y={m.t + 4} textAnchor="start" style={{ fontSize: 10 }}>
            {yLabel}
          </text>
        )}
        {refLines.map((r, i) => (
          <g key={i}>
            <line x1={m.l} x2={W - m.r} y1={sy(r.y)} y2={sy(r.y)} stroke="var(--gold)" strokeDasharray="5 4" strokeWidth={1.5} />
            <text x={W - m.r} y={sy(r.y) - 5} textAnchor="end" style={{ fill: 'var(--gold)' }}>
              {r.label}
            </text>
          </g>
        ))}
        {series.map((s, i) => {
          const col = s.color ?? SERIES[i % 8];
          const band = s.band?.filter((b) => Number.isFinite(b[1]) && Number.isFinite(b[2]));
          return (
            <g key={s.name}>
              {band && band.length > 1 && (
                <path
                  d={`M${band.map((b) => `${sx(b[0])},${sy(b[2])}`).join('L')}L${band
                    .slice()
                    .reverse()
                    .map((b) => `${sx(b[0])},${sy(b[1])}`)
                    .join('L')}Z`}
                  fill={col}
                  opacity={0.14}
                />
              )}
              <path d={`M${s.points.map((p) => `${sx(p[0])},${sy(p[1])}`).join('L')}`} fill="none" stroke={col} strokeWidth={legend ? 2 : 1.5} opacity={legend ? 1 : 0.7} />
            </g>
          );
        })}
      </svg>
      {legend && series.length > 1 && (
        <div className="legend" style={{ marginTop: 6 }}>
          {series.map((s, i) => (
            <span key={s.name}>
              <i style={{ background: s.color ?? SERIES[i % 8], height: 4, width: 16 }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      {t.el}
    </div>
  );
}

/** Horizontal point estimates with 95 % confidence whiskers. */
export function CIChart({
  rows,
  fmt = (v: number) => v.toFixed(3),
  refValue,
  refLabel,
}: {
  rows: { name: string; value: number; lo: number; hi: number; color?: string; note?: string }[];
  fmt?: (v: number) => string;
  refValue?: number;
  refLabel?: string;
}) {
  const t = useTip();
  const W = 640;
  const rowH = 34;
  const m = { l: 170, r: 20, t: 10, b: 28 };
  const H = m.t + m.b + rows.length * rowH;
  const vals = rows.flatMap((r) => [r.lo, r.hi, r.value]).concat(refValue !== undefined ? [refValue, 0] : [0]).filter(Number.isFinite);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 0.001;
  lo -= pad;
  hi += pad;
  const sx = (v: number) => m.l + ((v - lo) / (hi - lo)) * (W - m.l - m.r);
  const ticks = niceTicks(lo, hi, 5);
  return (
    <div className="chart-wrap" ref={t.ref}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Erwartungswerte mit Konfidenzintervallen">
        <g className="grid">
          {ticks.map((v) => (
            <line key={v} x1={sx(v)} x2={sx(v)} y1={m.t} y2={H - m.b} />
          ))}
        </g>
        {ticks.map((v) => (
          <text key={'t' + v} x={sx(v)} y={H - 10} textAnchor="middle">
            {fmt(v)}
          </text>
        ))}
        <line x1={sx(0)} x2={sx(0)} y1={m.t} y2={H - m.b} stroke="var(--line-strong)" strokeWidth={1.5} />
        {refValue !== undefined && (
          <g>
            <line x1={sx(refValue)} x2={sx(refValue)} y1={m.t} y2={H - m.b} stroke="var(--gold)" strokeDasharray="5 4" strokeWidth={1.5} />
            {refLabel && (
              <text x={sx(refValue) + 4} y={m.t + 10} style={{ fill: 'var(--gold)' }}>
                {refLabel}
              </text>
            )}
          </g>
        )}
        {rows.map((r, i) => {
          const y = m.t + i * rowH + rowH / 2;
          const col = r.color ?? SERIES[i % 8];
          return (
            <g
              key={r.name}
              onPointerMove={(e) =>
                t.show(
                  e,
                  <div>
                    <b>{r.name}</b>
                    <div>Schätzung: {fmt(r.value)}</div>
                    <div className="muted">95-%-KI: {fmt(r.lo)} … {fmt(r.hi)}</div>
                    {r.note && <div className="muted">{r.note}</div>}
                  </div>,
                )
              }
              onPointerLeave={t.hide}
            >
              <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill="transparent" />
              <text x={m.l - 8} y={y + 4} textAnchor="end" style={{ fill: 'var(--text-secondary)', fontSize: 12 }}>
                {r.name.length > 26 ? r.name.slice(0, 25) + '…' : r.name}
              </text>
              <line x1={sx(r.lo)} x2={sx(r.hi)} y1={y} y2={y} stroke={col} strokeWidth={2} />
              <line x1={sx(r.lo)} x2={sx(r.lo)} y1={y - 6} y2={y + 6} stroke={col} strokeWidth={2} />
              <line x1={sx(r.hi)} x2={sx(r.hi)} y1={y - 6} y2={y + 6} stroke={col} strokeWidth={2} />
              <circle cx={sx(r.value)} cy={y} r={5} fill={col} stroke="var(--surface-1)" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
      {t.el}
    </div>
  );
}

export function Histogram({ edges, counts, fmt = (v: number) => v.toFixed(0), color = SERIES[0], refValue, refLabel }: { edges: number[]; counts: number[]; fmt?: (v: number) => string; color?: string; refValue?: number; refLabel?: string }) {
  const t = useTip();
  const W = 640;
  const H = 200;
  const m = { l: 46, r: 10, t: 10, b: 28 };
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const n = counts.length;
  const bw = (W - m.l - m.r) / n;
  const lo = edges[0];
  const hi = edges[edges.length - 1];
  const sx = (v: number) => m.l + ((v - lo) / (hi - lo || 1)) * (W - m.l - m.r);
  const yt = niceTicks(0, max / total, 4);
  return (
    <div className="chart-wrap" ref={t.ref}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Histogramm">
        <g className="grid">
          {yt.map((v) => (
            <line key={v} x1={m.l} x2={W - m.r} y1={H - m.b - (v / (max / total)) * (H - m.t - m.b)} y2={H - m.b - (v / (max / total)) * (H - m.t - m.b)} />
          ))}
        </g>
        {yt.map((v) => (
          <text key={'y' + v} x={m.l - 6} y={H - m.b - (v / (max / total)) * (H - m.t - m.b) + 4} textAnchor="end">
            {(v * 100).toFixed(0)}%
          </text>
        ))}
        {counts.map((c, i) => {
          const h = (c / max) * (H - m.t - m.b);
          return (
            <rect
              key={i}
              x={m.l + i * bw + 1}
              y={H - m.b - h}
              width={Math.max(1, bw - 2)}
              height={h}
              rx={2}
              fill={color}
              onPointerMove={(e) => t.show(e, <div>{fmt(edges[i])} … {fmt(edges[i + 1])}: <b>{((c / total) * 100).toFixed(1)} %</b> ({c})</div>)}
              onPointerLeave={t.hide}
            />
          );
        })}
        {[0, Math.floor(n / 2), n].map((i) => (
          <text key={'x' + i} x={m.l + i * bw} y={H - 10} textAnchor="middle">
            {fmt(edges[i])}
          </text>
        ))}
        {refValue !== undefined && refValue >= lo && refValue <= hi && (
          <g>
            <line x1={sx(refValue)} x2={sx(refValue)} y1={m.t} y2={H - m.b} stroke="var(--gold)" strokeDasharray="5 4" strokeWidth={1.5} />
            {refLabel && (
              <text x={sx(refValue) + 4} y={m.t + 10} style={{ fill: 'var(--gold)' }}>
                {refLabel}
              </text>
            )}
          </g>
        )}
      </svg>
      {t.el}
    </div>
  );
}

/** Quantile ranges (p5–p95 line, p25–p75 bar, median tick) per row. */
export function RangeChart({ rows, fmt = (v: number) => v.toFixed(0), refValue, refLabel }: { rows: { name: string; p5: number; p25: number; median: number; p75: number; p95: number; mean: number }[]; fmt?: (v: number) => string; refValue?: number; refLabel?: string }) {
  const t = useTip();
  const W = 640;
  const rowH = 36;
  const m = { l: 170, r: 20, t: 10, b: 28 };
  const H = m.t + m.b + rows.length * rowH;
  const vals = rows.flatMap((r) => [r.p5, r.p95]).concat(refValue !== undefined ? [refValue] : []);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.06 || 1;
  lo -= pad;
  hi += pad;
  const sx = (v: number) => m.l + ((v - lo) / (hi - lo)) * (W - m.l - m.r);
  const ticks = niceTicks(lo, hi, 5);
  return (
    <div className="chart-wrap" ref={t.ref}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Verteilung der End-Bankroll">
        <g className="grid">
          {ticks.map((v) => (
            <line key={v} x1={sx(v)} x2={sx(v)} y1={m.t} y2={H - m.b} />
          ))}
        </g>
        {ticks.map((v) => (
          <text key={'t' + v} x={sx(v)} y={H - 10} textAnchor="middle">
            {fmt(v)}
          </text>
        ))}
        {refValue !== undefined && (
          <g>
            <line x1={sx(refValue)} x2={sx(refValue)} y1={m.t} y2={H - m.b} stroke="var(--gold)" strokeDasharray="5 4" strokeWidth={1.5} />
            {refLabel && (
              <text x={sx(refValue) + 4} y={m.t + 10} style={{ fill: 'var(--gold)' }}>
                {refLabel}
              </text>
            )}
          </g>
        )}
        {rows.map((r, i) => {
          const y = m.t + i * rowH + rowH / 2;
          const col = SERIES[i % 8];
          return (
            <g
              key={r.name}
              onPointerMove={(e) =>
                t.show(
                  e,
                  <div>
                    <b>{r.name}</b>
                    <div>Median {fmt(r.median)} · Mittel {fmt(r.mean)}</div>
                    <div className="muted">50 %: {fmt(r.p25)} … {fmt(r.p75)}</div>
                    <div className="muted">90 %: {fmt(r.p5)} … {fmt(r.p95)}</div>
                  </div>,
                )
              }
              onPointerLeave={t.hide}
            >
              <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill="transparent" />
              <text x={m.l - 8} y={y + 4} textAnchor="end" style={{ fill: 'var(--text-secondary)', fontSize: 12 }}>
                {r.name}
              </text>
              <line x1={sx(r.p5)} x2={sx(r.p95)} y1={y} y2={y} stroke={col} strokeWidth={2} />
              <rect x={sx(r.p25)} y={y - 8} width={Math.max(2, sx(r.p75) - sx(r.p25))} height={16} rx={4} fill={col} opacity={0.85} />
              <line x1={sx(r.median)} x2={sx(r.median)} y1={y - 11} y2={y + 11} stroke="var(--text-primary)" strokeWidth={2.5} />
            </g>
          );
        })}
      </svg>
      {t.el}
    </div>
  );
}
