// A sensible bot: learns new elements first, then levels what it has, fuses, mends a low wall. Used by the
// balance script and by the admin page to try the current tuning.

import { createWorld, step, drain, chooseCard, summary } from "./world.js";
import { speedFactor } from "./status.js";
import { freshProfile, runOptions, rollItem } from "../meta/profile.js";
import { TALENTS } from "../data/meta.js";
import { ELEMENTS } from "../data/elements.js";
import { CLASS_IDS } from "../data/classes.js";

const score = (w, c) => c.kind === "imbue" ? 5 : c.kind === "repair" ? (w.wall.hp < w.wall.max * 0.5 ? 9 : 0) : c.elem === "chaos" ? 10 : c.kind === "fuse" ? 8 : c.kind === "learn" ? 6 : c.kind === "mastery" ? 5 : c.kind === "level" ? 4 : c.kind === "react" ? 3 : 2;

/** A profile at three stages: "fresh", "half" (half the talents, six elements), "full" (all of it, gear). */
export function presetProfile(kind) {
  const p = freshProfile();
  if (kind === "fresh") { p.classes = [...CLASS_IDS]; return p }
  p.classes = [...CLASS_IDS];
  const frac = kind === "half" ? 0.5 : 1;
  for (const t of TALENTS) p.talents[t.id] = Math.round(t.max * frac);
  p.unlocked = kind === "half" ? ELEMENTS.slice(0, 6) : [...ELEMENTS];
  p.mageLevel = kind === "half" ? 6 : 20;
  if (kind === "full") { p.gear.staff = rollItem(11, 5); p.gear.cloak = rollItem(22, 5); p.gear.amulet = rollItem(33, 5) }
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
