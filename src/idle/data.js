// The idle RPG's data: elements and what counters what, the monsters, the ten maps, the experience curve.

// ---- elements: each beats one and is resisted by one (x1.5 / x0.5); "neutral" neither
export const ELEMS = ["neutral", "fire", "ice", "volt", "water", "earth", "wind", "poison", "light", "dark", "arcane"];
export const ELEM_NAME = { neutral: "Vô hệ", fire: "Lửa", ice: "Băng", volt: "Sét", water: "Nước", earth: "Đất", wind: "Gió", poison: "Độc", light: "Ánh sáng", dark: "Bóng tối", arcane: "Huyền bí" };
/** What each element beats (the target's element). */
export const BEATS = { fire: "ice", ice: "wind", wind: "earth", earth: "volt", volt: "water", water: "fire", poison: "light", light: "dark", dark: "arcane", arcane: "poison" };
export const COUNTER = 1.5, RESISTED = 0.5;
/** The factor of an attack's element on a monster's element. */
export function elemMul(atk, def) {
  if (!atk || atk === "neutral" || !def || def === "neutral") return 1;
  if (BEATS[atk] === def) return COUNTER;
  if (BEATS[def] === atk || atk === def) return RESISTED;
  return 1;
}

// ---- monsters: a sprite (the picture they're drawn with), their shape, their stats at level 1 and per level
//   hp, atk, def (percent cut), flee, hit, rate (seconds between blows), range (0 melee), xp, gold
export const KINDS = {
  slime:    { name: "Slime",      sprite: "slime",    hp: 1.0, atk: 0.8, def: 0.0, flee: 0.6, rate: 1.4, range: 0,  xp: 1.0, gold: 1.0 },
  bat:      { name: "Dơi",        sprite: "bat",      hp: 0.7, atk: 0.8, def: 0.0, flee: 1.6, rate: 1.0, range: 0,  xp: 1.0, gold: 0.8, fly: 22 },
  goblin:   { name: "Goblin",     sprite: "goblin",   hp: 1.1, atk: 1.0, def: 0.05, flee: 1.0, rate: 1.2, range: 0, xp: 1.1, gold: 1.3 },
  wolf:     { name: "Sói",        sprite: "wolf",     hp: 0.9, atk: 1.1, def: 0.0, flee: 1.4, rate: 0.9, range: 0,  xp: 1.1, gold: 1.0 },
  skeleton: { name: "Bộ xương",   sprite: "skeleton", hp: 1.2, atk: 1.1, def: 0.1, flee: 0.8, rate: 1.3, range: 0,  xp: 1.2, gold: 1.2 },
  shaman:   { name: "Pháp sư goblin", sprite: "shaman", hp: 0.9, atk: 1.3, def: 0.0, flee: 0.9, rate: 2.0, range: 60, xp: 1.3, gold: 1.5, magic: true },
  orc:      { name: "Orc",        sprite: "orc",      hp: 1.8, atk: 1.3, def: 0.15, flee: 0.7, rate: 1.5, range: 0, xp: 1.6, gold: 1.8 },
  golem:    { name: "Golem",      sprite: "golem",    hp: 2.6, atk: 1.4, def: 0.25, flee: 0.4, rate: 2.0, range: 0, xp: 2.0, gold: 2.2 },
};
/** A monster's numbers at a level (before its kind's factors). */
export const monsterBase = (lv) => ({
  hp: Math.round(20 + 22 * lv + 0.25 * lv * lv),
  atk: Math.round((2 + 0.7 * lv + 0.004 * lv * lv) * 10) / 10,
  hit: Math.round(10 + lv * 1.6),
  flee: Math.round(4 + lv * 1.3),
  xp: Math.round(6 * Math.pow(lv, 1.55) + 4),
  gold: Math.round(2 + lv * 1.2),
});

// ---- the ten maps: a range of levels, its monsters and their elements, a boss
//   tint: [r, g, b] multipliers for the ground; sky: the background's top colour
export const MAPS = [
  { id: 1, name: "Đồng cỏ",          lv: [1, 8],   kinds: ["slime", "bat", "goblin"],        elems: ["earth", "neutral"], boss: "golem", ground: "grass", sky: [120, 180, 240] },
  { id: 2, name: "Rừng thưa",        lv: [8, 16],  kinds: ["goblin", "wolf", "bat"],         elems: ["wind", "neutral"], boss: "orc",   ground: "forest", sky: [110, 170, 200] },
  { id: 3, name: "Rừng độc",         lv: [15, 25], kinds: ["slime", "skeleton", "shaman"],   elems: ["poison"],          boss: "orc",   ground: "swamp", sky: [120, 150, 110] },
  { id: 4, name: "Hang đá",          lv: [24, 34], kinds: ["golem", "bat", "goblin"],        elems: ["earth"],           boss: "golem", ground: "cave", sky: [70, 60, 80] },
  { id: 5, name: "Núi lửa",          lv: [33, 43], kinds: ["goblin", "orc", "shaman"],       elems: ["fire"],            boss: "golem", ground: "lava", sky: [180, 80, 60] },
  { id: 6, name: "Băng nguyên",      lv: [42, 52], kinds: ["wolf", "slime", "golem"],        elems: ["ice", "water"],    boss: "golem", ground: "snow", sky: [170, 200, 240] },
  { id: 7, name: "Thành cổ",         lv: [51, 62], kinds: ["skeleton", "bat", "shaman"],     elems: ["dark"],            boss: "orc",   ground: "ruins", sky: [70, 60, 100] },
  { id: 8, name: "Thánh điện sụp đổ", lv: [60, 72], kinds: ["orc", "skeleton", "golem"],     elems: ["light"],           boss: "golem", ground: "temple", sky: [230, 210, 160] },
  { id: 9, name: "Biển bão",         lv: [70, 82], kinds: ["slime", "wolf", "shaman"],       elems: ["volt", "water"],   boss: "orc",   ground: "shore", sky: [80, 90, 130] },
  { id: 10, name: "Vực hư không",    lv: [80, 99], kinds: ["skeleton", "golem", "shaman", "bat"], elems: ["arcane", "dark"], boss: "golem", ground: "void", sky: [40, 20, 70] },
];
export const mapOf = (id) => MAPS[Math.max(1, Math.min(MAPS.length, id)) - 1];
export const BOSS_EVERY = 100, BOSS_HP = 20, BOSS_ATK = 1.8, BOSS_LOOT = 5;

// ---- levels
export const MAX_LEVEL = 99;
export const xpToNext = (L) => Math.round(50 * Math.pow(L, 1.9) * Math.pow(1.064, L) * (0.6 + 0.4 * Math.min(1, L / 20)) * (1 + 0.012 * Math.max(0, L - 40)));
export const DEATH_XP = 0.01, RESPAWN = 5;
