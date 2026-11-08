// Passives: five per class, learned in the hall with crystals, each up to level 10. The first is the class's
// own and every hero has it at level 1 from the start. Each changes the run's numbers (profileMods) a little a
// level: level 10 is a real edge, level 1 a taste.
//   v(l): the value at level l (shown in the hall); mod(m, l): what it does to the run's mods.

const lin = (a, b) => (l) => a + b * (l - 1);   // a at level 1, + b each level after
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const P = (id, name, base, v, text, mod, sig = false) => ({ id, name, base, v, text, mod, sig, max: 10 });

export const PASSIVES = {
  mage: [
    P("arcanist", "Pháp lực nguyên tố", 30, lin(0.04, 0.015), (x) => `+${pct(x)} sát thương mọi nguyên tố`, (m, x) => { for (const e of ["fire", "ice", "volt", "water", "earth", "wind", "poison", "light", "dark", "arcane"]) m.elem[e] = (m.elem[e] ?? 1) * (1 + x) }, true),
    P("channel", "Niệm chú nhanh", 45, lin(0.012, 0.012), (x) => `−${pct(x)} hồi chiêu`, (m, x) => (m.cd *= 1 - x)),
    P("resonance", "Cộng hưởng sâu", 45, lin(0.03, 0.03), (x) => `+${pct(x)} sát thương phản ứng và tầng`, (m, x) => { m.reactDmg *= 1 + x; m.tierDmg *= 1 + x }),
    P("manaward", "Lá chắn ma lực", 50, lin(0.012, 0.012), (x) => `Tường nhận −${pct(x)} sát thương`, (m, x) => (m.wallTaken *= 1 - x)),
    P("conjurer", "Triệu hồi sư", 50, lin(0.04, 0.04), (x) => `Triệu hồi +${pct(x)} máu và sát thương`, (m, x) => { m.summonHp *= 1 + x; m.summonDmg *= 1 + x }),
  ],
  swordman: [
    P("bulwark", "Thành lũy", 30, lin(0.2, 0.04), (x) => `Tường hồi ${x.toFixed(2)} máu/giây, +${pct(0.04 + (x - 0.2) * 0.25)} máu tường tối đa`, (m, x) => { m.regen += x; m.wallMaxPct += 0.04 + (x - 0.2) * 0.25 }, true),
    P("riposte", "Phản đòn", 40, lin(3, 3), (x) => `Quái đánh tường nhận ${x} sát thương`, (m, x) => (m.thorns += x)),
    P("edge", "Lưỡi bén", 45, lin(0.03, 0.03), (x) => `+${pct(x)} sát thương cận chiến`, (m, x) => (m.meleeDmg *= 1 + x)),
    P("ironwill", "Ý chí sắt", 50, lin(0.012, 0.012), (x) => `Tường nhận −${pct(x)} sát thương`, (m, x) => (m.wallTaken *= 1 - x)),
    P("challenger", "Khiêu chiến", 45, lin(0.03, 0.025), (x) => `+${pct(x)} sát thương lên quái đang đánh tường`, (m, x) => (m.vsAttack += x)),
  ],
  archer: [
    P("hawkeye", "Mắt ưng", 30, lin(0.1, 0.02), (x) => `Quái càng xa càng đau: tới +${pct(x)} ở mép sân`, (m, x) => (m.farDmg += x), true),
    P("quickdraw", "Rút tên nhanh", 45, lin(0.015, 0.012), (x) => `−${pct(x)} hồi chiêu skill bắn`, (m, x) => (m.boltCd *= 1 - x)),
    P("precision", "Chuẩn xác", 45, lin(0.015, 0.012), (x) => `+${pct(x)} tỉ lệ chí mạng`, (m, x) => (m.crit += x)),
    P("biggame", "Săn mồi lớn", 45, lin(0.04, 0.03), (x) => `+${pct(x)} sát thương lên tinh anh và boss`, (m, x) => (m.vsBig += x)),
    P("trapper", "Bẫy thủ", 40, lin(0.05, 0.04), (x) => `Bẫy và vùng kéo dài thêm ${pct(x)}`, (m, x) => (m.zoneLife *= 1 + x)),
  ],
  thief: [
    P("phantom", "Bóng ma", 30, lin(0.04, 0.006), (x) => `${pct(x)} né đòn đánh tường, ${pct(x)} đánh 2 lần`, (m, x) => { m.dodge += x; m.doubleHit += x }, true),
    P("toxin", "Độc dược", 40, lin(0.04, 0.035), (x) => `+${pct(x)} sát thương chảy máu/nọc/độc`, (m, x) => (m.dotDmg *= 1 + x)),
    P("backstab", "Đâm sau lưng", 45, lin(0.06, 0.05), (x) => `Chí mạng gây thêm ${pct(x)} sát thương`, (m, x) => (m.critMul += x)),
    P("fingers", "Bàn tay nhanh", 35, lin(0.05, 0.04), (x) => `+${pct(x)} vàng`, (m, x) => (m.gold *= 1 + x)),
    P("nimble", "Nhanh nhẹn", 45, lin(0.01, 0.01), (x) => `−${pct(x)} hồi chiêu`, (m, x) => (m.cd *= 1 - x)),
  ],
  acolyte: [
    P("exorcist", "Trừ tà", 30, lin(0.2, 0.03), (x) => `+${pct(x)} sát thương lên quái Bóng tối và xương`, (m, x) => (m.vsUnholy += x), true),
    P("grace", "Ân phúc", 40, lin(0.05, 0.045), (x) => `Hồi tường nhiều hơn ${pct(x)}`, (m, x) => (m.healMul *= 1 + x)),
    P("sanctuary", "Thánh địa", 50, lin(0.012, 0.012), (x) => `Tường nhận −${pct(x)} sát thương`, (m, x) => (m.wallTaken *= 1 - x)),
    P("radiance", "Hào quang", 45, lin(0.03, 0.03), (x) => `+${pct(x)} sát thương Ánh sáng`, (m, x) => (m.elem.light = (m.elem.light ?? 1) * (1 + x))),
    P("guardian", "Thiên thần hộ mệnh", 50, lin(0.04, 0.04), (x) => `Triệu hồi +${pct(x)} máu và sát thương`, (m, x) => { m.summonHp *= 1 + x; m.summonDmg *= 1 + x }),
  ],
  merchant: [
    P("greed", "Lòng tham", 30, lin(1, 0.25), (x) => `Mỗi quái hạ được thêm ${x.toFixed(2)} vàng, +${pct((x - 1) * 0.04 + 0.02)} tinh thể`, (m, x) => { m.killGold += x; m.crystalMul = (m.crystalMul ?? 1) * (1.02 + (x - 1) * 0.04) }, true),
    P("heavycart", "Xe nặng", 40, lin(0.03, 0.03), (x) => `+${pct(x)} sát thương cận chiến, đẩy lùi mạnh hơn`, (m, x) => { m.meleeDmg *= 1 + x; m.push *= 1 + x }),
    P("haggle", "Mặc cả", 45, lin(0.04, 0.035), (x) => `Skill tốn vàng rẻ hơn ${pct(x)}`, (m, x) => (m.goldCost *= 1 - x)),
    P("investor", "Đầu tư", 45, lin(0.025, 0.025), (x) => `+${pct(x)} sát thương mọi đòn`, (m, x) => (m.dmg *= 1 + x)),
    P("hirelings", "Lính đánh thuê", 50, lin(0.04, 0.04), (x) => `Triệu hồi +${pct(x)} máu và sát thương`, (m, x) => { m.summonHp *= 1 + x; m.summonDmg *= 1 + x }),
  ],
};
export const SIG_PASSIVE = Object.fromEntries(Object.entries(PASSIVES).map(([c, l]) => [c, l.find((p) => p.sig).id]));
export const passiveCost = (p, level) => Math.round(p.base * Math.pow(1.45, level));
/** Apply a class's passives (levels { id: level }) to the run's mods. */
export function applyPassives(m, cls, levels) {
  for (const p of PASSIVES[cls] ?? []) { const l = Math.min(p.max, levels?.[p.id] ?? 0); if (l > 0) p.mod(m, p.v(l)) }
}
