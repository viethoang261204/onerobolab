/** Robot's projected position in viewport pixels (written by the canvas, read by the tour). */
let point: { x: number; y: number } | null = null;

export const robotScreen = {
  set(p: { x: number; y: number } | null): void {
    point = p;
  },
  get(): { x: number; y: number } | null {
    return point;
  },
};
