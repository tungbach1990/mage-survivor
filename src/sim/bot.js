// A sensible bot: learns new elements first, then levels what it has, fuses, mends a low wall. Used by the
// balance script and by the admin page to try the current tuning.

import { createWorld, step, drain, chooseCard, summary } from "./world.js?v=mw8jyp5q";
import { speedFactor } from "./status.js?v=mw8jyp5q";
import { freshProfile, runOptions, rollItem } from "../meta/profile.js?v=mw8jyp5q";
import { TALENT_TREES, START_MARKS, homeSchool } from "../data/meta.js?v=mw8jyp5q";
import { PASSIVES, passiveCost } from "../data/passives.js?v=mw8jyp5q";
import { autoStats, claimGear, itemScore, equip } from "../meta/profile.js?v=mw8jyp5q";
import { liveRefresh } from "../meta/live.js?v=mw8jyp5q";
import { talentCost } from "../data/meta.js?v=mw8jyp5q";
import { ELEMENTS, MARTIAL, MARKS } from "../data/elements.js?v=mw8jyp5q";
import { CLASS_IDS } from "../data/classes.js?v=mw8jyp5q";

/** The card the bot (and the idle toggle) would take. */
export const bestCard = (w) => w.cards.map((c, j) => [score(w, c), j]).sort((a, b) => b[0] - a[0])[0][1];
export const score = (w, c) => c.kind === "imbue" ? 5 : c.kind === "repair" ? (w.wall.hp < w.wall.max * 0.5 ? 9 : 0) : c.elem === "chaos" ? 10 : c.kind === "fuse" ? 8 : c.kind === "learn" ? 6 : c.kind === "mastery" ? 5 : c.kind === "level" ? 4 : c.kind === "react" ? 3 : 2;

/**
 * A profile at five stages, for every class: "fresh"; "early" (a few runs in: a quarter of its tree, four
 * marks); "half" (half its tree, six marks of its own school); "most" (three quarters, eight marks, some gear);
 * "full" (its whole tree, all twenty marks, gear of its own).
 */
const STAGE = { early: [0.25, 4, 3], half: [0.5, 6, 6], most: [0.75, 8, 12], full: [1, 20, 20] };
export function presetProfile(kind) {
  const p = freshProfile();
  p.classes = [...CLASS_IDS];
  if (kind === "fresh") { for (const c of CLASS_IDS) autoStats(p, c); return p }
  // "k1000": each class has had 1000 crystals spent on it, the cheapest talent or passive level first; the
  // account at level 4 (the runs that earned them)
  if (kind === "k1000") {
    p.mageLevel = 4;
    for (const c of CLASS_IDS) autoStats(p, c);
    for (const c of CLASS_IDS) {
      const pc = p.perClass[c];
      let left = 1000;
      for (;;) {
        const opts = [
          ...TALENT_TREES[c].filter((t) => (pc.talents[t.id] ?? 0) < t.max).map((t) => ["t", t.id, talentCost(t, pc.talents[t.id] ?? 0)]),
          ...PASSIVES[c].filter((ps) => (pc.passives[ps.id] ?? 0) < ps.max).map((ps) => ["p", ps.id, passiveCost(ps, pc.passives[ps.id] ?? 0)]),
        ].sort((a, b) => a[2] - b[2]);
        if (!opts.length || opts[0][2] > left) break;
        const [k, id, cost] = opts[0];
        left -= cost;
        if (k === "t") pc.talents[id] = (pc.talents[id] ?? 0) + 1; else pc.passives[id] = (pc.passives[id] ?? 0) + 1;
      }
    }
    return p;
  }
  const [frac, nMarks, lvl] = STAGE[kind];
  p.mageLevel = lvl;
  for (const c of CLASS_IDS) {
    const pc = p.perClass[c], home = homeSchool(c);
    for (const t of TALENT_TREES[c]) pc.talents[t.id] = Math.round(t.max * frac);
    for (const ps of PASSIVES[c]) pc.passives[ps.id] = Math.max(ps.sig ? 1 : 0, Math.round(10 * frac * 0.8));
    // what a player would open first: the marks its own book uses most (the Acolyte: light and water)
    const own = home === "arcane" ? ELEMENTS : home === "martial" ? MARTIAL : ["light", "water", ...MARTIAL, ...ELEMENTS];
    pc.marks = kind === "full" ? [...MARKS] : [...new Set([...START_MARKS[c], ...own])].slice(0, nMarks);
    if (kind === "full" || kind === "most") pc.gear = Object.fromEntries(["weapon", "offhand", "head", "body", "cloak", "gloves", "boots", "belt", "ring", "amulet"].map((s, i) => [s, { ...rollItem(11 * (i + 1), 5, 0, { cls: c, marks: pc.marks }), slot: s }]));
  }
  for (const c of CLASS_IDS) autoStats(p, c);
  return p;
}

/** Play one whole run; returns its summary plus how the boss went. */
export function playRun({ profile = "fresh", chapter = 1, seed = 1, cls = "mage", maxMinutes = 25 } = {}) {
  const p = typeof profile === "string" ? presetProfile(profile) : profile;
  const w = createWorld(seed, runOptions(p, { chapter, cls }));
  let bossTime = 0, bossHeld = 0, unstop = 0, bossMove = 0, bossWalk = 0;
  for (let i = 0; i < 60 * 60 * maxMinutes && w.phase !== "won" && w.phase !== "lost"; i++) {
    step(w, 1 / 60);
    let changed = false;
    for (const ev of drain(w)) {
      if (ev.type === "unstoppable") unstop++;
      // the account levels up: the new points spent; a boss's gear: worn if it's better
      if (ev.type === "acctLevel") { p.mageLevel = ev.level; autoStats(p, cls); changed = true }
      if (ev.type === "pickup" && ev.kind === "gear") {
        const it = claimGear(p, cls, { grade: ev.grade, level: ev.level ?? w.chapter }, seed); w.run.gearClaimed = (w.run.gearClaimed ?? 0) + 1;
        if (p.bag.includes(it) && itemScore(it) > itemScore(p.perClass[cls].gear[it.slot])) { equip(p, cls, it.id); changed = true }
      }
    }
    if (changed) liveRefresh(w, p);
    const boss = w.enemies.find((e) => e.boss && e.hp > 0);
    if (boss) {
      bossTime += 1 / 60;
      if (boss.status.stun > 0 || boss.status.freeze > 0 || boss.status.root > 0) bossHeld += 1 / 60;
      if (boss.state === "walk" || boss.blocked) { bossWalk += 1 / 60; if (!boss.blocked) bossMove += speedFactor(boss) / 60 }
    }
    if (w.phase === "cards") chooseCard(w, bestCard(w));
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
