// The idle game's save: six heroes (one a class), the bag, the crystals, the settings; and what's done with it:
// learning skills, raising stats, gear (wear, salvage, refine, the pick-up filters), passives, offline rewards.
// Older saves (the tower-defense game) move over: their gear, crystals (with what their talents and marks cost
// back), and a starting gift for every class that had played.

import { Rng } from "../../lib/pixelfx/core/math.js?v=mw8wxgia";
import { pointsAt, spentOn, statCost, freshStats, STAT_IDS, STAT_MAX } from "../data/stats.js?v=mw8wxgia";
import { SLOT_IDS } from "../data/gear.js?v=mw8wxgia";
import { STARTER, WTYPES } from "../data/weapons.js?v=mw8wxgia";
import { GRADES, GRADE, gradeOf } from "../data/loot.js?v=mw8wxgia";
import { CLASS_IDS } from "./hero.js?v=mw8wxgia";
import { SKILL_TREE, canLearn, skillPointsAt } from "./skills.js?v=mw8wxgia";
import { PASSIVE_TREE, SIG, passiveCost } from "./passives.js?v=mw8wxgia";
import { rollItem, starterWeapon, itemPower, salvageValue, refineCost, refineChance, REFINE_MAX, LINES, SLOT_POOL, LINE_COUNT, lineValue } from "./items.js?v=mw8wxgia";
import { xpToNext, MAX_LEVEL, mapOf } from "./data.js?v=mw8wxgia";
import { BAL } from "./balance.js?v=mw8wxgia";
import { freshHero, autoStats, autoSkills } from "./bot.js?v=mw8wxgia";

export const VERSION = 4, SAVE_KEY = "msd.save.v1", BAG_SIZE = 60;
export function freshProfile() {
  return {
    v: VERSION, current: "mage", heroes: Object.fromEntries(CLASS_IDS.map((c) => [c, withSig(freshHero(c))])),
    bag: [], crystals: 0, seed: 1, lootKeep: [...GRADES], autoSalvage: false, speed: 1,
    lastSeen: Date.now(), totals: { kills: 0, bosses: 0, deaths: 0, salvaged: 0, playSec: 0 }, achievements: [], quests: { day: "", list: [], done: [] },
    settings: {}, migratedFrom: null,
  };
}
const withSig = (h) => { h.passives[SIG[h.cls]] = 1; h.rate = null; h.resets = 0; return h };
export const heroOf = (p, cls = p.current) => p.heroes[cls];

// ---------- saving ----------
export function memoryStore() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }
export function load(store) { try { return migrate(JSON.parse(store.getItem(SAVE_KEY))) } catch { return freshProfile() } }
export function save(store, p) { p.savedAt = Date.now(); store.setItem(SAVE_KEY, JSON.stringify(p)) }
export const exportSave = (p) => JSON.stringify(p);
export const importSave = (text) => migrate(JSON.parse(text));

/** Any save to the current shape (a broken one: a fresh profile). */
export function migrate(o) {
  if (!o || typeof o !== "object") return freshProfile();
  if ((o.v ?? 0) >= 4 && o.heroes) {
    const p = freshProfile();
    Object.assign(p, o);
    for (const c of CLASS_IDS) { p.heroes[c] = { ...freshHero(c), ...(o.heroes[c] ?? {}) }; const h = p.heroes[c]; h.gear = { ...freshHero(c).gear, ...(h.gear ?? {}) }; h.passives ??= {}; h.passives[SIG[c]] ??= 1; h.stats = { ...freshStats(), ...(h.stats ?? {}) } }
    p.bag = (p.bag ?? []).filter(Boolean);
    return p;
  }
  return fromTowerDefense(o);
}
/** The old game's save: its gear (lines rolled again), its crystals back, and a gift for each class played. */
function fromTowerDefense(o) {
  const p = freshProfile();
  let refund = 0;
  const played = new Set();
  for (const [cls, c] of Object.entries(o.perClass ?? {})) {
    if (!CLASS_IDS.includes(cls)) continue;
    const talents = Object.values(c.talents ?? {}).reduce((a, b) => a + b, 0), passives = Object.values(c.passives ?? {}).reduce((a, b) => a + b, 0);
    refund += talents * 120 + Math.max(0, passives - 1) * 60 + Math.max(0, (c.marks?.length ?? 0) - 3) * 150;
    if (talents || passives > 1 || Object.values(c.gear ?? {}).some((it) => it && !it.starter)) played.add(cls);
    for (const [slot, it] of Object.entries(c.gear ?? {})) if (it && !it.starter && SLOT_IDS.includes(slot)) p.heroes[cls].gear[slot] = convertItem(it, cls);
  }
  for (const it of o.bag ?? []) if (it && !it.starter && CLASS_IDS.includes(it.cls) && p.bag.length < BAG_SIZE) p.bag.push(convertItem(it, it.cls));
  if ((o.stats?.runs ?? 0) > 0) played.add(o.lastClass ?? "mage");
  for (const cls of played) { const h = p.heroes[cls]; h.level = 6; h.gold = 500; autoStats(h); autoSkills(h) }
  p.crystals = Math.max(0, Math.round((o.crystals ?? 0) + refund));
  p.current = CLASS_IDS.includes(o.lastClass) ? o.lastClass : "mage";
  p.lootKeep = Array.isArray(o.lootKeep) ? o.lootKeep : [...GRADES];
  p.autoSalvage = !!o.autoSalvage;
  p.achievements = Array.isArray(o.achievements) ? [...o.achievements] : [];
  p.migratedFrom = o.v ?? 0;
  p.refund = refund;
  return p;
}
/** An old item: the same slot, look, grade and refining; level x2; its lines rolled again (the same every time). */
function convertItem(it, cls) {
  let h = 0; for (const ch of String(it.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = new Rng(h || 9), level = Math.max(1, Math.min(10, (it.level ?? it.chapter ?? 1) * 2)), rarity = gradeOf(it.rarity), pool = [...(SLOT_POOL[it.slot] ?? SLOT_POOL.ring)], lines = [];
  for (let i = 0; i < LINE_COUNT[rarity] && pool.length; i++) { const id = pool.splice(Math.floor(r.next() * pool.length), 1)[0]; lines.push({ id, v: lineValue(id, level, rarity, r.next()) }) }
  const wtype = it.slot === "weapon" ? (WTYPES[it.wtype]?.cls.includes(cls) ? it.wtype : STARTER[cls]) : undefined;
  return { id: `o${it.id}`, cls, slot: it.slot, ...(wtype ? { wtype } : {}), variant: it.variant ?? 0, rarity, level, refine: it.refine ?? 0, lines };
}

// ---------- stats and skills ----------
export const statPointsLeft = (h) => pointsAt(h.level) - spentOn(h.stats);
export function raiseStat(h, s, n = 1) {
  let done = 0;
  for (let i = 0; i < n; i++) { if (!STAT_IDS.includes(s) || h.stats[s] >= STAT_MAX || statCost(h.stats[s]) > statPointsLeft(h)) break; h.stats[s]++; done++ }
  return done;
}
export const skillPointsLeft = (h) => skillPointsAt(h.level) - Object.values(h.skills).reduce((a, b) => a + b, 0);
export function learnSkill(h, id) { if (skillPointsLeft(h) < 1 || !canLearn(h.cls, id, h.level, h.skills)) return false; h.skills[id] = (h.skills[id] ?? 0) + 1; return true }
/** A reset: the first free for each hero, then crystals (more each time, up to 500). */
export const resetCost = (h) => Math.min(500, (h.resets ?? 0) * 100);
export function resetPoints(p, h, what) {
  const c = resetCost(h); if (p.crystals < c) return false;
  p.crystals -= c; h.resets = (h.resets ?? 0) + 1;
  if (what !== "skills") h.stats = freshStats();
  if (what !== "stats") h.skills = {};
  return true;
}
/** What the hero does on its own when it levels up (if set to). */
export function onLevel(h) { if (h.autoStats) autoStats(h); if (h.autoSkills) autoSkills(h) }

// ---------- gear ----------
export const keeps = (p, grade) => (p.lootKeep ?? GRADES).includes(gradeOf(grade));
export const weaker = (p, it) => !!p.autoSalvage && itemPower(it) <= itemPower(p.heroes[it.cls]?.gear?.[it.slot]);
/** A dropped piece for the hero playing: kept in the bag, or broken down into crystals (filters, a full bag). */
export function claimDrop(p, cls, level, grade) {
  const it = rollItem(p.seed++ * 7919 + 13, cls, level, grade);
  if (!keeps(p, it.rarity) || weaker(p, it) || p.bag.length >= BAG_SIZE) { const v = salvageValue(it); p.crystals += v; p.totals.salvaged++; return { ...it, salvaged: v } }
  it.fresh = true; p.bag.push(it);
  return it;
}
export function equip(p, cls, id) {
  const i = p.bag.findIndex((it) => it.id === id), h = p.heroes[cls];
  if (i < 0 || !h) return false;
  const it = p.bag[i];
  if (it.cls !== cls) return false;
  if (it.slot === "weapon" && !WTYPES[it.wtype ?? STARTER[cls]]?.cls.includes(cls)) return false;
  if (it.slot === "offhand" && h.gear.weapon && WTYPES[h.gear.weapon.wtype]?.two) return false;
  if (it.slot === "weapon" && WTYPES[it.wtype]?.two && h.gear.offhand) { p.bag.push(h.gear.offhand); h.gear.offhand = null }
  const old = h.gear[it.slot];
  h.gear[it.slot] = it; delete it.fresh; p.bag.splice(p.bag.indexOf(it), 1);
  if (old) p.bag.push(old);
  return true;
}
export function unequip(p, cls, slot) { const h = p.heroes[cls]; if (!h?.gear[slot] || p.bag.length >= BAG_SIZE) return false; p.bag.push(h.gear[slot]); h.gear[slot] = null; return true }
export function salvage(p, id) {
  const i = p.bag.findIndex((it) => it.id === id); if (i < 0 || p.bag[i].starter) return 0;
  const v = salvageValue(p.bag[i]); p.crystals += v; p.bag.splice(i, 1); p.totals.salvaged++; return v;
}
/** Break down every piece in the bag the filters would drop. */
export function salvageFiltered(p) {
  let got = 0;
  p.bag = p.bag.filter((it) => { if (it.starter || (keeps(p, it.rarity) && !weaker(p, it))) return true; got += salvageValue(it); p.totals.salvaged++; return false });
  p.crystals += got; return got;
}
export function findItem(p, id) { const b = p.bag.find((it) => it.id === id); if (b) return b; for (const h of Object.values(p.heroes)) for (const it of Object.values(h.gear)) if (it?.id === id) return it; return null }
/** Refine +1 (gold and crystals): sure to +4, less and less after; a failure drops it one. "ok" | "fail" | null. */
export function refine(p, id, cls = p.current) {
  const it = findItem(p, id), h = p.heroes[cls]; if (!it || (it.refine ?? 0) >= REFINE_MAX) return null;
  const c = refineCost(it); if ((h.gold ?? 0) < c.gold || p.crystals < c.crystals) return null;
  h.gold -= c.gold; p.crystals -= c.crystals;
  const to = (it.refine ?? 0) + 1, roll = new Rng((p.seed++) * 2654435761).next();
  if (roll < refineChance(to)) { it.refine = to; return "ok" }
  it.refine = Math.max(0, (it.refine ?? 0) - 1); return "fail";
}

// ---------- passives ----------
export function buyPassive(p, cls, id) {
  const h = p.heroes[cls], ps = PASSIVE_TREE[cls]?.find((x) => x.id === id); if (!ps) return false;
  const l = h.passives[id] ?? 0; if (l >= ps.max) return false;
  const c = passiveCost(l); if (p.crystals < c) return false;
  p.crystals -= c; h.passives[id] = l + 1; return true;
}

// ---------- offline ----------
/** The hero's recent pace on its map: a moving average of experience, gold and kills a second. */
export function notePace(h, sec, xp, gold, kills) {
  if (sec <= 0) return;
  const r = h.rate ?? { xp: 0, gold: 0, kills: 0, sec: 0, map: h.map };
  if (r.map !== h.map) { r.xp = r.gold = r.kills = r.sec = 0; r.map = h.map }
  const keep = Math.max(0, 1 - sec / 300);
  r.xp = r.xp * keep + xp * (1 - keep) / sec; r.gold = r.gold * keep + gold * (1 - keep) / sec; r.kills = r.kills * keep + kills * (1 - keep) / sec; r.sec += sec;
  h.rate = r;
}
/**
 * What came in while the game was closed: up to 8 hours at 70% of the recent pace (none known: a cautious guess).
 * Gives it to the hero and the bag; returns { sec, xp, gold, kills, levels, items, salvaged, crystals } or null.
 */
export function offlineGains(p, now = Date.now()) {
  const sec = Math.min(BAL.offlineMax, Math.max(0, (now - (p.lastSeen ?? now)) / 1000));
  p.lastSeen = now;
  if (sec < 60) return null;
  const h = heroOf(p), r = h.rate && h.rate.sec >= 30 ? h.rate : guessPace(h), k = BAL.offline;
  const xp = Math.round(r.xp * sec * k), gold = Math.round(r.gold * sec * k), kills = Math.round(r.kills * sec * k);
  const out = { sec, xp, gold, kills, levels: 0, items: 0, salvaged: 0, crystals: 0 };
  h.gold = (h.gold ?? 0) + gold;
  h.xp = (h.xp ?? 0) + xp;
  while (h.level < MAX_LEVEL && h.xp >= xpToNext(h.level)) { h.xp -= xpToNext(h.level); h.level++; out.levels++; onLevel(h) }
  if (h.level >= MAX_LEVEL) h.xp = 0;
  const c0 = p.crystals, drops = Math.min(100, Math.round(kills * BAL.drop) + Math.floor(kills / 100));
  for (let i = 0; i < drops; i++) { const it = claimDrop(p, h.cls, mapOf(h.map).id, null); if (it.salvaged) out.salvaged++; else out.items++ }
  out.crystals = p.crystals - c0;
  p.totals.kills += kills;
  return out;
}
/** No pace known: a slow, safe guess from the map (half what a fight there would give). */
function guessPace(h) { const M = mapOf(h.map), lv = (M.lv[0] + M.lv[1]) / 2; return { xp: (6 * Math.pow(lv, 1.55) + 4) * BAL.monster.xp * 0.12, gold: (2 + lv * 1.2) * 0.12, kills: 0.12 } }
export { CLASS_IDS, SKILL_TREE, PASSIVE_TREE, passiveCost, itemPower, salvageValue, refineCost, refineChance, REFINE_MAX, LINES, GRADE, GRADES };
