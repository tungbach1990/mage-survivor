// The monsters: their numbers. Sizes in px of the playfield (320 x 180); speed in px/s; attack every `rate` s.
// half: half the body's width (where it stops at the wall); cy: its middle's height over the feet; r: hit radius.
// resist: what each kind shrugs off (< 1) or suffers (> 1) by element, before any elemental kin on top.
// sprite: whose picture it wears (and `tint`), when it has none of its own.
// Behaviours: fly (over golems and the ground, never rooted), ranged (stops that far from the wall and shoots
// it), bomber (blows up on what it reaches), healer (mends those round it), charger (bursts forward).

export const ENEMIES = {
  slime:    { name: "Slime",       hp: 30,   speed: 14, dmg: 3,  rate: 1.2, half: 8,  cy: 6,  r: 7,  gold: 1,  xp: 1, resist: { water: 0.6, poison: 0.7, fire: 1.3 } },
  goblin:   { name: "Goblin",      hp: 55,   speed: 18, dmg: 5,  rate: 1.1, half: 9,  cy: 13, r: 9,  gold: 2,  xp: 2, resist: { earth: 0.8, dark: 1.2 } },
  wolf:     { name: "Sói",         hp: 40,   speed: 34, dmg: 4,  rate: 0.8, half: 12, cy: 9,  r: 9,  gold: 2,  xp: 2, resist: { ice: 0.7, fire: 1.25 } },
  skeleton: { name: "Bộ xương",    hp: 70,   speed: 16, dmg: 8,  rate: 1.2, half: 8,  cy: 15, r: 8,  gold: 3,  xp: 3, burnImmune: true, resist: { poison: 0.25, dark: 0.5, light: 1.6, earth: 1.25 } },
  orc:      { name: "Orc",         hp: 160,  speed: 11, dmg: 14, rate: 1.4, half: 12, cy: 18, r: 12, gold: 5,  xp: 5, resist: { earth: 0.75, wind: 0.7, volt: 1.25 } },
  golem:    { name: "Golem",       hp: 1200, speed: 7,  dmg: 30, rate: 2.0, half: 18, cy: 26, r: 20, gold: 40, xp: 40, boss: true, resist: { earth: 0.5, fire: 0.85, water: 1.25, volt: 1.15 } },
  // ---- the newer kinds
  bat:      { name: "Dơi",            hp: 22,  speed: 30, dmg: 3,  rate: 0.9, half: 7,  cy: 22, r: 8,  gold: 1, xp: 1, fly: 14, resist: { earth: 0.4, wind: 1.5, volt: 1.3 } },
  shaman:   { name: "Pháp sư goblin", hp: 60,  speed: 15, dmg: 6,  rate: 2.0, half: 8,  cy: 14, r: 9,  gold: 4, xp: 4, ranged: 70, healer: { every: 4, radius: 42, frac: 0.05 }, resist: { arcane: 0.5, dark: 0.7, light: 1.3 } },
  archer:   { name: "Cung thủ xương", hp: 48,  speed: 16, dmg: 5,  rate: 1.6, half: 8,  cy: 15, r: 8,  gold: 3, xp: 3, sprite: "skeleton", tint: [230, 200, 120], ranged: 110, burnImmune: true, resist: { poison: 0.25, dark: 0.5, light: 1.6, wind: 1.3 } },
  bomber:   { name: "Slime bom",      hp: 34,  speed: 24, dmg: 26, rate: 1,   half: 8,  cy: 6,  r: 7,  gold: 2, xp: 2, sprite: "slime", tint: [255, 70, 40], bomber: true, resist: { fire: 0.3, ice: 1.5, water: 1.5 } },
  brute:    { name: "Orc cuồng nộ",   hp: 280, speed: 10, dmg: 20, rate: 1.6, half: 12, cy: 18, r: 12, gold: 7, xp: 7, sprite: "orc", tint: [200, 40, 40], charger: { every: 6, dur: 0.6, k: 4 }, resist: { earth: 0.6, ice: 0.7, fire: 0.8, poison: 1.3, light: 1.2 } },
};

// physical blows: phys = how much of a blade's or an arrow's damage lands; markImmune = martial marks it can't
// carry (bones don't bleed, bats can't be crippled or pinned)
const PHYS = {
  slime: [1.1, ["bleed"]], goblin: [1, []], wolf: [1, []], skeleton: [0.9, ["bleed"]], orc: [0.9, []],
  golem: [0.85, ["bleed"]], bat: [1.2, ["cripple", "pin"]], shaman: [1.1, []], archer: [0.9, ["bleed"]],
  bomber: [1.1, ["bleed"]], brute: [0.85, []],
};
for (const [type, [phys, immune]] of Object.entries(PHYS)) Object.assign(ENEMIES[type], { phys, markImmune: immune });

export const SPAWN_X = 334;
export const LANE = [76, 172];     // feet y range the monsters walk in
