import type { ReactElement } from 'react';
import type { RobotGlyphKind } from '../../types/ui';

/**
 * Flat stylised robot illustrations for the selector (96×72). Lightweight
 * stand-ins until rendered GLB thumbnails exist (Phase 7).
 */
const wheel = (cx: number, cy: number, r = 9) => (
  <g key={`${cx}-${cy}`}>
    <circle cx={cx} cy={cy} r={r} fill="#1e2433" />
    <circle cx={cx} cy={cy} r={r * 0.45} fill="#64748b" />
  </g>
);

const tread = (x: number, y: number, w: number, h = 13) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="#1e2433" />
    {Array.from({ length: Math.floor(w / 9) }, (_, i) => (
      <circle key={i} cx={x + 7 + i * 9} cy={y + h / 2} r={3} fill="#475569" />
    ))}
  </g>
);

const GLYPHS: Record<RobotGlyphKind, ReactElement> = {
  rover: (
    <g>
      <ellipse cx="48" cy="64" rx="34" ry="5" fill="#000" opacity=".25" />
      {wheel(24, 54)}
      {wheel(72, 54)}
      <rect x="18" y="30" width="60" height="24" rx="9" fill="#f1f5f9" />
      <rect x="18" y="44" width="60" height="10" rx="5" fill="#cbd5e1" />
      <rect x="28" y="34" width="26" height="12" rx="4" fill="#1d4ed8" />
      <rect x="31" y="37" width="20" height="3" rx="1.5" fill="#22d3ee" />
      <rect x="58" y="36" width="14" height="4" rx="2" fill="#22d3ee" />
      <path d="M56 30v-10l10-6" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="62" y="8" width="14" height="10" rx="3" fill="#f8fafc" />
      <circle cx="72" cy="13" r="2.6" fill="#22d3ee" />
      {wheel(30, 56, 8)}
      {wheel(66, 56, 8)}
    </g>
  ),
  excavator: (
    <g>
      <ellipse cx="46" cy="64" rx="34" ry="5" fill="#000" opacity=".25" />
      {tread(14, 50, 54)}
      <rect x="18" y="32" width="40" height="19" rx="4" fill="#facc15" />
      <rect x="22" y="22" width="18" height="14" rx="3" fill="#fde047" />
      <rect x="25" y="25" width="12" height="8" rx="2" fill="#1e3a8a" />
      <path d="M52 36 70 16l14 16" stroke="#eab308" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M78 30h12l-4 12h-10z" fill="#475569" />
    </g>
  ),
  tank: (
    <g>
      <ellipse cx="48" cy="64" rx="36" ry="5" fill="#000" opacity=".25" />
      {tread(10, 48, 76, 15)}
      <rect x="16" y="28" width="64" height="22" rx="6" fill="#475569" />
      <rect x="16" y="28" width="64" height="7" rx="3.5" fill="#64748b" />
      <rect x="30" y="16" width="30" height="14" rx="4" fill="#334155" />
      <rect x="34" y="20" width="22" height="5" rx="2.5" fill="#22d3ee" />
      <rect x="22" y="38" width="10" height="5" rx="2" fill="#f59e0b" />
      <rect x="64" y="38" width="10" height="5" rx="2" fill="#f59e0b" />
    </g>
  ),
  scout: (
    <g>
      <ellipse cx="48" cy="64" rx="32" ry="5" fill="#000" opacity=".25" />
      {wheel(24, 52, 11)}
      {wheel(72, 52, 11)}
      <path d="M26 44 34 26h28l8 18z" fill="#e2e8f0" />
      <rect x="38" y="30" width="20" height="9" rx="3" fill="#0f766e" />
      <rect x="41" y="33" width="14" height="3" rx="1.5" fill="#5eead4" />
      <path d="M62 26 68 10" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="68" cy="9" r="3" fill="#f43f5e" />
      <rect x="28" y="42" width="40" height="6" rx="3" fill="#94a3b8" />
    </g>
  ),
  arm: (
    <g>
      <ellipse cx="44" cy="64" rx="30" ry="5" fill="#000" opacity=".25" />
      <rect x="20" y="50" width="48" height="12" rx="4" fill="#334155" />
      <rect x="30" y="42" width="28" height="10" rx="4" fill="#f59e0b" />
      <path d="M44 44 36 22l28-10" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="36" cy="22" r="5" fill="#1e293b" />
      <circle cx="44" cy="44" r="5" fill="#1e293b" />
      <path d="M64 12l10-2M64 12l8 8" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
      <circle cx="44" cy="44" r="2" fill="#22d3ee" />
    </g>
  ),
  drone: (
    <g>
      <ellipse cx="48" cy="66" rx="22" ry="4" fill="#000" opacity=".2" />
      <path d="M22 22 74 46M74 22 22 46" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
      {[
        [22, 22],
        [74, 22],
        [22, 46],
        [74, 46],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y} rx="14" ry="4" fill="#94a3b8" opacity=".55" />
          <circle cx={x} cy={y} r="3.5" fill="#1e293b" />
        </g>
      ))}
      <rect x="34" y="26" width="28" height="16" rx="7" fill="#f97316" />
      <rect x="40" y="31" width="16" height="6" rx="3" fill="#1e3a8a" />
      <circle cx="48" cy="34" r="2" fill="#22d3ee" />
    </g>
  ),
};

export function RobotGlyph({ kind, className }: { kind: RobotGlyphKind; className?: string }) {
  return (
    <svg viewBox="0 0 96 72" className={className} aria-hidden="true">
      {GLYPHS[kind]}
    </svg>
  );
}
