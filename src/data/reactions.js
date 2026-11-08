// Every reaction: the 45 pairs (two different auras meet), the tiers (3, 4, 5, 6 auras on one monster), the ten
// named triads, UNSTABLE (7-9) and CHAOS (10). Each is a small function over `api`, the primitives combat.js
// gives it: damage an area, spread an aura, freeze, push, pull, lay ground, heal the wall... The numbers scale
// with H, the hit that set it off, so reactions grow with the player.
//
// Labels are short English words (the pixel font has no Vietnamese accents); `vi` explains each in the Codex.

import { MARKS, schoolOf } from "./elements.js?v=mw800jqu";
import { MARTIAL_PAIRS, MARTIAL_TRIADS } from "./martial.js?v=mw800jqu";

const idx = (e) => MARKS.indexOf(e);
export const pairKey = (a, b) => (idx(a) < idx(b) ? `${a}+${b}` : `${b}+${a}`);

// ---------- the 45 pairs ----------
// [a, b, id, label, vi, fx(ctx)] ; ctx = { api: A, e, x, y, H, w } ; `mul` multiplies the hit itself
const P = [
  ["fire", "ice", "melt", "MELT", "Lửa gặp băng: x2 sát thương, phá băng", (c) => { c.e.status.freeze = 0; c.e.status.freezeImmune = 1; c.A.fx("burst", c.x, c.y, "ice") }, { mul: 2 }],
  ["fire", "volt", "overload", "OVERLOAD", "Nổ lửa 60% quanh đó, dập lửa, đẩy lùi", (c) => {
    const b = c.e.status.burn; b.stacks = 0; b.t = 0; b.dps = 0;
    for (const o of c.A.area(c.x, c.y, 16)) { c.A.dmg(o, c.H * 0.6, "fire"); c.A.push(o, 4) }
    c.A.fx("blast", c.x, c.y, "fire", 16);
  }],
  ["fire", "water", "steam", "STEAM", "Hơi nước bỏng: vùng hơi, quái đánh tường chậm 30%", (c) => {
    c.e.status.wet = 0; c.A.removeAura(c.e, "water");
    c.A.ground("steam", c.x, c.y, 14, 3);
    for (const o of c.A.area(c.x, c.y, 14)) c.A.dmg(o, c.H * 0.4, "steam");
  }],
  ["fire", "earth", "magma", "MAGMA", "Hồ dung nham dưới chân", (c) => c.A.ground("lava", c.x, c.y, 12, 4)],
  ["fire", "wind", "firestorm", "FIRESTORM", "Gió thổi lửa: đốt cháy mọi quái quanh đó", (c) => { for (const o of c.A.area(c.x, c.y, 24)) c.A.aura(o, "fire"); c.A.fx("blast", c.x, c.y, "fire", 24) }],
  ["fire", "poison", "toxicblast", "TOXIC BLAST", "Tiêu độc, nổ theo số lớp độc", (c) => {
    const n = c.e.status.poison.stacks; c.e.status.poison.stacks = 0;
    for (const o of c.A.area(c.x, c.y, 18)) c.A.dmg(o, c.H * (0.4 + 0.25 * n), "poison");
    c.A.fx("blast", c.x, c.y, "poison", 18);
  }],
  ["fire", "light", "solar", "SOLAR", "Mặt trời nhỏ: nổ 80%, hồi 2 máu tường", (c) => { for (const o of c.A.area(c.x, c.y, 18)) c.A.dmg(o, c.H * 0.8, "light"); c.A.heal(2); c.A.fx("blast", c.x, c.y, "light", 18) }],
  ["fire", "dark", "hellfire", "HELLFIRE", "Lửa đen: cháy x2 trong 5 giây", (c) => { c.A.burn(c.e, 4); c.e.status.burn.black = 5; c.A.fx("burst", c.x, c.y, "dark") }],
  ["fire", "arcane", "pyrosurge", "PYRO SURGE", "Mỗi lớp tích điện nổ thành vòng lửa", (c) => {
    const n = Math.max(1, c.e.status.charge); c.e.status.charge = 0;
    for (const o of c.A.area(c.x, c.y, 22)) c.A.dmg(o, c.H * 0.25 * n, "fire");
    c.A.fx("ring", c.x, c.y, "fire", 22);
  }],
  ["ice", "volt", "superconduct", "SUPERCONDUCT", "Siêu dẫn: nhận thêm 40% sát thương trong 4 giây", (c) => { c.e.status.brittle = 4; c.A.fx("burst", c.x, c.y, "volt") }],
  ["ice", "water", "freeze", "FREEZE", "Băng gặp nước: đóng băng ngay", (c) => { c.A.freeze(c.e, 1.2); c.e.status.wet = 0 }],
  ["ice", "earth", "shatter", "SHATTER", "Vỡ vụn: +50% sát thương, mảnh băng bắn quanh", (c) => { for (const o of c.A.area(c.x, c.y, 14)) c.A.dmg(o, c.H * 0.5, "ice"); c.A.fx("shards", c.x, c.y, "ice", 14) }, { mul: 1.5 }],
  ["ice", "wind", "blizzard", "BLIZZARD", "Bão tuyết: làm lạnh mọi quái quanh đó", (c) => { for (const o of c.A.area(c.x, c.y, 28)) c.A.chill(o); c.A.fx("ring", c.x, c.y, "ice", 28) }],
  ["ice", "poison", "frostbite", "FROSTBITE", "Độc tick x2 khi đang lạnh", (c) => { c.e.status.poison.frost = 5; c.A.chill(c.e) }],
  ["ice", "light", "prism", "PRISM", "Khúc xạ trúng thêm 3 con, mỗi con 50%", (c) => { for (const o of c.A.nearest(c.x, c.y, 3, c.e)) { c.A.dmg(o, c.H * 0.5, "light"); c.A.beam(c.x, c.y, o, "light") } }],
  ["ice", "dark", "deepfreeze", "DEEP FREEZE", "Đóng băng x2 thời gian, xuyên miễn nhiễm", (c) => c.A.freeze(c.e, 2.4, true)],
  ["ice", "arcane", "crystal", "CRYSTAL", "Bọc pha lê rồi vỡ, gây 100% quanh đó", (c) => {
    c.A.freeze(c.e, 1.5, true);
    c.A.later(1.5, () => { for (const o of c.A.area(c.e.x, c.e.y, 16)) c.A.dmg(o, c.H, "ice"); c.A.fx("shards", c.e.x, c.e.y, "arcane", 16) });
  }],
  ["volt", "water", "shock", "SHOCK", "Sét lan qua vũng nước và mọi quái Ướt quanh đó", (c) => c.A.shock(c.e, c.H)],
  ["volt", "earth", "magnetize", "MAGNETIZE", "Từ hóa: hút quái quanh đó về một điểm", (c) => { c.A.pull(c.x, c.y, 30, 12); c.A.fx("ring", c.x, c.y, "volt", 30) }],
  ["volt", "wind", "stormarc", "STORM ARC", "Sét nảy thêm 4 lần", (c) => c.A.chain(c.e, 4, 60, c.H * 0.6, "volt")],
  ["volt", "poison", "neurotox", "NEUROTOX", "Tê liệt và +2 lớp độc", (c) => { c.A.stun(c.e, 0.6); c.A.poison(c.e, 2) }],
  ["volt", "light", "judgment", "JUDGMENT", "Sét trời giáng 120%", (c) => { for (const o of c.A.area(c.x, c.y, 14)) c.A.dmg(o, c.H * 1.2, "light"); c.A.fx("skybolt", c.x, c.y, "light") }],
  ["volt", "dark", "blackout", "BLACKOUT", "Tê liệt x2, nguyền lan theo chuỗi", (c) => { c.A.stun(c.e, 1.2); for (const o of c.A.nearest(c.x, c.y, 3, c.e)) { c.A.aura(o, "dark"); c.A.beam(c.x, c.y, o, "dark") } }],
  ["volt", "arcane", "arcflux", "ARC FLUX", "Tích điện cho mọi quái quanh đó", (c) => { for (const o of c.A.area(c.x, c.y, 24)) c.A.aura(o, "arcane"); c.A.fx("ring", c.x, c.y, "arcane", 24) }],
  ["water", "earth", "mud", "MUD", "Vùng bùn làm chậm 50%", (c) => c.A.ground("mud", c.x, c.y, 14, 4)],
  ["water", "wind", "typhoon", "TYPHOON", "Bão nước đẩy lùi và làm Ướt", (c) => { for (const o of c.A.area(c.x, c.y, 30)) { c.A.push(o, 20); c.A.aura(o, "water") } c.A.fx("ring", c.x, c.y, "water", 30) }],
  ["water", "poison", "contaminate", "CONTAMINATE", "Lan độc sang mọi quái Ướt", (c) => { for (const o of c.A.area(c.x, c.y, 40)) if (o.auras.has("water")) c.A.poison(o, 2) }],
  ["water", "light", "rainbow", "RAINBOW", "Cầu vồng: hồi 3 máu tường, quái Ướt bị phán xét", (c) => { c.A.heal(3); for (const o of c.A.area(c.x, c.y, 40)) if (o.auras.has("water")) o.status.judged = true; c.A.fx("ring", c.x, c.y, "light", 40) }],
  ["water", "dark", "drown", "DROWN", "Chết đuối: chậm 60% trong 3 giây", (c) => c.A.mud(c.e, 0.4, 3)],
  ["water", "arcane", "flow", "FLOW", "Dòng chảy: mọi skill giảm 0,5 giây hồi chiêu", (c) => c.A.cdr(0.5)],
  ["earth", "wind", "sandstorm", "SANDSTORM", "Bão cát: quái bên trong đánh tường chậm 50%", (c) => c.A.ground("sand", c.x, c.y, 16, 4)],
  ["earth", "poison", "tar", "TAR", "Hắc ín độc làm chậm", (c) => c.A.ground("tar", c.x, c.y, 14, 4)],
  ["earth", "light", "hallowed", "HALLOWED", "Đất thánh: gây sát thương, hồi tường", (c) => c.A.ground("hallowed", c.x, c.y, 16, 4)],
  ["earth", "dark", "grave", "GRAVE", "Tay xương giữ chân", (c) => { c.A.root(c.e, 1.5); for (const o of c.A.area(c.x, c.y, 16, c.e)) c.A.root(o, 0.8) }],
  ["earth", "arcane", "runestone", "RUNESTONE", "Trụ đá rune tự bắn trong 4 giây", (c) => c.A.ground("runestone", c.x, c.y, 6, 4)],
  ["wind", "poison", "miasma", "MIASMA", "Khí độc lan rộng", (c) => c.A.ground("miasma", c.x, c.y, 22, 3)],
  ["wind", "light", "radiantgale", "RADIANT GALE", "3 đốm sáng tự tìm mục tiêu, phán xét", (c) => { for (const o of c.A.nearest(c.x, c.y, 3, c.e)) { c.A.dmg(o, c.H * 0.6, "light"); o.status.judged = true; c.A.beam(c.x, c.y, o, "light") } }],
  ["wind", "dark", "phantom", "PHANTOM", "Bóng ma: quái quanh đó sợ hãi, đi lùi", (c) => { for (const o of c.A.area(c.x, c.y, 24)) c.A.fear(o, 1.2); c.A.fx("ring", c.x, c.y, "dark", 24) }],
  ["wind", "arcane", "vortex", "VORTEX", "Giếng trọng lực nhỏ hút về một điểm", (c) => c.A.well(c.x, c.y, 36, 30, 1.5)],
  ["poison", "light", "purge", "PURGE", "Thanh tẩy: nổ hết độc ngay, hồi tường", (c) => {
    const p = c.e.status.poison, n = p.stacks;
    c.A.dmg(c.e, Math.max(c.H * 0.5, n * p.dps * p.t * 0.75), "light"); c.A.heal(n); p.stacks = 0;
    c.A.fx("burst", c.x, c.y, "light");
  }],
  ["poison", "dark", "plague", "PLAGUE", "Dịch bệnh lan 3 con, chết thì nổ", (c) => { c.e.plague = true; for (const o of c.A.nearest(c.x, c.y, 3, c.e)) { c.A.poison(o, 2); c.A.aura(o, "dark"); o.plague = true } }],
  ["poison", "arcane", "catalyst", "CATALYST", "Xúc tác: độc tối đa 10 lớp, tick nhanh x2", (c) => { const p = c.e.status.poison; p.max = 10; p.fast = 5; c.A.poison(c.e, 2) }],
  ["light", "dark", "eclipse", "ECLIPSE", "Nhật thực: nổ 200% và chớp màn hình", (c) => {
    if (!c.A.cooldown("eclipse", 3)) return;
    for (const o of c.A.area(c.x, c.y, 20)) c.A.dmg(o, c.H * 2, "dark");
    c.A.fx("eclipse", c.x, c.y, "dark", 20);
  }],
  ["light", "arcane", "starfall", "STARFALL", "3 ngôi sao rơi quanh đó", (c) => {
    for (let i = 0; i < 3; i++) {
      const sx = c.x + c.A.rand(-16, 16), sy = c.y + c.A.rand(-8, 8);
      c.A.later(0.25 + i * 0.15, () => { for (const o of c.A.area(sx, sy, 10)) c.A.dmg(o, c.H * 0.5, "light"); c.A.fx("star", sx, sy, "light") });
    }
  }],
  ["dark", "arcane", "void", "VOID", "Khe hư không: sát thương và hút nhẹ", (c) => c.A.ground("void", c.x, c.y, 16, 3)],
];

export const PAIRS = {};
for (const [a, b, id, label, vi, fx, opt] of [...P, ...MARTIAL_PAIRS]) PAIRS[pairKey(a, b)] = { id, label, vi, fx, elems: [a, b], mul: opt?.mul ?? 1, school: schoolOf(a) };

// ---------- the tiers: 3, 4, 5, 6 auras on one monster ----------
const spreadAuras = (c, n, r) => {
  const pool = [...c.e.auras.keys()];
  for (const o of c.A.area(c.x, c.y, r, c.e)) for (let i = 0; i < n; i++) c.A.aura(o, pool[(i + o.id) % pool.length]);
};
export const TIERS = {
  3: { id: "triad", label: "TRIAD", vi: "3 dấu: nổ nhẹ 50% và lan 1 dấu", cd: 0.8, fx: (c) => { for (const o of c.A.area(c.x, c.y, 18)) c.A.dmg(o, c.H * 1.5, "tier"); spreadAuras(c, 1, 18); c.A.fx("tier3", c.x, c.y, "tier", 18) } },
  4: { id: "quadra", label: "QUADRA", vi: "4 dấu: nổ 200%, tê liệt, lan 2 dấu", cd: 2, fx: (c) => { for (const o of c.A.area(c.x, c.y, 24)) { c.A.dmg(o, c.H * 2.5, "tier"); c.A.stun(o, 0.5) } spreadAuras(c, 2, 24); c.A.fx("tier4", c.x, c.y, "tier", 24) } },
  5: { id: "penta", label: "PENTA", vi: "5 dấu: ngũ giác rune hút rồi nổ 560%, lan 3 dấu", cd: 4, fx: (c) => {
    c.A.well(c.x, c.y, 34, 16, 1.5); c.A.fx("tier5", c.x, c.y, "tier", 30);
    c.A.later(1.5, () => { for (const o of c.A.area(c.x, c.y, 30)) c.A.dmg(o, c.H * 4, "tier"); spreadAuras(c, 3, 30); c.A.fx("blast", c.x, c.y, "arcane", 30) });
  } },
  6: { id: "hexa", label: "HEXA", vi: "6 dấu: lục giác sao, 6 tia 400% quét sân", cd: 6, fx: (c) => {
    const elems = [...c.e.auras.keys()].slice(-6);
    elems.forEach((el, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3, dx = Math.cos(a), dy = Math.sin(a) * 0.5;
      c.A.ray(c.x, c.y - 6, dx, dy, 160, 6, (o) => { c.A.dmg(o, c.H * 6 / 3, "tier"); c.A.aura(o, el) }, el);
    });
    c.A.fx("tier6", c.x, c.y, "tier", 30);
  } },
};

// ---------- the ten named triads (they replace TRIAD when three auras match) ----------
const T = [
  [["fire", "ice", "volt"], "trinity", "TRINITY", "Lửa + Băng + Sét: 3 tia bắn 3 con mạnh nhất", (c) => {
    c.A.strongest(3, c.e).forEach((o, i) => { const el = ["fire", "ice", "volt"][i]; c.A.dmg(o, c.H * 3, el); c.A.aura(o, el); c.A.beam(c.x, c.y, o, el) });
  }],
  [["water", "earth", "wind"], "natureswrath", "NATURE'S WRATH", "Nước + Đất + Gió: dây leo giữ chân mọi quái quanh đó", (c) => { for (const o of c.A.area(c.x, c.y, 30)) c.A.root(o, 2); c.A.fx("ring", c.x, c.y, "wind", 30) }],
  [["light", "dark", "arcane"], "twilight", "TWILIGHT", "Sáng + Tối + Huyền bí: khe sáng-tối 300%, hồi 5 tường", (c) => { for (const o of c.A.area(c.x, c.y, 20)) c.A.dmg(o, c.H * 3, "arcane"); c.A.heal(5); c.A.fx("eclipse", c.x, c.y, "arcane", 20) }],
  [["fire", "poison", "dark"], "infernoplague", "INFERNO PLAGUE", "Lửa + Độc + Tối: lửa đen và độc lan 5 con", (c) => { for (const o of c.A.nearest(c.x, c.y, 5, c.e)) { c.A.burn(o, 4); o.status.burn.black = 5; c.A.poison(o, 2); c.A.beam(c.x, c.y, o, "poison") } }],
  [["ice", "water", "wind"], "absolutezero", "ABSOLUTE ZERO", "Băng + Nước + Gió: đóng băng mọi quái quanh đó", (c) => { for (const o of c.A.area(c.x, c.y, 30)) c.A.freeze(o, 1.5); c.A.fx("ring", c.x, c.y, "ice", 30) }],
  [["volt", "water", "light"], "holystorm", "HOLY STORM", "Sét + Nước + Sáng: 5 tia sét phán xét", (c) => {
    for (let i = 0; i < 5; i++) {
      const sx = c.x + c.A.rand(-30, 30), sy = c.y + c.A.rand(-14, 14);
      c.A.later(0.12 * i, () => { for (const o of c.A.area(sx, sy, 10)) { c.A.dmg(o, c.H * 1.2, "volt"); c.A.stun(o, 0.4) } c.A.fx("skybolt", sx, sy, "light") });
    }
  }],
  [["earth", "fire", "volt"], "eruption", "ERUPTION", "Đất + Lửa + Sét: núi lửa nhỏ, đá văng", (c) => { c.A.ground("lava", c.x, c.y, 16, 4); for (const o of c.A.area(c.x, c.y, 22)) { c.A.dmg(o, c.H * 2, "earth"); c.A.push(o, 8) } c.A.fx("blast", c.x, c.y, "fire", 22) }],
  [["poison", "water", "earth"], "swamp", "SWAMP", "Độc + Nước + Đất: đầm lầy lớn", (c) => c.A.ground("swamp", c.x, c.y, 26, 5)],
  [["wind", "volt", "arcane"], "tempest", "TEMPEST", "Gió + Sét + Huyền bí: xoáy hút kèm tia sét", (c) => { c.A.well(c.x, c.y, 40, 30, 1.5); c.A.chain(c.e, 5, 70, c.H, "volt") }],
  [["dark", "ice", "poison"], "necrosis", "NECROSIS", "Tối + Băng + Độc: nguyền và độc x3, chết thì nổ", (c) => { for (const o of c.A.area(c.x, c.y, 20)) { c.A.aura(o, "dark"); c.A.poison(o, 3); o.plague = true } }],
];
const triKey = (els) => [...els].sort((a, b) => idx(a) - idx(b)).join("+");
export const TRIADS = {};
for (const [els, id, label, vi, fx] of [...T, ...MARTIAL_TRIADS]) TRIADS[triKey(els)] = { id, label, vi, fx, elems: els, school: schoolOf(els[0]) };
export const triadOf = (auras) => (auras.length === 3 ? TRIADS[triKey(auras)] : null);

export const UNSTABLE = { id: "unstable", label: "UNSTABLE", vi: "7-9 nguyên tố: không ổn định, +10% sát thương nhận mỗi aura" };
export const CHAOS = { id: "chaos", label: "CHAOS", vi: "Đủ 10 nguyên tố: Hố Đen vũ trụ hút mọi thứ rồi nổ" };

/** Every entry of the Codex, in order: 45 pairs, 4 tiers, 10 triads, unstable, chaos (61). */
// the percentages in the descriptions follow the combo factors (a named three: as a TRIAD; a pair: as pairs)
const scaleVi = (vi, k) => vi.replace(/(\d+)%/g, (_, n) => `${Math.round((+n * k) / 5) * 5}%`);
for (const t of Object.values(TRIADS)) t.vi = scaleVi(t.vi, 0.35);
for (const p of Object.values(PAIRS)) p.vi = scaleVi(p.vi, 0.45);

export const CODEX = [
  ...Object.values(PAIRS).map((p) => ({ id: p.id, label: p.label, vi: p.vi, kind: "pair", elems: p.elems, school: p.school })),
  ...Object.entries(TIERS).map(([n, t]) => ({ id: t.id, label: t.label, vi: t.vi, kind: "tier", n: +n })),
  ...Object.values(TRIADS).map((t) => ({ id: t.id, label: t.label, vi: t.vi, kind: "triad", elems: t.elems, school: t.school })),
  { ...UNSTABLE, kind: "unstable" }, { ...CHAOS, kind: "chaos" },
];
export const REACTION_BY_ID = Object.fromEntries(CODEX.map((r) => [r.id, r]));
