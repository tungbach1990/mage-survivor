// Combat: every hit goes through damage(). It scales the hit (weather, gear and talents, broken armor, judgment,
// instability), lands it, then the element meets the monster's auras:
//   - a new element on a monster that carries others sets off the PAIR reaction with its newest aura;
//   - the aura count reaching 3, 4, 5, 6 sets off a TIER (TRIAD / QUADRA / PENTA / HEXA; a named triad for
//     the ten special threes), each once while the auras last;
//   - 7 to 9 auras: UNSTABLE (it takes more); 10: CHAOS, a black hole.
// Damage dealt by a reaction sets nothing further off (no loops), but the auras reactions spread do, later.

import { ENEMIES } from "./enemies.js?v=mw8jyp5q";
import { ELEMENTS, MARKS, AURA, schoolOf } from "../data/elements.js?v=mw8jyp5q";
import { PAIRS, TIERS, UNSTABLE, CHAOS, pairKey, triadOf } from "../data/reactions.js?v=mw8jyp5q";
import { WEATHER, GROUND, stats } from "../data/skills.js?v=mw8jyp5q";
import { applyBurn, applySlow, applyFreeze, applyStun, applyPoison, applyRoot, applyFear, applyMud, applyDot } from "./status.js?v=mw8jyp5q";
import { WALL_X, center, alive, around, nearest, inBlast, inGround, groundsAt, waterBody, addGround, addWell, reaches, movable } from "./field.js?v=mw8jyp5q";
import { ENVS } from "../data/environments.js?v=mw8jyp5q";
import { T, reactT } from "../data/tuning.js?v=mw8jyp5q";
export const kin = (e, el) => e.element === el || e.element2 === el;
import { startBlackHole } from "./chaos.js?v=mw8jyp5q";

const IS_ELEM = new Set(MARKS);   // every mark: the ten elements and the ten martial ones
/** A physical blow: a martial mark, or "phys" (a martial combo's damage). */
export const isPhys = (elem) => elem === "phys" || schoolOf(elem) === "martial";
/** The marks this run's class works with (Chaos Seed sows them, the black hole leaves them). */
export const schoolMarks = (w) => w.schoolMarks ?? ELEMENTS;
import { rollGrade, crystalPerKill, CRYSTAL, GEAR_RATE, GEAR_BOSS_BONUS, GEAR_PER_RUN } from "../data/loot.js?v=mw8jyp5q";
import { acctGain } from "./world.js?v=mw8jyp5q";
import { SKILLS } from "../data/skills.js?v=mw8jyp5q";
export const OVERTIME = 120;
export const WALL_HEAL_PER_SEC = 0.04;
/** Mend the wall by n, within this second's budget (returns what it mended). */
export function healWall(w, n) {
  if (w.wall.hp <= 0) return 0;   // fallen: nothing raises it
  const sec = Math.floor(w.t);
  if (w.healSec !== sec) { w.healSec = sec; w.healLeft = w.wall.max * WALL_HEAL_PER_SEC }
  const k = Math.max(0, Math.min(n, w.healLeft, w.wall.max - w.wall.hp));
  w.healLeft -= k; w.wall.hp += k;
  return k;
}
/** How much of a blow that isn't a reaction wears a shield down. */
export const SHIELD_WEAR = { phys: 0.5, sundered: 0.75, magic: 0.55 };
/** A wave dragging on past OVERTIME: the monsters grow fiercer, more and more (no endless stalemates). */
export const fury = (w) => (w.waveT > OVERTIME ? 1 + (w.waveT - OVERTIME) / 40 : 1);
/** Regeneration pauses for 2.5 s after a hit, and stops in overtime. */
export const canRegen = (w, e) => w.t - (e.lastHit ?? -9) > 2.5 && !(w.waveT > OVERTIME);
const LIGHT = { slime: 1.6, wolf: 1.3, goblin: 1.1 };   // who flies further on a gust

/** The weather's multiplier on an element's damage. */
/** The weather's (the player's rain) and the environment's multiplier on an element's damage. */
export const elemMul = (w, elem) => (WEATHER[w.weather?.kind]?.mul?.[elem] ?? 1) * (ENVS[w.env]?.mul?.[elem] ?? 1) * (T.elements[elem] ?? 1);
const env = (w) => ENVS[w.env] ?? {};
/** Stun, longer under the Lightning Rain. */
export function stun(w, e, dur) { return applyStun(e, ENEMIES[e.type], dur * (w.weather?.kind === "thunder" ? WEATHER.thunder.stunMul : 1)) }

// ---------- auras ----------
/** Put an element's aura on a monster (refreshing it if it's there) and its effect, without any reaction. */
export function applyAura(w, e, elem, opts = {}) {
  if (!IS_ELEM.has(elem) || e.hp <= 0) return false;
  const def = ENEMIES[e.type], fresh = !e.auras.has(elem);
  if (def.markImmune?.includes(elem) || e.immune?.has(elem)) return false;
  e.auras.set(elem, AURA.dur * (w.mods?.auraDur ?? 1) * (env(w).aura ?? 1));
  const st = e.status, p = opts.power ?? 1;
  switch (elem) {
    case "fire": applyBurn(e, def, opts.burn ?? 3 * p); e.auras.delete("water"); break;
    case "ice": if (applySlow(e, def, !!opts.freezeAt3) && opts.onFreeze) opts.onFreeze(); break;
    case "volt": if (opts.stun) stun(w, e, opts.stun); break;
    case "water": st.wet = AURA.dur; break;
    case "earth": break;   // armor broken while the aura lasts (damage())
    case "wind": if (movable(e) && (e.state === "walk" || opts.push)) e.x += (opts.push ?? AURA.windPush) * (def.boss ? 0.2 : LIGHT[e.type] ?? 1); break;
    case "poison": applyPoison(e, def, opts.poison ?? 2 * p); break;
    case "light": st.judged = true; break;
    case "dark": if (fresh) e.fearT = AURA.curse.fearEvery; break;
    case "arcane":
      st.charge++;
      if (st.charge >= AURA.arcane.stacks && !opts.noBurst) {
        st.charge = 0;
        const amt = (opts.hit ?? 10) * AURA.arcane.ratio;
        for (const o of around(w, e.x, e.y, AURA.arcane.radius)) damage(w, o, amt, "arcane", { reaction: true });
        w.events.push({ type: "fx", fx: "ring", x: e.x, y: e.y, h: ENEMIES[e.type].cy, elem: "arcane", r: AURA.arcane.radius });
      }
      break;
    // ---- the martial marks
    case "bleed": applyDot(e, "bleed", (opts.bleed ?? AURA.bleed.dps * p) * (env(w).mul?.bleed ?? 1), opts.stacks ?? 1, AURA.bleed.maxStacks); break;
    case "daze": st.dazeHits = (st.dazeHits ?? 0) + 1; if (st.dazeHits >= AURA.daze.hits) { st.dazeHits = 0; stun(w, e, AURA.daze.stun) } break;
    case "pin": if ((e.pinAt ?? -99) + AURA.pin.every <= w.t) { e.pinAt = w.t; applyRoot(e, def, AURA.pin.root * (env(w).pinMul ?? 1)) } break;
    case "expose": st.exposed = Math.max(st.exposed ?? 0, 1); break;
    case "venom": applyDot(e, "venom", (opts.venom ?? AURA.venom.dps * p) * (env(w).mul?.venom ?? 1), opts.stacks ?? 1, env(w).venomCap ?? AURA.venom.maxStacks); break;
    // sunder, cripple, blind, disarm, bounty: they work while the mark lasts (damage(), world.js, onDeath)
  }
  return fresh;
}
export function removeAura(e, elem) { e.auras.delete(elem); if (elem === "water") e.status.wet = 0 }

/** Auras run out; when the count drops, the tiers above it can fire again. */
export function tickAuras(w, e, dt) {
  // the arcane kin hold auras half as long; the sun dries water off twice as fast
  for (const [el, t] of e.auras) { const r = t - dt * (kin(e, "arcane") ? 2 : 1) * (el === "water" ? env(w).dry ?? 1 : 1); if (r <= 0) removeAura(e, el); else e.auras.set(el, r) }
  for (const n of [...e.tiers]) if (n > e.auras.size) e.tiers.delete(n);
  if (e.auras.has("dark")) {   // cursed: now and then, afraid
    e.fearT = (e.fearT ?? AURA.curse.fearEvery) - dt;
    if (e.fearT <= 0) { e.fearT = AURA.curse.fearEvery; applyFear(e, ENEMIES[e.type], AURA.curse.fear) }
  }
}

// ---------- the hit ----------
/**
 * Hurt a monster. opts: { quiet (no number), reaction (dealt by a reaction: sets nothing off and leaves no
 * aura), raw (no scaling), noAura, and the element effect's strength: burn, poison, stun, freezeAt3, push,
 * power }. Returns { react } (the pair reaction it set off, or null).
 */
export function damage(w, e, amount, elem, opts = {}) {
  if (opts === true) opts = { quiet: true };
  if (e.hp <= 0 || amount <= 0) return { react: null };
  const def = ENEMIES[e.type], st = e.status, real = IS_ELEM.has(elem) && !opts.reaction;
  // what this hit sets off: the new element against the newest aura it carries
  // (a combo only between two marks of the same school: two elements, or two martial marks)
  // lockMark: the hit's own mark isn't the class's yet: it lands, but leaves no mark (its extra marks still do)
  const fresh = real && !opts.noAura && !opts.lockMark && !e.auras.has(elem) && !def.markImmune?.includes(elem);
  const phys = isPhys(elem), school = schoolOf(elem);
  let pair = null;
  if (fresh && e.auras.size) {
    let newest = null;
    for (const k of e.auras.keys()) if (schoolOf(k) === school) newest = k;
    pair = newest ? PAIRS[pairKey(elem, newest)] ?? null : null;
    if (pair && ((e.reactCd?.[pair.id] ?? 0) > w.t || reactT(pair.id).off)) pair = null;
  }
  // the hit's size
  if (!opts.raw) {
    amount *= elemMul(w, elem) * (w.mods?.dmg ?? 1) * (w.mods?.elem?.[elem] ?? 1) * (w.pm?.dmg ?? 1);
    if (opts.reaction || elem === "tier") amount *= (w.mods?.reactDmg ?? 1) * (env(w).react ?? 1);
    if (elem === "tier") amount *= w.mods?.tierDmg ?? 1;
  }
  if (e.auras.has("earth")) amount *= AURA.earthTaken;
  if (phys) amount *= (e.phys ?? 1) * (e.auras.has("sunder") ? AURA.sunder + (w.mods?.sunder ?? 0) : 1);
  if (st.brittle > 0) amount *= 1.4;
  if (e.auras.size > 6) amount *= 1 + AURA.unstable * (e.auras.size - 6);
  if (st.judged && real) { amount *= AURA.judged; st.judged = false; e.judgedHit = true }
  if (pair) amount *= pair.mul;
  if (e.resist?.[elem] !== undefined) amount *= e.resist[elem];
  if (e.elite === "armored" && !opts.reaction && elem !== "tier") amount *= 0.5;
  e.lastHit = w.t;
  // the passives: farther is harder hit (Hawkeye), on those at the wall, on the big ones, on the unholy, twice
  if (real && !opts.reaction) {
    const M = w.mods ?? {};
    if (M.farDmg) amount *= 1 + M.farDmg * Math.max(0, Math.min(1, (e.x - WALL_X) / 250));
    if (M.vsAttack && e.state === "attack") amount *= 1 + M.vsAttack;
    if (M.vsBig && (e.elite || def.boss)) amount *= 1 + M.vsBig;
    if (M.vsUnholy && (kin(e, "dark") || e.type === "skeleton" || e.type === "archer")) amount *= 1 + M.vsUnholy;
    if (M.doubleHit && w.rng.chance(M.doubleHit)) { amount *= 2; opts = { ...opts, crit: true } }
  }
  if (real && phys && st.exposed > 0) { st.exposed--; amount *= (env(w).exposeCrit ?? 1.5) + (w.mods?.critMul ?? 0); opts = { ...opts, crit: true } }   // exposed: this blow is a sure crit
  else if (real && ((w.mods?.crit ?? 0) + (w.derived && SKILLS[w.src]?.basic ? w.derived.crit : 0)) > 0 && w.rng.chance((w.mods?.crit ?? 0) + (w.derived && SKILLS[w.src]?.basic ? w.derived.crit : 0))) { amount *= 1.5 + (w.mods?.critMul ?? 0); opts = { ...opts, crit: true } }
  // a shield (an elite's, a boss's): reactions (or tiers) break it outright; any other blow wears it down a
  // little, a physical one more (it's force against a barrier), more still on a sundered monster. Nothing
  // reaches the body while the shield stands.
  if (e.shield > 0) {
    const breaks = e.shieldBy === "tier" ? elem === "tier" || elem === "chaos" : opts.reaction || elem === "tier" || elem === "chaos";
    let s;
    if (breaks) { s = Math.min(e.shield, amount); amount -= s }
    else {
      const wear = phys ? (e.auras.has("sunder") ? SHIELD_WEAR.sundered : SHIELD_WEAR.phys) : SHIELD_WEAR.magic;
      s = Math.min(e.shield, amount * wear);
      amount = 0;
      w.events.push({ type: "shieldHit", id: e.id, x: e.x, y: e.y });
    }
    e.shield -= s;
    if (e.shield <= 0) w.events.push({ type: "shieldBreak", id: e.id, x: e.x, y: e.y });
  }

  // where the damage came from (for balancing): direct hits, pair combos, tiers, black holes, damage over time
  const cat = elem === "chaos" ? "chaos" : w.curTier ? `t${w.curTier}` : elem === "tier" ? "t5later" : opts.reaction ? (opts.quiet ? "dot" : "reaction") : "direct";
  const dealt = Math.max(0, Math.min(amount, e.hp));
  (w.dmgBy ??= {})[cat] = (w.dmgBy[cat] ?? 0) + dealt;
  const src = cat === "chaos" ? "@chaos" : cat === "dot" ? "@dot" : w.curReact && cat !== "direct" ? `#${w.curReact}` : cat === "t5later" ? "#penta" : w.src ?? "@other";
  if (dealt > 0) (w.dmgSrc ??= {})[src] = (w.dmgSrc[src] ?? 0) + dealt;
  e.hp -= amount;
  e.flash = 0.12;
  w.dealt += amount;
  const [cx, cy] = center(e);
  if (!opts.quiet && amount >= 1) w.events.push({ type: "dmg", x: cx, y: cy, h: def.cy, amount: Math.round(amount), elem: IS_ELEM.has(elem) ? elem : elem === "tier" ? "arcane" : elem === "phys" ? "sunder" : elem, crit: !!opts.crit, plain: !!opts.plain });

  // the element's aura and effect (also on the killing blow, so a death can still spread it)
  if (real && !opts.noAura && !opts.lockMark) applyAura(w, e, elem, { ...opts, hit: amount });
  // a blow can carry more marks than its own (a Bash: daze and sunder; an imbued blade): those count for tiers
  let more = false;
  if (real && !opts.noAura && e.hp > 0) for (const m of opts.also ?? []) if (!e.auras.has(m) && applyAura(w, e, m, { ...opts, hit: amount })) more = true;
  // Chaos Seed: now and then a hit sows two of the auras it still lacks
  let seeded = false;
  const seed = w.skills?.chaosseed;
  if (seed && real && e.hp > 0 && w.rng.chance(stats("chaosseed", seed.level).chance)) {
    const missing = schoolMarks(w).filter((el) => !e.auras.has(el));
    for (let i = 0; i < 2 && missing.length; i++) applyAura(w, e, missing.splice(Math.floor(w.rng.next() * missing.length), 1)[0], { noBurst: true });
    seeded = true;
    w.events.push({ type: "fx", fx: "seed", x: cx, y: cy, elem: "chaos" });
  }
  if (e.hp <= 0) onDeath(w, e);
  if (pair) react(w, e, pair, amount, [elem]);
  if ((fresh || seeded || more) && e.hp > 0) tiers(w, e, amount);
  return { react: pair?.id ?? null };
}

/** What it leaves: its experience, now and then crystals, and a boss of wave 5, 8 or 10 perhaps a piece of gear. */
function dropLoot(w, e, xp) {
  const def = ENEMIES[e.type], ch = w.endless ? Math.min(5, 1 + Math.floor(w.wave / 10)) : w.chapter;
  const at = (kind, v, extra = {}) => { (w.loot ??= []).push({ id: w.nextId++, kind, v, x: e.x + w.rng.range(-4, 4), y: e.y + w.rng.range(-4, 4), t: 0, ...extra }); w.events.push({ type: "drop", kind, x: e.x, y: e.y, grade: extra.grade }) };
  at("xp", xp);
  const per = crystalPerKill(ch);
  if (def.boss) at("crystal", per * CRYSTAL.boss);
  else if (e.elite) at("crystal", per * CRYSTAL.elite);
  else if (w.rng.chance(CRYSTAL.chance)) at("crystal", per / CRYSTAL.chance);
  // gear: a chance from every monster, more from elites, most from bosses; a few a run at most
  const big = def.boss || e.boss, rate = (big ? GEAR_RATE.boss : e.elite ? GEAR_RATE.elite : GEAR_RATE.normal) * (1 + 0.15 * (w.mods?.luck ?? 0));
  if ((w.run.gearDrops ?? 0) < GEAR_PER_RUN && w.rng.chance(rate)) {
    w.run.gearDrops = (w.run.gearDrops ?? 0) + 1;
    at("gear", 1, { grade: rollGrade(() => w.rng.next(), (big ? GEAR_BOSS_BONUS : 0) + 0.15 * (w.mods?.luck ?? 0)), level: ch });
  }
}
function onDeath(w, e) {
  const def = ENEMIES[e.type];
  // a bounty on its head (or caught alive): twice the gold and the xp
  const bounty = e.auras.has("bounty") || e.status.capture ? env(w).bounty ?? AURA.bounty : 1;
  w.gold += (def.gold * bounty + (w.mods?.killGold ?? 0)) * (w.pm?.gold ?? 1); w.kills++;
  acctGain(w, 1);
  dropLoot(w, e, (def.xp ?? 1) * (e.elite ? 3 : 1) * (w.mods?.xp ?? 1) * bounty);
  if (e.judgedHit && e.status.judged === false && e.auras.has("light")) healWall(w, 1);
  // poison and plague spread from the dead
  const p = e.status.poison;
  if (p.stacks || e.plague) {
    const next = nearest(w, e.x, e.y, e.plague ? 3 : 1, new Set([e]));
    for (const o of next) { applyPoison(o, ENEMIES[o.type], Math.max(2, p.dps), 2); if (e.plague) applyAura(w, o, "dark") }
    if (e.plague) { for (const o of around(w, e.x, e.y, 16, e)) damage(w, o, e.max * 0.15, "poison", { reaction: true }); w.events.push({ type: "fx", fx: "blast", x: e.x, y: e.y - 6, elem: "poison", r: 16 }) }
  }
  // the elemental kin leave something behind
  if (kin(e, "fire")) addGround(w, "lava", e.x, e.y, 9, 3);
  if (kin(e, "poison")) addGround(w, "miasma", e.x, e.y, 14, 3);
  w.events.push({ type: "death", id: e.id, x: e.x, y: e.y, kind: e.type, boss: !!def.boss, elite: e.elite, element: e.element });
  w.onKill?.(e);
}

// ---------- reactions ----------
function count(w, kind, elems) {
  w.seen.add(kind);
  if (!w.codex.has(kind)) { w.codex.add(kind); w.events.push({ type: "discover", kind }) }
  w.counts[kind] = (w.counts[kind] ?? 0) + 1;
  for (const el of elems) w.elemReacts[el] = (w.elemReacts[el] ?? 0) + 1;
}
function react(w, e, pair, H, _) {
  (e.reactCd ??= {})[pair.id] = w.t + 0.5;
  const [x, y] = [e.x, e.y];
  H *= (reactT(pair.id).dmg ?? 1) * (T.combo?.pair ?? 1);
  count(w, pair.id, pair.elems);
  w.events.push({ type: "reaction", kind: pair.id, x, y, h: ENEMIES[e.type].cy, elems: pair.elems });
  const was = w.curReact; w.curReact = pair.id;
  pair.fx({ A: api(w), e, x, y, H, w });
  w.curReact = was;
}
function tiers(w, e, H) {
  const n = e.auras.size;
  if (n >= 3 && n <= 6 && !e.tiers.has(n)) {
    const tier = TIERS[n], key = `tier${n}`;
    if ((w.cds[key] ?? 0) > w.t) return;
    w.cds[key] = w.t + tier.cd;
    e.tiers.add(n);
    const named = n === 3 ? triadOf([...e.auras.keys()]) : null, r = named ?? tier, elems = [...e.auras.keys()];
    if (reactT(r.id).off) return;
    H *= (reactT(r.id).dmg ?? 1) * (T.combo?.tier ?? 1) * (T.combo?.[`t${n}`] ?? 1);
    count(w, r.id, elems);
    w.events.push({ type: "reaction", kind: r.id, x: e.x, y: e.y, h: ENEMIES[e.type].cy, elems, tier: n });
    const ctx = { A: api(w), e, x: e.x, y: e.y, H, w };
    w.curTier = n; w.curReact = r.id;
    if (named) { for (const o of around(w, e.x, e.y, 18)) damage(w, o, H, "tier", { reaction: true }); named.fx(ctx) }
    else tier.fx(ctx);
    w.curTier = 0; w.curReact = null;
  } else if (n >= 7 && n < (w.chaosAt ?? 10) && !e.tiers.has(7)) {
    e.tiers.add(7);
    count(w, UNSTABLE.id, []);
    w.events.push({ type: "reaction", kind: UNSTABLE.id, x: e.x, y: e.y, h: ENEMIES[e.type].cy, elems: [...e.auras.keys()] });
  } else if (n >= (w.chaosAt ?? 10) && !e.tiers.has(10) && !((e.noChaosUntil ?? 0) > w.t)) {
    if (reactT("chaos").off) return;
    // the first black hole of a wave comes easily, each one after it takes longer (reset each wave)
    const cd = (w.skills?.chaosseed ? 18 : 25) * (1 + (w.chaosThisWave ?? 0)) * (w.chaosCd ?? 1);
    if ((w.cds.chaos ?? 0) > w.t) return;
    w.cds.chaos = w.t + cd;
    w.chaosThisWave = (w.chaosThisWave ?? 0) + 1;
    e.tiers.add(10);
    count(w, CHAOS.id, schoolMarks(w));
    w.events.push({ type: "reaction", kind: CHAOS.id, x: e.x, y: e.y, h: ENEMIES[e.type].cy, elems: ELEMENTS });
    startBlackHole(w, e.x, e.y);
  }
}

// ---------- the ground meets the elements ----------
/** Lightning in water: everyone standing in the body of water or soaked near it takes half and a short stun. */
export function shock(w, e, H) {
  const water = groundsAt(w, e.x, e.y, "water"), group = water.length ? waterBody(w, water) : new Set();
  const victims = alive(w).filter((o) => o !== e && ([...group].some((g) => inGround(g, o.x, o.y)) || (o.auras.has("water") && inBlast(o, e.x, e.y, 40))));
  for (const g of group) { g.shockCd = GROUND.shockCd; g.shockT = 0.25 }
  for (const o of victims) { damage(w, o, Math.round(H * GROUND.shockRatio), "volt", { reaction: true }); if (o.hp > 0) stun(w, o, GROUND.shockStun) }
  w.events.push({ type: "puddleShock", from: center(e), pts: victims.map(center), ids: victims.map((o) => o.id) });
}
/** A bolt from the sky into water runs through all of it (CONDUCT). */
export function conduct(w, x, y, H, skip) {
  const water = groundsAt(w, x, y, "water");
  if (!water.length || !water.some((g) => g.shockCd <= 0)) return 0;
  const group = waterBody(w, water);
  const victims = alive(w).filter((o) => !skip.has(o) && [...group].some((g) => inGround(g, o.x, o.y)));
  for (const g of group) { g.shockCd = GROUND.shockCd; g.shockT = 0.25 }
  for (const o of victims) { damage(w, o, Math.round(H * GROUND.shockRatio), "volt", { reaction: true }); if (o.hp > 0) stun(w, o, GROUND.shockStun) }
  count(w, "conduct", ["volt", "water"]);
  w.events.push({ type: "reaction", kind: "conduct", x, y, elems: ["volt", "water"] });
  w.events.push({ type: "puddleShock", from: [x, y], pts: victims.map(center), ids: victims.map((o) => o.id) });
  return victims.length;
}
/** Fire or lava reaching water boils it off into steam, scalding whoever stood in it. */
export function steamAt(w, x, y, r) {
  const hit = w.grounds.filter((g) => g.kind === "water" && reaches(g, x, y, r));
  for (const g of hit) {
    for (const o of alive(w)) if (inGround(g, o.x, o.y)) damage(w, o, GROUND.steamBurst * (w.mods?.dmg ?? 1), "steam", { reaction: true });
    Object.assign(g, { kind: "steam", life: GROUND.steamLife, max: GROUND.steamLife, rx: g.rx * 1.15, ry: g.ry * 1.15 });
    count(w, "steam", ["fire", "water"]);
    w.events.push({ type: "reaction", kind: "steam", x: g.x, y: g.y - 6, elems: ["fire", "water"] });
  }
  return hit.length;
}
/** Ice reaching lava sets it into obsidian, hurting and stunning whoever stood in it. */
export function obsidianAt(w, x, y, r) {
  const hit = w.grounds.filter((g) => g.kind === "lava" && reaches(g, x, y, r));
  for (const g of hit) {
    for (const o of alive(w)) if (inGround(g, o.x, o.y)) { damage(w, o, 40 * (w.mods?.dmg ?? 1), "earth", { reaction: true }); if (o.hp > 0) stun(w, o, 0.8) }
    w.events.push({ type: "reaction", kind: "obsidian", x: g.x, y: g.y - 6, elems: ["ice", "earth"] });
    w.events.push({ type: "obsidian", x: g.x, y: g.y, rx: g.rx });
  }
  w.grounds = w.grounds.filter((g) => !hit.includes(g));
  return hit.length;
}

// ---------- what reactions can do ----------
function api(w) {
  if (w._api) return w._api;
  const A = {
    area: (x, y, r, skip) => around(w, x, y, r, skip),
    nearest: (x, y, n, skip) => nearest(w, x, y, n, new Set(skip ? [skip] : [])),
    strongest: (n, skip) => alive(w).filter((o) => o !== skip).sort((a, b) => b.hp - a.hp).slice(0, n),
    dmg: (o, amount, elem) => damage(w, o, amount, elem, { reaction: true }),
    // a reaction spreads only marks the class has (an elemental monster's own mark aside)
    aura: (o, elem) => (!w.unlocked || w.unlocked.has(elem) ? applyAura(w, o, elem, { noBurst: false }) : false),
    removeAura: (o, elem) => removeAura(o, elem),
    stun: (o, d) => stun(w, o, d),
    freeze: (o, d, force) => applyFreeze(o, ENEMIES[o.type], d, force),
    chill: (o) => applySlow(o, ENEMIES[o.type]),
    root: (o, d) => applyRoot(o, ENEMIES[o.type], d),
    fear: (o, d) => applyFear(o, ENEMIES[o.type], d),
    mud: (o, k, d) => applyMud(o, k, d),
    burn: (o, dps) => applyBurn(o, ENEMIES[o.type], dps * (w.mods?.dmg ?? 1)),
    poison: (o, stacks) => applyPoison(o, ENEMIES[o.type], 2 * (w.mods?.dmg ?? 1), stacks),
    bleed: (o, stacks) => { if (!ENEMIES[o.type].markImmune?.includes("bleed")) applyDot(o, "bleed", AURA.bleed.dps * (w.mods?.dmg ?? 1), stacks, AURA.bleed.maxStacks) },
    venom: (o, stacks) => applyDot(o, "venom", AURA.venom.dps * (w.mods?.dmg ?? 1), stacks, AURA.venom.maxStacks),
    gold: (n) => { w.gold += n * (w.pm?.gold ?? 1); w.events.push({ type: "gold", n: Math.round(n) }) },
    xp: (n) => { w.xp = (w.xp ?? 0) + n },
    isBoss: (o) => !!ENEMIES[o.type].boss,
    push: (o, dx) => { if (o.hp > 0 && movable(o)) o.x += dx * (ENEMIES[o.type].boss ? 0.2 : 1) },
    pull: (x, y, r, px) => { for (const o of around(w, x, y, r).filter(movable)) { const d = Math.hypot(x - o.x, y - o.y) || 1, k = Math.min(px, d) * (ENEMIES[o.type].boss ? 0.3 : 1); o.x += ((x - o.x) / d) * k; o.y += ((y - o.y) / d) * k } },
    ground: (kind, x, y, r, life) => { if (kind === "lava" && w.grounds.some((g) => g.kind === "water" && reaches(g, x, y, r))) return steamAt(w, x, y, r); addGround(w, kind, x, y, r, life) },
    well: (x, y, r, k, t) => { addWell(w, x, y, r, k, t); w.events.push({ type: "fx", fx: "well", x, y, r, t, elem: "arcane" }) },
    heal: (n) => healWall(w, n),
    cdr: (s) => { if ((w.cds.flow ?? 0) > w.t) return; w.cds.flow = w.t + 2; for (const k of Object.values(w.skills)) k.cd = Math.max(0, k.cd - s) },
    cooldown: (key, s) => { if ((w.cds[key] ?? 0) > w.t) return false; w.cds[key] = w.t + s; return true },
    later: (t, fn) => w.timers.push({ t, fn }),
    rand: (a, b) => w.rng.range(a, b),
    shock: (e, H) => shock(w, e, H),
    chain: (e, n, jump, amount, elem) => {
      const hit = new Set([e]); let last = e;
      for (let i = 0; i < n; i++) {
        const next = alive(w).filter((o) => !hit.has(o) && Math.hypot(o.x - last.x, o.y - last.y) <= jump).sort((a, b) => Math.hypot(a.x - last.x, a.y - last.y) - Math.hypot(b.x - last.x, b.y - last.y))[0];
        if (!next) break;
        w.events.push({ type: "chain", pts: [center(last), center(next)], ids: [next.id], elem });
        hit.add(next); damage(w, next, amount, elem, { reaction: true }); last = next;
      }
    },
    ray: (x, y, dx, dy, len, width, fn, elem) => {
      const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      for (const o of alive(w)) {
        const [ox, oy] = center(o), t = (ox - x) * ux + (oy - y) * uy;
        if (t < 0 || t > len) continue;
        if (Math.abs((oy - y) * ux - (ox - x) * uy) <= width + ENEMIES[o.type].r * 0.5) fn(o);
      }
      w.events.push({ type: "fx", fx: "ray", x, y, x2: x + ux * len, y2: y + uy * len, elem });
    },
    beam: (x, y, o, elem) => w.events.push({ type: "fx", fx: "beam", x, y: y - 6, x2: center(o)[0], y2: center(o)[1], elem }),
    fx: (fx, x, y, elem, r) => w.events.push({ type: "fx", fx, x, y: y - 6, elem, r }),
  };
  w._api = A;
  return A;
}

export { api as reactionApi };
