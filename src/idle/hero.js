// A hero's numbers: from its level, the stat points spent (and the class's bonus), its gear and its passives,
// its buffs. Ragnarok-style (simplified): ATK from the weapon and STR (DEX for bows), MATK from INT, HIT/FLEE,
// crit from LUK, ASPD from the weapon, AGI and DEX, casting from DEX.

import { totalsOf, aspdOf, hitsPerSec, freshStats } from "../data/stats.js?v=mw98ji0s";
import { btbaOf, STARTER, WTYPES } from "../data/weapons.js?v=mw98ji0s";
import { baseOf } from "../data/loot.js?v=mw98ji0s";
import { PASSIVE_TREE } from "./passives.js?v=mw98ji0s";
import { lineFor } from "./items.js?v=mw98ji0s";
import { BAL } from "./balance.js?v=mw98ji0s";

export const CLASS_IDS = ["mage", "swordman", "archer", "thief", "acolyte", "merchant"];
// the classes that cast (their skills use MATK and casting time)
export const CASTERS = new Set(["mage", "acolyte"]);

/** Everything the gear adds: base numbers (ATK, DEF, health, stats) and its lines. */
export function gearSum(gear, cls) {
  const g = { atk: 0, matk: 0, def: 0, hp: 0, stat: freshZero(), pct: { hp: 0, aspd: 0, crit: 0, xp: 0, gold: 0 } };
  for (const it of Object.values(gear ?? {})) {
    if (!it) continue;
    const b = baseOf(it, STARTER[cls]);
    if (b?.atk) { if (it.wtype === "staff") { g.matk += b.atk; g.atk += Math.round(b.atk * 0.4) } else g.atk += b.atk }
    if (b?.def) g.def += b.def;
    if (b?.hp) g.hp += b.hp;
    if (b?.stat) g.stat[b.stat] += b.v;
    const r = 1 + 0.05 * (it.refine ?? 0);
    for (const raw of it.lines ?? []) {
      const l = lineFor(raw), v = l.v * r;
      if (l.kind === "pct") g.pct[l.id] = (g.pct[l.id] ?? 0) + v / 100;
      else if (l.id in g.stat) g.stat[l.id] += Math.round(v);
      else g[l.id] = (g[l.id] ?? 0) + v;
    }
  }
  return g;
}
const freshZero = () => ({ str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 });

/** What the passives add (fractions, and a few flat numbers). */
export function passiveSum(cls, levels) {
  const p = { atk: 0, matk: 0, hp: 0, def: 0, aspd: 0, crit: 0, sp: 0, xp: 0, gold: 0, cd: 0 };
  for (const ps of PASSIVE_TREE[cls] ?? []) { const l = levels?.[ps.id] ?? 0; if (l) p[ps.stat] += ps.per * l }
  return p;
}

/**
 * The hero, worked out. h: { cls, level, stats, gear, passives }; buff: the active buffs' sums.
 * Returns { maxHp, maxSp, atk, matk, def (fraction cut), softDef, hit, flee, crit, aspd, aps, castMul, wtype, ... }.
 */
export function heroStats(h, buff = {}) {
  const cls = h.cls, L = h.level, g = gearSum(h.gear, cls), P = passiveSum(cls, h.passives);
  const t = totalsOf(h.stats ?? freshStats(), cls, L);
  for (const s of Object.keys(g.stat)) t[s] += g.stat[s];
  const weapon = h.gear?.weapon, wtype = weapon ? weapon.wtype ?? STARTER[cls] : null;
  const ranged = wtype === "bow";
  const main = ranged ? t.dex : t.str, sub = ranged ? t.str : t.dex;
  const statAtk = main + Math.floor(main / 10) ** 2 + Math.floor(sub / 5) + Math.floor(t.luk / 5);
  const fist = wtype ? 0 : 8 + L;   // bare hands still hit
  const atk = (statAtk + g.atk + fist) * (1 + P.atk + (buff.atk ?? 0));
  const matk = (t.int * 2 + Math.floor(t.int / 11) ** 2 + g.matk + (CASTERS.has(cls) ? 10 + L * 1.5 : 0)) * (1 + P.matk + (buff.atk ?? 0));
  // the class's late-game factor (balance.js)
  const lf = 1 - (1 - (BAL.late[cls] ?? 1)) * Math.min(1, (L - 1) / 69);
  const maxHp = Math.round((35 + L * 9 + g.hp) * (1 + t.vit / 100) * (1 + (g.pct.hp ?? 0) + P.hp));
  const maxSp = Math.round((10 + L * 2) * (1 + t.int / 100) * (1 + P.sp));
  const defRaw = g.def * (1 + P.def);
  const def = Math.min(0.75, defRaw / (100 + defRaw) + (buff.def ?? 0));
  const sm = Math.min(0.45, (g.pct.aspd ?? 0) + P.aspd + (buff.aspd ?? 0) + (L + t.agi) * 0.001);
  const aspd = aspdOf(btbaOf(cls, wtype ?? "fist"), t.agi, t.dex, sm);
  return {
    cls, level: L, totals: t, wtype, ranged,
    maxHp, maxSp, atk: atk * lf, matk: matk * lf, def, softDef: t.vit * 0.5,
    hit: L + t.dex, flee: L + t.agi,
    crit: Math.min(0.75, (1 + t.luk * 0.3) / 100 + (g.pct.crit ?? 0) + P.crit + (buff.crit ?? 0)),
    aspd, aps: hitsPerSec(aspd) * BAL.aspd, castMul: Math.max(0, 1 - t.dex / 150),
    regenHp: 1 + Math.floor(t.vit / 5) + L * 0.2, regenSp: 1 + Math.floor(t.int / 6) + L * 0.05,
    xpMul: 1 + (g.pct.xp ?? 0) + P.xp, goldMul: 1 + (g.pct.gold ?? 0) + P.gold, cdMul: Math.max(0.5, 1 - P.cd),
    melee: !ranged && !CASTERS.has(cls) || (!ranged && wtype !== "staff"),
  };
}

/** A hit's chance against a flee. */
export const hitChance = (hit, flee) => Math.max(0.05, Math.min(1, (80 + hit - flee) / 100));
/** A blow's damage after a defence (fraction cut, then a flat cut), at least 1. */
export const afterDef = (dmg, defPct, flat = 0) => Math.max(1, dmg * (1 - defPct) - flat);
export { WTYPES };
