// Stats, after Ragnarok Online (pre-renewal): six of them, raised with points the account earns as it levels
// (the same total for every class), each class spending its own. Plus a class's own bonus that grows by itself.
//   points from level x to x+1: floor(x/5)+3, 48 to start;  raising a stat from x to x+1: floor((x-1)/10)+2
//   ASPD = 200 - (WD - (round(WD*AGI/25) + round(WD*DEX/100))/10) * (1 - SM),  WD = 50 * BTBA;  hits/s = 50/(200-ASPD)
//   cast time = base * (1 - DEX/150);  crit = 1 + LUK*0.3 %;  perfect dodge = LUK/10 %
// HIT (level + DEX) turns into a little damage; FLEE (level + AGI) into a little attack speed.

export const STAT_IDS = ["str", "agi", "vit", "int", "dex", "luk"];
export const STAT_NAMES = { str: "STR", agi: "AGI", vit: "VIT", int: "INT", dex: "DEX", luk: "LUK" };
export const STAT_TEXT = {
  str: "Sát thương skill cận chiến (võ)",
  agi: "Tốc độ đánh, FLEE",
  vit: "Máu tường, giảm sát thương nhận, hồi tường",
  int: "Sát thương phép và triệu hồi nguyên tố, hồi máu",
  dex: "Sát thương tầm xa (võ), niệm nhanh, HIT, chút tốc độ đánh",
  luk: "Chí mạng đòn thường, né hoàn hảo, chút sát thương",
};
export const STAT_MAX = 99, START_POINTS = 48, MAX_LEVEL = 99;
export const HIT_DMG = 0.002, FLEE_SM = 0.001;

export const freshStats = () => Object.fromEntries(STAT_IDS.map((s) => [s, 1]));
/** What raising a stat from x to x+1 costs. */
export const statCost = (x) => Math.floor((x - 1) / 10) + 2;
/** All the points an account of this level has. */
export function pointsAt(level) {
  let n = START_POINTS;
  for (let x = 1; x < Math.min(level, MAX_LEVEL); x++) n += Math.floor(x / 5) + 3;
  return n;
}
/** The points spent to bring these stats from 1 to where they are. */
export function spentOn(stats) {
  let n = 0;
  for (const s of STAT_IDS) for (let x = 1; x < (stats?.[s] ?? 1); x++) n += statCost(x);
  return n;
}

// a class's own bonus: +1 every two account levels, round its pattern (free, can go past 99)
export const JOB_BONUS = {
  mage:     ["int", "dex", "int", "agi", "int", "dex", "luk", "int"],
  swordman: ["str", "vit", "str", "dex", "vit", "str", "agi", "luk"],
  archer:   ["dex", "agi", "dex", "str", "dex", "luk", "agi", "int"],
  thief:    ["agi", "dex", "agi", "str", "luk", "agi", "dex", "vit"],
  acolyte:  ["int", "vit", "luk", "int", "dex", "vit", "int", "agi"],
  merchant: ["str", "vit", "dex", "luk", "str", "int", "vit", "dex"],
};
export function jobBonus(cls, level) {
  const out = Object.fromEntries(STAT_IDS.map((s) => [s, 0])), pat = JOB_BONUS[cls] ?? JOB_BONUS.mage;
  for (let i = 0; i < Math.floor(level / 2); i++) out[pat[i % pat.length]]++;
  return out;
}
export const totalsOf = (stats, cls, level) => { const b = jobBonus(cls, level); return Object.fromEntries(STAT_IDS.map((s) => [s, (stats?.[s] ?? 1) + b[s]])) };

// the class's weapon: its base time between attacks (seconds)
export const BTBA = { mage: 0.75, swordman: 0.7, archer: 0.85, thief: 0.5, acolyte: 0.7, merchant: 0.8 };
/** ASPD (capped at 190) for a weapon's BTBA, AGI, DEX and speed modifiers. */
export function aspdOf(btba, agi, dex, sm = 0) {
  const wd = 50 * btba;
  return Math.min(190, 200 - (wd - (Math.round((wd * agi) / 25) + Math.round((wd * dex) / 100)) / 10) * (1 - Math.min(0.9, sm)));
}
export const hitsPerSec = (aspd) => 50 / (200 - aspd);

// cast and after-cast delay, by the kind of skill (seconds); elemental schools cast, martial ones mostly don't
const CAST_ARCANE = { bolt: [0.6, 0.4], ball: [0.9, 0.6], chain: [0.8, 0.5], orb: [1.0, 0.6], zone: [1.5, 0.8], weather: [2.5, 1.0], summon: [2.0, 1.0], strike: [0.6, 0.4], heal: [0, 0.5] };
const CAST_MARTIAL = { melee: [0, 0.3], bolt: [0, 0.25], dash: [0.3, 0.5], volley: [0, 0.6], zone: [0.5, 0.6], summon: [0.5, 0.6], clone: [0.5, 0.6], ball: [0, 0.4], strike: [0, 0.3], heal: [0, 0.5] };
/** [cast, delay] for a skill (basic attacks and passives: none). */
export function castOf(sk, school) {
  if (sk?.passive === "nova") return [0.5, 0.5];
  if (!sk || sk.basic || sk.passive) return [0, 0];
  const t = (school === "martial" ? CAST_MARTIAL : CAST_ARCANE)[sk.kind] ?? [0.5, 0.4];
  return [sk.cast ?? t[0], sk.delay ?? t[1]];
}

/** Everything the stats work out to, for the run and the status window. */
export function derive(t, level, cls) {
  const phys = (main, sub) => main + Math.floor(main / 10) ** 2 + Math.floor(sub / 5) + Math.floor(t.luk / 5);
  const matkMin = t.int + Math.floor(t.int / 7) ** 2, matkMax = t.int + Math.floor(t.int / 5) ** 2;
  const hit = level + t.dex, flee = level + t.agi;
  return {
    atkMelee: phys(t.str, t.dex), atkRanged: phys(t.dex, t.str), matk: [matkMin, matkMax],
    hit, hitDmg: 1 + hit * HIT_DMG, flee, fleeSM: flee * FLEE_SM,
    crit: (1 + t.luk * 0.3) / 100, pdodge: t.luk / 1000,
    castMul: Math.max(0, 1 - t.dex / 150),
    wallHpMul: 1 + t.vit / 100, softDef: t.vit * 0.2, regen: Math.floor(t.vit / 5), mdef: Math.min(0.4, t.int * 0.005), healMul: 1 + t.int / 100,
    btba: BTBA[cls] ?? 0.75, agi: t.agi, dex: t.dex,
  };
}
/** The damage factor a skill gets from the stats: martial melee from STR, martial ranged from DEX, elemental from MATK. */
export function statDmg(d, school, kind) {
  if (!d) return 1;
  let k;
  if (school === "martial") k = 1 + ((kind === "melee" || kind === "dash" || kind === "zone" || kind === "clone") ? d.atkMelee : d.atkRanged) / 100;
  else k = 1 + (d.matk[0] + d.matk[1]) / 2 / 100;
  return k * d.hitDmg;
}
