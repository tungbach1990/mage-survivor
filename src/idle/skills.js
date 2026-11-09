// Every class's skills, learned with skill points (1 a level from level 2), each up to level 10, opened by the
// hero's level (and a skill before it). Six kinds:
//   hit    one target, pct% of the attack (times `hits`)
//   area   every monster in the group, pct% each
//   buff   the hero's own numbers for `dur` seconds (atk, aspd, def, crit as fractions)
//   heal   back `pct`% of the hero's health
//   debuff the target's defence cut (def) for dur seconds, with a hit
// The numbers at level 1 and 10 (a straight line between); sp: cost; cd: seconds; cast: base cast seconds
// (casting goes with DEX; martial blows have none). fx: the look (the old skills' effects), elem: its element.

const S = (id, name, kind, elem, lv, req, n, extra = {}) => ({ id, name, kind, elem, lv, req, ...n, ...extra });
const at = (a, b) => (l) => a + ((b - a) * (l - 1)) / 9;

export const SKILL_TREE = {
  mage: [
    S("firebolt", "Fire Bolt", "hit", "fire", 1, null, { pct: at(130, 300), hits: at(1, 3), sp: at(6, 16), cd: at(2.6, 1.8), cast: 0.6 }),
    S("icebolt", "Cold Bolt", "hit", "ice", 1, null, { pct: at(130, 300), hits: at(1, 3), sp: at(6, 16), cd: at(2.6, 1.8), cast: 0.6 }),
    S("lightbolt", "Lightning Bolt", "hit", "volt", 1, null, { pct: at(130, 300), hits: at(1, 3), sp: at(6, 16), cd: at(2.6, 1.8), cast: 0.6 }),
    S("missiles", "Soul Strike", "hit", "arcane", 10, "firebolt", { pct: at(200, 460), hits: at(2, 5), sp: at(10, 24), cd: at(3, 2.2), cast: 0.4 }),
    S("fireball", "Fireball", "area", "fire", 20, "firebolt", { pct: at(140, 320), sp: at(12, 28), cd: at(4, 3), cast: 1.0 }),
    S("nova", "Frost Nova", "area", "ice", 20, "icebolt", { pct: at(120, 300), sp: at(14, 30), cd: at(5, 3.5), cast: 0.8 }),
    S("thunderrain", "Thunderstorm", "area", "volt", 35, "lightbolt", { pct: at(220, 520), sp: at(24, 50), cd: at(7, 5), cast: 1.8 }),
    S("shadoworb", "Napalm Beat", "area", "dark", 50, "missiles", { pct: at(300, 700), sp: at(30, 60), cd: at(8, 6), cast: 1.2 }),
  ],
  swordman: [
    S("bash", "Bash", "hit", "neutral", 1, null, { pct: at(160, 400), hits: () => 1, sp: at(6, 15), cd: at(2, 1.4) }),
    S("endure", "Endure", "buff", "neutral", 1, null, { def: at(0.1, 0.3), dur: at(20, 40), sp: at(10, 20), cd: at(40, 30) }),
    S("magnum", "Magnum Break", "area", "fire", 10, "bash", { pct: at(130, 300), sp: at(12, 26), cd: at(4, 3) }),
    S("provoke", "Provoke", "debuff", "neutral", 10, null, { pct: at(100, 160), def: at(0.1, 0.35), dur: 12, sp: at(6, 14), cd: at(12, 8) }),
    S("bowling", "Bowling Bash", "area", "neutral", 20, "magnum", { pct: at(200, 450), sp: at(16, 34), cd: at(5, 3.5) }),
    S("whirlwind", "Whirlwind", "area", "wind", 35, "bowling", { pct: at(160, 380), sp: at(20, 40), cd: at(6, 4) }),
    S("swordwave", "Sword Wave", "area", "neutral", 50, "whirlwind", { pct: at(320, 720), sp: at(30, 60), cd: at(8, 6) }),
    S("shieldcharge", "Shield Charge", "hit", "earth", 20, "bash", { pct: at(250, 600), hits: () => 1, sp: at(14, 30), cd: at(6, 4) }),
  ],
  archer: [
    S("doublestrafe", "Double Strafe", "hit", "neutral", 1, null, { pct: at(120, 240), hits: () => 2, sp: at(8, 16), cd: at(2.2, 1.5) }),
    S("huntersmark", "Concentration", "buff", "neutral", 1, null, { atk: at(0.08, 0.25), aspd: at(0.05, 0.15), dur: at(20, 40), sp: at(12, 24), cd: at(45, 30) }),
    S("arrowshower", "Arrow Shower", "area", "neutral", 10, "doublestrafe", { pct: at(110, 260), sp: at(12, 26), cd: at(4, 3) }),
    S("pinshot", "Pin Shot", "hit", "wind", 10, null, { pct: at(180, 420), hits: () => 1, sp: at(10, 22), cd: at(3, 2) }),
    S("chargearrow", "Charge Arrow", "hit", "neutral", 20, "pinshot", { pct: at(260, 620), hits: () => 1, sp: at(16, 32), cd: at(5, 3.5) }),
    S("blindarrow", "Blitz Arrow", "area", "neutral", 35, "arrowshower", { pct: at(200, 460), sp: at(22, 44), cd: at(6, 4) }),
    S("falcon", "Falcon Assault", "hit", "neutral", 35, "doublestrafe", { pct: at(400, 900), hits: () => 1, sp: at(24, 48), cd: at(8, 6) }),
    S("anklesnare", "Sharp Shooting", "hit", "neutral", 50, "chargearrow", { pct: at(500, 1100), hits: () => 1, sp: at(30, 60), cd: at(9, 6) }),
  ],
  thief: [
    S("envenom", "Envenom", "hit", "poison", 1, null, { pct: at(150, 360), hits: () => 1, sp: at(6, 14), cd: at(2, 1.4) }),
    S("shadowclone", "Shadow Clone", "buff", "neutral", 1, null, { aspd: at(0.1, 0.3), dur: at(10, 20), sp: at(14, 28), cd: at(40, 28) }),
    S("flurry", "Dagger Flurry", "hit", "neutral", 10, "envenom", { pct: at(70, 150), hits: () => 3, sp: at(10, 22), cd: at(3, 2) }),
    S("sandattack", "Sand Attack", "debuff", "earth", 10, null, { pct: at(110, 220), def: at(0.1, 0.3), dur: 10, sp: at(6, 14), cd: at(10, 7) }),
    S("backstab", "Backstab", "hit", "neutral", 20, "flurry", { pct: at(300, 700), hits: () => 1, sp: at(14, 30), cd: at(5, 3.5), crit: true }),
    S("venomcloud", "Venom Splasher", "area", "poison", 20, "envenom", { pct: at(160, 380), sp: at(16, 34), cd: at(5, 3.5) }),
    S("hamstring", "Sonic Blow", "hit", "neutral", 35, "backstab", { pct: at(110, 240), hits: () => 6, sp: at(24, 48), cd: at(7, 5) }),
    S("steal", "Meteor Assault", "area", "dark", 50, "venomcloud", { pct: at(300, 700), sp: at(30, 60), cd: at(8, 6) }),
  ],
  acolyte: [
    S("holylance", "Holy Light", "hit", "light", 1, null, { pct: at(140, 320), hits: () => 1, sp: at(6, 15), cd: at(2.4, 1.6), cast: 0.5 }),
    S("heal", "Heal", "heal", "light", 1, null, { pct: at(18, 45), sp: at(10, 30), cd: at(8, 5), cast: 0.3 }),
    S("blessing", "Blessing", "buff", "neutral", 10, null, { atk: at(0.08, 0.25), def: at(0.05, 0.15), dur: at(30, 60), sp: at(14, 28), cd: at(60, 40) }),
    S("macestrike", "Mace Strike", "hit", "neutral", 10, null, { pct: at(160, 380), hits: () => 1, sp: at(8, 18), cd: at(2.5, 1.8) }),
    S("magnus", "Magnus Exorcismus", "area", "light", 20, "holylance", { pct: at(150, 360), sp: at(18, 38), cd: at(5, 3.5), cast: 1.2 }),
    S("judgment", "Judgment", "hit", "light", 35, "holylance", { pct: at(320, 760), hits: () => 1, sp: at(20, 42), cd: at(6, 4), cast: 0.8 }),
    S("angelus", "Angelus", "buff", "neutral", 35, "blessing", { def: at(0.1, 0.3), dur: at(30, 60), sp: at(20, 36), cd: at(60, 40) }),
    S("smite", "Sanctuary", "area", "light", 50, "magnus", { pct: at(320, 760), sp: at(32, 64), cd: at(8, 6), cast: 1.5 }),
  ],
  merchant: [
    S("mammonite", "Mammonite", "hit", "neutral", 1, null, { pct: at(180, 450), hits: () => 1, sp: at(6, 16), cd: at(2.4, 1.6), gold: at(5, 20) }),
    S("overcharge", "Overcharge", "buff", "neutral", 1, null, { atk: at(0.06, 0.2), dur: at(30, 60), sp: at(12, 24), cd: at(50, 35) }),
    S("cartrev", "Cart Revolution", "area", "neutral", 10, "mammonite", { pct: at(120, 280), sp: at(12, 26), cd: at(4, 3) }),
    S("cointoss", "Coin Toss", "hit", "neutral", 10, null, { pct: at(150, 340), hits: () => 2, sp: at(8, 18), cd: at(3, 2) }),
    S("loudex", "Loud Exclamation", "buff", "neutral", 20, "overcharge", { atk: at(0.08, 0.2), aspd: at(0.05, 0.12), dur: at(30, 60), sp: at(16, 30), cd: at(60, 40) }),
    S("vending", "Cart Termination", "hit", "neutral", 35, "cartrev", { pct: at(400, 900), hits: () => 1, sp: at(24, 48), cd: at(7, 5) }),
    S("greed", "Mega Cart", "area", "earth", 35, "cartrev", { pct: at(220, 520), sp: at(24, 48), cd: at(6, 4) }),
    S("stonegolem", "Hammerfall", "area", "earth", 50, "vending", { pct: at(320, 760), sp: at(32, 64), cd: at(8, 6) }),
  ],
};
export const SKILL_MAX = 10;
export const skillOf = (cls, id) => SKILL_TREE[cls]?.find((s) => s.id === id) ?? null;
/** A skill's numbers at a level. */
export function skillAt(sk, lv) {
  const o = {};
  for (const k of ["pct", "hits", "sp", "cd", "atk", "aspd", "def", "crit", "dur", "gold"]) if (sk[k] !== undefined) o[k] = typeof sk[k] === "function" ? sk[k](lv) : sk[k];
  if (o.hits) o.hits = Math.round(o.hits);
  o.cast = sk.cast ?? 0;
  return o;
}
/** May the hero learn (or raise) it now: its level open, the skill before it learned, under 10. */
export function canLearn(cls, id, level, skills) {
  const sk = skillOf(cls, id); if (!sk) return false;
  if ((skills[id] ?? 0) >= SKILL_MAX || level < sk.lv) return false;
  return !sk.req || (skills[sk.req] ?? 0) >= 1;
}
/** Points: one a level from level 2. */
export const skillPointsAt = (level) => Math.max(0, level - 1);
