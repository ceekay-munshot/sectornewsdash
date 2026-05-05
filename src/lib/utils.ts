// Tiny seeded PRNG for stable mock data across reloads.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function pickN<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const a = arr.slice();
  const out: T[] = [];
  for (let i = 0; i < n && a.length; i++) {
    const idx = Math.floor(rng() * a.length);
    out.push(a.splice(idx, 1)[0]);
  }
  return out;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// "MAR-27" — uppercase three-letter month, dash, zero-padded day.
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const month = d
    .toLocaleString("en-US", { month: "short" })
    .toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

export function classNames(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Map a heat score (0..100) to a thermal-style gradient that biases hot.
 * Cold sectors land green, the active mid-range (40–65) walks through
 * teal → amber → orange so realistic heat scores read vivid rather than
 * stuck on muted blue, and 75+ saturates fully red.
 */
export function heatToColor(heat: number): { hex: string; rgb: string } {
  const h = clamp(heat, 0, 100);
  const stops: Array<[number, [number, number, number]]> = [
    [0, [34, 197, 94]],
    [30, [6, 182, 212]],
    [50, [234, 179, 8]],
    [65, [249, 115, 22]],
    [80, [239, 68, 68]],
    [100, [220, 38, 38]],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (h >= stops[i][0] && h <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const t = (h - lo[0]) / span;
  const r = Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * t);
  const g = Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * t);
  const b = Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * t);
  const hex =
    "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return { hex, rgb: `${r},${g},${b}` };
}
