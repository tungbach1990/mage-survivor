// Changing the profile in the middle of a run: stats raised, gear swapped, the account levelled up. The run's
// numbers move by what changed (so the cards taken in the run keep their effect), the wall's health with them.
import { runOptions } from "./profile.js?v=mw9emti8";
import { DEFAULT_MODS, baseWallMax, snapMods } from "../sim/world.js?v=mw9emti8";
import { derive } from "../data/stats.js?v=mw9emti8";
import { btbaOf, basicIdOf } from "../data/weapons.js?v=mw9emti8";
import { SKILLS } from "../data/skills.js?v=mw9emti8";
import { refreshPassives } from "../sim/upgrades.js?v=mw9emti8";

export function liveRefresh(w, p) {
  const o = runOptions(p, { cls: w.cls, chapter: w.chapter, endless: w.endless }), before = w.baseMods, after = o.mods, def = DEFAULT_MODS();
  const oldWall = baseWallMax(before, w.derived);
  for (const [k, v] of Object.entries(after)) {
    if (k === "elem" || k === "imbue") continue;
    if (typeof v !== "number") { w.mods[k] = v; continue }
    const b = before[k] ?? def[k] ?? 0;
    if ((def[k] ?? 0) === 1 && b !== 0) w.mods[k] = (w.mods[k] ?? 1) * (v / b);
    else w.mods[k] = (w.mods[k] ?? 0) + v - b;
  }
  for (const [k, v] of Object.entries(after.elem ?? {})) w.mods.elem[k] = (w.mods.elem[k] ?? 1) * (v / (before.elem?.[k] ?? 1));
  for (const k of Object.keys(before.elem ?? {})) if (!(k in (after.elem ?? {}))) w.mods.elem[k] = (w.mods.elem[k] ?? 1) / before.elem[k];
  w.mods.imbue ??= {};
  for (const k of new Set([...Object.keys(after.imbue ?? {}), ...Object.keys(before.imbue ?? {})])) { const n = (w.mods.imbue[k] ?? 0) + (after.imbue?.[k] ?? 0) - (before.imbue?.[k] ?? 0); if (n > 1e-9) w.mods.imbue[k] = n; else delete w.mods.imbue[k] }
  w.baseMods = snapMods(after);
  w.derived = derive(o.stats, o.acctLevel, w.cls);
  w.weapon = o.weapon; w.derived.btba = btbaOf(w.cls, w.weapon?.wtype ?? "fist");
  const now = Object.keys(w.skills).find((id) => SKILLS[id]?.basic), want = basicIdOf(w.cls, w.weapon?.wtype);
  if (now && now !== want) { const lv = w.skills[now].level; delete w.skills[now]; w.skills = { [want]: { level: lv, cd: 0.3 }, ...w.skills } }
  w.look = o.look; w.novice = o.novice;
  // the wall: its maximum by the change, its health in proportion (never to nothing)
  const delta = baseWallMax(after, w.derived) - oldWall;
  if (delta) { const k = w.wall.hp / w.wall.max; w.wall.max = Math.max(1, w.wall.max + delta); w.wall.hp = Math.max(1, Math.min(w.wall.max, w.wall.max * k)) }
  refreshPassives(w);
}
