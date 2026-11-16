import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { seededRandom } from '../../simulator/environment/geometry';
import type { DecalId, PatternId } from '../model/robot-config';

/*
 * Pattern and decal textures, drawn procedurally on canvases (no image
 * files). Patterns are mostly light/dark so they MULTIPLY the part colour
 * (a blue body gets blue stripes); flame and warning carry their own
 * colours. Swap any entry for a real texture later — callers only see
 * `patternTexture(id)` / `decalTexture(...)`.
 */

type Draw = (g: CanvasRenderingContext2D, s: number) => void;

const shade = (k: number) => `rgb(${Math.round(255 * k)},${Math.round(255 * k)},${Math.round(255 * k)})`;

const PATTERN_DRAW: Readonly<Record<Exclude<PatternId, 'none'>, Draw>> = {
  stripes: (g, s) => {
    g.fillStyle = shade(0.55);
    for (let i = -s; i < s * 2; i += s / 4) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + s / 10, 0);
      g.lineTo(i + s / 10 - s, s);
      g.lineTo(i - s, s);
      g.fill();
    }
  },
  camo: (g, s) => {
    const r = seededRandom(7);
    for (const k of [0.78, 0.6, 0.45]) {
      g.fillStyle = shade(k);
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        g.ellipse(r() * s, r() * s, s * (0.06 + r() * 0.1), s * (0.04 + r() * 0.07), r() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  },
  digital: (g, s) => {
    const r = seededRandom(11);
    const c = s / 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = r();
      if (v < 0.45) continue;
      g.fillStyle = shade(v < 0.7 ? 0.8 : v < 0.88 ? 0.62 : 0.45);
      g.fillRect(x * c, y * c, c, c);
    }
  },
  carbon: (g, s) => {
    const c = s / 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      g.fillStyle = shade((x + y) % 2 ? 0.42 : 0.3);
      g.fillRect(x * c, y * c, c, c);
      g.fillStyle = shade(0.55);
      g.fillRect(x * c, y * c + ((x + y) % 2 ? 0 : c / 2), c, c / 6);
    }
  },
  flame: (g, s) => {
    const r = seededRandom(5);
    for (const [col, h] of [
      ['#ef4444', 0.62],
      ['#f97316', 0.48],
      ['#facc15', 0.3],
    ] as const) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, s);
      for (let x = 0; x <= s; x += s / 8) g.lineTo(x, s - s * h * (0.55 + r() * 0.45));
      g.lineTo(s, s);
      g.fill();
    }
  },
  circuit: (g, s) => {
    const r = seededRandom(3);
    g.strokeStyle = shade(0.5);
    g.fillStyle = shade(0.5);
    g.lineWidth = s / 64;
    for (let i = 0; i < 10; i++) {
      let x = Math.round(r() * 8) * (s / 8);
      let y = Math.round(r() * 8) * (s / 8);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        if (r() < 0.5) x += (r() < 0.5 ? -1 : 1) * (s / 8);
        else y += (r() < 0.5 ? -1 : 1) * (s / 8);
        g.lineTo(x, y);
      }
      g.stroke();
      g.beginPath();
      g.arc(x, y, s / 40, 0, Math.PI * 2);
      g.fill();
    }
  },
  warning: (g, s) => {
    g.fillStyle = '#facc15';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#1a1d26';
    for (let i = -s; i < s * 2; i += s / 3) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + s / 6, 0);
      g.lineTo(i + s / 6 - s, s);
      g.lineTo(i - s, s);
      g.fill();
    }
  },
  gradient: (g, s) => {
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, shade(1));
    grad.addColorStop(1, shade(0.42));
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  },
};

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  return g ? [c, g] : null;
}

function drawPattern(id: Exclude<PatternId, 'none'>, size: number) {
  const cg = canvas(size);
  if (!cg) return null;
  const [c, g] = cg;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  PATTERN_DRAW[id](g, size);
  return c;
}

const patternCache = new Map<PatternId, Texture | null>();

/** Tiling texture for a pattern (app-lifetime cache; null for "none" / no DOM). */
export function patternTexture(id: PatternId): Texture | null {
  if (id === 'none') return null;
  if (!patternCache.has(id)) {
    const c = drawPattern(id, 256);
    const t = c ? new CanvasTexture(c) : null;
    if (t) {
      t.wrapS = t.wrapT = RepeatWrapping;
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
    }
    patternCache.set(id, t);
  }
  return patternCache.get(id) ?? null;
}

/** Small swatch image for the pattern picker. */
export function patternPreview(id: PatternId): string | null {
  if (id === 'none') return null;
  return drawPattern(id, 72)?.toDataURL() ?? null;
}

// ── decals ───────────────────────────────────────────────────────────────

function star(g: CanvasRenderingContext2D, s: number, points = 5, inner = 0.42) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = (i % 2 ? inner : 1) * s * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
  }
  g.closePath();
}

const poly = (g: CanvasRenderingContext2D, s: number, pts: readonly (readonly [number, number])[]) => {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)));
  g.closePath();
};

const DECAL_SHAPE: Readonly<Record<Exclude<DecalId, 'number' | 'initials'>, Draw>> = {
  star: (g, s) => star(g, s),
  lightning: (g, s) => poly(g, s, [[0.58, 0.06], [0.24, 0.56], [0.48, 0.56], [0.38, 0.94], [0.78, 0.4], [0.54, 0.4]]),
  rocket: (g, s) => {
    g.beginPath();
    g.moveTo(0.5 * s, 0.06 * s);
    g.quadraticCurveTo(0.74 * s, 0.3 * s, 0.66 * s, 0.66 * s);
    g.lineTo(0.8 * s, 0.84 * s);
    g.lineTo(0.6 * s, 0.8 * s);
    g.lineTo(0.5 * s, 0.94 * s);
    g.lineTo(0.4 * s, 0.8 * s);
    g.lineTo(0.2 * s, 0.84 * s);
    g.lineTo(0.34 * s, 0.66 * s);
    g.quadraticCurveTo(0.26 * s, 0.3 * s, 0.5 * s, 0.06 * s);
    g.closePath();
  },
  shield: (g, s) => {
    g.beginPath();
    g.moveTo(0.5 * s, 0.06 * s);
    g.lineTo(0.86 * s, 0.2 * s);
    g.quadraticCurveTo(0.84 * s, 0.72 * s, 0.5 * s, 0.94 * s);
    g.quadraticCurveTo(0.16 * s, 0.72 * s, 0.14 * s, 0.2 * s);
    g.closePath();
  },
  gear: (g, s) => star(g, s, 8, 0.78),
  logo: (g, s) => {
    // Onespace mark, outer ring (the night sky and rocket are added by `onespaceInner`).
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2);
  },
};

/** Onespace mark inside the ring: dark night disc, a rocket climbing to the upper right, a porthole. */
function onespaceInner(g: CanvasRenderingContext2D, s: number, color: string) {
  const dark = 'rgba(8,14,30,0.85)';
  g.fillStyle = dark;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(s / 2, s / 2);
  g.rotate(Math.PI / 4);
  g.scale(0.52, 0.52);
  g.translate(-s / 2, -s / 2);
  g.fillStyle = color;
  DECAL_SHAPE.rocket(g, s);
  g.fill();
  g.fillStyle = dark;
  g.beginPath();
  g.arc(s / 2, s * 0.36, s * 0.09, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

const decalCache = new Map<string, Texture | null>();

/** Transparent texture with the decal drawn in `color` (app-lifetime cache). */
export function decalTexture(id: DecalId, color: string, text = ''): Texture | null {
  const key = `${id}|${color}|${text}`;
  if (!decalCache.has(key)) {
    const cg = canvas(256);
    let t: Texture | null = null;
    if (cg) {
      const [c, g] = cg;
      const s = 256;
      g.lineJoin = 'round';
      g.lineWidth = 14;
      g.strokeStyle = 'rgba(8,14,30,0.55)';
      g.fillStyle = color;
      if (id === 'number' || id === 'initials') {
        const label = text || (id === 'number' ? '01' : 'RV');
        g.font = `900 ${label.length > 2 ? 104 : 138}px Inter, "Segoe UI", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.strokeText(label, s / 2, s / 2 + 8);
        g.fillText(label, s / 2, s / 2 + 8);
      } else {
        DECAL_SHAPE[id](g, s);
        g.stroke();
        g.fill();
        if (id === 'gear') {
          g.fillStyle = 'rgba(8,14,30,0.75)';
          g.beginPath();
          g.arc(s / 2, s / 2, s * 0.14, 0, Math.PI * 2);
          g.fill();
        } else if (id === 'logo') {
          onespaceInner(g, s, color);
        }
      }
      t = new CanvasTexture(c);
      t.colorSpace = SRGBColorSpace;
    }
    decalCache.set(key, t);
  }
  return decalCache.get(key) ?? null;
}

/** Decal icon for the picker (white on transparent). */
export function decalPreview(id: DecalId): string | null {
  const t = decalTexture(id, '#ffffff');
  return t ? ((t.image as HTMLCanvasElement).toDataURL() ?? null) : null;
}
