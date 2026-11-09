// Gear in the idle game: ten slots, seven grades, an item level (the map it dropped on, 1-10), its base numbers
// (loot.js: weapon ATK, armour DEF and health, an accessory's stat) and one to three plain lines. Refining +1..+10.

import { Rng } from "../../lib/pixelfx/core/math.js?v=mw8xck5v";
import { SLOT_IDS, kindsOf, kindOf } from "../data/gear.js?v=mw8xck5v";
import { STARTER, wtypesOf } from "../data/weapons.js?v=mw8xck5v";
import { GRADES, GRADE, gradeOf, rollGrade, baseOf, refineChance, REFINE_MAX } from "../data/loot.js?v=mw8xck5v";

// the lines: points or percent, by item level (1-10) and grade (+10% a grade)
export const LINES = {
  str: { name: "STR", kind: "pt", per: 1.2 }, agi: { name: "AGI", kind: "pt", per: 1.2 }, vit: { name: "VIT", kind: "pt", per: 1.2 },
  int: { name: "INT", kind: "pt", per: 1.2 }, dex: { name: "DEX", kind: "pt", per: 1.2 }, luk: { name: "LUK", kind: "pt", per: 1.2 },
  atk: { name: "ATK", kind: "pt", per: 6 }, matk: { name: "MATK", kind: "pt", per: 6 }, hp: { name: "máu", kind: "pt", per: 25 }, def: { name: "DEF", kind: "pt", per: 2 },
  hpP: { name: "máu", kind: "pct", per: 1.5, key: "hp" }, aspd: { name: "tốc đánh", kind: "pct", per: 0.6 }, crit: { name: "chí mạng", kind: "pct", per: 0.4 },
  xp: { name: "kinh nghiệm", kind: "pct", per: 1.5 }, gold: { name: "vàng", kind: "pct", per: 2 },
};
// each slot its own lines
export const SLOT_POOL = {
  weapon: ["atk", "matk", "str", "dex", "crit", "aspd"], offhand: ["def", "hp", "vit", "hpP"], head: ["int", "dex", "def", "xp"],
  body: ["hp", "hpP", "def", "vit"], cloak: ["agi", "luk", "def", "aspd"], gloves: ["str", "dex", "atk", "crit"],
  boots: ["agi", "def", "aspd", "hp"], belt: ["hp", "vit", "str", "gold"], ring: ["str", "agi", "dex", "luk", "int", "crit", "atk"],
  amulet: ["int", "vit", "luk", "matk", "xp", "gold"],
};
export const LINE_COUNT = { white: 1, green: 1, blue: 2, yellow: 2, purple: 3, red: 3, rainbow: 3 };
const gIdx = (g) => GRADES.indexOf(gradeOf(g));
/** A line's value at an item level and grade (u in 0..1 picks within the range). */
export function lineValue(id, level, grade, u = 0.5) {
  const L = LINES[id], v = L.per * (1 + level) * (0.8 + 0.4 * u) * (1 + 0.1 * gIdx(grade));
  return L.kind === "pct" ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v));
}
export const lineText = (l, refine = 0) => { const L = LINES[l.id]; if (!L) return l.id; const v = Math.round(l.v * (1 + 0.05 * refine) * 10) / 10; return L.kind === "pct" ? `+${v}% ${L.name}` : `+${Math.round(v)} ${L.name}` };
/** The line as the hero sums it: { id (the stat it adds to), kind, v }. */
export const lineFor = (l) => { const L = LINES[l.id]; return { id: L.key ?? l.id, kind: L.kind, v: l.v } };

/** A piece of gear for a class from a map (its level), of a grade (rolled if not given). */
export function rollItem(seed, cls, mapLevel, grade = null, bonus = 0) {
  const r = new Rng(seed), level = Math.max(1, Math.min(10, mapLevel));
  const rarity = grade ?? rollGrade(() => r.next(), bonus);
  const slot = SLOT_IDS[Math.floor(r.next() * SLOT_IDS.length)];
  // early maps drop the class's own weapon only; later, every type it may hold
  const types = level <= 2 ? [STARTER[cls]] : wtypesOf(cls), wtype = slot === "weapon" ? types[Math.floor(r.next() * types.length)] : undefined;
  const kinds = kindsOf(slot, cls, wtype).length, variant = Math.floor(r.next() * Math.min(kinds, 1 + Math.ceil(level / 2)));
  const pool = [...SLOT_POOL[slot]], lines = [];
  for (let i = 0; i < LINE_COUNT[rarity] && pool.length; i++) { const id = pool.splice(Math.floor(r.next() * pool.length), 1)[0]; lines.push({ id, v: lineValue(id, level, rarity, r.next()) }) }
  return { id: `g${seed}`, cls, slot, ...(wtype ? { wtype } : {}), variant, rarity, level, refine: 0, lines };
}
export const starterWeapon = (cls) => ({ id: `start_${cls}`, cls, slot: "weapon", wtype: STARTER[cls], variant: 0, rarity: "white", level: 1, refine: 0, lines: [], starter: true });
export const itemName = (it) => `${kindOf(it)[0]} ${GRADE[gradeOf(it.rarity)].name} · cấp ${it.level}${it.refine ? ` +${it.refine}` : ""}`;
/** One number to compare by (Lực chiến). */
export function itemPower(it) {
  if (!it) return 0;
  const b = baseOf(it, STARTER[it.cls]) ?? {};
  let s = (b.atk ?? 0) / 4 + (b.def ?? 0) * 1.5 + (b.hp ?? 0) / 3 + (b.v ?? 0) * 3;
  for (const l of it.lines ?? []) s += (l.v * (1 + 0.05 * (it.refine ?? 0)) / LINES[l.id].per) * 3;
  return Math.round(s);
}
export const salvageValue = (it) => Math.round(GRADE[gradeOf(it.rarity)].salvage * (1 + 0.6 * ((it.level ?? 1) - 1)));
export const refineCost = (it) => ({ gold: Math.round(80 * (it.level ?? 1) * Math.pow(1.6, it.refine ?? 0)), crystals: Math.round(2 * (it.level ?? 1) * ((it.refine ?? 0) + 1)) });
export { refineChance, REFINE_MAX, GRADES, GRADE };
