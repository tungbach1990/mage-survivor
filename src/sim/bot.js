// A sensible bot: learns new elements first, then levels what it has, fuses, mends a low wall. Used by the
// balance script and by the admin page to try the current tuning.

import { createWorld, step, drain, chooseCard, summary } from "./world.js?v=mwadl24d";
import { speedFactor } from "./status.js?v=mwadl24d";
import { freshProfile, runOptions, settle, buyTalent, drawMark, drawCost } from "../meta/profile.js?v=mwadl24d";
import { TALENT_TREES, talentCost } from "../data/meta.js?v=mwadl24d";
import { CLASS_IDS } from "../data/classes.js?v=mwadl24d";

/** The card the bot (and the idle toggle) would take. */
export const bestCard = (w) => w.cards.map((c, j) => [score(w, c), j]).sort((a, b) => b[0] - a[0])[0][1];
export const score = (w, c) => c.kind === "imbue" ? 5 : c.kind === "repair" ? (w.wall.hp < w.wall.max * 0.5 ? 9 : 0) : c.elem === "chaos" ? 10 : c.kind === "fuse" ? 8 : c.kind === "learn" ? 6 : c.kind === "mastery" ? 5 : c.kind === "level" ? 4 : c.kind === "react" ? 3 : 2;

/** Spend a character's crystals as a player would: a mark when it's within reach (half the crystals), else the cheapest node. */
export function spend(p, cls, reserve = 0) {
  for (let guard = 0; guard < 400; guard++) {
    const left = p.crystals - reserve, c = p.perClass[cls], mark = drawCost(p, cls);
    if (mark <= left * 0.6 && drawMark(p, cls)) continue;
    const opts = TALENT_TREES[cls].map((t) => [t.id, talentCost(t, c.talents[t.id] ?? 0)]).sort((a, b) => a[1] - b[1]);
    if (!opts.length || opts[0][1] > left || !buyTalent(p, cls, opts[0][0])) break;
  }
}
/**
 * A profile at a stage, for every class: "fresh"; "k1000" (1000 crystals spent as a player would); "early",
 * "half", "most", "full" (that many crystals spent: 1500, 6000, 15000, 40000).
 */
const SPENT = { k1000: 1000, early: 1500, half: 6000, most: 15000, full: 40000 };
export function presetProfile(kind) {
  const p = freshProfile();
  p.classes = [...CLASS_IDS];
  if (kind === "fresh") return p;
  for (const c of CLASS_IDS) { p.current = c; p.crystals = SPENT[kind] ?? 0; spend(p, c) }
  p.crystals = 0; p.current = "mage";
  return p;
}
/** A player's climb: play, settle, spend, again. Returns each run's summary. */
export function climb(cls, runs, seed = 1, chapterOf = (p) => Math.min(5, p.best.chapter + 1)) {
  const p = freshProfile(); p.classes = [...CLASS_IDS]; p.current = cls; p.lastClass = cls;
  const out = [];
  for (let i = 0; i < runs; i++) {
    const ch = chapterOf(p), r = playRun({ profile: p, chapter: ch, seed: seed * 1000 + i, cls });
    settle(p, r, { cls }); spend(p, cls); out.push({ ...r, crystalsAfter: p.crystals, best: p.best.chapter });
  }
  return { p, runs: out };
}

/** Play one whole run; returns its summary plus how the boss went. */
export function playRun({ profile = "fresh", chapter = 1, seed = 1, cls = "mage", maxMinutes = 25 } = {}) {
  const p = typeof profile === "string" ? presetProfile(profile) : profile;
  if (p.perClass[cls]) p.current = cls;
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
    if (w.phase === "cards") chooseCard(w, bestCard(w));
  }
  return { ...summary(w), bossTime, bossHeld, unstop, bossMove, bossWalk, minutes: w.t / 60 };
}

/** Many runs: win rate, waves, how long bosses spent held. */
export function trial(opts, seeds) {
  const rs = seeds.map((seed) => playRun({ ...opts, seed }));
  const n = rs.length, sum = (f) => rs.reduce((a, r) => a + f(r), 0);
  return {
    runs: n, won: sum((r) => (r.won ? 1 : 0)), winRate: sum((r) => (r.won ? 1 : 0)) / n, waves: sum((r) => r.waves) / n,
    bossHeld: sum((r) => r.bossHeld) / Math.max(1e-9, sum((r) => r.bossTime)),
    bossSpeed: sum((r) => r.bossMove) / Math.max(1e-9, sum((r) => r.bossWalk)),
    unstop: sum((r) => r.unstop) / n,
    chaos: sum((r) => r.chaos) / n, kills: sum((r) => r.kills) / n, minutes: sum((r) => r.minutes) / n,
  };
}
