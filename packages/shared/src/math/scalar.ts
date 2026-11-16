export const TAU = Math.PI * 2;

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const degToRad = (degrees: number): number => (degrees * Math.PI) / 180;

export const radToDeg = (radians: number): number => (radians * 180) / Math.PI;

/** Wrap an angle into the half-open interval (-π, π]. */
export const normalizeAngle = (radians: number): number => {
  let a = radians % TAU;
  if (a <= -Math.PI) a += TAU;
  else if (a > Math.PI) a -= TAU;
  return a;
};

/** Shortest signed rotation from `from` to `to`, in (-π, π]. */
export const angleDelta = (from: number, to: number): number => normalizeAngle(to - from);
