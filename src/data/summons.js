// Summons: allies that fight on the field for a while. Three bodies, three roles:
//   spirit  (ranged) hovers by the wall and casts at what comes in range
//   beast   (melee)  runs at the nearest monster and bites
//   golem   (block)  plants itself in the path: monsters stop to beat on it instead of the wall
// One per element, and eight fusions: own both halves and a card offers to fuse them into one (freeing a
// slot). A fusion strikes with its two elements in turn, so it sets off their reaction on its own.

const L = (a, b) => (l) => a + ((b - a) * (l - 1)) / 4;
const lv = (spec) => (l) => Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, typeof v === "function" ? v(l) : v]));
const base = { spirit: { range: 105, life: 16 }, beast: { speed: 62, life: 14 }, golem: { life: 18 } };
const S = (name, body, elems, desc, stats, extra = {}) => ({
  name, elem: elems[0], elems, kind: "summon", body, icon: null, desc, ...extra,
  stats: (l) => { const s = lv({ ...base[body], cd: L(9, 6), max: (l) => (l >= 4 ? 2 : 1), ...stats })(l); s.dmg *= SUMMON_DMG; return s },
});
// a summon hits about as hard over a fight as a spell in its slot
export const SUMMON_DMG = 1.8;

export const SUMMONS = {
  // ---- one per element
  salamander:  S("Kỳ nhông lửa", "beast", ["fire"], "Triệu hồi: thú lửa lao vào cắn, đốt cháy.", { hp: L(70, 140), dmg: L(10, 22), rate: 0.8, burn: L(3, 6) }),
  frostsprite: S("Tinh linh băng", "spirit", ["ice"], "Triệu hồi: bắn băng từ xa, 3 lớp lạnh thì đóng băng.", { hp: L(40, 80), dmg: L(8, 18), rate: 1.0, freezeAt3: true }),
  thunderwisp: S("Hồn sấm", "spirit", ["volt"], "Triệu hồi: phóng sét nảy qua 2–3 con, tê liệt.", { hp: L(40, 80), dmg: L(9, 20), rate: 1.1, chains: (l) => (l >= 3 ? 3 : 2), stun: 0.4 }),
  undine:      S("Thủy thần", "golem", ["water"], "Triệu hồi: chặn đường; quanh nó luôn có vũng nước, quái đánh nó bị Ướt.", { hp: L(150, 300), dmg: L(8, 16), rate: 1.2, puddle: 14 }),
  stonegolem:  S("Golem đá", "golem", ["earth"], "Triệu hồi: chặn đường, rất trâu, gai đá phản đòn, vỡ giáp.", { hp: L(240, 480), dmg: L(12, 26), rate: 1.4, thorns: L(4, 10) }),
  galewolf:    S("Sói gió", "beast", ["wind"], "Triệu hồi: sói cực nhanh, cắn liên tục và hất lùi.", { hp: L(60, 120), dmg: L(8, 18), rate: 0.55, speed: 95, push: 6 }),
  toad:        S("Cóc độc", "beast", ["poison"], "Triệu hồi: cóc nhảy vào đàn quái, mỗi cú cắn +2 lớp độc.", { hp: L(80, 160), dmg: L(6, 14), rate: 0.9, poison: L(3, 6), stacks: 2, speed: 45 }),
  angel:       S("Thiên thần", "spirit", ["light"], "Triệu hồi: bắn ánh sáng, phán xét, hồi máu tường.", { hp: L(50, 100), dmg: L(8, 18), rate: 1.0, heal: L(0.5, 1.2) }),
  shade:       S("Bóng ma", "spirit", ["dark"], "Triệu hồi: nguyền quái, hút 10% sát thương thành máu tường.", { hp: L(45, 90), dmg: L(9, 20), rate: 1.0, drain: 0.1 }),
  familiar:    S("Linh thú huyền bí", "spirit", ["arcane"], "Triệu hồi: bắn tên huyền bí rất nhanh, tích điện.", { hp: L(40, 80), dmg: L(5, 11), rate: 0.45 }),
  // ---- fusions: [the two they come from]
  phoenix:    S("Phượng hoàng", "spirit", ["fire", "light"], "Hợp thể Kỳ nhông + Thiên thần: lửa và ánh sáng xen kẽ (SOLAR); chết thì nổ và tái sinh một lần.", { hp: L(90, 180), dmg: L(16, 34), rate: 0.9, range: 130, burn: L(4, 8), heal: L(0.5, 1) }, { fuse: ["salamander", "angel"] }),
  steamgolem: S("Golem hơi nước", "golem", ["fire", "water"], "Hợp thể Kỳ nhông + Thủy thần: chặn đường, tỏa hơi nước bỏng quanh mình (STEAM).", { hp: L(260, 520), dmg: L(14, 30), rate: 1.1, steam: 2.5 }, { fuse: ["salamander", "undine"] }),
  stormtitan: S("Titan bão", "golem", ["volt", "wind"], "Hợp thể Hồn sấm + Sói gió: chặn đường, mỗi cú đấm phóng sét nảy 3 con và hất lùi (STORM ARC).", { hp: L(240, 480), dmg: L(16, 34), rate: 1.0, chains: 3, push: 10, stun: 0.4 }, { fuse: ["thunderwisp", "galewolf"] }),
  glacier:    S("Băng sơn", "golem", ["ice", "water"], "Hợp thể Tinh linh băng + Thủy thần: chặn đường, quái đánh nó bị làm lạnh rồi đóng băng (FREEZE).", { hp: L(300, 600), dmg: L(12, 26), rate: 1.2, chillBack: true }, { fuse: ["frostsprite", "undine"] }),
  magmabeast: S("Thú dung nham", "beast", ["fire", "earth"], "Hợp thể Kỳ nhông + Golem đá: chạy đến đâu để lại dung nham đến đó (MAGMA).", { hp: L(140, 280), dmg: L(16, 34), rate: 0.85, burn: L(4, 8), lava: 1.2 }, { fuse: ["salamander", "stonegolem"] }),
  plague:     S("Thú dịch hạch", "beast", ["poison", "dark"], "Hợp thể Cóc độc + Bóng ma: cắn gieo dịch bệnh, quái chết thì nổ lây (PLAGUE).", { hp: L(120, 240), dmg: L(10, 22), rate: 0.75, poison: L(4, 8), stacks: 2 }, { fuse: ["toad", "shade"] }),
  voideye:    S("Mắt hư không", "spirit", ["dark", "arcane"], "Hợp thể Bóng ma + Linh thú: tia hư không (VOID), cứ 4 giây mở giếng hút quái.", { hp: L(80, 160), dmg: L(12, 26), rate: 0.7, range: 130, well: 4 }, { fuse: ["shade", "familiar"] }),
  prism:      S("Tinh thể lăng kính", "spirit", ["ice", "light"], "Hợp thể Tinh linh băng + Thiên thần: tia khúc xạ trúng 3 con (PRISM).", { hp: L(70, 140), dmg: L(12, 26), rate: 0.9, range: 140, split: 3 }, { fuse: ["frostsprite", "angel"] }),
};
for (const [id, s] of Object.entries(SUMMONS)) s.icon = `icon_s_${id}`;
export const FUSIONS = Object.entries(SUMMONS).filter(([, s]) => s.fuse).map(([id]) => id);
