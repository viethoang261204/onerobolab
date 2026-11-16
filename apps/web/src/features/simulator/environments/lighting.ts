/*
 * Environment lighting profiles — pure data. Each profile changes the whole
 * mood: sky gradient, sun colour / angle / strength, sky-ground fill, rim
 * light, fog, reflection studio colours and ambient particles.
 */

export type ParticleKind = 'pollen' | 'dust' | 'snow' | 'spores' | 'motes' | 'embers';

export interface LightingProfile {
  readonly sky: { readonly zenith: string; readonly horizon: string; readonly ground: string };
  /** Sun glow sprite on the dome. */
  readonly sunGlow: string;
  readonly sun: { readonly color: string; readonly intensity: number; readonly direction: readonly [number, number, number] };
  readonly hemi: { readonly sky: string; readonly ground: string; readonly intensity: number };
  readonly rim: { readonly color: string; readonly intensity: number };
  readonly fog: { readonly color: string; readonly near: number; readonly far: number };
  /** Colours of the soft light panels baked into the reflection map. */
  readonly studio: { readonly key: string; readonly fill: string; readonly floor: string };
  readonly particles: { readonly kind: ParticleKind; readonly color: string; readonly count: number } | null;
}

export type LightingProfileId = 'daylight' | 'naturalDay' | 'warmAfternoon' | 'warehouse' | 'goldenGorge' | 'coolDaylight' | 'humidCanopy';

export const LIGHTING: Readonly<Record<LightingProfileId, LightingProfile>> = {
  /** Starter: bright clean daylight, soft blue sky. */
  daylight: {
    sky: { zenith: '#3f8fe8', horizon: '#dcefff', ground: '#cfe7f7' },
    sunGlow: '#fff4d6',
    sun: { color: '#fff1d8', intensity: 2.6, direction: [6, 10, 4] },
    hemi: { sky: '#dcecff', ground: '#9fbf7a', intensity: 1.05 },
    rim: { color: '#c7d7ff', intensity: 0.5 },
    fog: { color: '#d6eafa', near: 14, far: 46 },
    studio: { key: '#ffffff', fill: '#bcd8ff', floor: '#8fbf6a' },
    particles: { kind: 'pollen', color: '#fff7c2', count: 70 },
  },
  /**
   * Natural look (filmic tone mapping): mid-morning sun at ~38°, long soft
   * shadows, low sky fill for depth, blue aerial haze toward the hills.
   */
  naturalDay: {
    sky: { zenith: '#4a86d0', horizon: '#cfe2f4', ground: '#b9cbb0' },
    sunGlow: '#fff2d2',
    sun: { color: '#fff0d6', intensity: 3.6, direction: [7, 6.2, 4.6] },
    hemi: { sky: '#bcd4f2', ground: '#6b7a48', intensity: 0.7 },
    rim: { color: '#d4e2ff', intensity: 0.35 },
    fog: { color: '#c5d9ec', near: 9, far: 40 },
    studio: { key: '#fff4e0', fill: '#a9c6ea', floor: '#6f8a4c' },
    particles: { kind: 'pollen', color: '#fff7d6', count: 36 },
  },
  /** Canyon: warm late afternoon, long shadows, dusty haze. */
  warmAfternoon: {
    sky: { zenith: '#4d86c9', horizon: '#f6d3a6', ground: '#e9b98a' },
    sunGlow: '#ffd7a0',
    sun: { color: '#ffd3a1', intensity: 2.8, direction: [-7, 6.5, 3] },
    hemi: { sky: '#ffe6c7', ground: '#b0643a', intensity: 0.9 },
    rim: { color: '#9fc0ff', intensity: 0.55 },
    fog: { color: '#efc9a0', near: 12, far: 40 },
    studio: { key: '#fff0dc', fill: '#ffb27a', floor: '#c77a45' },
    particles: { kind: 'dust', color: '#ffd9a8', count: 80 },
  },
  /** Warehouse interior under skylights: neutral key, warm lamps. */
  warehouse: {
    sky: { zenith: '#5b7fa8', horizon: '#f0d9b8', ground: '#d8b48c' },
    sunGlow: '#ffe2b0',
    sun: { color: '#fff3e2', intensity: 2.2, direction: [3, 11, 5] },
    hemi: { sky: '#fff1dd', ground: '#7d6a58', intensity: 1.05 },
    rim: { color: '#9ec5ff', intensity: 0.6 },
    fog: { color: '#e9ccaa', near: 12, far: 38 },
    studio: { key: '#fff4e0', fill: '#9cc4ff', floor: '#8a7a68' },
    particles: { kind: 'dust', color: '#fff0d0', count: 60 },
  },
  /** Canyon bridge: golden light raking across the gorge. */
  goldenGorge: {
    sky: { zenith: '#3f79c4', horizon: '#ffd2a0', ground: '#f0b27c' },
    sunGlow: '#ffc98a',
    sun: { color: '#ffcf96', intensity: 3.0, direction: [8, 5.5, -3] },
    hemi: { sky: '#ffe3c2', ground: '#8f4f2e', intensity: 0.85 },
    rim: { color: '#a7c8ff', intensity: 0.7 },
    fog: { color: '#f2c79c', near: 13, far: 44 },
    studio: { key: '#fff0dc', fill: '#ff9d63', floor: '#a4552e' },
    particles: { kind: 'dust', color: '#ffe2b8', count: 60 },
  },
  /** Frost: cool crisp daylight, pale blue haze, falling snow. */
  coolDaylight: {
    sky: { zenith: '#5a93d6', horizon: '#e8f4ff', ground: '#dbeaf8' },
    sunGlow: '#f4fbff',
    sun: { color: '#eef6ff', intensity: 2.4, direction: [5, 8, 6] },
    hemi: { sky: '#e3f1ff', ground: '#a9c4dc', intensity: 1.15 },
    rim: { color: '#8fd3ff', intensity: 0.7 },
    fog: { color: '#dcecf8', near: 11, far: 36 },
    studio: { key: '#ffffff', fill: '#a8dcff', floor: '#d8e8f6' },
    particles: { kind: 'snow', color: '#ffffff', count: 260 },
  },
  /** Jungle: humid soft light filtered through the canopy. */
  humidCanopy: {
    sky: { zenith: '#4d9ab8', horizon: '#d7f0dc', ground: '#a8cfa0' },
    sunGlow: '#fff6c8',
    sun: { color: '#fff0c8', intensity: 2.2, direction: [4, 9, -5] },
    hemi: { sky: '#dff5dc', ground: '#4c6b33', intensity: 1.0 },
    rim: { color: '#b8ffd8', intensity: 0.45 },
    fog: { color: '#c9e6cf', near: 9, far: 30 },
    studio: { key: '#fffbe6', fill: '#9fe0b0', floor: '#3f6a34' },
    particles: { kind: 'spores', color: '#e8ffb0', count: 90 },
  },
};
