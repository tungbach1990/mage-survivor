// CHAOS: ten auras on one monster tear a black hole open there. It rips space (0.6 s), drags everything in on a
// tightening spiral (2.2 s), collapses (0.3 s) and blows (0.4 s): half a monster's life and more, a tenth of a
// boss's, and every survivor is left carrying all ten auras.

import { ENEMIES } from "./enemies.js?v=mw7klme6";
import { ELEMENTS } from "../data/elements.js?v=mw7klme6";
import { alive, inBlast } from "./field.js?v=mw7klme6";
import { damage, applyAura } from "./combat.js?v=mw7klme6";
import { reactT } from "../data/tuning.js?v=mw7klme6";

export const BLACK_HOLE = { rift: 0.6, pull: 2.2, collapse: 0.3, blast: 0.4, radius: 60, reach: 110, pullSpeed: [20, 140], bossPull: 0.3, dmgFrac: 0.5, dmgFlat: 200, bossFrac: 0.1 };
const PHASES = ["rift", "pull", "collapse", "blast"];

export function startBlackHole(w, x, y) {
  const lvl = w.skills?.chaosseed?.level ?? 0, grow = 1 + 0.1 * lvl;
  const bh = { x, y, t: 0, phase: "rift", r: BLACK_HOLE.radius * grow * (w.mods?.bhRadius ?? 1), power: grow, blown: false };
  w.blackholes.push(bh);
  w.events.push({ type: "blackhole", phase: "rift", x, y, r: bh.r });
  return bh;
}

export function updateBlackHoles(w, dt) {
  for (const bh of w.blackholes) {
    bh.t += dt;
    const { rift, pull, collapse, blast } = BLACK_HOLE;
    const phase = bh.t < rift ? "rift" : bh.t < rift + pull ? "pull" : bh.t < rift + pull + collapse ? "collapse" : bh.t < rift + pull + collapse + blast ? "blast" : "done";
    if (phase !== bh.phase) { bh.phase = phase; if (phase !== "done") w.events.push({ type: "blackhole", phase, x: bh.x, y: bh.y, r: bh.r }) }
    if (phase === "pull" || phase === "collapse") {
      // a spiral in, faster as it goes; the field sheared round it
      const u = Math.min(1, (bh.t - rift) / pull), speed = BLACK_HOLE.pullSpeed[0] + (BLACK_HOLE.pullSpeed[1] - BLACK_HOLE.pullSpeed[0]) * u * u;
      for (const e of alive(w)) {
        const dx = bh.x - e.x, dy = bh.y - e.y, d = Math.hypot(dx, dy * 1.5);
        if (d > BLACK_HOLE.reach || d < 1) continue;
        const k = (ENEMIES[e.type].boss ? BLACK_HOLE.bossPull : 1) * speed * dt * (1 - d / (BLACK_HOLE.reach * 1.2)), sw = 0.6;
        e.x += (dx / d) * k - (dy / d) * k * sw; e.y += (dy / d) * k + (dx / d) * k * sw * 0.5;
        if (Math.hypot(bh.x - e.x, bh.y - e.y) < 3) { e.x = bh.x + (e.id % 5) - 2; e.y = bh.y + (e.id % 3) - 1 }
      }
    }
    if (phase === "blast" && !bh.blown) {
      bh.blown = true;
      for (const e of alive(w)) {
        if (!inBlast(e, bh.x, bh.y, bh.r)) continue;
        const def = ENEMIES[e.type];
        const amount = (def.boss ? e.max * BLACK_HOLE.bossFrac * bh.power : (e.max * BLACK_HOLE.dmgFrac + BLACK_HOLE.dmgFlat * (w.mods?.dmg ?? 1)) * bh.power) * (reactT("chaos").dmg ?? 1) * (w.chaosPow ?? 1);
        damage(w, e, amount, "chaos", { reaction: true, raw: true });
        // survivors keep all the marks (for the tiers), but can't open another black hole for a while: no chains
        if (e.hp > 0) { for (const el of w.schoolMarks ?? ELEMENTS) applyAura(w, e, el, { noBurst: true }); e.tiers.add(10); e.noChaosUntil = w.t + 30 }
      }
      w.hitstop = Math.max(w.hitstop, 0.15);
    }
  }
  w.blackholes = w.blackholes.filter((b) => b.phase !== "done");
}

export const blackHolePhases = PHASES;
