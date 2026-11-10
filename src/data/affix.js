// Item lines, two kinds each: points (a flat number) and percent. Their size goes with the item's level (and
// its grade: +20% a grade over a white); each attribute has its own unit factor on the same table.
//   level:  1        2        3         4         5
//   points: 10~15    50~75    150~200   300~350   500~550
//   %:      10~15%   20~25%   30~35%    40~45%    50~55%
// Elements and martial marks: points of that kind of damage on every basic attack, or a percent of the blow's
// own damage added as that kind (10% fire on a 200 blow: +20 fire). It leaves the mark, if the class has it open.

import { ELEM, ELEMENTS, MARTIAL, MARKS } from "./elements.js?v=mwad0nah";

export const PT_TABLE = [null, [10, 15], [50, 75], [150, 200], [300, 350], [500, 550]];
export const PCT_TABLE = [null, [10, 15], [20, 25], [30, 35], [40, 45], [50, 55]];
export const GRADE_IDX = { white: 0, green: 1, blue: 2, yellow: 3, purple: 4, red: 5, rainbow: 6, common: 0, rare: 2, epic: 4, legendary: 5 };
/** A line's grade bonus: +10% a grade over a white (the base numbers take +20%). */
export const gradeMul = (grade) => 1 + 0.1 * (GRADE_IDX[grade] ?? 0);
/** Lines an item of this grade rolls. */
export const LINES = { white: 1, green: 1, blue: 2, yellow: 2, purple: 3, red: 3, rainbow: 4 };
/** Refining: every level lifts the lines 5% (the base numbers 10%, loot.js). */
export const REFINE_LINE = 0.05;
// each slot its own lines: [attribute or "MARK" or "STAT", the kinds it may take]
export const SLOT_LINES = {
  weapon:  [["dmg", ["pt", "pct"]], ["MARK", ["pt", "pct"]], ["crit", ["pct"]], ["cd", ["pct"]]],
  offhand: [["wall", ["pt", "pct"]], ["def", ["pct"]], ["MARK", ["pct"]], ["vit", ["pt", "pct"]]],
  head:    [["int", ["pt", "pct"]], ["dex", ["pt", "pct"]], ["cd", ["pct"]], ["xp", ["pct"]]],
  body:    [["wall", ["pt", "pct"]], ["def", ["pct"]], ["vit", ["pt", "pct"]], ["regen", ["pt", "pct"]]],
  cloak:   [["agi", ["pt", "pct"]], ["luk", ["pt", "pct"]], ["aura", ["pct"]], ["area", ["pct"]]],
  gloves:  [["str", ["pt", "pct"]], ["dex", ["pt", "pct"]], ["dmg", ["pct"]], ["crit", ["pct"]]],
  boots:   [["agi", ["pt", "pct"]], ["react", ["pct"]], ["area", ["pct"]]],
  belt:    [["wall", ["pt", "pct"]], ["regen", ["pt", "pct"]], ["gold", ["pt", "pct"]], ["str", ["pt", "pct"]]],
  ring:    [["STAT", ["pt", "pct"]], ["tier", ["pct"]], ["react", ["pct"]]],
  amulet:  [["STAT", ["pt", "pct"]], ["xp", ["pct"]], ["MARK", ["pct"]]],
};

const S = (id, name, pt, pct, applyPt, applyPct, extra = {}) => ({ id, name, pt, pct, applyPt, applyPct, ...extra });
const STAT_NAME = { str: "STR", agi: "AGI", vit: "VIT", int: "INT", dex: "DEX", luk: "LUK" };
/** Every attribute: its points factor and percent factor (null: that kind doesn't exist), and what each does. */
export const ATTRS = [
  S("wall", "máu tường", 1, 1, (m, v) => (m.wallMax += v), (m, v) => (m.wallMaxPct += v / 100)),
  S("dmg", "sát thương", 0.2, 0.4, (m, v) => (m.basicFlat = (m.basicFlat ?? 0) + v), (m, v) => (m.dmg *= 1 + v / 100), { ptText: "sát thương mỗi đòn thường" }),
  S("def", "DEF", 0.1, 1, (m, v) => (m.def = (m.def ?? 0) + v), (m, v) => (m.defPct = (m.defPct ?? 0) + v / 100), { pctText: "DEF trang bị" }),
  ...Object.entries(STAT_NAME).map(([s, n]) => S(s, n, 0.1, 0.4, (m, v) => ((m.statAdd ??= {})[s] = (m.statAdd[s] ?? 0) + v), (m, v) => ((m.statPct ??= {})[s] = (m.statPct[s] ?? 0) + v / 100))),
  S("regen", "hồi tường", 0.2, 1, (m, v) => (m.regen += v / 10), (m, v) => (m.healMul *= 1 + v / 100), { ptText: "máu tường mỗi 10 giây", pctText: "hồi máu" }),
  S("gold", "vàng", 0.02, 1, (m, v) => (m.killGold += v), (m, v) => (m.gold *= 1 + v / 100), { ptText: "vàng mỗi quái" }),
  S("cd", "hồi chiêu", null, 0.3, null, (m, v) => (m.cd *= 1 - v / 100), { pctSign: "−" }),
  S("crit", "chí mạng", null, 0.2, null, (m, v) => (m.crit += v / 100)),
  S("area", "diện rộng", null, 0.4, null, (m, v) => (m.area *= 1 + v / 100)),
  S("react", "sát thương phản ứng", null, 0.6, null, (m, v) => (m.reactDmg *= 1 + v / 100)),
  S("tier", "sát thương tầng", null, 0.6, null, (m, v) => (m.tierDmg *= 1 + v / 100)),
  S("aura", "thời gian dấu", null, 0.5, null, (m, v) => (m.auraDur *= 1 + v / 100)),
  S("xp", "kinh nghiệm", null, 0.5, null, (m, v) => (m.xp *= 1 + v / 100)),
  S("crystal", "tinh thể", null, 0.5, null, (m, v) => (m.crystalMul = (m.crystalMul ?? 1) * (1 + v / 100))),
  // a kind of damage with every basic attack: an element or a martial mark
  ...MARKS.map((mk) => S(`el_${mk}`, ELEM[mk].name, 0.2, 0.6, (m, v) => ((m.addPt ??= {})[mk] = (m.addPt[mk] ?? 0) + v), (m, v) => ((m.addPct ??= {})[mk] = (m.addPct[mk] ?? 0) + v / 100), { mark: mk, martial: MARTIAL.includes(mk) })),
];
export const ATTR = Object.fromEntries(ATTRS.map((a) => [a.id, a]));
export const PLAIN_ATTRS = ATTRS.filter((a) => !a.mark);

const fmt = (v) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
/** A line's value: the table for the item's level, its attribute's factor, the grade. */
export function lineValue(attr, kind, level, grade, u) {
  const a = ATTR[attr], f = kind === "pt" ? a.pt : a.pct, [lo, hi] = (kind === "pt" ? PT_TABLE : PCT_TABLE)[Math.max(1, Math.min(5, level))];
  return fmt((lo + (hi - lo) * u) * f * gradeMul(grade));
}
/** The range a line can roll at this level and grade (for the hall's text). */
export const lineRange = (attr, kind, level, grade) => [lineValue(attr, kind, level, grade, 0), lineValue(attr, kind, level, grade, 1)];
/** A line's value as it stands (refined). */
export const lineNow = (l, refine = 0) => fmt(l.v * (1 + REFINE_LINE * refine));
export function lineText(l, refine = 0) {
  const a = ATTR[l.id]; if (!a) return l.id;
  l = { ...l, v: lineNow(l, refine) };
  if (a.mark) return l.kind === "pt" ? `+${l.v} sát thương ${a.name}` : `+${l.v}% ${a.name}`;
  return l.kind === "pt" ? `+${l.v} ${a.ptText ?? a.name}` : `${a.pctSign ?? "+"}${l.v}% ${a.pctText ?? a.name}`;
}
/** Apply one line to the run's numbers (marks only if open: `open` a Set, or null for all). */
export function applyLine(m, l, open = null, refine = 0) {
  const a = ATTR[l.id]; if (!a) return;
  if (a.mark && open && !open.has(a.mark)) return;
  (l.kind === "pt" ? a.applyPt : a.applyPct)?.(m, l.v * (1 + REFINE_LINE * refine));
}
/** Roll the lines of an item: element lines from those the chapter drops, one martial line at most. */
export function rollLines(next, level, grade, elems, slot = "ring", open = null) {
  const n = LINES[grade] ?? 1, out = [], pool = [...(SLOT_LINES[slot] ?? SLOT_LINES.ring)];
  const markPool = [...elems, ...MARTIAL], openPool = open ? markPool.filter((m) => open.includes(m)) : [];
  for (let i = 0; i < n && pool.length; i++) {
    const [what, kinds] = pool.splice(Math.floor(next() * pool.length), 1)[0];
    let attr = what;
    if (what === "MARK") attr = `el_${(openPool.length && next() < 0.7 ? openPool : markPool)[Math.floor(next() * (openPool.length && next() < 0.7 ? openPool : markPool).length)]}`;
    else if (what === "STAT") attr = Object.keys(STAT_NAME)[Math.floor(next() * 6)];
    if (!ATTR[attr]) continue;
    const kind = kinds[Math.floor(next() * kinds.length)];
    out.push({ id: attr, kind, v: lineValue(attr, kind, level, grade, next()) });
  }
  return out;
}
/** One number to compare items by: the base numbers and the lines (a mark not open counts nothing), refined. */
export function gearScore(it, base, open = null) {
  if (!it) return 0;
  let s = 0;
  if (base?.atk) s += base.atk / 40; if (base?.def) s += base.def / 6; if (base?.hp) s += base.hp / 12; if (base?.v) s += base.v / 2;
  for (const l of it.affixes ?? []) {
    const a = ATTR[l.id]; if (!a || (a.mark && open && !open.has(a.mark))) continue;
    const ref = lineValue(l.id, l.kind, 1, "white", 0.5) || 1;
    s += 0.5 * (l.v * (1 + REFINE_LINE * (it.refine ?? 0))) / ref;
  }
  return Math.round(s * 10);
}
/** The elements an item's lines carry (for its name), in order. */
export const elemsOfLines = (lines) => [...new Set((lines ?? []).map((l) => ATTR[l.id]?.mark).filter((m) => m && ELEMENTS.includes(m)))];
export const martialOfLines = (lines) => (lines ?? []).find((l) => ATTR[l.id]?.martial) ?? null;
