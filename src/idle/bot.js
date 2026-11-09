// The bot (and the "auto" settings): spends stat and skill points, wears the better gear. And a fast run of the
// battle with no drawing, to balance the climb.
import { createBattle, step, drain, refresh } from "./world.js?v=mw8wxgia";
import { SKILL_TREE, canLearn, skillPointsAt } from "./skills.js?v=mw8wxgia";
import { pointsAt, spentOn, statCost, freshStats, STAT_MAX } from "../data/stats.js?v=mw8wxgia";
import { rollItem, itemPower, starterWeapon } from "./items.js?v=mw8wxgia";
import { SLOT_IDS } from "../data/gear.js?v=mw8wxgia";

export const STAT_PLAN = {
  mage: [["int", 0.55], ["dex", 0.3], ["vit", 0.15]], swordman: [["str", 0.5], ["vit", 0.3], ["agi", 0.2]],
  archer: [["dex", 0.55], ["agi", 0.3], ["vit", 0.15]], thief: [["agi", 0.45], ["str", 0.35], ["luk", 0.2]],
  acolyte: [["int", 0.45], ["vit", 0.35], ["dex", 0.2]], merchant: [["str", 0.5], ["vit", 0.35], ["luk", 0.15]],
};
/** A fresh hero for a class. */
export function freshHero(cls) {
  return { cls, level: 1, xp: 0, gold: 0, map: 1, stats: freshStats(), skills: {}, passives: {}, gear: { ...Object.fromEntries(SLOT_IDS.map((s) => [s, null])), weapon: starterWeapon(cls) }, autoStats: true, autoSkills: true, autoMap: true, order: [], off: {} };
}
/** Spend the stat points left, in the plan's shares (the lowest share-to-target first). */
export function autoStats(h) {
  const plan = STAT_PLAN[h.cls];
  for (let guard = 0; guard < 2000; guard++) {
    const left = pointsAt(h.level) - spentOn(h.stats);
    let best = null, bestGap = -1;
    const tot = plan.reduce((a, [s]) => a + h.stats[s], 0) + 1;
    for (const [s, share] of plan) { if (h.stats[s] >= STAT_MAX) continue; const gap = share - h.stats[s] / tot; if (gap > bestGap && statCost(h.stats[s]) <= left) { bestGap = gap; best = s } }
    if (!best) break;
    h.stats[best]++;
  }
}
/** Spend the skill points left: the newest skill it may learn first, then the strongest ones up. */
export function autoSkills(h) {
  const tree = SKILL_TREE[h.cls];
  for (let guard = 0; guard < 200; guard++) {
    const used = Object.values(h.skills).reduce((a, b) => a + b, 0);
    if (used >= skillPointsAt(h.level)) break;
    const fresh = tree.filter((s) => !h.skills[s.id] && canLearn(h.cls, s.id, h.level, h.skills)).sort((a, b) => b.lv - a.lv)[0];
    const up = tree.filter((s) => h.skills[s.id] && canLearn(h.cls, s.id, h.level, h.skills)).sort((a, b) => b.lv - a.lv || h.skills[a.id] - h.skills[b.id])[0];
    const pick = fresh ?? up; if (!pick) break;
    h.skills[pick.id] = (h.skills[pick.id] ?? 0) + 1;
  }
}
/** Wear a piece if it's stronger than what's in its slot. Returns true if worn. */
export function wearIfBetter(h, it) { if (it.cls !== h.cls) return false; if (itemPower(it) > itemPower(h.gear[it.slot])) { h.gear[it.slot] = it; return true } return false }

/** Play `seconds` of the battle fast; the bot spends points and wears drops. Returns the battle. */
export function simulate(h, seconds, seed = 1, dt = 0.1) {
  let n = seed * 7919;
  autoStats(h); autoSkills(h);
  const w = createBattle(seed, h, { onLevel: (hero) => { autoStats(hero); autoSkills(hero) } });
  refresh(w);
  for (let t = 0; t < seconds; t += dt) {
    step(w, dt);
    for (const ev of drain(w)) if (ev.type === "gear") { const it = rollItem(++n, h.cls, ev.level, null, ev.boss ? 0.25 : 0); if (wearIfBetter(h, it)) refresh(w) }
  }
  return w;
}
