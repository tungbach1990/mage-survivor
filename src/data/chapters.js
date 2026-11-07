// Five chapters of ten waves, then Endless. Each chapter: how tough its monsters are, what they resist, how
// often they come as elites, how the arena is tinted, and what its boss is.

export const CHAPTERS = [
  { n: 1, name: "Đồng cỏ",      hp: 1,   dmg: 1,   elite: 0.03, tint: null,               resist: {},                     elemPool: ["volt", "water", "earth"], elemChance: 0.08, roster: ["bat", "bomber"], boss: { name: "GOLEM ĐÁ", shieldBy: "reaction", hpMul: 0.3, dmgMul: 0.6 } },
  { n: 2, name: "Rừng độc",     hp: 2.2, dmg: 1.2, elite: 0.07, tint: [0.86, 1.0, 0.8],   resist: { poison: 0.4 },        swap: "poison", hazard: "miasma", elemPool: ["poison", "water", "wind", "earth", "water+poison"], elemChance: 0.22, roster: ["bat", "archer", "shaman"], boss: { name: "GOLEM RÊU", shieldBy: "reaction", hpMul: 0.8 } },
  { n: 3, name: "Núi lửa",      hp: 19, dmg: 1.8, elite: 0.12, tint: [1.08, 0.86, 0.74], resist: { fire: 0.4 },          swap: "fire", hazard: "lava", elemPool: ["fire", "earth", "volt", "wind", "fire+earth", "fire+volt"], elemChance: 0.3, roster: ["brute", "bomber", "archer"], boss: { name: "GOLEM NHAM THẠCH", shieldBy: "tier", hpMul: 0.9 } },
  { n: 4, name: "Băng nguyên",  hp: 34, dmg: 2.3, elite: 0.18, tint: [0.84, 0.94, 1.12], resist: { ice: 0.4 },           swap: "ice", cdMul: 1.1, elemPool: ["ice", "water", "wind", "light", "ice+water", "volt+wind", "dark+ice"], elemChance: 0.35, roster: ["bat", "shaman", "brute"], boss: { name: "GOLEM BĂNG", shieldBy: "tier" } },
  { n: 5, name: "Vực hư không", hp: 74,  dmg: 2.8, elite: 0.25, tint: [0.78, 0.7, 1.0],   resist: { dark: 0.4, arcane: 0.6 }, swap: "dark", hazard: "void", elemPool: ["dark", "arcane", "light", "poison", "fire", "ice", "poison+dark", "light+arcane", "fire+volt", "dark+ice"], elemChance: 0.42, roster: ["bat", "archer", "shaman", "bomber", "brute"], boss: { name: "GOLEM HƯ KHÔNG", shieldBy: "tier" } },
];
export const ENDLESS = { base: 5, hpPerWave: 1.12, elitePerWave: 0.02, bossEvery: 10 };

// elites: a glow and a short tag over them
export const ELITES = {
  armored:  { tag: "ARMOR",   color: [180, 180, 200], vi: "Giáp dày: đòn thường chỉ gây 50%, phản ứng gây đủ" },
  swift:    { tag: "SWIFT",  color: [120, 240, 200], vi: "Nhanh gấp rưỡi" },
  splitter: { tag: "SPLIT",   color: [240, 200, 120], vi: "Chết thì tách đôi" },
  regen:    { tag: "REGEN",    color: [120, 240, 120], vi: "Tự hồi 1,5% máu mỗi giây khi không bị đánh" },
  warded:   { tag: "WARD",  color: [200, 140, 255], vi: "Miễn nhiễm gần hết một nguyên tố" },
  shielded: { tag: "SHIELD",  color: [140, 200, 255], vi: "Khiên chỉ phá được bằng phản ứng" },
};
export const ELITE_KINDS = Object.keys(ELITES);
