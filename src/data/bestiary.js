// Elemental monsters: the six bodies recoloured into one element each. Each shrugs off its own element (a
// quarter of the damage, and its status), falls hard to the one that beats it, and has a trait of its own.
// Chapters bring their own kinds (chapters.js `elemPool`).

export const ELEMENTAL = {
  fire:   { name: "Hỏa tinh",      base: "goblin",   weak: "ice",    immune: ["burn"],           trait: "Miễn đốt cháy. Chết thì để lại vệt lửa đốt quái khác." },
  ice:    { name: "Sói tuyết",     base: "wolf",     weak: "fire",   immune: ["freeze", "chill"], trait: "Không bị làm lạnh hay đóng băng." },
  volt:   { name: "Nhầy sấm",      base: "slime",    weak: "earth",  immune: ["stun"],           trait: "Không bị tê liệt. Đất nối đất làm nó yếu hẳn." },
  water:  { name: "Thủy nhầy",     base: "slime",    weak: "volt",   immune: ["mud"],            trait: "Luôn Ướt; bùn, hắc ín không làm chậm được." },
  earth:  { name: "Orc đá",        base: "orc",      weak: "water",  immune: ["push"],           trait: "Không bị đẩy lùi, hút hay thổi bay." },
  wind:   { name: "Sói gió",       base: "wolf",     weak: "earth",  immune: ["push", "root"],   trait: "Nhanh hơn 40%, không bị giữ chân hay đẩy." },
  poison: { name: "Xương dịch",    base: "skeleton", weak: "light",  immune: ["poison"],         trait: "Miễn độc. Chết thì để lại khí độc." },
  light:  { name: "Hiệp sĩ sáng",  base: "orc",      weak: "dark",   immune: ["fear"],           trait: "Hồi 2% máu/giây cho quái quanh nó." },
  dark:   { name: "Hồn ma",        base: "skeleton", weak: "light",  immune: ["fear", "curse"],  trait: "Cứ 4 giây lại dịch chuyển tới trước 14px." },
  arcane: { name: "Nhầy huyền bí", base: "slime",    weak: "dark",   immune: [],                 trait: "Aura trên nó chỉ giữ được một nửa thời gian." },
};
export const RESIST = 0.25, WEAK = 1.6;

// Twin kin: two elements at once (both resisted, both foes' weaknesses, both traits).
export const DUALS = {
  "fire+earth":   { name: "Hỏa thạch" },
  "volt+wind":    { name: "Phong lôi" },
  "ice+water":    { name: "Băng thủy" },
  "poison+dark":  { name: "Dịch quỷ" },
  "light+arcane": { name: "Thánh ấn" },
  "fire+volt":    { name: "Plasma" },
  "water+poison": { name: "Đầm lầy" },
  "dark+ice":     { name: "Băng ma" },
};
/** A kin key's elements: "fire" -> [fire], "fire+earth" -> [fire, earth]. */
export const kinElems = (key) => key.split("+");
/** What a kin key is weak to: its elements' foes, minus what it resists itself. */
export const kinWeak = (key) => { const els = kinElems(key); return [...new Set(els.map((e) => ELEMENTAL[e].weak))].filter((w) => !els.includes(w)) };
export const kinName = (key) => DUALS[key]?.name ?? ELEMENTAL[key]?.name ?? key;
