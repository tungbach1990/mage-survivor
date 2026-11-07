// The ten elements (and Chaos, the eleventh): names, colors, the palette their effects are drawn in, and the
// numbers of the aura each leaves on a monster.

export const ELEMENTS = ["fire", "ice", "volt", "water", "earth", "wind", "poison", "light", "dark", "arcane"];

export const ELEM = {
  fire:   { name: "Lửa",      label: "FIRE",   icon: "🔥", color: [255, 120, 40],  ramp: ["#2a0806", "#6a1408", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#ffffff"] },
  ice:    { name: "Băng",     label: "ICE",    icon: "❄", color: [140, 210, 255], ramp: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"] },
  volt:   { name: "Sét",      label: "VOLT",   icon: "⚡", color: [200, 150, 255], ramp: ["#14082a", "#2c1050", "#5a24a0", "#8c4ae0", "#c08cff", "#e0c4ff", "#f6ecff", "#ffffff"] },
  water:  { name: "Nước",     label: "WATER",  icon: "💧", color: [70, 150, 240],  ramp: ["#06142a", "#0c2a52", "#14468a", "#2066c0", "#3a8ae0", "#6ab4f4", "#b0dcff", "#ffffff"] },
  earth:  { name: "Đất",      label: "EARTH",  icon: "⛰", color: [190, 140, 80],  ramp: ["#1a120a", "#3a2814", "#5c4020", "#80582c", "#a8783c", "#c89a5a", "#e8c890", "#fff4dc"] },
  wind:   { name: "Gió",      label: "WIND",   icon: "🌪", color: [150, 240, 200], ramp: ["#0a2018", "#14402e", "#226a4a", "#3a9a6c", "#62c894", "#9ae8c0", "#d0fae6", "#ffffff"] },
  poison: { name: "Độc",      label: "POISON", icon: "☠", color: [150, 230, 60],  ramp: ["#0e1606", "#22360a", "#3c5c10", "#5c8a18", "#84b828", "#b0e048", "#dcff90", "#ffffff"] },
  light:  { name: "Ánh sáng", label: "LIGHT",  icon: "✦", color: [255, 230, 120], ramp: ["#2a1e06", "#5a420c", "#8c6a14", "#c09a24", "#f0c83c", "#ffe27a", "#fff4c0", "#ffffff"] },
  dark:   { name: "Bóng tối", label: "DARK",   icon: "☾", color: [150, 80, 200],  ramp: ["#08040e", "#160a24", "#2a1240", "#46205e", "#6a3088", "#9450b4", "#c48ce0", "#f0dcff"] },
  arcane: { name: "Huyền bí", label: "ARCANE", icon: "✧", color: [255, 110, 220], ramp: ["#1c0620", "#3e0c48", "#6a1478", "#9c24a8", "#d040d0", "#f07ae6", "#ffc4f4", "#ffffff"] },
  chaos:  { name: "Chaos",    label: "CHAOS",  icon: "✺", color: [255, 255, 255], ramp: ["#000000", "#140428", "#3a0a5a", "#7a1aa0", "#d040d0", "#ff8ac8", "#fff0a0", "#ffffff"] },
};

// ---- the ten martial marks: what blades, arrows, daggers, maces and carts leave on a monster ----
// They are auras like the elements: two different ones set off a combo (only within the same school),
// 3-6 of any kind a tier, 7-9 UNSTABLE, ten CHAOS.
export const MARTIAL = ["bleed", "daze", "sunder", "cripple", "pin", "expose", "blind", "disarm", "venom", "bounty"];
const steel = (a, b, c) => ["#14100e", a, b, c, "#c8c0b8", "#e8e2da", "#f6f2ec", "#ffffff"];
Object.assign(ELEM, {
  bleed:   { name: "Chảy máu",   label: "BLEED",   icon: "🩸", color: [230, 40, 50],   ramp: ["#1a0406", "#4a0a10", "#8a1420", "#c42030", "#ec4048", "#ff8088", "#ffc4c8", "#ffffff"] },
  daze:    { name: "Choáng váng", label: "DAZE",    icon: "💫", color: [255, 220, 90],  ramp: steel("#4a3a10", "#8a6a20", "#d0a830") },
  sunder:  { name: "Phá giáp",   label: "SUNDER",  icon: "🛡", color: [200, 205, 220], ramp: steel("#2a2c34", "#4a4e5c", "#7a8094") },
  cripple: { name: "Què",        label: "CRIPPLE", icon: "🦵", color: [190, 120, 70],  ramp: steel("#3a2010", "#6a3a1a", "#a86a3a") },
  pin:     { name: "Ghim",       label: "PIN",     icon: "📌", color: [160, 170, 190], ramp: steel("#22262e", "#3e4452", "#6a7286") },
  expose:  { name: "Đánh dấu",   label: "EXPOSE",  icon: "🎯", color: [255, 90, 60],   ramp: steel("#4a1408", "#8a2a10", "#e04a20") },
  blind:   { name: "Mù",         label: "BLIND",   icon: "🌫", color: [150, 140, 130], ramp: steel("#2a2622", "#4a443e", "#7a726a") },
  disarm:  { name: "Tước vũ khí", label: "DISARM", icon: "🗡", color: [120, 200, 230], ramp: steel("#102a34", "#1e4c5e", "#3a8aa8") },
  venom:   { name: "Nọc",        label: "VENOM",   icon: "🐍", color: [110, 200, 90],  ramp: ["#081206", "#14300e", "#225a18", "#3a8a26", "#5cb83a", "#8ae05a", "#c8ff9a", "#ffffff"] },
  bounty:  { name: "Truy nã",    label: "BOUNTY",  icon: "💰", color: [255, 200, 60],  ramp: ["#2a1a04", "#5a3a08", "#8a6010", "#c09020", "#f0c040", "#ffe080", "#fff4c4", "#ffffff"] },
});
export const MARKS = [...ELEMENTS, ...MARTIAL];
const SCHOOL = Object.fromEntries([...ELEMENTS.map((e) => [e, "arcane"]), ...MARTIAL.map((m) => [m, "martial"])]);
/** "arcane" (an element) or "martial" (a mark), or undefined (not a mark). */
export const schoolOf = (m) => SCHOOL[m];
export const SCHOOLS = { arcane: ELEMENTS, martial: MARTIAL };

// the aura: how long it lasts, how many kinds a monster can carry, and what each does while it's there
export const AURA = {
  dur: 5, max: 20,
  earthTaken: 1.2,             // armor broken: +20% damage taken
  windPush: 12,                // knocked back px (light monsters fly further)
  poison: { maxStacks: 5, tick: 0.5, dur: 5, dps: 3 },
  judged: 1.3,                 // the next hit on a judged monster
  curse: { wall: 0.7, fearEvery: 6, fear: 1 },
  arcane: { stacks: 5, ratio: 3, radius: 16 },
  unstable: 0.1,               // +10% damage taken for each aura past the sixth
  // the martial marks
  bleed: { maxStacks: 5, dps: 3 },
  daze: { atk: 0.7, hits: 3, stun: 0.6 },
  sunder: 1.25,                // physical blows +25%
  cripple: 0.65,               // speed left
  pin: { root: 0.8, every: 4 },
  blind: 0.35,                 // chance a blow on the wall misses
  disarm: 0.65,                // its blows on the wall
  venom: { maxStacks: 8, dps: 2 },
  bounty: 2,                   // gold and xp on its death
};
