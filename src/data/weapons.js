// Weapons: their types (after Ragnarok's: which classes may hold them, one hand or two, how fast they swing),
// each type its own basic attack. Bare hands punch, in every class. Every class starts holding its own type.

export const WTYPE_IDS = ["fist", "dagger", "sword", "twohand", "spear", "axe", "mace", "staff", "bow", "cart"];
const ALL = ["mage", "swordman", "archer", "thief", "acolyte", "merchant"];
//   cls: who may hold it; two: two-handed; btba: base seconds between blows (by class, then the default);
//   stat: what drives it; mark: what it leaves; name: the basic attack's name with it
export const WTYPES = {
  fist:    { name: "Tay không", blow: "Đấm",        cls: ALL, two: false, btba: { thief: 0.4, default: 0.45 }, stat: "str", mark: "daze" },
  dagger:  { name: "Dao găm",   blow: "Đâm dao",    cls: ["mage", "swordman", "archer", "thief", "merchant"], two: false, btba: { thief: 0.5, default: 0.65 }, stat: "str", mark: "bleed" },
  sword:   { name: "Kiếm",      blow: "Chém",       cls: ["swordman", "thief", "merchant"], two: false, btba: { default: 0.7 }, stat: "str", mark: "sunder" },
  twohand: { name: "Kiếm 2 tay", blow: "Chém 2 tay", cls: ["swordman"], two: true, btba: { default: 0.85 }, stat: "str", mark: "sunder" },
  spear:   { name: "Giáo",      blow: "Đâm giáo",   cls: ["swordman"], two: true, btba: { default: 0.8 }, stat: "str", mark: "pin" },
  axe:     { name: "Rìu",       blow: "Bổ rìu",     cls: ["swordman", "merchant"], two: true, btba: { default: 0.8 }, stat: "str", mark: "bleed" },
  mace:    { name: "Chùy",      blow: "Nện chùy",   cls: ["swordman", "acolyte", "merchant"], two: false, btba: { default: 0.7 }, stat: "str", mark: "daze" },
  staff:   { name: "Gậy phép",  blow: "Phép",       cls: ["mage", "acolyte"], two: true, btba: { default: 0.75 }, stat: "int", mark: "arcane" },
  bow:     { name: "Cung",      blow: "Bắn tên",    cls: ["archer", "thief"], two: true, btba: { thief: 1.0, default: 0.85 }, stat: "dex", mark: "bleed" },
  cart:    { name: "Xe đẩy",    blow: "Cart Hit",   cls: ["merchant"], two: true, btba: { default: 0.8 }, stat: "str", mark: "daze" },
};
/** The type each class starts with (its basic attack as it always was). */
export const STARTER = { mage: "staff", swordman: "sword", archer: "bow", thief: "dagger", acolyte: "staff", merchant: "cart" };
export const STARTER_NAME = { mage: "Gậy gỗ", swordman: "Kiếm sắt", archer: "Cung gỗ", thief: "Dao găm", acolyte: "Gậy thánh", merchant: "Xe gỗ" };
export const wtypesOf = (cls) => WTYPE_IDS.filter((t) => t !== "fist" && WTYPES[t].cls.includes(cls));
export const btbaOf = (cls, wtype) => { const b = WTYPES[wtype ?? "fist"]?.btba ?? WTYPES.fist.btba; return b[cls] ?? b.default };
/** The basic attack a class makes with a weapon type (bare hands: a punch). */
export const basicIdOf = (cls, wtype) => (!wtype || wtype === "fist" ? `basic_${cls}_fist` : wtype === STARTER[cls] ? `basic_${cls}` : `basic_${cls}_${wtype}`);
/** The weapon's kinds: [name, material] for each type. */
export const WEAPON_KINDS = {
  dagger:  [["Dao găm sắt", "iron"], ["Dao bóng tối", "shadow"], ["Dao xương", "bone"], ["Dao pha lê", "crystal"]],
  sword:   [["Kiếm sắt", "iron"], ["Kiếm vàng", "gold"], ["Kiếm lửa", "ember"], ["Kiếm pha lê", "crystal"]],
  twohand: [["Đại kiếm sắt", "iron"], ["Đại kiếm hỏa", "ember"], ["Đại kiếm bóng tối", "shadow"]],
  spear:   [["Giáo sắt", "iron"], ["Giáo xương", "bone"], ["Giáo vàng", "gold"]],
  axe:     [["Rìu sắt", "iron"], ["Rìu xương", "bone"], ["Rìu lửa", "ember"]],
  mace:    [["Chùy gỗ", "leather"], ["Chùy bạc", "iron"], ["Chùy vàng", "gold"], ["Chùy thánh", "crystal"]],
  staff:   [["Gậy gỗ", "leather"], ["Gậy pha lê", "crystal"], ["Gậy hỏa", "ember"], ["Gậy bóng tối", "shadow"]],
  bow:     [["Cung gỗ", "leather"], ["Cung lá", "nature"], ["Cung xương", "bone"], ["Cung vàng", "gold"]],
  cart:    [["Xe gỗ", "leather"], ["Xe sắt", "iron"], ["Xe vàng", "gold"], ["Xe rồng", "ember"]],
};
// how hard each type hits: per-blow, against the class's own starter (the same damage per second for the
// one-target types; the wide ones a little less a blow; bare hands well under)
export const WTYPE_DMG = { fist: 0.55, dagger: 1.2, sword: 1.15, twohand: 1.0, spear: 0.9, axe: 1.25, mace: 1.3, staff: 1, bow: 1.3, cart: 1 };
