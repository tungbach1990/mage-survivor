// The profile: everything that lasts between runs, its saving and loading, what a run starts with, and what a
// run earns. Shared: crystals, the bag, the account level, records, codex, achievements, quests. Per class
// (p.perClass[cls]): the talent tree, the marks unlocked, the three gear slots.
// Pure functions over a plain object, so Node tests drive it with an in-memory store.

import { Rng } from "../../lib/pixelfx/core/math.js?v=mwall5v2";
import { ELEMENTS, MARTIAL, MARKS, schoolOf, ELEM } from "../data/elements.js?v=mwall5v2";
import { SKILLS } from "../data/skills.js?v=mwall5v2";
import { CODEX } from "../data/reactions.js?v=mwall5v2";
import { CLASSES, CLASS_IDS, SIGNATURE, PLAYABLE } from "../data/classes.js?v=mwall5v2";
import { CLASS_PASSIVE, classPassiveCost, passiveWorth } from "../data/meta.js?v=mwall5v2";
import { TREE, LEGACY_TREES, legacyCost, TALENT_TREES, TALENTS, talentCost, START_MARKS, markCost, marksBought, markPool, homeSchool, crossSchool, ELEMENT_COST, mageXpNext, SLOTS, WEAPON_NAME, slotName, RARITY, AFFIXES, LEGENDARY, BAG_SIZE, ACHIEVEMENTS, QUESTS } from "../data/meta.js?v=mwall5v2";
import { DEFAULT_MODS } from "../sim/world.js?v=mwall5v2";
import { GRADE, GRADES, gradeOf, rollGrade, itemPower, baseOf, baseMul, elemsFor, ELEM_COUNT, maxElems, imbueChance, ENCHANT, refineCost, refineChance, REFINE_MAX } from "../data/loot.js?v=mwall5v2";
import { STARTER, WTYPES, wtypesOf } from "../data/weapons.js?v=mwall5v2";
import { ATTR, lineValue, lineText, applyLine, rollLines, elemsOfLines, martialOfLines, gearScore } from "../data/affix.js?v=mwall5v2";
import { STAT_IDS, STAT_MAX, statCost, pointsAt, spentOn, freshStats, totalsOf } from "../data/stats.js?v=mwall5v2";
import { PASSIVES, SIG_PASSIVE, passiveCost, applyPassives } from "../data/passives.js?v=mwall5v2";
import { SLOT_IDS, kindOf, kindsOf, lookOf } from "../data/gear.js?v=mwall5v2";
import { GEAR_SCALE } from "../data/meta.js?v=mwall5v2";

export const SAVE_KEY = "msd.save.v1";
export const VERSION = 4;
/** Every new player (and everyone at the wipe to v4) starts with this: enough for one draw of a mark. */
export const START_CRYSTALS = 499;

const freshGear = () => Object.fromEntries(SLOT_IDS.map((s) => [s, null]));
export const starterWeapon = (cls) => ({ id: `start_${cls}`, cls, slot: "weapon", wtype: STARTER[cls], variant: 0, rarity: "white", level: 1, chapter: 1, affixes: [], refine: 0, gen: 3, legendary: null, starter: true });
/** Does a mark open a skill of the class (its main mark, nothing else needed)? */
const opensSkill = (cls, m) => Object.values(SKILLS).some((s) => s.cls.includes(cls) && !s.basic && !s.fuse && s.elem === m && (s.req ?? [s.elem]).every((x) => x === m));
/** Two marks drawn from a class's school. */
export function drawStart(cls, seed) { const r = new Rng(seed * 7919 + 17), pool = markPool(cls).filter((m) => opensSkill(cls, m)), out = []; while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(r.next() * pool.length), 1)[0]); return out }
const freshClass = (cls, seed = null) => { const marks = seed == null ? [...START_MARKS[cls]] : drawStart(cls, seed); return { cls, talents: {}, passive: 0, stats: freshStats(), statResets: 0, passives: { [SIG_PASSIVE[cls]]: 1 }, marks, start: [...marks], gear: { ...freshGear(), weapon: starterWeapon(cls) }, starterGiven: true } };
export function freshProfile() {
  return {
    v: VERSION, crystals: START_CRYSTALS, mageXp: 0, mageLevel: 1,
    perClass: Object.fromEntries(CLASS_IDS.map((c) => [c, freshClass(c)])),
    bag: [], codex: [], counts: {}, achievements: [],
    quests: { day: null, list: [] }, best: { chapter: 0, endless: 0, byClass: {} },
    classes: ["mage", "swordman"], lastClass: "mage", chars: ["mage"], current: "mage", nextChar: 1,
    stats: { runs: 0, kills: 0, waves: 0, elites: 0, legendaries: 0, flawless: 0, maxAwakened: 0 },
    itemSeed: 1,
  };
}
/** An item from an older save: the staff slot is the weapon now, and an item belongs to a class. */
const fixItem = (it, cls = "mage") => (it ? { ...it, slot: it.slot === "staff" ? "weapon" : it.slot, cls: it.cls ?? cls } : null);
/** Bring an older save up to date (and fill anything missing). v1 (one tree, elements, gear) all goes to the Mage. */
export function migrate(data) {
  if (!data || (data.v ?? 0) < 4) { const f = freshProfile(); drawFirst(f, Date.now() + Math.floor(Math.random() * 1e6)); return f }
  const d = data ?? {}, p = { ...freshProfile(), ...d };
  p.stats = { ...freshProfile().stats, ...(d.stats ?? {}) };
  p.best = { ...freshProfile().best, ...(d.best ?? {}) };
  p.best.byClass = { ...(d.best?.byClass ?? {}) };
  p.classes = [...new Set(["mage", "swordman", ...(d.classes ?? [])])].filter((c) => CLASSES[c]);
  p.perClass = Object.fromEntries(CLASS_IDS.map((c) => {
    const o = d.perClass?.[c];
    return [c, o ? { cls: c, ...(o.name ? { name: o.name } : {}), start: o.start ?? [...START_MARKS[c]], talents: { ...o.talents }, passive: o.passive ?? 0, stats: { ...freshStats(), ...(o.stats ?? {}) }, statResets: o.statResets ?? 0, starterGiven: !!o.starterGiven, passives: { [SIG_PASSIVE[c]]: 1, ...(o.passives ?? {}) }, marks: [...new Set([...(o.start ?? START_MARKS[c]), ...(o.marks ?? [])])], gear: { ...freshGear(), ...Object.fromEntries(Object.entries(o.gear ?? {}).map(([k, v]) => [k === "staff" ? "weapon" : k, v])) } } : freshClass(c)];
  }));
  for (const [id, o] of Object.entries(d.perClass ?? {})) if (!CLASS_IDS.includes(id) && o && CLASSES[o.cls]) p.perClass[id] = { ...freshClass(o.cls), ...o, stats: { ...freshStats(), ...(o.stats ?? {}) }, gear: { ...freshGear(), ...(o.gear ?? {}) } };
  // the characters: an older save's open classes each one
  p.chars = (Array.isArray(d.chars) ? d.chars : p.classes).filter((id) => p.perClass[id]);
  if (!p.chars.length) p.chars = ["mage"];
  p.current = p.chars.includes(d.current) ? d.current : p.chars.includes(d.lastClass) ? d.lastClass : p.chars[0];
  p.nextChar = Math.max(d.nextChar ?? 1, 1);
  // the one playing must be of a class one can play (else the first that is; none: a new mage)
  if (!PLAYABLE.includes(clsOf(p, p.current))) { const ok = p.chars.find((id) => PLAYABLE.includes(clsOf(p, id))); if (ok) p.current = ok; else { p.chars.unshift("mage"); p.current = "mage" } }
  p.lastClass = clsOf(p, p.current);
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
  for (const [cl, c] of Object.entries(p.perClass)) if (!c.starterGiven) { c.starterGiven = true; const k = c.cls ?? cl; if (!c.gear.weapon) c.gear.weapon = starterWeapon(k); else if (p.bag.length < BAG_SIZE) p.bag.push(starterWeapon(k)) }
  p.bag.forEach(regrade); for (const c of Object.values(p.perClass)) Object.values(c.gear).forEach(regrade);
  delete p.talents; delete p.unlocked; delete p.gear;
  // the tree is eight nodes now: an older save's levels of those kept, the others paid back
  if ((d.v ?? 0) < 3) {
    const keep = new Set(TREE.map((t) => t.id));
    for (const c of Object.values(p.perClass)) {
      const old = LEGACY_TREES[c.cls ?? "mage"] ?? LEGACY_TREES.mage;
      for (const [id, l] of Object.entries(c.talents ?? {})) if (!keep.has(id)) { const t = old.find((x) => x.id === id); if (t) for (let k = 0; k < l; k++) p.crystals += legacyCost(t, k); delete c.talents[id] }
    }
  }
  // gear is gone from the game: what an older save had (worn or in the bag) is broken down into crystals, once
  if ((d.v ?? 0) < 3) {
    let got = 0, n = 0;
    for (const it of p.bag) if (it && !it.starter) { got += salvageValue(it); n++ }
    for (const c of Object.values(p.perClass)) for (const [s, it] of Object.entries(c.gear ?? {})) if (it && !it.starter) { got += salvageValue(it); n++; c.gear[s] = s === "weapon" ? starterWeapon(c.cls ?? "mage") : null }
    p.bag = [];
    if (n) { p.crystals += got; p.notice = `Trang bị đã bỏ khỏi game: ${n} món được phân rã thành ${got} 💎.` }
  }
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
/** A character's part. Given a class: the character playing if it's of that class, else the first of it. */
export const pc = (p, key) => {
  if (!CLASS_IDS.includes(key)) return p.perClass[key] ?? null;
  const cur = p.perClass[p.current];
  if (cur && (cur.cls ?? p.current) === key) return cur;
  const first = (p.chars ?? []).find((id) => (p.perClass[id]?.cls ?? id) === key);
  if (first) return p.perClass[first];
  return p.perClass[key] ?? (p.perClass[key] = freshClass(key));
};
export const clsOf = (p, id) => p.perClass[id]?.cls ?? id;
export const charName = (p, id) => p.perClass[id]?.name ?? CLASSES[clsOf(p, id)]?.name ?? id;
export const MAX_CHARS = 8;
/** The characters one can play now (of a playable class). */
export const playableChars = (p) => (p.chars ?? []).filter((id) => PLAYABLE.includes(clsOf(p, id)));
/** A new character of an open class: two marks drawn from its school. Returns its id, or null. */
export function createChar(p, cls, name = "", seed = Date.now()) {
  if (!PLAYABLE.includes(cls) || !classOpen(p, cls) || playableChars(p).length >= MAX_CHARS) return null;
  const id = `c${p.nextChar++}`;
  p.perClass[id] = { ...freshClass(cls, seed), name: name.trim().slice(0, 16) || `${CLASSES[cls].name} ${p.chars.filter((x) => clsOf(p, x) === cls).length + 1}` };
  p.chars.push(id); p.current = id; p.lastClass = cls;
  return id;
}
/** Delete a character (not the last): what it wore goes to the bag (as room allows). */
export function deleteChar(p, id) {
  if (!p.chars.includes(id) || playableChars(p).filter((x) => x !== id).length < 1) return false;
  const c = p.perClass[id];
  for (const it of Object.values(c?.gear ?? {})) if (it && !it.starter && p.bag.length < BAG_SIZE) p.bag.push(it);
  p.chars = p.chars.filter((x) => x !== id);
  delete p.perClass[id];
  if (p.current === id) { p.current = playableChars(p)[0]; p.lastClass = clsOf(p, p.current) }
  return true;
}
export function selectChar(p, id) { if (!p.chars.includes(id) || !PLAYABLE.includes(clsOf(p, id))) return false; p.current = id; p.lastClass = clsOf(p, id); return true }
/** A brand-new player's first character: its two marks drawn too. */
export function drawFirst(p, seed = Date.now()) { const c = p.perClass[p.current]; if (!c) return; c.marks = drawStart(clsOf(p, p.current), seed); c.start = [...c.marks] }
export const marksOpen = (p, cls) => pc(p, cls).marks;
export function profileMods(p, cls = p.lastClass ?? "mage") {
  const m = { ...DEFAULT_MODS(), elem: {}, imbue: {} }, c = pc(p, cls);
  for (const t of TALENT_TREES[cls]) { const l = c.talents[t.id] ?? 0; if (l) t.mod(m, l) }
  // the class's own passive (no gear: the tree and this are what's carried into a run)
  { const P0 = CLASS_PASSIVE[cls], l = c.passive ?? 0; if (P0 && l > 0) P0.apply(m, passiveWorth(l)) }
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
export function runOptions(p, { chapter = 1, endless = false, cls = clsOf(p, p.current) ?? p.lastClass ?? "mage" } = {}) {
  if (!classOpen(p, cls)) cls = "mage";
  // how new the player is with this class: 1 with an empty tree, 0 with all of it (the class's "novice" factor
  // fades with it)
  // (the class's novice factor no longer fades: the tree grows without end, so it is just the class's strength)
  const bought = 0, max = 1;
  return { cls, chapter, endless, mods: profileMods(p, cls), unlocked: marksOpen(p, cls), chaosUnlocked: chaosUnlocked(p, cls), codex: p.codex, basicLevel: basicLevel(p), novice: 1 - bought / max, look: {},
    acctLevel: p.mageLevel, acctXp: p.mageXp, weapon: { wtype: STARTER[cls], atk: 1 } };
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
/** Raise the class's own passive a level (500, 1000, 2000, ... crystals). */
export function buyClassPassive(p, cls) {
  const c = pc(p, cls), l = c.passive ?? 0, cost = classPassiveCost(l);
  if (!CLASS_PASSIVE[cls] || p.crystals < cost) return false;
  p.crystals -= cost; c.passive = l + 1; return true;
}
export function buyTalent(p, cls, id) {
  const t = TALENT_TREES[cls]?.find((x) => x.id === id), c = pc(p, cls), l = c.talents[id] ?? 0;
  if (!t || l >= t.max) return false;
  const cost = talentCost(t, l);
  if (p.crystals < cost) return false;
  p.crystals -= cost; c.talents[id] = l + 1;
  return true;
}
export const drawCost = (p, cls) => { const c = pc(p, cls); return markCost(cls, null, marksBought(cls, c.marks, c.start)) };
/** Draw a mark (gacha): one of the class's school it hasn't, for crystals. Returns the mark, or null. */
export function drawMark(p, cls) {
  const c = pc(p, cls), pool = markPool(cls).filter((m) => !c.marks.includes(m)), cost = drawCost(p, cls);
  if (!pool.length || p.crystals < cost) return null;
  p.crystals -= cost;
  const r = new Rng((p.markSeed = (p.markSeed ?? 1) + 1) * 2246822519 + 3);
  const mk = pool[Math.floor(r.next() * pool.length)];
  c.marks.push(mk);
  return mk;
}
export function unlockMark(p, cls, mark) {
  const c = pc(p, cls), cost = markCost(cls, mark, marksBought(cls, c.marks, c.start));
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
/** Today's challenge, the same for everyone (by the day in Vietnam): its seed, class, two marks, chapter. */
export function dailyOf(day = today(new Date(Date.now() + 7 * 3600 * 1000 - new Date().getTimezoneOffset() * -60000 * 0))) {
  let h = 0; for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cls = PLAYABLE[h % PLAYABLE.length], marks = drawStart(cls, h % 100000), chapter = 1 + (h >> 7) % 3;
  return { day, seed: h % 1000000007, cls, marks, chapter };
}
/** A daily run's options: no tree, the day's two marks. */
export function dailyOptions(p, d = dailyOf()) {
  const f = freshProfile(); f.classes = [...PLAYABLE]; f.perClass[d.cls].marks = [...d.marks]; f.current = d.cls;
  return { ...runOptions(f, { chapter: d.chapter, cls: d.cls }), daily: d.day };
}
/** Note a daily score: the day's best kept (a week of them); the first run of a day pays. Returns the reward. */
export function noteDaily(p, day, score) {
  const D = (p.daily ??= { best: {} }), first = !(day in D.best);
  D.best[day] = Math.max(D.best[day] ?? 0, score);
  const keep = Object.keys(D.best).sort().slice(-7); D.best = Object.fromEntries(keep.map((k) => [k, D.best[k]]));
  if (first) { p.crystals += 100; return 100 }
  return 0;
}
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
  const rows = runCrystals(sum);
  return rows.reduce((a, r) => a + r[1], 0);
}
/** A run's crystals, line by line: [what, how many] (the waves passed, the bosses, the score; a first clear in settle). */
export function runCrystals(sum) {
  const ch = sum.endless ? 5 : sum.chapter ?? 1, rows = [];
  if (sum.waves) rows.push(["Đợt đã qua", Math.round(6 * ch * sum.waves)]);
  if (sum.bosses) rows.push(["Boss", Math.round(20 * ch * sum.bosses)]);
  if (sum.score) rows.push(["Điểm combo", Math.floor(sum.score / 200)]);
  return rows;
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
  if (sum.won && !sum.endless) { if (sum.chapter > p.best.chapter) { const b = 150 * sum.chapter; p.crystals += b; out.crystals += b; out.firstClear = b } p.best.chapter = Math.max(p.best.chapter, sum.chapter); if (sum.wallLeft >= 0.999) p.stats.flawless++ }
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
  for (const g of [].slice(0)) {
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
