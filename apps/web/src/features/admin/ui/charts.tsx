import { formatDate, formatNumber } from '../lib/format';

/*
 * Small SVG charts for the dashboard and analytics (no chart library).
 * Every chart has a text alternative (aria-label + <title> per bar).
 */

export interface Series {
  readonly label: string;
  readonly color: string;
  readonly values: readonly number[];
}

/**
 * Grouped daily columns (e.g. attempts vs passed per day). `width` is the
 * drawing's coordinate width: use a larger value on wide cards so labels stay small.
 */
export function ColumnChart({ days, series, height = 180, width = 720, label }: { days: readonly string[]; series: readonly Series[]; height?: number; width?: number; label: string }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const W = width;
  const padL = 30;
  const padB = 22;
  const plotH = height - padB - 8;
  const slot = (W - padL) / Math.max(1, days.length);
  const barW = Math.max(3, Math.min(18, (slot - 6) / series.length));
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.ceil(days.length / 10);

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={label}>
        {ticks.map((t) => {
          const y = 8 + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="var(--color-adm-line)" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--color-adm-faint)">
                {t}
              </text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const x0 = padL + i * slot + (slot - barW * series.length) / 2;
          return (
            <g key={d}>
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const h = (v / max) * plotH;
                return (
                  <rect key={s.label} x={x0 + si * barW} y={8 + plotH - h} width={barW - 1} height={Math.max(h, v > 0 ? 1.5 : 0)} rx="2" fill={s.color}>
                    <title>{`${formatDate(d)} · ${s.label}: ${formatNumber(v)}`}</title>
                  </rect>
                );
              })}
              {i % labelEvery === 0 && (
                <text x={padL + i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--color-adm-muted)">
                  {formatDate(d).slice(0, 5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-adm-muted">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Labelled horizontal bars (0–100% or counts). */
export function BarList({ items, max, format = (v) => formatNumber(v), color = 'var(--color-adm-accent)' }: {
  items: readonly { key: string; label: string; sublabel?: string; value: number }[];
  max?: number;
  format?: (v: number) => string;
  color?: string;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,2fr)_minmax(3rem,1.3fr)_auto] items-center gap-3 text-sm">
          <span className="min-w-0 truncate text-adm-ink" title={i.label}>
            {i.label}
            {i.sublabel && <span className="ml-1.5 text-xs text-adm-faint">{i.sublabel}</span>}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-adm-line/70" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (i.value / top) * 100)}%`, background: color }} />
          </span>
          <span className="tabular text-right text-adm-body">{format(i.value)}</span>
        </li>
      ))}
    </ul>
  );
}
