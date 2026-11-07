// What carries over between runs: the talent tree, element unlocks, gear, achievements, daily quests.

import { MARTIAL_PAIRS, MARTIAL_TRIADS } from "./martial.js";
const MARTIAL_IDS = new Set([...MARTIAL_PAIRS.map((p) => p[2]), ...MARTIAL_TRIADS.map((t) => t[1])]);

// ---------- talents: 4 branches, 16 nodes; cost = base * growth^level ----------
export const TALENTS = [
  // wall
  { id: "wallHp", branch: "Tường", name: "Tường dày", max: 5, base: 20, text: "+20 máu tường mỗi cấp", mod: (m, l) => (m.wallMax += 20 * l) },
  { id: "wallRegen", branch: "Tường", name: "Tự vá", max: 5, base: 30, text: "Tường hồi 0,15 máu/giây mỗi cấp", mod: (m, l) => (m.regen += 0.15 * l) },
  { id: "thorns", branch: "Tường", name: "Gai đá", max: 5, base: 30, text: "Quái đánh tường nhận 6 sát thương mỗi cấp", mod: (m, l) => (m.thorns += 6 * l) },
  { id: "startCard", branch: "Tường", name: "Chuẩn bị", max: 3, base: 60, text: "Bắt đầu lượt với thêm 1 lần chọn thẻ mỗi cấp", mod: (m, l) => (m.startCards = (m.startCards ?? 0) + l) },
  // power
  { id: "dmg", branch: "Sức mạnh", name: "Pháp lực", max: 5, base: 25, text: "+5% sát thương mỗi cấp", mod: (m, l) => (m.dmg *= 1 + 0.05 * l) },
  { id: "crit", branch: "Sức mạnh", name: "Chí mạng", max: 5, base: 30, text: "+3% tỉ lệ chí mạng (x1.5) mỗi cấp", mod: (m, l) => (m.crit += 0.03 * l) },
  { id: "react", branch: "Sức mạnh", name: "Cộng hưởng", max: 5, base: 35, text: "+6% sát thương phản ứng mỗi cấp", mod: (m, l) => (m.reactDmg *= 1 + 0.06 * l) },
  { id: "tier", branch: "Sức mạnh", name: "Tầng nguyên tố", max: 5, base: 45, text: "+8% sát thương TRIAD→HEXA mỗi cấp", mod: (m, l) => (m.tierDmg *= 1 + 0.08 * l) },
  // arcana
  { id: "cd", branch: "Huyền thuật", name: "Niệm nhanh", max: 5, base: 30, text: "−3% hồi chiêu mỗi cấp", mod: (m, l) => (m.cd *= 1 - 0.03 * l) },
  { id: "area", branch: "Huyền thuật", name: "Lan tỏa", max: 5, base: 25, text: "+4% diện rộng mỗi cấp", mod: (m, l) => (m.area *= 1 + 0.04 * l) },
  { id: "auraDur", branch: "Huyền thuật", name: "Ấn lâu", max: 5, base: 35, text: "+10% thời gian aura mỗi cấp", mod: (m, l) => (m.auraDur *= 1 + 0.1 * l) },
  { id: "focus", branch: "Huyền thuật", name: "Hội tụ", max: 3, base: 50, text: "Phép đơn mục tiêu ưu tiên quái nhiều aura", mod: (m, l) => (m.focus += 0.4 * l) },
  // fortune
  { id: "crystals", branch: "Vận may", name: "Mỏ tinh thể", max: 5, base: 30, text: "+10% tinh thể mỗi cấp", mod: (m, l) => (m.crystalMul = 1 + 0.1 * l) },
  { id: "rerolls", branch: "Vận may", name: "Đổi thẻ", max: 3, base: 40, text: "+1 lần đổi thẻ mỗi lượt chọn", mod: (m, l) => (m.rerolls = l) },
  { id: "choices", branch: "Vận may", name: "Thêm lựa chọn", max: 1, base: 300, text: "4 thẻ thay vì 3", mod: (m, l) => (m.choices += l) },
  { id: "luck", branch: "Vận may", name: "Bàn tay vàng", max: 5, base: 35, text: "Đồ rơi hiếm hơn", mod: (m, l) => (m.luck = l) },
];
export const TALENT_GROWTH = 1.7;
export const talentCost = (t, level) => Math.round(t.base * Math.pow(TALENT_GROWTH, level));

// ---------- elements: three to start, the rest bought (or earned) ----------
export const START_ELEMENTS = ["fire", "ice", "volt"];
export const ELEMENT_COST = { water: 150, earth: 200, wind: 250, poison: 300, light: 400, dark: 500, arcane: 600 };

// ---------- mage level: account xp from runs ----------
export const mageXpNext = (level) => Math.round(100 * Math.pow(1.35, level - 1));
export const MAGE_PERKS = { 3: "Đòn đánh thường bắt đầu ở cấp 2", 5: "Mở ô Bùa hộ mệnh", 8: "Mở Vô tận sớm (khi đã qua chương 3)" };

// ---------- gear ----------
export const SLOTS = { staff: "Gậy", cloak: "Áo choàng", amulet: "Bùa hộ mệnh" };
export const RARITY = {
  common:    { name: "Thường",      color: "#c8c8d0", affixes: 1, weight: 60 },
  rare:      { name: "Hiếm",        color: "#5ab8f4", affixes: 2, weight: 28 },
  epic:      { name: "Sử thi",      color: "#c08cff", affixes: 3, weight: 10 },
  legendary: { name: "Huyền thoại", color: "#ffc83a", affixes: 3, weight: 2 },
};
// [id, text, roll(min,max), apply(mods, value)]
export const AFFIXES = [
  ["dmg", "+{v}% sát thương", [4, 12], (m, v) => (m.dmg *= 1 + v / 100)],
  ["cd", "−{v}% hồi chiêu", [3, 8], (m, v) => (m.cd *= 1 - v / 100)],
  ["area", "+{v}% diện rộng", [4, 10], (m, v) => (m.area *= 1 + v / 100)],
  ["wall", "+{v} máu tường", [15, 45], (m, v) => (m.wallMax += v)],
  ["react", "+{v}% sát thương phản ứng", [5, 15], (m, v) => (m.reactDmg *= 1 + v / 100)],
  ["tier", "+{v}% sát thương tầng", [6, 18], (m, v) => (m.tierDmg *= 1 + v / 100)],
  ["aura", "+{v}% thời gian aura", [5, 15], (m, v) => (m.auraDur *= 1 + v / 100)],
  ["crit", "+{v}% chí mạng", [2, 6], (m, v) => (m.crit += v / 100)],
  ["regen", "+{v} hồi tường/10s", [2, 6], (m, v) => (m.regen += v / 10)],
  ["xp", "+{v}% kinh nghiệm", [5, 15], (m, v) => (m.xp *= 1 + v / 100)],
  ["crystal", "+{v}% tinh thể", [5, 15], (m, v) => (m.crystalMul = (m.crystalMul ?? 1) * (1 + v / 100))],
  ...["fire", "ice", "volt", "water", "earth", "wind", "poison", "light", "dark", "arcane"].map((el) => [`e_${el}`, `+{v}% sát thương ${el}`, [8, 20], (m, v) => (m.elem[el] = (m.elem[el] ?? 1) * (1 + v / 100))]),
];
export const LEGENDARY = [
  ["bh", "Hố Đen bán kính +50%", (m) => (m.bhRadius *= 1.5)],
  ["hexa", "Sát thương tầng +60%", (m) => (m.tierDmg *= 1.6)],
  ["slot", "+1 ô skill", (m) => (m.slots += 1)],
  ["aura", "Aura kéo dài gấp rưỡi", (m) => (m.auraDur *= 1.5)],
  ["resonance", "Sát thương phản ứng +50%", (m) => (m.reactDmg *= 1.5)],
];
export const BAG_SIZE = 30;

// ---------- achievements: [id, name, text, crystals, check(profile)] ----------
const P = (p) => p.stats;
export const ACHIEVEMENTS = [
  ["ch1", "Người giữ cổng", "Qua chương 1", 30, (p) => p.best.chapter >= 1],
  ["ch2", "Qua rừng độc", "Qua chương 2", 60, (p) => p.best.chapter >= 2],
  ["ch3", "Vượt núi lửa", "Qua chương 3", 100, (p) => p.best.chapter >= 3],
  ["ch4", "Băng tan", "Qua chương 4", 150, (p) => p.best.chapter >= 4],
  ["ch5", "Chạm vực hư không", "Qua chương 5", 250, (p) => p.best.chapter >= 5],
  ["end10", "Không hồi kết", "Vô tận: đợt 10", 80, (p) => p.best.endless >= 10],
  ["end25", "Bền bỉ", "Vô tận: đợt 25", 200, (p) => p.best.endless >= 25],
  ["end50", "Bất tử", "Vô tận: đợt 50", 500, (p) => p.best.endless >= 50],
  ["codex10", "Nhà giả kim", "Khám phá 10 phản ứng", 40, (p) => p.codex.length >= 10],
  ["codex30", "Học giả nguyên tố", "Khám phá 30 phản ứng", 120, (p) => p.codex.length >= 30],
  ["codex61", "Toàn tri", "Khám phá cả 61 mục Codex", 600, (p) => p.codex.length >= 61],
  ["triad", "Tam hợp", "Lần đầu TRIAD", 20, (p) => (p.counts.triad ?? 0) >= 1],
  ["penta", "Ngũ hành", "Lần đầu PENTA", 50, (p) => (p.counts.penta ?? 0) >= 1],
  ["hexa", "Lục tinh", "Lần đầu HEXA", 80, (p) => (p.counts.hexa ?? 0) >= 1],
  ["chaos1", "Hố Đen", "Lần đầu CHAOS", 150, (p) => (p.counts.chaos ?? 0) >= 1],
  ["chaos10", "Chúa tể hỗn mang", "10 lần CHAOS", 400, (p) => (p.counts.chaos ?? 0) >= 10],
  ["melt100", "Tan chảy", "100 lần MELT", 60, (p) => (p.counts.melt ?? 0) >= 100],
  ["shock100", "Dây dẫn", "100 lần SHOCK hoặc CONDUCT", 60, (p) => (p.counts.shock ?? 0) + (p.counts.conduct ?? 0) >= 100],
  ["steam50", "Nồi hơi", "50 lần STEAM", 50, (p) => (p.counts.steam ?? 0) >= 50],
  ["kills1k", "Đồ tể", "Hạ 1.000 quái", 50, (p) => P(p).kills >= 1000],
  ["kills10k", "Huyền thoại", "Hạ 10.000 quái", 300, (p) => P(p).kills >= 10000],
  ["runs10", "Kiên trì", "Chơi 10 lượt", 40, (p) => P(p).runs >= 10],
  ["elem5", "Đa hệ", "Mở khóa 5 nguyên tố", 50, (p) => p.unlocked.length >= 5],
  ["elem10", "Thập hệ", "Mở khóa cả 10 nguyên tố", 200, (p) => p.unlocked.length >= 10],
  ["awaken10", "Thức tỉnh", "Thức tỉnh 10 nguyên tố trong một lượt", 250, (p) => P(p).maxAwakened >= 10],
  ["mage10", "Đại pháp sư", "Pháp sư cấp 10", 150, (p) => p.mageLevel >= 10],
  ["legend", "Báu vật", "Nhặt được đồ Huyền thoại", 100, (p) => P(p).legendaries >= 1],
  ["flawless", "Không trầy xước", "Qua một chương mà tường còn đầy máu", 120, (p) => P(p).flawless >= 1],
  ["elite100", "Săn tinh anh", "Hạ 100 quái tinh anh", 80, (p) => P(p).elites >= 100],
  ["talent20", "Cây đại thụ", "Tổng 20 cấp nâng cấp", 100, (p) => Object.values(p.talents).reduce((a, b) => a + b, 0) >= 20],
  // the classes
  ...[["mage", "Pháp sư"], ["swordman", "Kiếm sĩ"], ["archer", "Cung thủ"], ["thief", "Đạo tặc"], ["acolyte", "Tu sĩ"], ["merchant", "Thương nhân"]].map(([c, n]) =>
    [`ch1_${c}`, `${n} giữ cổng`, `Qua chương 1 bằng ${n}`, 40, (p) => (p.best.byClass?.[c]?.chapter ?? 0) >= 1]),
  ["allclasses", "Sáu nghề", "Mở khóa cả 6 nghề", 200, (p) => (p.classes?.length ?? 0) >= 6],
  ["martialchaos", "Võ đạo hỗn mang", "Tạo CHAOS bằng một nghề võ", 200, (p) => (p.stats.martialChaos ?? 0) >= 1],
  ["combo30", "Bậc thầy combo", "Khám phá 30 combo võ thuật", 150, (p) => p.codex.filter((id) => MARTIAL_IDS.has(id)).length >= 30],
].map(([id, name, text, reward, check]) => ({ id, name, text, reward, check }));

// ---------- daily quests: three a day from these ----------
export const QUESTS = [
  ...[["swordman", "Kiếm sĩ"], ["archer", "Cung thủ"], ["thief", "Đạo tặc"], ["acolyte", "Tu sĩ"], ["merchant", "Thương nhân"]].map(([c, n]) =>
    ({ id: `cls_${c}`, text: `Qua {n} đợt bằng ${n}`, n: [4, 8], reward: 50, of: (s) => (s.cls === c ? s.waves : 0) })),
  { id: "kills", text: "Hạ {n} quái", n: [200, 400], reward: 40, of: (s) => s.kills },
  { id: "waves", text: "Qua {n} đợt", n: [8, 15], reward: 40, of: (s) => s.waves },
  { id: "reacts", text: "Kích hoạt {n} phản ứng", n: [60, 150], reward: 50, of: (s) => Object.values(s.counts).reduce((a, b) => a + b, 0) },
  { id: "tiers", text: "Kích hoạt {n} phản ứng tầng", n: [10, 25], reward: 60, of: (s) => ["triad", "quadra", "penta", "hexa"].reduce((a, k) => a + (s.counts[k] ?? 0), 0) },
  { id: "penta", text: "Kích hoạt {n} PENTA", n: [2, 5], reward: 70, of: (s) => s.counts.penta ?? 0 },
  { id: "melt", text: "Kích hoạt {n} MELT", n: [15, 40], reward: 40, of: (s) => s.counts.melt ?? 0 },
  { id: "shock", text: "Kích hoạt {n} SHOCK", n: [15, 40], reward: 40, of: (s) => s.counts.shock ?? 0 },
  { id: "boss", text: "Hạ {n} boss", n: [1, 3], reward: 60, of: (s) => s.bosses },
  { id: "elites", text: "Hạ {n} quái tinh anh", n: [5, 15], reward: 50, of: (s) => s.elites },
  { id: "awaken", text: "Thức tỉnh {n} dấu trong một lượt", n: [3, 6], reward: 60, of: (s) => s.awakened.length, max: true },
];
