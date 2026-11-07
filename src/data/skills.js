// The skills, as data. Each is an element, an archetype (how it fires) and its numbers at levels 1-5; the
// archetypes run in sim/skills-runtime.js and look up their pictures in render/looks.js. Adding a skill is
// adding a line here.
//   bolt    a shot at the target (pierce, count, homing)       ball    a shot that bursts at the crowd
//   chain   lightning that leaps                                 orb     a slow drifting thing that pulses
//   zone    something on the ground at the crowd (or target)    weather rain over the field for a while
//   passive works on its own (Frost Nova, Chaos Seed)
// Element effects carried by a hit: burn (dps), poison (dps), stun (s), freezeAt3, push (px).

import { SUMMONS } from "./summons.js";
import { CLASS_SKILLS, SHARED, CLASS_IDS } from "./classes.js";

const L = (a, b) => (l) => a + ((b - a) * (l - 1)) / 4;
const lv = (spec) => (l) => Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, typeof v === "function" ? v(l) : v]));

export const SKILLS = {
  // ---- fire
  firebolt:  { name: "Firebolt", elem: "fire", kind: "bolt", icon: "icon_firebolt", desc: "Tia lửa nhanh, đốt cháy.", stats: lv({ cd: L(0.75, 0.42), dmg: L(17, 38), speed: 260, burn: L(3, 6) }) },
  fireball:  { name: "Fireball", elem: "fire", kind: "ball", icon: "icon_fireball", desc: "Cầu lửa nổ diện rộng. Trên nước → STEAM.", stats: lv({ cd: L(2.4, 1.6), dmg: L(22, 50), radius: L(18, 26), speed: 150, burn: L(4, 8) }) },
  lavarain:  { name: "Lava Rain", elem: "fire", kind: "weather", weather: "lava", icon: "icon_lavarain", desc: "Mưa dung nham: giọt lửa rơi khắp sân, hồ dung nham. Lửa +15%, băng −15%.", stats: lv({ cd: L(14, 10), dur: L(5, 7), every: L(0.35, 0.25), fall: 0.45, dmg: L(10, 22), radius: 8, burn: 3, aim: 0.5, poolChance: 0.3, poolR: L(9, 12), poolLife: 5 }) },
  // ---- ice
  icebolt:   { name: "Icebolt", elem: "ice", kind: "bolt", icon: "icon_icebolt", desc: "Giáo băng xuyên nhiều con, 3 lớp lạnh thì đóng băng.", stats: lv({ cd: L(1.6, 1.0), dmg: L(16, 36), speed: 240, pierce: (l) => Math.round(L(3, 5)(l)), freezeAt3: true, puddle: 10 }) },
  iceball:   { name: "Iceball", elem: "ice", kind: "ball", icon: "icon_iceball", desc: "Cầu băng nổ, làm chậm, để lại vũng nước.", stats: lv({ cd: L(2.8, 1.8), dmg: L(14, 32), radius: L(20, 28), speed: 120, puddle: 0.8 }) },
  nova:      { name: "Frost Nova", elem: "ice", kind: "passive", passive: "nova", icon: "icon_nova", desc: "Bị động: quái đánh tường thì băng nổ quanh chúng, đóng băng.", stats: lv({ cd: L(8, 5), dmg: L(15, 35), radius: L(34, 46), freeze: L(1.5, 2.5) }) },
  // ---- volt
  lightbolt: { name: "Lightning Bolt", elem: "volt", kind: "chain", icon: "icon_lightbolt", desc: "Sét nảy qua nhiều con, tê liệt.", stats: lv({ cd: L(2.2, 1.4), dmg: L(20, 40), chains: (l) => Math.round(L(3, 5)(l)), jump: 52, stun: 0.6 }) },
  lightball: { name: "Lightning Ball", elem: "volt", kind: "orb", icon: "icon_lightball", desc: "Cầu sét trôi qua đội hình, giật quái quanh nó.", stats: lv({ cd: L(5, 3.5), dmg: L(6, 14), speed: 42, life: 4, radius: 22, tick: 0.3, stunChance: L(0.25, 0.4), stun: 0.5 }) },
  thunderrain: { name: "Lightning Rain", elem: "volt", kind: "weather", weather: "thunder", icon: "icon_thunderrain", desc: "Mưa sét: sét đánh khắp sân; rơi vào nước thì dẫn điện. Sét +15%.", stats: lv({ cd: L(14, 10), dur: L(5, 7), every: L(0.5, 0.32), fall: 0.5, dmg: L(24, 48), radius: 13, stun: 0.6, aim: 0.6 }) },
  // ---- water
  waterjet:  { name: "Water Jet", elem: "water", kind: "bolt", icon: "icon_waterjet", desc: "Vòi nước xuyên 2 con, làm Ướt và đẩy lùi nhẹ.", stats: lv({ cd: L(0.9, 0.55), dmg: L(12, 28), speed: 300, pierce: 2, push: 4 }) },
  tidal:     { name: "Tidal Wave", elem: "water", kind: "zone", at: "crowd", icon: "icon_tidal", desc: "Sóng thần đổ xuống chỗ quái đông: đẩy lùi, để lại vũng nước.", stats: lv({ cd: L(4.5, 3), dmg: L(18, 40), radius: L(26, 34), push: 18, puddle: 0.7 }) },
  storm:     { name: "Storm Cloud", elem: "water", kind: "weather", weather: "rain", icon: "icon_storm", desc: "Mưa nước: quái chậm 20% và bị Ướt, mưa tạo vũng nước. Lửa −10%.", stats: lv({ cd: L(14, 10), dur: L(6, 9), every: L(0.9, 0.6), puddleR: L(12, 16) }) },
  // ---- earth
  stonespike:{ name: "Stone Spike", elem: "earth", kind: "zone", at: "target", icon: "icon_stonespike", desc: "Gai đá trồi lên dưới mục tiêu, vỡ giáp.", stats: lv({ cd: L(1.3, 0.8), dmg: L(22, 48), radius: 8 }) },
  quake:     { name: "Quake", elem: "earth", kind: "zone", at: "crowd", icon: "icon_quake", desc: "Động đất ở chỗ quái đông: sát thương lớn, choáng ngắn.", stats: lv({ cd: L(5, 3.5), dmg: L(28, 60), radius: L(28, 36), stun: 0.3 }) },
  // ---- wind
  windblade: { name: "Wind Blade", elem: "wind", kind: "bolt", icon: "icon_windblade", desc: "Lưỡi gió xuyên 4 con, thổi lùi.", stats: lv({ cd: L(1.1, 0.7), dmg: L(12, 28), speed: 280, pierce: 4, push: 10 }) },
  tornado:   { name: "Tornado", elem: "wind", kind: "orb", icon: "icon_tornado", desc: "Lốc xoáy trôi qua sân, hút và quất quái.", stats: lv({ cd: L(6, 4), dmg: L(5, 12), speed: 30, life: 4, radius: 20, tick: 0.25, pull: 30 }) },
  // ---- poison
  venomdart: { name: "Venom Dart", elem: "poison", kind: "bolt", icon: "icon_venomdart", desc: "Phi tiêu độc: +2 lớp độc.", stats: lv({ cd: L(0.9, 0.55), dmg: L(8, 18), speed: 250, poison: L(3, 6), stacks: 2 }) },
  toxiccloud:{ name: "Toxic Cloud", elem: "poison", kind: "zone", at: "crowd", icon: "icon_toxiccloud", desc: "Mây độc lơ lửng 4 giây, quái trong đó nhiễm độc.", stats: lv({ cd: L(6, 4), dmg: L(4, 9), radius: L(22, 28), life: 4, tick: 0.5, poison: L(2, 4) }) },
  // ---- light
  holylance: { name: "Holy Lance", elem: "light", kind: "bolt", icon: "icon_holylance", desc: "Thương ánh sáng xuyên thẳng hàng, phán xét.", stats: lv({ cd: L(1.4, 0.9), dmg: L(18, 40), speed: 420, pierce: 6 }) },
  smite:     { name: "Smite", elem: "light", kind: "zone", at: "strongest", icon: "icon_smite", desc: "Búa ánh sáng giáng xuống con mạnh nhất.", stats: lv({ cd: L(4, 2.8), dmg: L(45, 100), radius: 14 }) },
  // ---- dark
  shadoworb: { name: "Shadow Orb", elem: "dark", kind: "orb", icon: "icon_shadoworb", desc: "Quả cầu bóng tối trôi chậm, nguyền quái quanh nó.", stats: lv({ cd: L(5, 3.5), dmg: L(6, 14), speed: 26, life: 5, radius: 18, tick: 0.4 }) },
  grasping:  { name: "Grasping Hands", elem: "dark", kind: "zone", at: "crowd", icon: "icon_grasping", desc: "Tay bóng tối trồi lên giữ chân quái 1,5 giây.", stats: lv({ cd: L(5, 3.5), dmg: L(14, 30), radius: L(22, 28), root: 1.5 }) },
  // ---- arcane
  missiles:  { name: "Arcane Missiles", elem: "arcane", kind: "bolt", icon: "icon_missiles", desc: "3 tên lửa huyền bí tự đuổi theo mục tiêu.", stats: lv({ cd: L(1.6, 1.0), dmg: L(7, 15), speed: 170, count: 3, homing: true }) },
  runecircle:{ name: "Rune Circle", elem: "arcane", kind: "zone", at: "crowd", icon: "icon_runecircle", desc: "Vòng rune trên đất 3 giây, tích điện quái đứng trong.", stats: lv({ cd: L(5.5, 4), dmg: L(5, 11), radius: L(22, 28), life: 3, tick: 0.5 }) },
  // ---- chaos
  chaosseed: { name: "Chaos Seed", elem: "chaos", kind: "passive", passive: "chaosseed", icon: "icon_chaos", desc: "Mỗi đòn có tỉ lệ nhỏ gieo 2 aura còn thiếu. Hố Đen mạnh hơn, hồi nhanh hơn.", stats: lv({ cd: 0, chance: L(0.02, 0.06) }) },
};
Object.assign(SKILLS, SUMMONS, CLASS_SKILLS);
// who may learn what: the Mage's book unless the skill says, a few shared, Chaos Seed for everyone
for (const [id, sk] of Object.entries(SKILLS)) sk.cls ??= SHARED[id] ?? (id === "chaosseed" ? CLASS_IDS : ["mage"]);
/** The highest level a skill goes to (a basic attack: 8). */
export const maxLevel = (id) => SKILLS[id]?.max ?? 5;
export const MAX_LEVEL = 5;
export const stats = (id, level) => SKILLS[id].stats(level);
export const SKILLS_OF = (elem) => Object.entries(SKILLS).filter(([, s]) => s.elem === elem).map(([id]) => id);

// one weather at a time; each skews the elements and the field
export const WEATHER = {
  rain: { slow: 0.2, mul: { fire: 0.9 }, fireSpeed: 0.9 },
  lava: { mul: { fire: 1.15, ice: 0.85 } },
  thunder: { mul: { volt: 1.15 }, stunMul: 1.3 },
  gap: 1.5,
};
// the ground's numbers
export const GROUND = { rainLife: 9, iceLife: 6, shockRatio: 0.5, shockStun: 0.3, shockCd: 0.4, lavaTick: 0.5, steamLife: 3, steamBurst: 15 };
