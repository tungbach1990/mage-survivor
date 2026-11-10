// Ten waves a chapter (the same shapes, tougher each chapter), and Endless: waves made up as they come.
// Each group: [start s, type, count, gap s]. Bosses on waves 5 (a small one) and 10.

import { ENDLESS } from "../data/chapters.js?v=mwaciyfp";

export const WAVES = [
  [[0, "slime", 8, 1.3]],
  [[0, "slime", 8, 1.1], [4, "goblin", 4, 2]],
  [[0, "goblin", 8, 1.2], [5, "wolf", 6, 1.4]],
  [[0, "skeleton", 6, 1.6], [2, "goblin", 6, 1.3], [8, "wolf", 4, 1]],
  [[0, "slime", 10, 0.9], [4, "orc", 2, 5], [10, "golem", 1, 0, { hp: 0.55, scale: "small", boss: "mini" }]],
  [[0, "wolf", 12, 0.8], [3, "skeleton", 6, 1.5]],
  [[0, "orc", 4, 3], [1, "goblin", 10, 0.9], [8, "skeleton", 4, 1.2]],
  [[0, "wolf", 11, 0.6], [4, "orc", 3, 2.5], [12, "golem", 1, 0, { hp: 0.7, scale: "small", boss: "mini" }]],
  [[0, "skeleton", 12, 0.9], [3, "orc", 6, 2], [6, "goblin", 8, 0.8]],
  [[0, "slime", 10, 0.6], [2, "wolf", 10, 0.7], [5, "orc", 6, 2], [8, "skeleton", 8, 1], [14, "golem", 1, 0, { hp: 1.3, boss: "chapter" }]],
];

// each wave tougher than the last: its monsters' health and their blows (wave 10: x6.9 health, x1.56 blows)
export const HP_GROWTH = 1.24;
export const DMG_GROWTH = 1.05;

/** The spawn list of wave i (0-based) of a chapter: [{ t, type, opts }] in time order. */
export function spawnList(i) {
  const out = [];
  for (const [t0, type, n, gap, opts] of WAVES[i]) for (let k = 0; k < n; k++) out.push({ t: t0 + k * gap, type, opts: opts ?? {} });
  return out.sort((a, b) => a.t - b.t);
}

/** Endless wave n (0-based): more of everything, a boss every ten. */
export function endlessList(n, rng) {
  const pool = ["slime", "goblin", "wolf", "skeleton", "orc", "bat", "archer", "bomber", ...(n >= 5 ? ["shaman", "brute"] : [])], out = [];
  const groups = 3 + Math.min(4, Math.floor(n / 4));
  for (let g = 0; g < groups; g++) {
    const type = pool[Math.floor(rng.next() * pool.length)], count = 6 + Math.floor(n / 3) + Math.floor(rng.next() * 4);
    const gap = Math.max(0.35, 1.1 - n * 0.02), t0 = g * 3;
    for (let k = 0; k < count; k++) out.push({ t: t0 + k * gap, type, opts: {} });
  }
  if ((n + 1) % ENDLESS.bossEvery === 0) out.push({ t: 12, type: "golem", opts: { hp: 1.5, boss: "chapter" } });
  return out.sort((a, b) => a.t - b.t);
}
