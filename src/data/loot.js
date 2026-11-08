// Loot: what a slain monster leaves on the ground, to fly into the hero — experience, crystals, and from the
// bosses of waves 5, 8 and 10 (not always) a piece of gear. Gear has seven grades; an item's strength is its
// level (its chapter) and grade together: two grades up is worth one level, so a white of chapter 2 is a blue of
// chapter 1.

export const GRADES = ["white", "green", "blue", "yellow", "purple", "red", "rainbow"];
export const GRADE = {
  white:   { name: "Trắng",     color: [236, 236, 242], affixes: 1, weight: 50,  salvage: 4 },
  green:   { name: "Xanh lá",   color: [96, 222, 110],  affixes: 1, weight: 26,  salvage: 8 },
  blue:    { name: "Xanh dương", color: [80, 160, 255], affixes: 2, weight: 13,  salvage: 15 },
  yellow:  { name: "Vàng",      color: [255, 214, 60],  affixes: 2, weight: 6.5, salvage: 30 },
  purple:  { name: "Tím",       color: [190, 110, 255], affixes: 3, weight: 3,   salvage: 60 },
  red:     { name: "Đỏ",        color: [255, 70, 70],   affixes: 3, weight: 1.2, salvage: 120, power: true },
  rainbow: { name: "Cầu vồng",  color: [255, 150, 230], affixes: 4, weight: 0.3, salvage: 250, power: true },
};
// older saves' grades
export const LEGACY_GRADE = { common: "white", rare: "blue", epic: "purple", legendary: "red" };
export const gradeOf = (r) => (GRADE[r] ? r : LEGACY_GRADE[r] ?? "white");
export const gradeIndex = (r) => GRADES.indexOf(gradeOf(r));
/** How strong an item's numbers are against a white of the same level: +20% a grade; a level is two grades
 * (+40%), so a white of level 2 is a blue of level 1. */
export const GRADE_STEP = 0.2, LEVEL_STEP = 2 * GRADE_STEP;
export const itemPower = (level, grade) => (1 + LEVEL_STEP * (Math.max(1, level) - 1)) * (1 + GRADE_STEP * gradeIndex(grade));

/** A grade, rolled: luck (the gear's own) and the boss's bonus lift the rarer ones. */
export function rollGrade(next, bonus = 0) {
  const ws = GRADES.map((g, i) => GRADE[g].weight * (i === 0 ? 1 : Math.pow(1 + bonus, i)));
  let x = next() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ws.length; i++) { if (x < ws[i]) return GRADES[i]; x -= ws[i] }
  return "white";
}

// ---- drops: gear only from the bosses of waves 5, 8 and 10, at most one each, never sure
export const GEAR_DROP = { 4: { chance: 0.35, bonus: 0 }, 7: { chance: 0.5, bonus: 0.15 }, 9: { chance: 0.8, bonus: 0.35 } };
export const ENDLESS_GEAR = { chance: 0.6, bonus: 0.2 };
// crystals: on average a third of a crystal a monster (more in later chapters); elites and bosses more, surely
export const crystalPerKill = (chapter) => (1 + 0.5 * (chapter - 1)) / 3;
export const CRYSTAL = { chance: 0.3, elite: 4, boss: 30 };
// the hero's aura from what it wears: how bright each grade glows
export const GLOW = { white: 0.12, green: 0.22, blue: 0.32, yellow: 0.42, purple: 0.52, red: 0.65, rainbow: 0.8 };
export const hueRGB = (h) => { const f = (n) => { const k = (n + h * 6) % 6; return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))) }; return [f(5), f(3), f(1)] };

// ---- an item's base numbers (Ragnarok's weapon ATK and armour DEF, its accessories' stat points; MU's base and
// options): +40% a level, +20% a grade over a white. The rolled lines come on top.
export const baseMul = (level, grade) => itemPower(level, grade);
export const WEAPON_ATK = { dagger: 30, sword: 40, twohand: 55, spear: 48, axe: 58, mace: 42, staff: 32, bow: 38, cart: 45 };
export const ARMOUR = { body: { def: 6, hp: 12 }, head: { def: 3 }, offhand: { def: 5 }, cloak: { def: 3 }, gloves: { def: 2 }, boots: { def: 3 }, belt: { def: 2, hp: 8 } };
export const RING_STATS = ["str", "agi", "dex", "luk"], AMULET_STATS = ["int", "vit"];
const hashId = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h };
/** { atk } for a weapon (and its multiplier against the type's base), { def, hp } for armour, { stat, v } for an accessory. */
export function baseOf(it, starterType = "staff") {
  if (!it) return null;
  const k = baseMul(it.level ?? it.chapter ?? 1, it.rarity);
  if (it.slot === "weapon") { const t = it.wtype ?? starterType, b = WEAPON_ATK[t] ?? 40; return { atk: Math.round(b * k), mul: k } }
  if (ARMOUR[it.slot]) { const a = ARMOUR[it.slot]; return { def: Math.round(a.def * k), ...(a.hp ? { hp: Math.round(a.hp * k) } : {}) } }
  if (it.slot === "ring" || it.slot === "amulet") {
    const list = it.slot === "ring" ? RING_STATS : AMULET_STATS, stat = list[(it.variant ?? hashId(it.id)) % list.length];
    return { stat, v: Math.max(1, Math.round(2 * itemPower(it.level ?? it.chapter ?? 1, it.rarity))) };
  }
  return null;
}
/** DEF to the share of a blow that gets through (Ragnarok's armour: by percent, with diminishing returns). */
export const defShare = (def) => 100 / (100 + Math.max(0, def));
