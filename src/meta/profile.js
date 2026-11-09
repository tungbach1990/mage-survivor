// The profile: everything that lasts between runs, its saving and loading, what a run starts with, and what a
// run earns. Shared: crystals, the bag, the account level, records, codex, achievements, quests. Per class
// (p.perClass[cls]): the talent tree, the marks unlocked, the three gear slots.
// Pure functions over a plain object, so Node tests drive it with an in-memory store.

import { Rng } from "../../lib/pixelfx/core/math.js?v=mw8v0vub";
import { ELEMENTS, MARTIAL, MARKS, schoolOf, ELEM } from "../data/elements.js?v=mw8v0vub";
import { SKILLS } from "../data/skills.js?v=mw8v0vub";
import { CODEX } from "../data/reactions.js?v=mw8v0vub";
import { CLASSES, CLASS_IDS } from "../data/classes.js?v=mw8v0vub";
import { TALENT_TREES, TALENTS, talentCost, START_MARKS, markCost, homeSchool, crossSchool, ELEMENT_COST, mageXpNext, SLOTS, WEAPON_NAME, slotName, RARITY, AFFIXES, LEGENDARY, BAG_SIZE, ACHIEVEMENTS, QUESTS } from "../data/meta.js?v=mw8v0vub";
import { DEFAULT_MODS } from "../sim/world.js?v=mw8v0vub";
import { GRADE, GRADES, gradeOf, rollGrade, itemPower, baseOf, baseMul, elemsFor, ELEM_COUNT, maxElems, imbueChance, ENCHANT, refineCost, refineChance, REFINE_MAX } from "../data/loot.js?v=mw8v0vub";
import { STARTER, WTYPES, wtypesOf } from "../data/weapons.js?v=mw8v0vub";
import { ATTR, lineValue, lineText, applyLine, rollLines, elemsOfLines, martialOfLines, gearScore } from "../data/affix.js?v=mw8v0vub";
import { STAT_IDS, STAT_MAX, statCost, pointsAt, spentOn, freshStats, totalsOf } from "../data/stats.js?v=mw8v0vub";
import { PASSIVES, SIG_PASSIVE, passiveCost, applyPassives } from "../data/passives.js?v=mw8v0vub";
import { SLOT_IDS, kindOf, kindsOf, lookOf } from "../data/gear.js?v=mw8v0vub";
import { GEAR_SCALE } from "../data/meta.js?v=mw8v0vub";

export const SAVE_KEY = "msd.save.v1";
export const VERSION = 2;

const freshGear = () => Object.fromEntries(SLOT_IDS.map((s) => [s, null]));
export const starterWeapon = (cls) => ({ id: `start_${cls}`, cls, slot: "weapon", wtype: STARTER[cls], variant: 0, rarity: "white", level: 1, chapter: 1, affixes: [], refine: 0, gen: 3, legendary: null, starter: true });
const freshClass = (cls) => ({ talents: {}, stats: freshStats(), statResets: 0, passives: { [SIG_PASSIVE[cls]]: 1 }, marks: [...START_MARKS[cls]], gear: { ...freshGear(), weapon: starterWeapon(cls) }, starterGiven: true });
export function freshProfile() {
  return {
    v: VERSION, crystals: 0, mageXp: 0, mageLevel: 1,
    perClass: Object.fromEntries(CLASS_IDS.map((c) => [c, freshClass(c)])),
    bag: [], codex: [], counts: {}, achievements: [],
    quests: { day: null, list: [] }, best: { chapter: 0, endless: 0, byClass: {} },
    classes: ["mage", "swordman"], lastClass: "mage",
    stats: { runs: 0, kills: 0, waves: 0, elites: 0, legendaries: 0, flawless: 0, maxAwakened: 0 },
    itemSeed: 1,
  };
}
/** An item from an older save: the staff slot is the weapon now, and an item belongs to a class. */
const fixItem = (it, cls = "mage") => (it ? { ...it, slot: it.slot === "staff" ? "weapon" : it.slot, cls: it.cls ?? cls } : null);
/** Bring an older save up to date (and fill anything missing). v1 (one tree, elements, gear) all goes to the Mage. */
export function migrate(data) {
  const d = data ?? {}, p = { ...freshProfile(), ...d };
  p.stats = { ...freshProfile().stats, ...(d.stats ?? {}) };
  p.best = { ...freshProfile().best, ...(d.best ?? {}) };
  p.best.byClass = { ...(d.best?.byClass ?? {}) };
  p.classes = [...new Set(["mage", "swordman", ...(d.classes ?? [])])].filter((c) => CLASSES[c]);
  p.perClass = Object.fromEntries(CLASS_IDS.map((c) => {
    const o = d.perClass?.[c];
    return [c, o ? { talents: { ...o.talents }, stats: { ...freshStats(), ...(o.stats ?? {}) }, statResets: o.statResets ?? 0, starterGiven: !!o.starterGiven, passives: { [SIG_PASSIVE[c]]: 1, ...(o.passives ?? {}) }, marks: [...new Set([...START_MARKS[c], ...(o.marks ?? [])])], gear: { ...freshGear(), ...Object.fromEntries(Object.entries(o.gear ?? {}).map(([k, v]) => [k === "staff" ? "weapon" : k, v])) } } : freshClass(c)];
  }));
  if (!d.perClass && (d.talents || d.unlocked || d.gear)) {
    const m = p.perClass.mage;
    m.talents = { ...(d.talents ?? {}) };
    m.marks = [...new Set([...START_MARKS.mage, ...(d.unlocked ?? [])])];
    m.gear = { ...freshGear(), weapon: fixItem(d.gear?.staff), cloak: fixItem(d.gear?.cloak), amulet: fixItem(d.gear?.amulet) };
  }
  p.bag = (d.bag ?? []).map((it) => fixItem(it));
  const regrade = (it) => {
    if (!it) return;
    it.rarity = gradeOf(it.rarity); it.level ??= it.chapter ?? 1; it.refine ??= 0; it.elems ??= []; it.affixes ??= [];
    if (it.slot === "weapon") it.wtype ??= STARTER[it.cls] ?? "staff";
    for (const a of it.affixes.filter((x) => x.id.startsWith("i_"))) { const mk = a.id.slice(2); if (MARTIAL.includes(mk)) it.martial ??= { mark: mk, v: 10 }; else if (!it.elems.includes(mk) && it.elems.length < maxElems(it.slot)) it.elems.push(mk) }
    it.affixes = it.affixes.filter((x) => !x.id.startsWith("i_"));
    const lv = it.level ?? 1, mid = (id, kind) => lineValue(id, kind, lv, it.rarity, 0.5), OLD = { dmg: "dmg", cd: "cd", area: "area", react: "react", tier: "tier", aura: "aura", crit: "crit", xp: "xp", crystal: "crystal", regen: "regen" };
    it.affixes = it.affixes.map((a) => {
      if (a.kind) return a;
      if (a.id === "wall") return { id: "wall", kind: "pt", v: mid("wall", "pt") };
      if (OLD[a.id]) { const k = ATTR[OLD[a.id]].pct != null ? "pct" : "pt"; return { id: OLD[a.id], kind: k, v: mid(OLD[a.id], k) } }
      const mk = a.id.replace(/^[me]_/, ""); if (ATTR[`el_${mk}`]) return { id: `el_${mk}`, kind: "pct", v: mid(`el_${mk}`, "pct") };
      return null;
    }).filter(Boolean);
    for (const e of it.elems ?? []) if (!it.affixes.some((l) => l.id === `el_${e}`)) it.affixes.push({ id: `el_${e}`, kind: "pct", v: mid(`el_${e}`, "pct") });
    if (it.martial && !it.affixes.some((l) => ATTR[l.id]?.martial)) it.affixes.push({ id: `el_${it.martial.mark}`, kind: "pct", v: mid(`el_${it.martial.mark}`, "pct") });
    delete it.elems; delete it.martial;
    if ((it.gen ?? 0) < 3 && !it.starter) {
      let h = 0; for (const ch of String(it.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const rr = new Rng(h || 7), keep = it.affixes.find((l) => ATTR[l.id]?.mark);
      it.affixes = rollLines(() => rr.next(), it.level ?? 1, it.rarity, elemsFor(it.level ?? 1), it.slot);
      if (keep && !it.affixes.some((l) => ATTR[l.id]?.mark)) { const kind = "pct"; it.affixes[it.affixes.length - 1] = { id: keep.id, kind, v: lineValue(keep.id, kind, it.level ?? 1, it.rarity, 0.5) } }
    }
    it.gen = 3;
    it.affixes = it.affixes.filter((l) => l.id !== "crystal");   // no crystal lines any more
  };
  // a class that never had its starter weapon: given now, worn if its hands are empty
  for (const [cl, c] of Object.entries(p.perClass)) if (!c.starterGiven) { c.starterGiven = true; if (!c.gear.weapon) c.gear.weapon = starterWeapon(cl); else if (p.bag.length < BAG_SIZE) p.bag.push(starterWeapon(cl)) }
  p.bag.forEach(regrade); for (const c of Object.values(p.perClass)) Object.values(c.gear).forEach(regrade);
  delete p.talents; delete p.unlocked; delete p.gear;
  p.v = VERSION;
  return p;
}

// ---------- storage: localStorage in the browser, a Map in tests ----------
export function memoryStore() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }
export function load(store) { try { return migrate(JSON.parse(store.getItem(SAVE_KEY))) } catch { return freshProfile() } }
export function save(store, p) { p.savedAt = Date.now(); store.setItem(SAVE_KEY, JSON.stringify(p)) }
export const exportSave = (p) => JSON.stringify(p, null, 1);
export const importSave = (text) => migrate(JSON.parse(text));

// ---------- a class's part ----------
export const pc = (p, cls) => p.perClass[cls] ?? (p.perClass[cls] = freshClass(cls));
export const marksOpen = (p, cls) => pc(p, cls).marks;
export function profileMods(p, cls = p.lastClass ?? "mage") {
  const m = { ...DEFAULT_MODS(), elem: {}, imbue: {} }, c = pc(p, cls);
  for (const t of TALENT_TREES[cls]) { const l = c.talents[t.id] ?? 0; if (l) t.mod(m, l) }
  applyPassives(m, cls, c.passives);
  for (const it of Object.values(c.gear)) { const b = baseOf(it, STARTER[cls]); if (b?.def) m.def = (m.def ?? 0) + b.def; if (b?.hp) m.wallMax += b.hp }
  const open = new Set(marksOpen(p, cls)), seen = new Set();
  for (const it of Object.values(c.gear)) if (it) { applyItem(m, it, seen.has(it.legendary), open); if (it.legendary) seen.add(it.legendary) }
  m.def = (m.def ?? 0) * (1 + (m.defPct ?? 0));
  m.cd = Math.max(0.4, m.cd);
  return m;
}
/** CHAOS Seed for a class: all ten marks of its own school open (the Acolyte: any ten). */
export function chaosUnlocked(p, cls = p.lastClass ?? "mage") {
  const open = marksOpen(p, cls), home = homeSchool(cls);
  return home === "both" ? open.length >= 10 : (home === "arcane" ? ELEMENTS : MARTIAL).every((m) => open.includes(m));
}
/** A run starts with the class's basic attack: at level 2 from account level 3. */
export const basicLevel = (p) => (p.mageLevel >= 3 ? 2 : 1);
export const classOpen = (p, cls) => p.classes.includes(cls);
export function unlockClass(p, cls) {
  const c = CLASSES[cls];
  if (!c || classOpen(p, cls) || p.crystals < c.cost) return false;
  p.crystals -= c.cost; p.classes.push(cls);
  return true;
}
export const endlessOpen = (p) => p.best.chapter >= 5 || (p.mageLevel >= 8 && p.best.chapter >= 3);
export const chapterOpen = (p, n) => n <= p.best.chapter + 1;

/** The options for createWorld: the class picked (one the profile has) with its tree, marks and gear. */
export function runOptions(p, { chapter = 1, endless = false, cls = p.lastClass ?? "mage" } = {}) {
  if (!classOpen(p, cls)) cls = "mage";
  // how new the player is with this class: 1 with an empty tree, 0 with all of it (the class's "novice" factor
  // fades with it)
  const tree = TALENT_TREES[cls], bought = tree.reduce((s, t) => s + (pc(p, cls).talents[t.id] ?? 0), 0), max = tree.reduce((s, t) => s + t.max, 0);
  return { cls, chapter, endless, mods: profileMods(p, cls), unlocked: marksOpen(p, cls), chaosUnlocked: chaosUnlocked(p, cls), codex: p.codex, basicLevel: basicLevel(p), novice: 1 - bought / max, look: lookOf(pc(p, cls).gear),
    stats: statTotals(p, cls), acctLevel: p.mageLevel, acctXp: p.mageXp, weapon: weaponOf(pc(p, cls).gear.weapon) };
}

// ---------- spending ----------
/** Raise a passive one level (to 10), for crystals. */
export function buyPassive(p, cls, id) {
  const def = PASSIVES[cls]?.find((x) => x.id === id), c = pc(p, cls);
  c.passives ??= { [SIG_PASSIVE[cls]]: 1 };
  const l = c.passives[id] ?? 0;
  if (!def || l >= def.max) return false;
  const cost = passiveCost(def, l);
  if (p.crystals < cost) return false;
  p.crystals -= cost; c.passives[id] = l + 1;
  return true;
}
/** What a held weapon brings to a run: its type and its attack (a starter's is 1). */
export const weaponOf = (it) => (it ? { wtype: it.wtype ?? STARTER[it.cls], atk: baseOf(it, STARTER[it.cls]).mul, atkValue: baseOf(it, STARTER[it.cls]).atk } : null);
// ---------- stats ----------
/** The stats: the points spent, the class's bonus, and what the rings and amulets add. */
export function statTotals(p, cls) {
  const t = totalsOf(pc(p, cls).stats ?? freshStats(), cls, p.mageLevel);
  for (const it of Object.values(pc(p, cls).gear ?? {})) { const b = baseOf(it); if (b?.stat) t[b.stat] += b.v }
  const m = profileMods(p, cls);
  for (const s of Object.keys(t)) t[s] = Math.round((t[s] + (m.statAdd?.[s] ?? 0)) * (1 + (m.statPct?.[s] ?? 0)));
  return t;
}
export const statPointsLeft = (p, cls) => pointsAt(p.mageLevel) - spentOn(pc(p, cls).stats ?? freshStats());
/** Raise a stat by one, if the points are there (and it's under 99). */
export function raiseStat(p, cls, id) {
  const c = pc(p, cls); c.stats ??= freshStats();
  const x = c.stats[id] ?? 1;
  if (!STAT_IDS.includes(id) || x >= STAT_MAX || statPointsLeft(p, cls) < statCost(x)) return false;
  c.stats[id] = x + 1;
  return true;
}
/** What the next reset costs: the first for each class is free. */
export const resetCost = (p, cls) => { const n = pc(p, cls).statResets ?? 0; return n === 0 ? 0 : Math.min(600, 150 * n) };
export function resetStats(p, cls) {
  const c = pc(p, cls), cost = resetCost(p, cls);
  if (p.crystals < cost) return false;
  p.crystals -= cost; c.stats = freshStats(); c.statResets = (c.statResets ?? 0) + 1;
  return true;
}
/** Spend what's left by a plan: stats and their shares, the cheapest gap to its share first. */
export function autoStats(p, cls, plan = STAT_PLAN[cls]) {
  const c = pc(p, cls); c.stats ??= freshStats();
  for (let guard = 0; guard < 500; guard++) {
    const spent = (s) => { let n = 0; for (let x = 1; x < c.stats[s]; x++) n += statCost(x); return n };
    const opts = plan.filter(([s]) => c.stats[s] < STAT_MAX && statCost(c.stats[s]) <= statPointsLeft(p, cls)).sort((a, b) => spent(a[0]) / a[1] - spent(b[0]) / b[1]);
    if (!opts.length) break;
    raiseStat(p, cls, opts[0][0]);
  }
}
export const STAT_PLAN = {
  mage: [["int", 0.6], ["dex", 0.25], ["vit", 0.15]], swordman: [["str", 0.6], ["vit", 0.25], ["agi", 0.15]],
  archer: [["dex", 0.6], ["agi", 0.25], ["luk", 0.15]], thief: [["agi", 0.6], ["dex", 0.25], ["luk", 0.15]],
  acolyte: [["int", 0.6], ["vit", 0.25], ["dex", 0.15]], merchant: [["str", 0.6], ["vit", 0.25], ["luk", 0.15]],
};
/** A piece of gear a boss dropped in a run, made into a real item in the bag (now, not at the end). */
/** The lowest grade kept when picked up; lower ones are broken down into crystals at once. */
export const lootKeeps = (p, grade) => (p.lootKeep ? p.lootKeep.includes(gradeOf(grade)) : GRADES.indexOf(gradeOf(grade)) >= GRADES.indexOf(p.lootMin ?? "white"));
/** Is this piece weaker than what the class wears in its slot (and set to be broken down)? */
export const weakerThanWorn = (p, it) => !!p.autoSalvage && !!pc(p, it.cls)?.gear?.[it.slot] && itemScore(it, p) <= itemScore(pc(p, it.cls).gear[it.slot], p);
/** Break down every piece in the bag the filters would drop now (worn gear and starters kept). Returns the crystals. */
export function salvageFiltered(p) {
  let got = 0;
  p.bag = p.bag.filter((it) => { if (it.starter || (lootKeeps(p, it.rarity) && !weakerThanWorn(p, it))) return true; got += salvageValue(it); return false });
  p.crystals += got;
  return got;
}
export function claimGear(p, cls, g, seed = 0) {
  g = { ...g };
  if (!lootKeeps(p, g.grade)) { const v = salvageValue({ rarity: g.grade, level: g.level ?? 1 }); p.crystals += v; return { salvaged: v, rarity: g.grade, level: g.level ?? 1 } }
  const it = rollItem(p.itemSeed++ * 7919 + seed, g.level ?? 1, profileMods(p, cls).luck ?? 0, { cls, marks: marksOpen(p, cls), grade: g.grade });
  if (GRADE[it.rarity].power) p.stats.legendaries++;
  if (weakerThanWorn(p, it) || p.bag.length >= BAG_SIZE) { const v = salvageValue(it); p.crystals += v; return { ...it, salvaged: v } }
  p.bag.push(it);
  it.fresh = true;
  return it;
}
/** How good a piece is, roughly (to compare with what's worn). */
/** "Lực chiến": one number to compare items by (a mark the class hasn't open counts nothing). */
export const itemScore = (it, p = null) => (it ? gearScore(it, baseOf(it, STARTER[it.cls]), p ? new Set(marksOpen(p, it.cls)) : null) + (it.legendary ? 15 : 0) : 0);
// ---------- enchanting and refining (in the hall) ----------
/** An item by id, in the bag or worn by any class. */
export function findItem(p, id) {
  const b = p.bag.find((it) => it.id === id); if (b) return b;
  for (const c of Object.values(p.perClass)) for (const it of Object.values(c.gear ?? {})) if (it?.id === id) return it;
  return null;
}
const enchantRoll = (p) => new Rng((p.enchantSeed = (p.enchantSeed ?? 1) + 1) * 2654435761).next();
/** What adding the next element costs, and how likely it is to take. */
export const addElemCost = (it) => { const n = elemsOfLines(it.affixes).length; if (n >= maxElems(it.slot)) return null; const [c, ch] = ENCHANT.add[Math.min(n, ENCHANT.add.length - 1)]; return { cost: c * (it.level ?? 1), chance: ch } };
/** Add an element to an item. Returns "ok", "fail" (crystals spent, nothing added) or null (not possible). */
export function addElement(p, id, el, kind = "pct") {
  const it = findItem(p, id), q = it && addElemCost(it);
  if (!q || elemsOfLines(it.affixes).includes(el) || !ELEMENTS.includes(el) || p.crystals < q.cost) return null;
  p.crystals -= q.cost;
  if (enchantRoll(p) >= q.chance) return "fail";
  it.affixes.push({ id: `el_${el}`, kind, v: lineValue(`el_${el}`, kind, it.level ?? 1, it.rarity, enchantRoll(p)) }); return "ok";
}
export function removeElement(p, id, el) {
  const it = findItem(p, id);
  if (!it || !elemsOfLines(it.affixes).includes(el) || p.crystals < ENCHANT.remove) return false;
  p.crystals -= ENCHANT.remove; it.affixes = it.affixes.filter((l) => l.id !== `el_${el}`); return true;
}
/** A new martial line (another mark; the value kept, or a fresh one). */
export function rerollMartial(p, id) {
  const it = findItem(p, id), cost = it ? ENCHANT.martial * (it.level ?? 1) : 0;
  if (!it || p.crystals < cost) return false;
  p.crystals -= cost;
  const cur = martialOfLines(it.affixes), others = MARTIAL.filter((m) => `el_${m}` !== cur?.id), mk = others[Math.floor(enchantRoll(p) * others.length)];
  if (cur) cur.id = `el_${mk}`;
  else it.affixes.push({ id: `el_${mk}`, kind: "pct", v: lineValue(`el_${mk}`, "pct", it.level ?? 1, it.rarity, enchantRoll(p)) });
  return true;
}
/** Refine +1: sure to +4, then less and less; a failure drops it one. Returns "ok", "fail" or null. */
export function refineItem(p, id) {
  const it = findItem(p, id); if (!it || (it.refine ?? 0) >= REFINE_MAX) return null;
  const cost = refineCost(it); if (p.crystals < cost) return null;
  p.crystals -= cost;
  const to = (it.refine ?? 0) + 1;
  if (enchantRoll(p) < refineChance(to)) { it.refine = to; return "ok" }
  it.refine = Math.max(0, (it.refine ?? 0) - 1); return "fail";
}
export function buyTalent(p, cls, id) {
  const t = TALENT_TREES[cls]?.find((x) => x.id === id), c = pc(p, cls), l = c.talents[id] ?? 0;
  if (!t || l >= t.max) return false;
  const cost = talentCost(t, l);
  if (p.crystals < cost) return false;
  p.crystals -= cost; c.talents[id] = l + 1;
  return true;
}
export function unlockMark(p, cls, mark) {
  const c = pc(p, cls), cost = markCost(cls, mark);
  if (!MARKS.includes(mark) || c.marks.includes(mark) || p.crystals < cost) return false;
  p.crystals -= cost; c.marks.push(mark);
  return true;
}
export function equip(p, cls, itemId) {
  const i = p.bag.findIndex((it) => it.id === itemId);
  if (i < 0) return false;
  const it = p.bag[i], c = pc(p, cls);
  if (it.cls !== cls) return false;
  if (it.slot === "weapon" && !WTYPES[it.wtype ?? STARTER[cls]]?.cls.includes(cls)) return false;
  // two hands: the off-hand piece goes to the bag (no room there: no swap); an off-hand piece needs a free hand
  if (it.slot === "offhand" && c.gear.weapon && WTYPES[c.gear.weapon.wtype]?.two) return false;
  if (it.slot === "weapon" && WTYPES[it.wtype]?.two && c.gear.offhand) { if (p.bag.length >= BAG_SIZE) return false; p.bag.push(c.gear.offhand); c.gear.offhand = null }
  const old = c.gear[it.slot];
  c.gear[it.slot] = it; p.bag.splice(i, 1);
  if (old) p.bag.push(old);
  return true;
}
export function unequip(p, cls, slot) { const c = pc(p, cls); if (!c.gear[slot] || p.bag.length >= BAG_SIZE) return false; p.bag.push(c.gear[slot]); c.gear[slot] = null; return true }
export const salvageValue = (it) => Math.round(3 * GRADE[gradeOf(it.rarity)].salvage * (1 + 0.5 * ((it.level ?? it.chapter ?? 1) - 1)));
export function salvage(p, itemId) {
  const i = p.bag.findIndex((it) => it.id === itemId);
  if (i < 0) return false;
  p.crystals += salvageValue(p.bag[i]); p.bag.splice(i, 1);
  return true;
}

// ---------- gear ----------
export function applyItem(m, it, dupLegendary = false, open = null) {
  for (const l of it.affixes ?? []) applyLine(m, l, open, it.refine ?? 0);
  if (it.legendary && !dupLegendary) LEGENDARY.find((x) => x[0] === it.legendary)?.[2](m);
}
export const affixText = (a) => lineText(a);
export const itemName = (it) => `${kindOf(it)[0]}${elemsOfLines(it.affixes).map((e) => " " + ELEM[e].name).join("")} ${GRADE[gradeOf(it.rarity)].name} · cấp ${it.level ?? it.chapter ?? 1}${it.refine ? ` · +${it.refine}` : ""}`;
/**
 * A random item for a chapter, from a seed (so tests and drops repeat), for a class: its lines only name marks
 * the class has open, and its imbues only marks of the other school (the Acolyte: either).
 */
export function rollItem(seed, chapter, luck = 0, { cls = "mage", marks = MARKS, grade = null } = {}) {
  const r = new Rng(seed), slots = Object.keys(SLOTS), open = new Set(marks);
  const rarity = grade ?? rollGrade(() => r.next(), 0.15 * luck), level = Math.max(1, Math.min(5, chapter)), power = itemPower(level, rarity);
  const slot = slots[Math.floor(r.next() * slots.length)];
  const types = level <= 1 ? [STARTER[cls]] : level === 2 ? wtypesOf(cls).filter((t) => t === STARTER[cls] || ["dagger", "sword", "bow", "mace"].includes(t)) : wtypesOf(cls);
  const wtype = slot === "weapon" ? types[Math.floor(r.next() * types.length)] : undefined;
  const kinds = kindsOf(slot, cls, wtype).length, variant = Math.floor(r.next() * (level <= 1 ? Math.min(2, kinds) : kinds));
  const affixes = rollLines(() => r.next(), level, rarity, elemsFor(level), slot, marks === MARKS ? null : marks);
  return { id: `i${seed}`, cls, slot, ...(wtype ? { wtype } : {}), variant, rarity, level, refine: 0, affixes, gen: 3, legendary: GRADE[rarity].power ? LEGENDARY[Math.floor(r.next() * LEGENDARY.length)][0] : null, chapter: level };
}

// ---------- quests ----------
export function today(now = new Date()) { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` }
export function refreshQuests(p, day = today()) {
  if (p.quests.day === day) return p.quests.list;
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = new Rng(h || 1), pool = [...QUESTS];
  p.quests = { day, list: [0, 1, 2].map(() => { const q = pool.splice(Math.floor(r.next() * pool.length), 1)[0]; return { id: q.id, goal: Math.round(q.n[0] + (q.n[1] - q.n[0]) * r.next()), progress: 0, done: false, claimed: false } }) };
  return p.quests.list;
}
export const questText = (q) => QUESTS.find((x) => x.id === q.id).text.replace("{n}", q.goal);
export function claimQuest(p, i) {
  const q = p.quests.list[i];
  if (!q || !q.done || q.claimed) return 0;
  q.claimed = true;
  const reward = QUESTS.find((x) => x.id === q.id).reward;
  p.crystals += reward;
  return reward;
}

// ---------- what a run earns ----------
export function crystalsFor(sum, mods = {}) {
  const ch = sum.chapter;
  // every monster slain is worth something (a third of a crystal, more in later chapters), and a run never
  // pays less than 10: a beaten run still buys a little strength
  // the crystals picked up in the run (older summaries: from the kills)
  const kills = sum.crystals ?? (sum.kills ?? 0) * (1 + 0.5 * (ch - 1)) / 3;
  void kills; void mods;
  return 0;   // crystals come only from breaking gear down now
}
/**
 * Fold a finished run into the profile. Returns what changed: { crystals, mageLevels, items, achievements,
 * quests (done now), discovered }.
 */
export function settle(p, sum, opts = {}) {
  const cls = sum.cls ?? "mage", mods = profileMods(p, cls), out = { crystals: 0, mageLevels: 0, items: [], achievements: [], quests: [], discovered: [] };
  // crystals and account xp
  out.crystals = crystalsFor(sum, mods);
  p.crystals += out.crystals;
  if (sum.acct) { out.mageLevels = Math.max(0, sum.acct.level - p.mageLevel); p.mageLevel = Math.max(p.mageLevel, sum.acct.level); p.mageXp = sum.acct.xp }
  else {
    p.mageXp += sum.waves * 10 + sum.kills + sum.bosses * 50;
    while (p.mageXp >= mageXpNext(p.mageLevel)) { p.mageXp -= mageXpNext(p.mageLevel); p.mageLevel++; out.mageLevels++ }
  }
  // records
  if (sum.won && !sum.endless) { p.best.chapter = Math.max(p.best.chapter, sum.chapter); if (sum.wallLeft >= 0.999) p.stats.flawless++ }
  {
    const b = (p.best.byClass[cls] ??= { chapter: 0, endless: 0, runs: 0 });
    b.runs++;
    if (sum.won && !sum.endless) b.chapter = Math.max(b.chapter, sum.chapter);
    if (sum.endless) b.endless = Math.max(b.endless, sum.waves);
    p.lastClass = cls;
    if (sum.chaos && CLASSES[cls].school !== "arcane") p.stats.martialChaos = (p.stats.martialChaos ?? 0) + sum.chaos;
  }
  if (sum.endless) p.best.endless = Math.max(p.best.endless, sum.waves);
  Object.assign(p.stats, { runs: p.stats.runs + 1, kills: p.stats.kills + sum.kills, waves: p.stats.waves + sum.waves, elites: p.stats.elites + (sum.elites ?? 0), maxAwakened: Math.max(p.stats.maxAwakened, sum.awakened.length) });
  // the codex and reaction totals
  for (const [k, n] of Object.entries(sum.counts)) p.counts[k] = (p.counts[k] ?? 0) + n;
  for (const k of Object.keys(sum.counts)) if (!p.codex.includes(k) && CODEX.some((c) => c.id === k)) { p.codex.push(k); out.discovered.push(k) }
  // the gear the bosses dropped, of the grade and level they dropped it at
  for (const g of (sum.gear ?? []).slice(sum.gearClaimed ?? 0)) {
    if (!lootKeeps(p, g.grade)) { p.crystals += salvageValue({ rarity: g.grade, level: g.level ?? 1 }); continue }
    const it = rollItem(p.itemSeed++ * 7919 + (opts.seed ?? 0), g.level ?? sum.chapter, mods.luck ?? 0, { cls, marks: marksOpen(p, cls), grade: g.grade });
    if (GRADE[it.rarity].power) p.stats.legendaries++;
    if (p.bag.length < BAG_SIZE) p.bag.push(it); else p.crystals += salvageValue(it);
    out.items.push(it);
  }
  // quests
  refreshQuests(p, opts.day);
  for (const q of p.quests.list) {
    if (q.done) continue;
    const def = QUESTS.find((x) => x.id === q.id), v = def.of(sum);
    q.progress = def.max ? Math.max(q.progress, v) : q.progress + v;
    if (q.progress >= q.goal) { q.done = true; out.quests.push(q) }
  }
  // achievements (they pay at once)
  for (const a of ACHIEVEMENTS) if (!p.achievements.includes(a.id) && a.check(p)) { p.achievements.push(a.id); p.crystals += a.reward; out.achievements.push(a) }
  return out;
}

export { TALENTS, TALENT_TREES, talentCost, ELEMENT_COST, markCost, mageXpNext, SLOTS, WEAPON_NAME, slotName, RARITY, ACHIEVEMENTS, QUESTS, BAG_SIZE };
