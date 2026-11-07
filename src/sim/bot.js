// A sensible bot: learns new elements first, then levels what it has, fuses, mends a low wall. Used by the
// balance script and by the admin page to try the current tuning.

import { createWorld, step, drain, chooseCard, summary } from "./world.js?v=mw6zzix7";
import { speedFactor } from "./status.js?v=mw6zzix7";
import { freshProfile, runOptions, rollItem } from "../meta/profile.js?v=mw6zzix7";
import { TALENT_TREES, START_MARKS, homeSchool } from "../data/meta.js?v=mw6zzix7";
import { ELEMENTS, MARTIAL, MARKS } from "../data/elements.js?v=mw6zzix7";
import { CLASS_IDS } from "../data/classes.js?v=mw6zzix7";

const score = (w, c) => c.kind === "imbue" ? 5 : c.kind === "repair" ? (w.wall.hp < w.wall.max * 0.5 ? 9 : 0) : c.elem === "chaos" ? 10 : c.kind === "fuse" ? 8 : c.kind === "learn" ? 6 : c.kind === "mastery" ? 5 : c.kind === "level" ? 4 : c.kind === "react" ? 3 : 2;

/**
 * A profile at five stages, for every class: "fresh"; "early" (a few runs in: a quarter of its tree, four
 * marks); "half" (half its tree, six marks of its own school); "most" (three quarters, eight marks, some gear);
 * "full" (its whole tree, all twenty marks, gear of its own).
 */
const STAGE = { early: [0.25, 4, 3], half: [0.5, 6, 6], most: [0.75, 8, 12], full: [1, 20, 20] };
export function presetProfile(kind) {
  const p = freshProfile();
  p.classes = [...CLASS_IDS];
  if (kind === "fresh") return p;
  const [frac, nMarks, lvl] = STAGE[kind];
  p.mageLevel = lvl;
  for (const c of CLASS_IDS) {
    const pc = p.perClass[c], home = homeSchool(c);
    for (const t of TALENT_TREES[c]) pc.talents[t.id] = Math.round(t.max * frac);
    // what a player would open first: the marks its own book uses most (the Acolyte: light and water)
    const own = home === "arcane" ? ELEMENTS : home === "martial" ? MARTIAL : ["light", "water", ...MARTIAL, ...ELEMENTS];
    pc.marks = kind === "full" ? [...MARKS] : [...new Set([...START_MARKS[c], ...own])].slice(0, nMarks);
    if (kind === "full" || kind === "most") pc.gear = Object.fromEntries(["weapon", "cloak", "amulet"].map((s, i) => [s, { ...rollItem(11 * (i + 1), 5, 0, { cls: c, marks: pc.marks }), slot: s }]));
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
