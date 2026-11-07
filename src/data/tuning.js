// Tuning: the numbers an admin can turn without touching code. Every value is a multiplier (1 = as designed)
// or a switch, read live by the sim. The admin page (src/admin.js) edits `T` and saves it in localStorage;
// tests and bots run on the defaults unless they set it.

export const DEFAULT_TUNING = () => ({
  v: 1,
  monster: { hp: 1, dmg: 1, speed: 1, elite: 1, kin: 1, extra: 1 },
  // crowd control on bosses and elites: durations x ccMul; `poise` seconds of it in a row and they turn
  // UNSTOPPABLE for `unstop` s (no stun, freeze, root, fear, knockback or pull)
  boss: { hp: 1, dmg: 1, ccMul: 0.4, poise: 1.6, unstop: 6, slowFloor: 0.7, enrage: 0.25, charge: 1 },
  elite: { ccMul: 0.7, poise: 3, unstop: 3, slowFloor: 0.5 },
  summon: { hp: 1, dmg: 1 },
  combo: { pair: 0.6, tier: 0.55 },   // every pair combo and every tier (TRIAD..HEXA), on top of each one's own
  types: {},       // monster type -> { hp, dmg, speed, resist: { element: multiplier } }
  skills: {},      // skill id -> { dmg, cd, off }
  reactions: {},   // reaction id -> { dmg, off }   (pairs, tiers, triads, chaos)
  elements: {},    // element -> damage multiplier
  classes: {},     // class -> { dmg, wallTaken }
});

export const T = DEFAULT_TUNING();

/** Replace the live tuning with `obj` (missing parts fall back to the defaults). */
export function setTuning(obj = {}) {
  const d = DEFAULT_TUNING();
  for (const k of Object.keys(T)) delete T[k];
  Object.assign(T, d, obj, {
    monster: { ...d.monster, ...obj.monster }, boss: { ...d.boss, ...obj.boss }, elite: { ...d.elite, ...obj.elite }, summon: { ...d.summon, ...obj.summon }, combo: { ...d.combo, ...obj.combo },
    types: { ...(obj.types ?? {}) }, classes: { ...(obj.classes ?? {}) }, skills: { ...(obj.skills ?? {}) }, reactions: { ...(obj.reactions ?? {}) }, elements: { ...(obj.elements ?? {}) },
  });
  return T;
}
export const resetTuning = () => setTuning({});

export const skillT = (id) => T.skills[id] ?? NONE;
export const reactT = (id) => T.reactions[id] ?? NONE;
export const typeT = (type) => T.types[type] ?? NONE;
const NONE = Object.freeze({});

export const TUNING_KEY = "msd.tuning.v1";
