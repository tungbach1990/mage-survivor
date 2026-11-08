// The profile: everything that lasts between runs, its saving and loading, what a run starts with, and what a
// run earns. Shared: crystals, the bag, the account level, records, codex, achievements, quests. Per class
// (p.perClass[cls]): the talent tree, the marks unlocked, the three gear slots.
// Pure functions over a plain object, so Node tests drive it with an in-memory store.

import { Rng } from "../../lib/pixelfx/core/math.js?v=mw7owxdc";
import { ELEMENTS, MARTIAL, MARKS, schoolOf } from "../data/elements.js?v=mw7owxdc";
import { SKILLS } from "../data/skills.js?v=mw7owxdc";
import { CODEX } from "../data/reactions.js?v=mw7owxdc";
import { CLASSES, CLASS_IDS } from "../data/classes.js?v=mw7owxdc";
import { TALENT_TREES, TALENTS, talentCost, START_MARKS, markCost, homeSchool, crossSchool, ELEMENT_COST, mageXpNext, SLOTS, WEAPON_NAME, slotName, RARITY, AFFIXES, LEGENDARY, BAG_SIZE, ACHIEVEMENTS, QUESTS } from "../data/meta.js?v=mw7owxdc";
import { DEFAULT_MODS } from "../sim/world.js?v=mw7owxdc";
import { PASSIVES, SIG_PASSIVE, passiveCost, applyPassives } from "../data/passives.js?v=mw7owxdc";
import { SLOT_IDS, kindOf, kindsOf, lookOf } from "../data/gear.js?v=mw7owxdc";
import { GEAR_SCALE } from "../data/meta.js?v=mw7owxdc";

export const SAVE_KEY = "msd.save.v1";
export const VERSION = 2;

const freshGear = () => Object.fromEntries(SLOT_IDS.map((s) => [s, null]));
const freshClass = (cls) => ({ talents: {}, passives: { [SIG_PASSIVE[cls]]: 1 }, marks: [...START_MARKS[cls]], gear: freshGear() });
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
    return [c, o ? { talents: { ...o.talents }, passives: { [SIG_PASSIVE[c]]: 1, ...(o.passives ?? {}) }, marks: [...new Set([...START_MARKS[c], ...(o.marks ?? [])])], gear: { ...freshGear(), ...Object.fromEntries(Object.entries(o.gear ?? {}).map(([k, v]) => [k === "staff" ? "weapon" : k, v])) } } : freshClass(c)];
  }));
  if (!d.perClass && (d.talents || d.unlocked || d.gear)) {
    const m = p.perClass.mage;
    m.talents = { ...(d.talents ?? {}) };
    m.marks = [...new Set([...START_MARKS.mage, ...(d.unlocked ?? [])])];
    m.gear = { ...freshGear(), weapon: fixItem(d.gear?.staff), cloak: fixItem(d.gear?.cloak), amulet: fixItem(d.gear?.amulet) };
  }
  p.bag = (d.bag ?? []).map((it) => fixItem(it));
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
  m.dmg *= 1 + 0.01 * Math.min(50, p.mageLevel - 1);
  const seen = new Set();
  for (const it of Object.values(c.gear)) if (it) { applyItem(m, it, seen.has(it.legendary)); if (it.legendary) seen.add(it.legendary) }
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
  return { cls, chapter, endless, mods: profileMods(p, cls), unlocked: marksOpen(p, cls), chaosUnlocked: chaosUnlocked(p, cls), codex: p.codex, basicLevel: basicLevel(p), novice: 1 - bought / max, look: lookOf(pc(p, cls).gear) };
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
  const old = c.gear[it.slot];
  c.gear[it.slot] = it; p.bag.splice(i, 1);
  if (old) p.bag.push(old);
  return true;
}
export function unequip(p, cls, slot) { const c = pc(p, cls); if (!c.gear[slot] || p.bag.length >= BAG_SIZE) return false; p.bag.push(c.gear[slot]); c.gear[slot] = null; return true }
export const salvageValue = (it) => ({ common: 5, rare: 15, epic: 40, legendary: 120 })[it.rarity];
export function salvage(p, itemId) {
  const i = p.bag.findIndex((it) => it.id === itemId);
  if (i < 0) return false;
  p.crystals += salvageValue(p.bag[i]); p.bag.splice(i, 1);
  return true;
}

// ---------- gear ----------
export function applyItem(m, it, dupLegendary = false) {
  m.imbue ??= {};
  for (const a of it.affixes) AFFIXES.find((x) => x[0] === a.id)?.[3](m, a.v);
  if (it.legendary && !dupLegendary) LEGENDARY.find((x) => x[0] === it.legendary)?.[2](m);
}
export function affixText(a) { const def = AFFIXES.find((x) => x[0] === a.id); return def ? def[1].replace("{v}", a.v) : a.id }
export const itemName = (it) => `${kindOf(it)[0]} ${RARITY[it.rarity].name}`;
/**
 * A random item for a chapter, from a seed (so tests and drops repeat), for a class: its lines only name marks
 * the class has open, and its imbues only marks of the other school (the Acolyte: either).
 */
export function rollItem(seed, chapter, luck = 0, { cls = "mage", marks = MARKS } = {}) {
  const r = new Rng(seed), slots = Object.keys(SLOTS), open = new Set(marks);
  const w = Object.entries(RARITY).map(([k, v]) => [k, v.weight * (k === "common" ? 1 : 1 + 0.25 * (chapter - 1) + 0.15 * luck)]);
  let x = r.next() * w.reduce((s, [, v]) => s + v, 0), rarity = "common";
  for (const [k, v] of w) { if (x < v) { rarity = k; break } x -= v }
  const pool = AFFIXES.filter((a) => {
    const o = a[4];
    if (!o) return true;
    if (o.legacy || !open.has(o.mark)) return false;
    return !o.imbue || homeSchool(cls) === "both" || crossSchool(cls, o.mark);
  }), affixes = [];
  for (let i = 0; i < RARITY[rarity].affixes && pool.length; i++) {
    const a = pool.splice(Math.floor(r.next() * pool.length), 1)[0], [lo, hi] = a[2];
    affixes.push({ id: a[0], v: Math.round((lo + (hi - lo) * r.next()) * (a[4]?.imbue ? 1 : 1 + 0.15 * (chapter - 1))) });
  }
  const slot = slots[Math.floor(r.next() * slots.length)], variant = Math.floor(r.next() * kindsOf(slot, cls).length);
  for (const a of affixes) a.v = Math.max(1, Math.round(a.v * GEAR_SCALE));
  return { id: `i${seed}`, cls, slot, variant, rarity, affixes, legendary: rarity === "legendary" ? LEGENDARY[Math.floor(r.next() * LEGENDARY.length)][0] : null, chapter };
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
  const kills = (sum.kills ?? 0) * (1 + 0.5 * (ch - 1)) / 3;
  return Math.round(Math.max(10, sum.waves * (1 + 0.5 * ch) + kills + sum.bosses * 20 * ch + (sum.won ? 50 * ch : 0)) * (mods.crystalMul ?? 1));
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
  p.mageXp += sum.waves * 10 + sum.kills + sum.bosses * 50;
  while (p.mageXp >= mageXpNext(p.mageLevel)) { p.mageXp -= mageXpNext(p.mageLevel); p.mageLevel++; out.mageLevels++ }
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
  // drops for the class played: a boss is sure to drop, each wave has a small chance
  const drops = sum.bosses * 2 + Array.from({ length: sum.waves }, (_, i) => new Rng((opts.seed ?? 1) * 97 + i).next() < 0.12).filter(Boolean).length;
  for (let i = 0; i < drops; i++) {
    const it = rollItem(p.itemSeed++ * 7919 + (opts.seed ?? 0), sum.chapter, mods.luck ?? 0, { cls, marks: marksOpen(p, cls) });
    if (it.rarity === "legendary") p.stats.legendaries++;
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
