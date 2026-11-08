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
/** How strong an item's lines are: 1 for a white of level 1, +12% a grade, a level is two grades. */
export const itemPower = (level, grade) => 1 + 0.12 * ((Math.max(1, level) - 1) * 2 + gradeIndex(grade));

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
