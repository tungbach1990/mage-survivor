// What carries over between runs: per class the talent tree, the marks unlocked and the gear worn; shared, the
// crystals, the bag, the account level, achievements and daily quests.

import { MARTIAL_PAIRS, MARTIAL_TRIADS } from "./martial.js?v=mw7okn8h";
import { ELEMENTS, MARTIAL, MARKS, ELEM, schoolOf } from "./elements.js?v=mw7okn8h";
const MARTIAL_IDS = new Set([...MARTIAL_PAIRS.map((p) => p[2]), ...MARTIAL_TRIADS.map((t) => t[1])]);

// ---------- talents: one tree per class, 4 branches of 4; cost = base * growth^level ----------
const T = (id, branch, name, max, base, text, mod) => ({ id, branch, name, max, base, text, mod });
const COMMON = [
  T("wallHp", "Tường", "Tường dày", 5, 20, "+20 máu tường mỗi cấp", (m, l) => (m.wallMax += 20 * l)),
  T("wallRegen", "Tường", "Tự vá", 5, 30, "Tường hồi 0,15 máu/giây mỗi cấp", (m, l) => (m.regen += 0.15 * l)),
  T("thorns", "Tường", "Gai đá", 5, 30, "Quái đánh tường nhận 6 sát thương mỗi cấp", (m, l) => (m.thorns += 6 * l)),
  T("dmg", "Sức mạnh", "Sức mạnh", 5, 25, "+5% sát thương mỗi cấp", (m, l) => (m.dmg *= 1 + 0.05 * l)),
  T("crit", "Sức mạnh", "Chí mạng", 5, 30, "+3% tỉ lệ chí mạng mỗi cấp", (m, l) => (m.crit += 0.03 * l)),
  T("react", "Sức mạnh", "Cộng hưởng", 5, 35, "+6% sát thương phản ứng/combo mỗi cấp", (m, l) => (m.reactDmg *= 1 + 0.06 * l)),
  T("tier", "Sức mạnh", "Tầng dấu", 5, 45, "+8% sát thương TRIAD→HEXA mỗi cấp", (m, l) => (m.tierDmg *= 1 + 0.08 * l)),
  T("cd", "Kỹ năng", "Nhanh tay", 5, 30, "−3% hồi chiêu mỗi cấp", (m, l) => (m.cd *= 1 - 0.03 * l)),
  T("area", "Kỹ năng", "Lan tỏa", 5, 25, "+4% diện rộng mỗi cấp", (m, l) => (m.area *= 1 + 0.04 * l)),
  T("auraDur", "Kỹ năng", "Dấu lâu", 5, 35, "+10% thời gian dấu mỗi cấp", (m, l) => (m.auraDur *= 1 + 0.1 * l)),
  T("rerolls", "Vận may", "Đổi thẻ", 3, 40, "+1 lần đổi thẻ mỗi lượt chọn", (m, l) => (m.rerolls = l)),
  T("luck", "Vận may", "Bàn tay vàng", 5, 35, "Đồ rơi hiếm hơn", (m, l) => (m.luck = l)),
];
const SIG = "Đặc trưng";
const SIGNATURE = {
  mage: [
    T("summonHp", SIG, "Triệu hồi bền", 5, 35, "+15% máu triệu hồi mỗi cấp", (m, l) => (m.summonHp *= 1 + 0.15 * l)),
    T("weatherDur", SIG, "Mưa dài", 5, 40, "+10% thời gian mưa phép mỗi cấp", (m, l) => (m.weatherDur *= 1 + 0.1 * l)),
    T("focus", SIG, "Hội tụ", 3, 50, "Phép đơn mục tiêu ưu tiên quái nhiều dấu", (m, l) => (m.focus += 0.4 * l)),
    T("bh", SIG, "Hố Đen rộng", 3, 80, "+10% bán kính Hố Đen mỗi cấp", (m, l) => (m.bhRadius *= 1 + 0.1 * l)),
  ],
  swordman: [
    T("meleeDmg", SIG, "Lưỡi bén", 5, 30, "+4% sát thương cận chiến mỗi cấp", (m, l) => (m.meleeDmg *= 1 + 0.04 * l)),
    T("reach", SIG, "Tầm chém", 3, 45, "+5 tầm với đòn cận chiến mỗi cấp", (m, l) => (m.reach += 5 * l)),
    T("guard", SIG, "Giữ cổng", 5, 40, "Tường nhận −2% sát thương mỗi cấp", (m, l) => (m.wallTaken *= 1 - 0.02 * l)),
    T("sunder", SIG, "Phá giáp sâu", 3, 50, "Phá giáp +4% sát thương vật lý mỗi cấp", (m, l) => (m.sunder += 0.04 * l)),
  ],
  archer: [
    T("pierce", SIG, "Mũi tên xuyên", 2, 80, "+1 xuyên cho tên/tia mỗi cấp", (m, l) => (m.pierce += l)),
    T("rapid", SIG, "Bắn nhanh", 5, 35, "−4% hồi chiêu skill bắn mỗi cấp", (m, l) => (m.boltCd *= 1 - 0.04 * l)),
    T("traps", SIG, "Bẫy bền", 5, 30, "+15% thời gian bẫy và vùng mỗi cấp", (m, l) => (m.zoneLife *= 1 + 0.15 * l)),
    T("sharp", SIG, "Thiện xạ", 5, 40, "+4% tỉ lệ chí mạng mỗi cấp", (m, l) => (m.crit += 0.04 * l)),
  ],
  thief: [
    T("dot", SIG, "Nọc đặc", 5, 30, "+10% sát thương chảy máu/nọc/độc mỗi cấp", (m, l) => (m.dotDmg *= 1 + 0.1 * l)),
    T("backstab", SIG, "Đâm lén", 5, 40, "Chí mạng +10% sát thương mỗi cấp", (m, l) => (m.critMul += 0.1 * l)),
    T("pickpocket", SIG, "Móc túi", 5, 25, "+10% vàng mỗi cấp", (m, l) => (m.gold *= 1 + 0.1 * l)),
    T("evade", SIG, "Né tránh", 5, 40, "Quái đánh trượt tường thêm 3% mỗi cấp", (m, l) => (m.dodge += 0.03 * l)),
  ],
  acolyte: [
    T("healMul", SIG, "Hồi phục", 5, 30, "+7% lượng hồi tường mỗi cấp", (m, l) => (m.healMul *= 1 + 0.07 * l)),
    T("holy", SIG, "Thánh quang", 5, 35, "+8% sát thương Ánh sáng mỗi cấp", (m, l) => (m.elem.light = (m.elem.light ?? 1) * (1 + 0.08 * l))),
    T("aegis", SIG, "Giáp thánh", 5, 40, "Tường nhận −2% sát thương mỗi cấp", (m, l) => (m.wallTaken *= 1 - 0.02 * l)),
    T("grace", SIG, "Ân điển", 5, 35, "+15% máu Thiên thần/triệu hồi mỗi cấp", (m, l) => (m.summonHp *= 1 + 0.15 * l)),
  ],
  merchant: [
    T("trade", SIG, "Buôn may", 5, 25, "+12% vàng mỗi cấp", (m, l) => (m.gold *= 1 + 0.12 * l)),
    T("discount", SIG, "Giảm giá", 3, 45, "Skill tốn vàng rẻ hơn 12% mỗi cấp", (m, l) => (m.goldCost *= 1 - 0.12 * l)),
    T("heavycart", SIG, "Xe đẩy nặng", 5, 30, "+8% sát thương cận chiến, +15% đẩy lùi mỗi cấp", (m, l) => { m.meleeDmg *= 1 + 0.08 * l; m.push *= 1 + 0.15 * l }),
    T("hirelings", SIG, "Thuê bền", 5, 35, "+15% máu golem/quầy hàng mỗi cấp", (m, l) => (m.summonHp *= 1 + 0.15 * l)),
  ],
};
export const TALENT_TREES = Object.fromEntries(Object.entries(SIGNATURE).map(([c, sig]) => [c, [...COMMON, ...sig]]));
export const TALENTS = TALENT_TREES.mage;
export const TALENT_GROWTH = 1.7;
export const talentCost = (t, level) => Math.round(t.base * Math.pow(TALENT_GROWTH, level));

// ---------- marks: every class can unlock all twenty; three to start ----------
export const START_MARKS = {
  mage: ["fire", "ice", "volt"], swordman: ["sunder", "daze", "bleed"], archer: ["bleed", "pin", "cripple"],
  thief: ["venom", "expose", "blind"], acolyte: ["daze", "sunder", "expose"], merchant: ["bounty", "daze", "cripple"],
};
export const START_ELEMENTS = START_MARKS.mage;
const BASE_COST = {
  fire: 150, ice: 150, volt: 150, water: 150, earth: 200, wind: 250, poison: 300, light: 400, dark: 500, arcane: 600,
  bleed: 150, daze: 150, sunder: 150, cripple: 200, pin: 200, expose: 250, blind: 300, disarm: 400, venom: 400, bounty: 500,
};
export const ELEMENT_COST = Object.fromEntries(ELEMENTS.filter((e) => !START_ELEMENTS.includes(e)).map((e) => [e, BASE_COST[e]]));
/** A class's own school: the Mage elements, the Acolyte both, the rest martial. */
export const homeSchool = (cls) => (cls === "mage" ? "arcane" : cls === "acolyte" ? "both" : "martial");
export const crossSchool = (cls, mark) => homeSchool(cls) !== "both" && schoolOf(mark) !== homeSchool(cls);
/** What unlocking a mark costs a class: marks of the other school half as much again. */
export const markCost = (cls, mark) => Math.round(BASE_COST[mark] * (crossSchool(cls, mark) ? 1.5 : 1));

// ---------- account level: xp from every run ----------
export const mageXpNext = (level) => Math.round(100 * Math.pow(1.35, level - 1));
export const MAGE_PERKS = { 3: "Đòn đánh thường bắt đầu ở cấp 2", 5: "Mở ô Bùa hộ mệnh", 8: "Mở Vô tận sớm (khi đã qua chương 3)" };

// ---------- gear: three slots per class; the weapon named for the class ----------
import { SLOT_IDS, SLOT_NAMES } from "./gear.js?v=mw7okn8h";
export const SLOTS = Object.fromEntries(SLOT_IDS.map((s) => [s, SLOT_NAMES[s]]));
export const WEAPON_NAME = { mage: "Gậy phép", swordman: "Kiếm", archer: "Cung", thief: "Dao găm", acolyte: "Chùy", merchant: "Xe đẩy" };
export const slotName = (slot, cls) => (slot === "weapon" ? WEAPON_NAME[cls] ?? "Vũ khí" : SLOTS[slot] ?? slot);

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
  // a mark's damage (m_), and an imbue (i_): the class's blows carry a mark of the other school now and then
  ...MARKS.map((mk) => [`m_${mk}`, `+{v}% sát thương ${ELEM[mk].name}`, [8, 20], (m, v) => (m.elem[mk] = (m.elem[mk] ?? 1) * (1 + v / 100)), { mark: mk }]),
  ...MARKS.map((mk) => [`i_${mk}`, `Tẩm ${ELEM[mk].name} {v}%`, [8, 20], (m, v) => (m.imbue[mk] = Math.max(m.imbue[mk] ?? 0, v / 100)), { mark: mk, imbue: true }]),
  // older saves: e_<element>
  ...ELEMENTS.map((el) => [`e_${el}`, `+{v}% sát thương ${ELEM[el].name}`, [8, 20], (m, v) => (m.elem[el] = (m.elem[el] ?? 1) * (1 + v / 100)), { mark: el, legacy: true }]),
];
export const LEGENDARY = [
  ["bh", "Hố Đen bán kính +50%", (m) => (m.bhRadius *= 1.5)],
  ["hexa", "Sát thương tầng +60%", (m) => (m.tierDmg *= 1.6)],
  ["slot", "+1 ô skill", (m) => (m.slots += 1)],
  ["aura", "Aura kéo dài gấp rưỡi", (m) => (m.auraDur *= 1.5)],
  ["resonance", "Sát thương phản ứng +50%", (m) => (m.reactDmg *= 1.5)],
  ["imbue2", "Vũ khí nguyên tố: tỉ lệ tẩm dấu ×2", (m) => (m.imbueMul *= 2)],
];
export const BAG_SIZE = 40;
/** Ten slots now: each item's lines are worth less than when there were three. */
export const GEAR_SCALE = 0.45;

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
  ["elem5", "Đa hệ", "Một nghề mở 5 dấu", 50, (p) => Object.values(p.perClass ?? {}).some((c) => c.marks.length >= 5)],
  ["elem10", "Thập hệ", "Một nghề mở 10 dấu", 200, (p) => Object.values(p.perClass ?? {}).some((c) => c.marks.length >= 10)],
  ["awaken10", "Thức tỉnh", "Thức tỉnh 10 nguyên tố trong một lượt", 250, (p) => P(p).maxAwakened >= 10],
  ["mage10", "Lão luyện", "Tài khoản cấp 10", 150, (p) => p.mageLevel >= 10],
  ["legend", "Báu vật", "Nhặt được đồ Huyền thoại", 100, (p) => P(p).legendaries >= 1],
  ["flawless", "Không trầy xước", "Qua một chương mà tường còn đầy máu", 120, (p) => P(p).flawless >= 1],
  ["elite100", "Săn tinh anh", "Hạ 100 quái tinh anh", 80, (p) => P(p).elites >= 100],
  ["talent20", "Cây đại thụ", "Tổng 20 cấp nâng cấp", 100, (p) => Object.values(p.perClass ?? {}).reduce((a, c) => a + Object.values(c.talents).reduce((x, y) => x + y, 0), 0) >= 20],
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
