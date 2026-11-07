// A sensible bot: learns new elements first, then levels what it has, fuses, mends a low wall. Used by the
// balance script and by the admin page to try the current tuning.

import { createWorld, step, drain, chooseCard, summary } from "./world.js";
import { speedFactor } from "./status.js";
import { freshProfile, runOptions, rollItem } from "../meta/profile.js";
import { TALENT_TREES, START_MARKS, homeSchool } from "../data/meta.js";
import { ELEMENTS, MARTIAL, MARKS } from "../data/elements.js";
import { CLASS_IDS } from "../data/classes.js";

const score = (w, c) => c.kind === "imbue" ? 5 : c.kind === "repair" ? (w.wall.hp < w.wall.max * 0.5 ? 9 : 0) : c.elem === "chaos" ? 10 : c.kind === "fuse" ? 8 : c.kind === "learn" ? 6 : c.kind === "mastery" ? 5 : c.kind === "level" ? 4 : c.kind === "react" ? 3 : 2;

/**
 * A profile at three stages, for every class: "fresh"; "half" (half its tree, six marks of its own school);
 * "full" (its whole tree, all twenty marks, gear of its own).
 */
export function presetProfile(kind) {
  const p = freshProfile();
  p.classes = [...CLASS_IDS];
  if (kind === "fresh") return p;
  const frac = kind === "half" ? 0.5 : 1;
  p.mageLevel = kind === "half" ? 6 : 20;
  for (const c of CLASS_IDS) {
    const pc = p.perClass[c], home = homeSchool(c);
    for (const t of TALENT_TREES[c]) pc.talents[t.id] = Math.round(t.max * frac);
    const own = home === "arcane" ? ELEMENTS : home === "martial" ? MARTIAL : [...MARTIAL.slice(0, 3), ...ELEMENTS];
    pc.marks = kind === "half" ? [...new Set([...START_MARKS[c], ...own])].slice(0, 6) : [...MARKS];
    if (kind === "full") pc.gear = Object.fromEntries(["weapon", "cloak", "amulet"].map((s, i) => [s, { ...rollItem(11 * (i + 1), 5, 0, { cls: c, marks: pc.marks }), slot: s }]));
  }
  return p;
}

/** Play one whole run; returns its summary plus how the boss went. */
export function playRun({ profile = "fresh", chapter = 1, seed = 1, cls = "mage", maxMinutes = 25 } = {}) {
  const p = typeof profile === "string" ? presetProfile(profile) : profile;
  const w = createWorld(seed, runOptions(p, { chapter, cls }));
  let bossTime = 0, bossHeld = 0, unstop = 0, bossMove = 0, bossWalk = 0;
  for (let i = 0; i < 60 * 60 * maxMinutes && w.phase !== "won" && w.phase !== "lost"; i++) {
    step(w, 1 / 60);
    for (const ev of drain(w)) if (ev.type === "unstoppable") unstop++;
    const boss = w.enemies.find((e) => e.boss && e.hp > 0);
    if (boss) {
      bossTime += 1 / 60;
      if (boss.status.stun > 0 || boss.status.freeze > 0 || boss.status.root > 0) bossHeld += 1 / 60;
      if (boss.state === "walk" || boss.blocked) { bossWalk += 1 / 60; if (!boss.blocked) bossMove += speedFactor(boss) / 60 }
    }
    if (w.phase === "cards") chooseCard(w, w.cards.map((c, j) => [score(w, c), j]).sort((a, b) => b[0] - a[0])[0][1]);
  }
  return { ...summary(w), bossTime, bossHeld, unstop, bossMove, bossWalk };
}

/** Many runs: win rate, waves, how long bosses spent held. */
export function trial(opts, seeds) {
  const rs = seeds.map((seed) => playRun({ ...opts, seed }));
  const n = rs.length, sum = (f) => rs.reduce((a, r) => a + f(r), 0);
  return {
    runs: n, won: sum((r) => (r.won ? 1 : 0)), winRate: sum((r) => (r.won ? 1 : 0)) / n, waves: sum((r) => r.waves) / n,
    bossHeld: sum((r) => r.bossHeld) / Math.max(1e-9, sum((r) => r.bossTime)),
    bossSpeed: sum((r) => r.bossMove) / Math.max(1e-9, sum((r) => r.bossWalk)),   // how fast it really went, 1 = free
    unstop: sum((r) => r.unstop) / n,
    chaos: sum((r) => r.chaos) / n, kills: sum((r) => r.kills) / n,
  };
}
