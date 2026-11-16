const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** HH:MM:SS local time for console timestamps. */
export const formatClock = (epochMs: number): string => {
  const d = new Date(epochMs);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
