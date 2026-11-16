import type { Quality } from './settings-store';

/**
 * Render-resolution cap per quality level, shared by every 3D canvas. Pixel
 * cost grows with dpr²: at 1920×1080, 1.75 = 6.4 Mpx/frame vs 1.25 = 3.2 Mpx —
 * the main lever for FPS.
 */
export const QUALITY_DPR: Readonly<Record<Quality, [number, number]>> = { high: [1, 1.5], medium: [1, 1.25], low: [1, 1] };
