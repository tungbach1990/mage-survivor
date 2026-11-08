// The six classes, their basic attacks (levels 1-8) and their own skills. A skill's `elem` is the mark its hit
// leaves (an element or a martial mark) and `also` the extra marks it adds; `cls` says who can learn it
// (skills without one are the Mage's). New archetypes: melee (a swing at what's near the wall), dash (a charge
// down one row), heal (mends the wall); passives with `pm` change the run's numbers (dmg, wallTaken, gold).

import { ELEMENTS, MARTIAL, MARKS } from "./elements.js?v=mw82t9te";
import { STARTER, WTYPES, WTYPE_DMG, wtypesOf, btbaOf, basicIdOf } from "./weapons.js?v=mw82t9te";

const L = (a, b) => (l) => a + ((b - a) * (l - 1)) / 4;            // levels 1-5
const L8 = (a, b) => (l) => a + ((b - a) * (l - 1)) / 7;           // a basic attack's levels 1-8
const lv = (spec) => (l) => Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, typeof v === "function" ? v(l) : v]));
const S = (cls, name, elem, kind, desc, stats, extra = {}) => ({ name, elem, kind, cls: [].concat(cls), desc, icon: extra.icon ?? "icon_basic", stats: lv(stats), ...extra });

export const CLASS_SKILLS = {
  // ---------------- the basic attacks: one per class, the run starts with it, it levels to 8 ----------------
  basic_mage: S("mage", "Magic Bolt", "arcane", "bolt", "Đánh thường: tia phép huyền bí. Cấp 4: 2 tia. Cấp 8: xuyên 3 con.",
    { cd: L8(0.8, 0.38), dmg: L8(8, 28), speed: 260, count: (l) => (l >= 4 ? 2 : 1), pierce: (l) => (l >= 8 ? 3 : 1) }, { basic: true, max: 8, icon: "icon_b_mage" }),
  basic_swordman: S("swordman", "Chém", "sunder", "melee", "Đánh thường: chém những con sát tường. Cấp 4: trúng 3 con. Cấp 8: chém ra sóng kiếm.",
    { cd: L8(0.7, 0.38), dmg: L8(13, 34), reach: 30, width: 26, targets: (l) => (l >= 4 ? 3 : 2), wave: (l) => l >= 8 }, { basic: true, max: 8, icon: "icon_b_swordman" }),
  basic_archer: S("archer", "Bắn tên", "bleed", "bolt", "Đánh thường: một mũi tên. Cấp 4: 2 mũi. Cấp 8: xuyên 3 con.",
    { cd: L8(0.7, 0.34), dmg: L8(16, 26), speed: 330, count: (l) => (l >= 4 ? 2 : 1), pierce: (l) => (l >= 8 ? 3 : 1) }, { basic: true, max: 8, icon: "icon_b_archer" }),
  basic_thief: S("thief", "Phi dao", "venom", "bolt", "Đánh thường: ném 2 dao găm tẩm nọc. Cấp 4: 3 dao. Cấp 8: dao bay thẳng vào mục tiêu; mục tiêu chết trước thì dao lượn một vòng rồi lao vào con gần nhất.",
    { cd: L8(0.62, 0.32), dmg: L8(5, 8), speed: 300, count: (l) => (l >= 4 ? 3 : 2), homing: (l) => l >= 8 }, { basic: true, max: 8, icon: "icon_b_thief" }),
  basic_acolyte: S("acolyte", "Holy Light", "light", "strike", "Đánh thường: thập giá thánh quang giáng thẳng lên quái. Cấp 4: 2 thập giá. Cấp 8: mỗi thập giá hồi 1 máu tường.",
    { cd: L8(0.68, 0.4), dmg: L8(22, 28), speed: 260, count: (l) => (l >= 4 ? 2 : 1), mend: (l) => (l >= 8 ? 1 : 0) }, { basic: true, max: 8, icon: "icon_b_acolyte" }),
  basic_merchant: S("merchant", "Cart Hit", "daze", "melee", "Đánh thường: húc xe đẩy vào quái sát tường. Cấp 4: trúng 3 con. Cấp 8: mỗi cú rơi 1 vàng.",
    { cd: L8(0.85, 0.45), dmg: L8(24, 32), reach: 32, width: 28, targets: (l) => (l >= 4 ? 3 : 2), coin: (l) => l >= 8 }, { basic: true, max: 8, icon: "icon_b_merchant" }),

  // ---------------- Swordman: a gatekeeper ----------------
  bash: S("swordman", "Bash", "daze", "melee", "Đập mạnh một con sát tường: Choáng + Phá giáp.", { cd: L(2.6, 2), dmg: L(60, 96), reach: 34, width: 20, targets: 1 }, { also: ["sunder"], icon: "icon_bash" }),
  magnum: S("swordman", "Magnum Break", "daze", "melee", "Bùng nổ quanh cổng: trúng mọi con gần tường, hất lùi.", { cd: L(5, 3.6), dmg: L(36, 64), reach: 38, width: 90, targets: 99, push: 14 }, { icon: "icon_magnum" }),
  bowling: S("swordman", "Bowling Bash", "cripple", "dash", "Lao dọc một hàng quái: hất lùi, Què + Choáng.", { cd: L(7, 5), dmg: L(26, 58), length: 170, width: 18, push: 18 }, { also: ["daze"], icon: "icon_bowling" }),
  provoke: S("swordman", "Provoke", "disarm", "zone", "Khiêu khích chỗ đông quái: Tước vũ khí + Đánh dấu.", { cd: L(8, 6), dmg: L(6, 14), radius: L(28, 36) }, { at: "crowd", also: ["expose"], icon: "icon_provoke" }),
  whirlwind: S("swordman", "Whirlwind", "bleed", "melee", "Xoay kiếm: Chảy máu mọi con gần tường.", { cd: L(3.6, 2.6), dmg: L(26, 44), reach: 40, width: 80, targets: 99 }, { icon: "icon_whirlwind" }),
  shieldcharge: S("swordman", "Shield Charge", "pin", "dash", "Húc khiên dọc một hàng: Ghim + Phá giáp.", { cd: L(8, 5.5), dmg: L(30, 64), length: 150, width: 20, push: 10 }, { also: ["sunder"], icon: "icon_shieldcharge" }),
  swordwave: S("swordman", "Sword Wave", "sunder", "bolt", "Sóng kiếm dựng đứng quét ngang sân, chém mọi con nó đi qua: Phá giáp. Cao dần theo cấp, cấp 8 phủ kín chiều ngang tường thành.", { cd: L(2.2, 1.6), dmg: L(32, 50), speed: 200, pierce: 99, half: L(32, 56) }, { icon: "icon_swordwave" }),
  endure: S("swordman", "Endure", "sunder", "passive", "Bị động: tường nhận ít sát thương hơn (−12% → −20%).", { cd: 0, wallTaken: L(0.88, 0.8) }, { passive: "mod", icon: "icon_endure" }),

  // ---------------- Archer: from the wall, far ----------------
  doublestrafe: S("archer", "Double Strafe", "bleed", "bolt", "Hai mũi tên liên tiếp: Chảy máu.", { cd: L(1.6, 1), dmg: L(18, 42), speed: 340, count: 2 }, { icon: "icon_doublestrafe" }),
  arrowshower: S("archer", "Arrow Shower", "cripple", "volley", "Bắn một loạt tên lên trời, tên rơi xuống chỗ quái đông: mỗi mũi gây sát thương và Què. Cấp càng cao càng nhiều tên (6 → 26).", { cd: L(4.5, 3.2), dmg: L(9, 18), arrows: L(6, 16), radius: L(24, 32), hit: 7, rise: 0.55, gap: 0.035 }, { icon: "icon_arrowshower" }),
  pinshot: S("archer", "Pin Shot", "pin", "bolt", "Mũi tên ghim: giữ chân.", { cd: L(2.5, 1.6), dmg: L(24, 52), speed: 360 }, { icon: "icon_pinshot" }),
  huntersmark: S("archer", "Hunter's Mark", "expose", "bolt", "Đánh dấu con mạnh: đòn sau chí mạng.", { cd: L(3, 2), dmg: L(10, 22), speed: 380, pierce: 2 }, { icon: "icon_huntersmark" }),
  blindarrow: S("archer", "Blind Arrow", "blind", "ball", "Mũi tên khói: làm mù một vùng.", { cd: L(3.5, 2.4), dmg: L(14, 32), radius: L(18, 24), speed: 220 }, { icon: "icon_blindarrow" }),
  chargearrow: S("archer", "Charge Arrow", "sunder", "bolt", "Mũi tên nặng xuyên 3 con, hất lùi: Phá giáp.", { cd: L(3, 2), dmg: L(22, 48), speed: 300, pierce: 3, push: 16 }, { icon: "icon_chargearrow" }),
  falcon: S("archer", "Falcon", "bleed", "summon", "Chim ưng bay trên đầu cung thủ, không có máu, ở mãi: lao xuống cào kẻ địch rồi rút về. Chảy máu + Đánh dấu. Cấp 5: cào 2 nhát. Cấp 4: thêm 1 con.", { cd: 1, max: (l) => (l >= 4 ? 2 : 1), dmg: L(16, 36), rate: L(1.6, 1), range: 230, speed: 260, claws: (l) => (l >= 3 ? 2 : 1) }, { body: "falcon", elems: ["bleed", "expose"], icon: "icon_falcon" }),
  anklesnare: S("archer", "Ankle Snare", "pin", "zone", "Bẫy kẹp 3 giây: Ghim + Què.", { cd: L(7, 5), dmg: L(4, 9), radius: 20, life: 3, tick: 0.6 }, { at: "crowd", also: ["cripple"], icon: "icon_anklesnare" }),

  // ---------------- Thief: poison, tricks, gold ----------------
  envenom: S("thief", "Envenom", "venom", "bolt", "Dao tẩm độc: +3 lớp Nọc.", { cd: L(2, 1.3), dmg: L(16, 36), speed: 320, stacks: 3 }, { icon: "icon_envenom" }),
  backstab: S("thief", "Backstab", "expose", "melee", "Đâm lén một con sát tường: gấp đôi với con đang đánh tường.", { cd: L(3.2, 2.2), dmg: L(45, 100), reach: 42, width: 20, targets: 1, vsAttack: 2 }, { icon: "icon_backstab" }),
  sandattack: S("thief", "Sand Attack", "blind", "zone", "Hất cát vào mặt: Mù một vùng.", { cd: L(4, 2.8), dmg: L(8, 18), radius: 22 }, { at: "target", icon: "icon_sandattack" }),
  steal: S("thief", "Steal", "bounty", "bolt", "Móc túi: Truy nã + Tước vũ khí, quái chết rơi gấp đôi vàng.", { cd: L(3, 2), dmg: L(12, 28), speed: 320 }, { also: ["disarm"], icon: "icon_steal" }),
  hamstring: S("thief", "Hamstring", "cripple", "bolt", "Cắt gân: Què + Chảy máu.", { cd: L(2.6, 1.8), dmg: L(16, 36), speed: 320 }, { also: ["bleed"], icon: "icon_hamstring" }),
  flurry: S("thief", "Dagger Flurry", "bleed", "melee", "Ba nhát dao liên tiếp vào những con sát tường.", { cd: L(2, 1.4), dmg: L(10, 22), reach: 38, width: 30, targets: 3, repeat: 3 }, { icon: "icon_flurry" }),
  shadowclone: S("thief", "Shadow Clone", "blind", "clone", "Tạo bản sao khói của chính mình đứng ở cổng thành: lặp lại mọi đòn của bạn (đánh thường và skill) với một phần sát thương (30% → 80% ở cấp 8). Không có máu.", { cd: L(16, 12), max: 1, life: L(7, 10), pct: L(0.3, 0.8) }, { elems: ["blind"], icon: "icon_shadowclone" }),
  venomcloud: S("thief", "Venom Cloud", "venom", "zone", "Mây nọc 4 giây ở chỗ đông.", { cd: L(6, 4), dmg: L(3, 7), radius: L(22, 28), life: 4, tick: 0.5 }, { at: "crowd", icon: "icon_venomcloud" }),

  // ---------------- Acolyte: light, mending, a mace ----------------
  heal: S("acolyte", "Heal", "light", "heal", "Hồi máu cho tường.", { cd: L(7, 5), heal: L(8, 15) }, { icon: "icon_heal" }),
  blessing: S("acolyte", "Blessing", "light", "passive", "Bị động: +8% → +25% sát thương.", { cd: 0, dmg: L(1.08, 1.25) }, { passive: "mod", icon: "icon_blessing" }),
  angelus: S("acolyte", "Angelus", "sunder", "passive", "Bị động: tường nhận ít sát thương hơn (−7% → −14%).", { cd: 0, wallTaken: L(0.93, 0.86) }, { passive: "mod", icon: "icon_angelus" }),
  magnus: S("acolyte", "Magnus Exorcismus", "expose", "zone", "Thập tự thánh 3 giây ở chỗ đông: Đánh dấu.", { cd: L(8, 6), dmg: L(10, 15), radius: L(26, 32), life: 3, tick: 0.5 }, { at: "crowd", icon: "icon_magnus" }),
  macestrike: S("acolyte", "Mace Strike", "daze", "melee", "Đập chùy vào con sát tường: Choáng + Phá giáp.", { cd: L(1.8, 1.4), dmg: L(38, 54), reach: 34, width: 24, targets: 2 }, { also: ["sunder"], icon: "icon_macestrike" }),
  judgment: S("acolyte", "Judgment", "expose", "bolt", "Phán quyết: Đánh dấu + Ánh sáng.", { cd: L(2.6, 1.8), dmg: L(30, 48), speed: 380 }, { also: ["light"], icon: "icon_judgment" }),
  purify: S("acolyte", "Purify", "sunder", "zone", "Thanh tẩy con mạnh nhất: Phá giáp + Truy nã.", { cd: L(5, 3.5), dmg: L(24, 34), radius: 16 }, { at: "strongest", also: ["bounty"], icon: "icon_purify" }),
  aquabenedicta: S("acolyte", "Aqua Benedicta", "water", "zone", "Nước thánh: làm Ướt, để lại vũng nước.", { cd: L(4, 3), dmg: L(10, 22), radius: 16, puddle: 0.9 }, { at: "target", icon: "icon_aquabenedicta" }),

  // ---------------- Merchant: a cart, coins, hirelings ----------------
  mammonite: S("merchant", "Mammonite", "bounty", "bolt", "Ném túi vàng (tốn 4 vàng): sát thương rất lớn, Truy nã + Phá giáp.", { cd: L(2, 1.4), dmg: L(60, 140), speed: 300, gold: 4 }, { also: ["sunder"], icon: "icon_mammonite" }),
  cartrev: S("merchant", "Cart Revolution", "cripple", "melee", "Quay xe đẩy: trúng mọi con gần tường, hất lùi, Què.", { cd: L(4.5, 3), dmg: L(24, 54), reach: 40, width: 80, targets: 99, push: 14 }, { icon: "icon_cartrev" }),
  overcharge: S("merchant", "Overcharge", "bounty", "passive", "Bị động: vàng nhận được ×1,3 → ×1,8.", { cd: 0, gold: L(1.3, 1.8) }, { passive: "mod", icon: "icon_overcharge" }),
  cointoss: S("merchant", "Coin Toss", "daze", "bolt", "Tung 3 đồng xu vào đầu: Choáng + Đánh dấu.", { cd: L(1.6, 1.1), dmg: L(8, 18), speed: 280, count: 3 }, { also: ["expose"], icon: "icon_cointoss" }),
  vending: S("merchant", "Vending Turret", "sunder", "summon", "Dựng quầy bắn đồ vào quái: Phá giáp + Truy nã.", { cd: L(10, 7), max: (l) => (l >= 4 ? 2 : 1), hp: L(80, 160), dmg: L(12, 28), rate: 0.8, range: 130, life: 18 }, { body: "spirit", elems: ["sunder", "bounty"], icon: "icon_vending" }),
  loudex: S("merchant", "Loud Exclamation", "disarm", "passive", "Bị động: +6% → +20% sát thương.", { cd: 0, dmg: L(1.06, 1.2) }, { passive: "mod", icon: "icon_loudex" }),
  greed: S("merchant", "Greed", "bounty", "zone", "Hút của cải chỗ đông: Truy nã + Tước vũ khí, mỗi con trúng rơi 1 vàng.", { cd: L(6, 4), dmg: L(10, 22), radius: L(26, 32), coin: true }, { at: "crowd", also: ["disarm"], icon: "icon_greed" }),
};

// skills the other classes share with the Mage's book (they keep the Mage's numbers)
export const SHARED = { holylance: ["mage", "acolyte"], smite: ["mage", "acolyte"], angel: ["mage", "acolyte"], stonegolem: ["mage", "merchant"] };

// every class's basic attack with each weapon type it may hold (its own type's is the one above), and bare hands
for (const cls of Object.keys(STARTER)) {
  CLASS_SKILLS[`basic_${cls}`].wtype = STARTER[cls];
  const own = CLASS_SKILLS[`basic_${cls}`], ownBt = btbaOf(cls, STARTER[cls]);
  // a class that strikes from afar with its own weapon, given one for the wall, hits harder with it (it waits for them)
  const reach = (t) => (own.kind !== "melee" && t !== "fist" && t !== "bow" ? 1.7 : 1);
  const per = (t) => (l) => own.stats(l).dmg * WTYPE_DMG[t] * reach(t) * (btbaOf(cls, t) / ownBt);
  const cd = (t) => (l) => btbaOf(cls, t) * (1 - 0.45 * (l - 1) / 7);
  const MELEE = {
    fist:    { reach: 26, width: 22, targets: () => 1, desc: "Tay không: đấm con quái sát tường. Tháo vũ khí thì đánh thế này." },
    dagger:  { reach: 26, width: 22, targets: (l) => (l >= 4 ? 2 : 1), desc: "Dao găm: đâm nhanh. Cấp 4: 2 con." },
    sword:   { reach: 30, width: 26, targets: (l) => (l >= 4 ? 3 : 2), desc: "Kiếm: chém 2 con sát tường. Cấp 4: 3 con." },
    twohand: { reach: 34, width: 64, targets: (l) => (l >= 4 ? 4 : 3), desc: "Kiếm 2 tay: chém rộng 3 con, chậm. Cấp 4: 4 con." },
    spear:   { reach: 46, width: 18, targets: (l) => (l >= 4 ? 3 : 2), desc: "Giáo: đâm xa một hàng 2 con. Cấp 4: 3 con." },
    axe:     { reach: 30, width: 24, targets: (l) => (l >= 4 ? 2 : 1), desc: "Rìu: bổ mạnh, chậm. Cấp 4: 2 con." },
    mace:    { reach: 28, width: 24, targets: (l) => (l >= 4 ? 2 : 1), desc: "Chùy: nện choáng. Cấp 4: 2 con." },
  };
  for (const t of ["fist", ...wtypesOf(cls)]) {
    if (t === STARTER[cls]) continue;
    const id = basicIdOf(cls, t), W = WTYPES[t];
    let kind, stats, desc;
    if (MELEE[t]) { const m = MELEE[t]; kind = "melee"; desc = m.desc; stats = (l) => ({ cd: cd(t)(l), dmg: per(t)(l), reach: m.reach, width: m.width, targets: m.targets(l) }) }
    else if (t === "bow") { kind = "bolt"; desc = "Cung: bắn tên. Cấp 4: 2 mũi. Cấp 8: xuyên 3 con."; stats = (l) => ({ cd: cd(t)(l), dmg: per(t)(l), speed: 330, count: l >= 4 ? 2 : 1, pierce: l >= 8 ? 3 : 1 }) }
    else continue;   // staff and cart belong to their own classes
    CLASS_SKILLS[id] = { name: W.blow, elem: t === "fist" ? "daze" : W.mark, kind, cls: [cls], desc, icon: t === "fist" ? "icon_basic" : own.icon, stats, basic: true, max: 8, wtype: t };
  }
}
export const CLASSES = {
  mage:     { early: 1.6, mid: 1.85, power: 1.48, name: "Pháp sư",   look: "mage",     school: "arcane",  cost: 0,   blurb: "Phép 10 nguyên tố, mưa phép, triệu hồi và hợp thể. Ghép nguyên tố để ra phản ứng." },
  swordman: { early: 0.86, mid: 0.88, chaosPow: 0.8, power: 2.68, name: "Kiếm sĩ",   look: "swordman", school: "martial", cost: 0,   blurb: "Giữ cổng: chém những con sát tường, lao húc dọc hàng, giảm sát thương tường nhận." },
  archer:   { early: 2.8, mid: 1.3, power: 1.45, name: "Cung thủ",  look: "archer",   school: "martial", cost: 300, blurb: "Bắn xa từ trên tường: tên ghim, mưa tên, bẫy kẹp. Chảy máu và Đánh dấu." },
  thief:    { early: 2.42, mid: 1.25, chaosPow: 0.95, power: 2.6, name: "Đạo tặc",   look: "thief",    school: "martial", cost: 400, blurb: "Nọc độc, mù, đâm lén con đang đánh tường, móc túi rơi vàng." },
  acolyte:  { early: 1.28, mid: 0.62, chaosAt: 11, chaosCd: 1.5, chaosPow: 0.6, power: 3.2, name: "Tu sĩ",     look: "acolyte",  school: "both",    cost: 500, blurb: "Ánh sáng và chùy: hồi tường, ban phước, phán quyết. Lai cả nguyên tố lẫn võ thuật; CHAOS cần 12 dấu và hồi lâu hơn." },
  merchant: { early: 1.75, mid: 1.12, power: 2.15, name: "Thương nhân", look: "merchant", school: "martial", cost: 700, blurb: "Xe đẩy, đồng xu, thuê golem: tiêu vàng ra sát thương lớn, kiếm vàng từ Truy nã." },
};
export const CLASS_IDS = Object.keys(CLASSES);
/** The marks a class gathers toward awakening and CHAOS (Chaos Seed sows these). */
export const marksOf = (cls) => ({ arcane: ELEMENTS, martial: MARTIAL, both: MARKS })[CLASSES[cls]?.school ?? "arcane"];
