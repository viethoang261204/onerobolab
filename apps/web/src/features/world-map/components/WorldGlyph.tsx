import { memo, type ReactNode } from 'react';
import type { WorldTheme } from '../../../content/worlds/types';
import { cn } from '../../../utils/cn';
import { THEME_PALETTES, type ThemePalette } from '../scene/theme-palettes';

/*
 * Flat illustration of a world's floating island (same palette as the 3D
 * island) for cards and panels — pure SVG, no WebGL context per card.
 * viewBox 0 0 190 112; island top centred at (95, 46).
 */

const CX = 95;
const CY = 46;
const RX = 76;
const RY = 27;

const tree = (x: number, y: number, s: number, trunk: string, leaf: string, k: string) => (
  <g key={k}>
    <rect x={x - 1.5 * s} y={y - 6 * s} width={3 * s} height={7 * s} rx={1} fill={trunk} />
    <circle cx={x} cy={y - 10 * s} r={7 * s} fill={leaf} />
    <circle cx={x + 2 * s} cy={y - 14 * s} r={4.5 * s} fill={leaf} opacity={0.85} />
  </g>
);

const pine = (x: number, y: number, s: number, body: string, cap: string, k: string) => (
  <g key={k}>
    <path d={`M${x} ${y - 22 * s}L${x + 8 * s} ${y - 4 * s}H${x - 8 * s}Z`} fill={body} />
    <path d={`M${x} ${y - 22 * s}L${x + 4 * s} ${y - 13 * s}H${x - 4 * s}Z`} fill={cap} />
  </g>
);

function decor(theme: WorldTheme, c: ThemePalette): ReactNode {
  switch (theme) {
    case 'starter':
      return (
        <>
          <path d={`M${CX - 58} ${CY + 6}L${CX + 50} ${CY - 12}l8 5L${CX - 50} ${CY + 11}z`} fill={c.d} />
          <path d={`M${CX - 22} ${CY - 18}l52 30-8 4-52-30z`} fill={c.d} />
          <rect x={CX - 40} y={CY - 22} width={16} height={12} rx={2} fill={c.c} />
          <rect x={CX - 41} y={CY - 24} width={18} height={4} rx={1} fill={c.glow} />
          {[tree(CX + 36, CY - 6, 1, c.a, c.b, 't1'), tree(CX - 56, CY + 2, 0.9, c.a, c.b, 't2'), tree(CX + 56, CY + 6, 0.8, c.a, c.b, 't3'), tree(CX + 12, CY + 16, 0.85, c.a, c.b, 't4')]}
        </>
      );
    case 'canyon':
      return (
        <>
          <path d={`M${CX - 60} ${CY + 8}Q${CX} ${CY - 6} ${CX + 58} ${CY + 4}`} stroke={c.d} strokeWidth={6} fill="none" strokeLinecap="round" />
          {[
            [CX - 34, CY - 4, 1],
            [CX + 30, CY - 8, 0.8],
          ].map(([x = 0, y = 0, s = 1], i) => (
            <g key={i}>
              <rect x={x - 14 * s} y={y - 22 * s} width={28 * s} height={22 * s} fill={c.a} />
              <ellipse cx={x} cy={y - 22 * s} rx={14 * s} ry={5 * s} fill={c.b} />
            </g>
          ))}
          {[CX + 2, CX + 52, CX - 58].map((x, i) => (
            <rect key={i} x={x} y={CY - 2 + i * 3} width={4} height={12} rx={2} fill={c.c} />
          ))}
        </>
      );
    case 'frost':
      return (
        <>
          <ellipse cx={CX + 22} cy={CY + 4} rx={24} ry={8} fill={c.d} />
          {[pine(CX - 40, CY + 4, 1.1, c.a, c.b, 'p1'), pine(CX - 22, CY - 6, 0.9, c.a, c.b, 'p2'), pine(CX + 54, CY - 2, 0.9, c.a, c.b, 'p3'), pine(CX - 58, CY + 10, 0.8, c.a, c.b, 'p4')]}
          {[
            [CX + 6, CY - 10],
            [CX + 34, CY - 10],
          ].map(([x = 0, y = 0], i) => (
            <path key={i} d={`M${x} ${y - 16}l5 10-5 8-5-8z`} fill={c.c} />
          ))}
        </>
      );
    case 'jungle':
      return (
        <>
          <rect x={CX + 58} y={CY + 6} width={7} height={34} fill={c.d} opacity={0.85} />
          <path d={`M${CX - 30} ${CY + 4}h36l-5-8h-26zM${CX - 24} ${CY - 4}h24l-4-7h-16zM${CX - 18} ${CY - 11}h12l-3-6h-6z`} fill={c.c} />
          <rect x={CX - 15} y={CY - 21} width={6} height={4} fill={c.glow} />
          {[tree(CX + 22, CY - 2, 1.1, c.a, c.b, 'j1'), tree(CX + 44, CY + 6, 1, c.a, c.b, 'j2'), tree(CX - 52, CY + 6, 1, c.a, c.b, 'j3'), tree(CX + 4, CY + 18, 0.9, c.a, c.b, 'j4')]}
        </>
      );
    case 'skylab':
      return (
        <>
          <rect x={CX - 48} y={CY - 4} width={34} height={5} rx={2} fill={c.a} />
          <path d={`M${CX - 46} ${CY - 4}a15 13 0 0 1 30 0z`} fill={c.c} opacity={0.9} />
          {[CX + 18, CX + 44].map((x, i) => (
            <g key={i}>
              <rect x={x - 3} y={CY - 34 + i * 6} width={6} height={34 - i * 6} fill={c.a} />
              <ellipse cx={x} cy={CY - 20 + i * 4} rx={9} ry={3} fill="none" stroke={c.glow} strokeWidth={2} />
            </g>
          ))}
          {[0, 1, 2].map((i) => (
            <rect key={i} x={CX - 30 + i * 13} y={CY + 10} width={11} height={5} fill={c.d} transform={`skewX(-20)`} />
          ))}
        </>
      );
    case 'lava':
      return (
        <>
          <ellipse cx={CX + 20} cy={CY + 6} rx={22} ry={7} fill={c.b} />
          <rect x={CX + 60} y={CY + 6} width={6} height={30} fill={c.b} opacity={0.9} />
          {[
            [CX - 36, 26],
            [CX - 20, 18],
            [CX + 36, 22],
          ].map(([x = 0, h = 0], i) => (
            <g key={i}>
              <rect x={x - 4} y={CY - h} width={8} height={h} fill={c.a} />
              <rect x={x - 3.5} y={CY - h - 2} width={7} height={3} fill={c.b} />
            </g>
          ))}
          {[CX - 58, CX + 4, CX + 48].map((x, i) => (
            <path key={i} d={`M${x} ${CY + 8}l4-12 4 12z`} fill={c.d} />
          ))}
        </>
      );
  }
}

/** Illustrated floating island for a world theme. */
export const WorldGlyph = memo(function WorldGlyph({ theme, locked = false, className }: { theme: WorldTheme; locked?: boolean; className?: string }) {
  const c = THEME_PALETTES[theme];
  return (
    <svg viewBox="0 0 190 112" aria-hidden="true" className={cn(locked && 'opacity-55 grayscale-[0.75]', className)}>
      <ellipse cx={CX} cy={CY + 8} rx={RX + 10} ry={RY + 10} fill={c.glow} opacity={locked ? 0.05 : 0.14} />
      <path d={`M${CX - RX} ${CY + 4}L${CX - 30} ${CY + 40}L${CX - 4} ${CY + 64}L${CX + 20} ${CY + 42}L${CX + RX} ${CY + 4}Z`} fill={c.rock} />
      <path d={`M${CX - 4} ${CY + 64}L${CX + 20} ${CY + 42}L${CX + RX} ${CY + 4}L${CX + 10} ${CY + 20}Z`} fill="#000" opacity={0.18} />
      <ellipse cx={CX} cy={CY + 5} rx={RX} ry={RY} fill={c.band} />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill={c.top} />
      <ellipse cx={CX} cy={CY + 1} rx={11} ry={4} fill={c.glow} opacity={0.8} />
      {decor(theme, c)}
    </svg>
  );
});
