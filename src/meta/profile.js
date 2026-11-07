// The profile: everything that lasts between runs, its saving and loading, what a run starts with, and what a
// run earns. Pure functions over a plain object, so Node tests drive it with an in-memory store.

import { Rng } from "../../lib/pixelfx/core/math.js";
import { ELEMENTS } from "../data/elements.js";
import { SKILLS } from "../data/skills.js";
import { CODEX } from "../data/reactions.js";
import { CLASSES } from "../data/classes.js";
import { TALENTS, talentCost, START_ELEMENTS, ELEMENT_COST, mageXpNext, SLOTS, RARITY, AFFIXES, LEGENDARY, BAG_SIZE, ACHIEVEMENTS, QUESTS } from "../data/meta.js";
import { DEFAULT_MODS } from "../sim/world.js";

export const SAVE_KEY = "msd.save.v1";
export const VERSION = 1;

export function freshProfile() {
  return {
    v: VERSION, crystals: 0, talents: {}, unlocked: [...START_ELEMENTS], mageXp: 0, mageLevel: 1,
    gear: { staff: null, cloak: null, amulet: null }, bag: [], codex: [], counts: {}, achievements: [],
    quests: { day: null, list: [] }, best: { chapter: 0, endless: 0, byClass: {} },
    classes: ["mage", "swordman"], lastClass: "mage",
    stats: { runs: 0, kills: 0, waves: 0, elites: 0, legendaries: 0, flawless: 0, maxAwakened: 0 },
    itemSeed: 1,
  };
}
/** Bring an older save up to date (and fill anything missing). */
export function migrate(data) {
  const p = { ...freshProfile(), ...(data ?? {}) };
  p.stats = { ...freshProfile().stats, ...(data?.stats ?? {}) };
  p.best = { ...freshProfile().best, ...(data?.best ?? {}) };
  p.best.byClass = { ...(data?.best?.byClass ?? {}) };
  p.classes = [...new Set(["mage", "swordman", ...(data?.classes ?? [])])].filter((c) => CLASSES[c]);
  p.gear = { ...freshProfile().gear, ...(data?.gear ?? {}) };
  p.v = VERSION;
  return p;
}

// ---------- storage: localStorage in the browser, a Map in tests ----------
export function memoryStore() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }
export function load(store) { try { return migrate(JSON.parse(store.getItem(SAVE_KEY))) } catch { return freshProfile() } }
export function save(store, p) { p.savedAt = Date.now(); store.setItem(SAVE_KEY, JSON.stringify(p)) }
export const exportSave = (p) => JSON.stringify(p, null, 1);
export const importSave = (text) => migrate(JSON.parse(text));

// ---------- what a run starts with ----------
export function profileMods(p) {
  const m = { ...DEFAULT_MODS(), elem: {} };
  for (const t of TALENTS) { const l = p.talents[t.id] ?? 0; if (l) t.mod(m, l) }
  m.dmg *= 1 + 0.01 * Math.min(50, p.mageLevel - 1);
  for (const it of Object.values(p.gear)) if (it) applyItem(m, it);
  return m;
}
export const chaosUnlocked = (p) => ELEMENTS.every((e) => p.unlocked.includes(e));
/** A run starts with the class's basic attack: at level 2 from mage level 3. */
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

/** The options for createWorld: the class picked (one the profile has) starts with its basic attack. */
export function runOptions(p, { chapter = 1, endless = false, cls = p.lastClass ?? "mage" } = {}) {
  if (!classOpen(p, cls)) cls = "mage";
  return { cls, chapter, endless, mods: profileMods(p), unlocked: p.unlocked, chaosUnlocked: chaosUnlocked(p), codex: p.codex, basicLevel: basicLevel(p) };
}

// ---------- spending ----------
export function buyTalent(p, id) {
  const t = TALENTS.find((x) => x.id === id), l = p.talents[id] ?? 0;
  if (!t || l >= t.max) return false;
  const cost = talentCost(t, l);
  if (p.crystals < cost) return false;
  p.crystals -= cost; p.talents[id] = l + 1;
  return true;
}
export function unlockElement(p, el) {
  if (p.unlocked.includes(el) || !(el in ELEMENT_COST) || p.crystals < ELEMENT_COST[el]) return false;
  p.crystals -= ELEMENT_COST[el]; p.unlocked.push(el);
  return true;
}
export function equip(p, itemId) {
  const i = p.bag.findIndex((it) => it.id === itemId);
  if (i < 0) return false;
  const it = p.bag[i];
  if (it.slot === "amulet" && p.mageLevel < 5) return false;
  const old = p.gear[it.slot];
  p.gear[it.slot] = it; p.bag.splice(i, 1);
  if (old) p.bag.push(old);
  return true;
}
export function unequip(p, slot) { if (!p.gear[slot] || p.bag.length >= BAG_SIZE) return false; p.bag.push(p.gear[slot]); p.gear[slot] = null; return true }
export const salvageValue = (it) => ({ common: 5, rare: 15, epic: 40, legendary: 120 })[it.rarity];
export function salvage(p, itemId) {
  const i = p.bag.findIndex((it) => it.id === itemId);
  if (i < 0) return false;
  p.crystals += salvageValue(p.bag[i]); p.bag.splice(i, 1);
  return true;
}

// ---------- gear ----------
export function applyItem(m, it) {
  for (const a of it.affixes) AFFIXES.find((x) => x[0] === a.id)?.[3](m, a.v);
  if (it.legendary) LEGENDARY.find((x) => x[0] === it.legendary)?.[2](m);
}
export function affixText(a) { const def = AFFIXES.find((x) => x[0] === a.id); return def ? def[1].replace("{v}", a.v) : a.id }
/** A random item for a chapter, from a seed (so tests and drops repeat). */
export function rollItem(seed, chapter, luck = 0) {
  const r = new Rng(seed), slots = Object.keys(SLOTS);
  const w = Object.entries(RARITY).map(([k, v]) => [k, v.weight * (k === "common" ? 1 : 1 + 0.25 * (chapter - 1) + 0.15 * luck)]);
  let x = r.next() * w.reduce((s, [, v]) => s + v, 0), rarity = "common";
  for (const [k, v] of w) { if (x < v) { rarity = k; break } x -= v }
  const pool = [...AFFIXES], affixes = [];
  for (let i = 0; i < RARITY[rarity].affixes; i++) {
    const a = pool.splice(Math.floor(r.next() * pool.length), 1)[0], [lo, hi] = a[2];
    affixes.push({ id: a[0], v: Math.round((lo + (hi - lo) * r.next()) * (1 + 0.15 * (chapter - 1))) });
  }
  const slot = slots[Math.floor(r.next() * slots.length)];
  return { id: `i${seed}`, slot, rarity, affixes, legendary: rarity === "legendary" ? LEGENDARY[Math.floor(r.next() * LEGENDARY.length)][0] : null, chapter };
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
  return Math.round((sum.waves * (1 + 0.5 * ch) + sum.bosses * 20 * ch + (sum.won ? 50 * ch : 0)) * (mods.crystalMul ?? 1));
}
/**
 * Fold a finished run into the profile. Returns what changed: { crystals, mageLevels, items, achievements,
 * quests (done now), discovered }.
 */
export function settle(p, sum, opts = {}) {
  const mods = profileMods(p), out = { crystals: 0, mageLevels: 0, items: [], achievements: [], quests: [], discovered: [] };
  // crystals and mage xp
  out.crystals = crystalsFor(sum, mods);
  p.crystals += out.crystals;
  p.mageXp += sum.waves * 10 + sum.kills + sum.bosses * 50;
  while (p.mageXp >= mageXpNext(p.mageLevel)) { p.mageXp -= mageXpNext(p.mageLevel); p.mageLevel++; out.mageLevels++ }
  // records
  if (sum.won && !sum.endless) { p.best.chapter = Math.max(p.best.chapter, sum.chapter); if (sum.wallLeft >= 0.999) p.stats.flawless++ }
  // the class's own record
  if (sum.cls) {
    const b = (p.best.byClass[sum.cls] ??= { chapter: 0, endless: 0, runs: 0 });
    b.runs++;
    if (sum.won && !sum.endless) b.chapter = Math.max(b.chapter, sum.chapter);
    if (sum.endless) b.endless = Math.max(b.endless, sum.waves);
    p.lastClass = sum.cls;
    if (sum.chaos && CLASSES[sum.cls].school !== "arcane") p.stats.martialChaos = (p.stats.martialChaos ?? 0) + sum.chaos;
  }
  if (sum.endless) p.best.endless = Math.max(p.best.endless, sum.waves);
  Object.assign(p.stats, { runs: p.stats.runs + 1, kills: p.stats.kills + sum.kills, waves: p.stats.waves + sum.waves, elites: p.stats.elites + (sum.elites ?? 0), maxAwakened: Math.max(p.stats.maxAwakened, sum.awakened.length) });
  // the codex and reaction totals
  for (const [k, n] of Object.entries(sum.counts)) p.counts[k] = (p.counts[k] ?? 0) + n;
  for (const k of Object.keys(sum.counts)) if (!p.codex.includes(k) && CODEX.some((c) => c.id === k)) { p.codex.push(k); out.discovered.push(k) }
  // drops: a boss is sure to drop, each wave has a small chance
  const drops = sum.bosses + Array.from({ length: sum.waves }, (_, i) => new Rng((opts.seed ?? 1) * 97 + i).next() < 0.05).filter(Boolean).length;
  for (let i = 0; i < drops; i++) {
    const it = rollItem(p.itemSeed++ * 7919 + (opts.seed ?? 0), sum.chapter, mods.luck ?? 0);
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

export { TALENTS, talentCost, ELEMENT_COST, mageXpNext, SLOTS, RARITY, ACHIEVEMENTS, QUESTS, BAG_SIZE };
