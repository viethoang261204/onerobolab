import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/*
 * Procedural surface textures for the natural look (Starter Island
 * missions 1–3): drawn once on a canvas, tiled, cached for the app lifetime
 * like the shared materials. No downloads, ≤512 px each.
 */

type Draw = (ctx: CanvasRenderingContext2D, size: number, rnd: () => number) => void;

const cache = new Map<string, Texture>();

/** Small deterministic PRNG (textures look the same on every load). */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(key: string, size: number, seed: number, draw: Draw, repeat = 1): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size, prng(seed));
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** Speckles drawn so they wrap seamlessly across the tile edge. */
function speckle(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, n: number, r: [number, number], colors: readonly string[], alpha: [number, number]) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const rad = r[0] + rnd() * (r[1] - r[0]);
    ctx.globalAlpha = alpha[0] + rnd() * (alpha[1] - alpha[0]);
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)]!;
    for (const ox of [-size, 0, size])
      for (const oy of [-size, 0, size]) {
        if (x + ox < -rad || x + ox > size + rad || y + oy < -rad || y + oy > size + rad) continue;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  ctx.globalAlpha = 1;
}

/**
 * Ground detail, multiplied over the terrain's vertex colours: near-white
 * base with darker soil flecks and lighter blade streaks, so the colour still
 * comes from the terrain palette.
 */
export const groundDetailTexture = () =>
  make('ground', 512, 11, (ctx, size, rnd) => {
    ctx.fillStyle = '#e9ede4';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rnd, 900, [6, 22], ['#c9d1bf', '#d8dfcf', '#f6f8f1'], [0.25, 0.55]);
    speckle(ctx, size, rnd, 2600, [0.6, 1.8], ['#8f8a6c', '#a59d7c', '#77806a'], [0.35, 0.7]);
    // Blade streaks: short strokes in random directions.
    ctx.lineCap = 'round';
    for (let i = 0; i < 5200; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const a = -Math.PI / 2 + (rnd() - 0.5) * 1.6;
      const l = 3 + rnd() * 6;
      ctx.globalAlpha = 0.18 + rnd() * 0.3;
      ctx.strokeStyle = rnd() < 0.5 ? '#ffffff' : '#b6c2a6';
      ctx.lineWidth = 0.7 + rnd() * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

/** Light concrete paving slabs with joints and wear. One tile = 2 × 2 slabs. */
export const pavingTexture = () =>
  make('paving', 512, 21, (ctx, size, rnd) => {
    const half = size / 2;
    for (let i = 0; i < 4; i++) {
      const sx = (i % 2) * half;
      const sy = Math.floor(i / 2) * half;
      const shade = 222 + Math.floor(rnd() * 16);
      ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
      ctx.fillRect(sx, sy, half, half);
    }
    speckle(ctx, size, rnd, 3000, [0.5, 1.6], ['#9aa1ad', '#b8bec8', '#f5f7fa'], [0.25, 0.6]);
    speckle(ctx, size, rnd, 60, [10, 30], ['#c7ccd4', '#e6e9ee'], [0.15, 0.3]);
    ctx.strokeStyle = '#8c939f';
    ctx.lineWidth = 5;
    for (const p of [0, half, size]) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
  });

/** Fine-grained asphalt with aggregate and a few tar patches. */
export const asphaltTexture = () =>
  make('asphalt', 512, 31, (ctx, size, rnd) => {
    ctx.fillStyle = '#4a505b';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rnd, 40, [18, 46], ['#3f444e', '#555b66'], [0.25, 0.45]);
    speckle(ctx, size, rnd, 9000, [0.5, 1.4], ['#2d3139', '#6b717c', '#7e848f', '#393e47'], [0.4, 0.9]);
  });

/** Packed dirt trail with pebbles and tyre-worn lighter centre. */
export const dirtTexture = () =>
  make('dirt', 512, 41, (ctx, size, rnd) => {
    ctx.fillStyle = '#b9966a';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rnd, 220, [8, 30], ['#a88457', '#c7a679', '#b08d60'], [0.25, 0.5]);
    speckle(ctx, size, rnd, 4200, [0.6, 1.8], ['#7d6141', '#d6bb93', '#8f7250'], [0.35, 0.8]);
    // Pebbles: small rounded stones with a lit top edge.
    for (let i = 0; i < 380; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 1.6 + rnd() * 3.2;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = rnd() < 0.5 ? '#8d8679' : '#a39c8e';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + rnd() * 0.3), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#e4ddcf';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.25, y - r * 0.3, r * 0.45, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

/** Leaf clusters for foliage (multiplied by each instance's colour). */
export const foliageTexture = () =>
  make('foliage', 256, 51, (ctx, size, rnd) => {
    ctx.fillStyle = '#c8d0c2';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 3 + rnd() * 5;
      const l = 120 + Math.floor(rnd() * 135);
      ctx.fillStyle = `rgb(${l},${Math.min(255, l + 12)},${l - 10})`;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

/** Vertical bark grooves (multiplied by the trunk colour). */
export const barkTexture = () =>
  make('bark', 256, 61, (ctx, size, rnd) => {
    ctx.fillStyle = '#d6cfc6';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * size;
      ctx.strokeStyle = rnd() < 0.6 ? '#7e7266' : '#a2978a';
      ctx.globalAlpha = 0.5 + rnd() * 0.4;
      ctx.lineWidth = 1.5 + rnd() * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      let px = x;
      for (let y = 0; y <= size; y += 16) {
        px += (rnd() - 0.5) * 6;
        ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

/** Weathered timber planks (bridge decks). */
export const planksTexture = () =>
  make('planks', 256, 71, (ctx, size, rnd) => {
    const n = 4;
    const h = size / n;
    for (let i = 0; i < n; i++) {
      const l = 150 + Math.floor(rnd() * 40);
      ctx.fillStyle = `rgb(${l},${Math.floor(l * 0.72)},${Math.floor(l * 0.48)})`;
      ctx.fillRect(0, i * h, size, h);
      ctx.strokeStyle = 'rgba(70,45,25,0.35)';
      for (let k = 0; k < 9; k++) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        const y = i * h + rnd() * h;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y + (rnd() - 0.5) * 6, size * 0.7, y + (rnd() - 0.5) * 6, size, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,25,12,0.75)';
      ctx.fillRect(0, i * h, size, 3);
    }
  });

/** Radial falloff (opaque centre → clear rim) for soft contact shadows under props. */
export const contactShadowTexture = () =>
  make('contact', 128, 81, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
