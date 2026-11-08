// The game's state and its fixed-step update. No drawing here: the world pushes `events` (casts, hits,
// reactions, deaths, waves) that the renderer turns into pixelfx effects; the renderer reads `grounds`, `drops`,
// `weather`, `wells` and `blackholes` straight from the state.
//
// A run: one chapter of ten waves (or Endless). The mage levels up from kills (a card each level) and picks a
// card after each wave. Elements awaken as their reactions add up; with all ten awake, Chaos does.

import { Rng } from "../../lib/pixelfx/core/math.js?v=mw7j8yv5";
import { ENEMIES, SPAWN_X } from "./enemies.js?v=mw7j8yv5";
import { SKILLS, WEATHER, GROUND, stats, SKILLS_OF } from "../data/skills.js?v=mw7j8yv5";
import { ELEMENTS, MARKS, AURA } from "../data/elements.js?v=mw7j8yv5";
import { CHAPTERS, ENDLESS, ELITE_KINDS } from "../data/chapters.js?v=mw7j8yv5";
import { ENVS, ENV_POOL } from "../data/environments.js?v=mw7j8yv5";
import { ELEMENTAL, RESIST, WEAK, kinElems, kinWeak } from "../data/bestiary.js?v=mw7j8yv5";
import { T, typeT } from "../data/tuning.js?v=mw7j8yv5";
import { freshStatus, applyBurn, applyPoison, applyMud, speedFactor, slowFactor, isHeld, tickStatus } from "./status.js?v=mw7j8yv5";
import { WAVES, HP_GROWTH, DMG_GROWTH, spawnList, endlessList } from "./waves.js?v=mw7j8yv5";
import { drawCards, applyCard, refreshPassives } from "./upgrades.js?v=mw7j8yv5";
import { CLASSES, marksOf } from "../data/classes.js?v=mw7j8yv5";
import { W, H, WALL_X, GEM, MAGE_FEET, LANE, center, alive, inView, inBlast, around, addGround, inGround, GROUNDS, movable } from "./field.js?v=mw7j8yv5";
import { damage, applyAura, tickAuras, steamAt, obsidianAt, conduct, stun, elemMul, kin, canRegen, fury, healWall } from "./combat.js?v=mw7j8yv5";
import { cast, updateShots, updateZones, nova, skillStats } from "./skills-runtime.js?v=mw7j8yv5";
import { summon, updateMinions, blockerFor, hitMinion } from "./summons.js?v=mw7j8yv5";
import { updateBlackHoles } from "./chaos.js?v=mw7j8yv5";

export { W, H, WALL_X, GEM, MAGE_FEET, damage, addGround, steamAt, obsidianAt, applyAura };
export const addPuddle = (w, x, y, rx, src, life) => addGround(w, "water", x, y, rx, life, src);

export const DEFAULT_MODS = () => ({ dmg: 1, cd: 1, area: 1, auraDur: 1, reactDmg: 1, tierDmg: 1, crit: 0, focus: 0, bhRadius: 1, elem: {}, slots: 0, choices: 0, xp: 1, regen: 0, thorns: 0, wallMax: 0,
  // the class trees' signature numbers
  meleeDmg: 1, reach: 0, pierce: 0, boltCd: 1, zoneLife: 1, dotDmg: 1, critMul: 0, gold: 1, goldCost: 1, push: 1, healMul: 1, wallTaken: 1, dodge: 0, weatherDur: 1, sunder: 0, summonHp: 1, imbue: {}, imbueMul: 1 });

/**
 * A new run. opts: { cls (the class: mage, swordman, archer, thief, acolyte, merchant), chapter (1-5), endless,
 * mods (from the profile), basicLevel, skills (to start with instead of the class's basic attack: { id: level }),
 * unlocked (elements, for a Mage), chaosUnlocked, codex (reactions already discovered) }.
 */
export function createWorld(seed = 1, opts = {}) {
  const mods = { ...DEFAULT_MODS(), ...(opts.mods ?? {}) };
  mods.elem = { ...(opts.mods?.elem ?? {}) }; mods.imbue = { ...(opts.mods?.imbue ?? {}) };
  const wallMax = 150 + mods.wallMax;
  const cls = CLASSES[opts.cls] ? opts.cls : "mage";
  const start = opts.skills ?? { [`basic_${cls}`]: opts.basicLevel ?? 1 };
  const w = {
    t: 0, rng: new Rng(seed), nextId: 1, seed, cls, look: opts.look ?? {}, schoolMarks: marksOf(cls), chaosAt: CLASSES[cls].chaosAt ?? 10, chaosCd: CLASSES[cls].chaosCd ?? 1, chaosPow: CLASSES[cls].chaosPow ?? 1, novice: opts.novice ?? 0, imbue: new Set(), pm: { dmg: 1, wallTaken: 1, gold: 1 },
    chapter: opts.endless ? ENDLESS.base : opts.chapter ?? 1, endless: !!opts.endless,
    mods, unlocked: new Set(opts.unlocked ?? MARKS), chaosUnlocked: opts.chaosUnlocked ?? true,
    wall: { hp: wallMax, max: wallMax },
    gold: 0, kills: 0, dealt: 0, xp: 0, level: 1, levelsDue: (mods.startCards ?? 0) + (opts.endless ? 4 : (opts.chapter ?? 1) - 1),   // later chapters start a few cards ahead
    wave: 0, waveT: 0, spawns: [], phase: "rest", restT: 1.5, cardReason: null,
    cards: null,
    enemies: [], shots: [], zones: [], wells: [], timers: [], blackholes: [], minions: [],
    skills: Object.fromEntries(Object.entries(start).map(([id, l], i) => [id, { level: l, cd: 0.6 + i * 0.3 }])),
    weather: { kind: null, t: 0, st: null, tick: 0, gap: 0 },
    grounds: [], drops: [],
    codex: new Set(opts.codex ?? []), seen: new Set(), counts: {}, elemReacts: {},
    awakened: new Set(), mastery: new Set(), chaosAwake: false,
    cds: {}, hazardT: 6, env: "clear", envT: 0, sight: null,
    run: { waves: 0, bosses: 0, elites: 0, discovered: [] },
    mage: { pose: "idle", t: 0 },
    hitstop: 0,
    events: [],
  };
  refreshPassives(w);
  return w;
}

export const raining = (w) => w.weather.kind === "rain";
export const chapterOf = (w) => CHAPTERS[Math.min(5, w.chapter) - 1];
export const totalWaves = (w) => (w.endless ? Infinity : WAVES.length);
export const AWAKEN = 6;   // reactions an element needs in a run to awaken
export const xpNext = (level) => Math.round(8 * Math.pow(1.3, level - 1));

// ---------- monsters ----------
export function spawn(w, type, x, y, opts = {}) {
  const def = ENEMIES[type], ch = chapterOf(w);
  const waveMul = w.endless ? Math.pow(ENDLESS.hpPerWave, w.wave) : Math.pow(HP_GROWTH, w.wave);
  const tt = typeT(type);
  const hp = def.hp * ch.hp * waveMul * (opts.hp ?? 1) * T.monster.hp * (tt.hp ?? 1) * (def.boss ? T.boss.hp * (ch.boss.hpMul ?? 1) : 1);
  // what this kind resists, the chapter's on top, and the admin's word last
  const resist = { ...(def.resist ?? {}) };
  for (const [el, k] of Object.entries(ch.resist ?? {})) resist[el] = (resist[el] ?? 1) * k;
  Object.assign(resist, tt.resist ?? {});
  const e = {
    id: w.nextId++, type, x, y, hp, max: hp, state: "walk", atkT: 0, walkT: w.rng.next(), status: freshStatus(), flash: 0,
    small: opts.scale === "small", auras: new Map(), tiers: new Set(), resist, speedMul: T.monster.speed * (tt.speed ?? 1), dmgMul: ch.dmg * (w.endless ? 1 : Math.pow(DMG_GROWTH, w.wave)) * T.monster.dmg * (tt.dmg ?? 1) * (def.boss ? T.boss.dmg * (ch.boss?.dmgMul ?? 1) : 1),
    immune: def.fly ? new Set(["root", "mud"]) : null, phys: tt.phys ?? def.phys ?? 1,
    tenacity: def.boss ? { mul: T.boss.ccMul, max: T.boss.poise, time: T.boss.unstop, slowFloor: T.boss.slowFloor, poise: 0, unstop: 0 } : null,
    lavaT: 0, groundT: 0, boss: opts.boss ?? null, bossPhase: 1, shield: 0, elite: null, swap: ch.swap ?? null,
  };
  // some come as elemental kin: tougher, resisting their element, weak to its foe
  if (!def.boss && opts.elite !== false && opts.element !== false && ch.elemPool?.length) {
    const chance = (ch.elemChance + (w.endless ? 0.01 * w.wave : 0)) * T.monster.kin;
    if (opts.element || w.rng.chance(chance)) makeElemental(w, e, opts.element ?? w.rng.pick(ch.elemPool));
  }
  if (!def.boss && opts.elite !== false) {
    const chance = (ch.elite + (w.endless ? ENDLESS.elitePerWave * w.wave : 0)) * T.monster.elite;
    if (w.rng.chance(chance)) makeElite(w, e, w.rng.pick(ELITE_KINDS));
  }
  w.enemies.push(e);
  if (e.boss) w.events.push({ type: "boss", id: e.id, name: ch.boss.name, kind: e.boss });
  return e;
}
/** Make it elemental kin: `key` one element ("fire") or two ("fire+earth"). */
export function makeElemental(w, e, key) {
  const els = kinElems(key);
  e.element = els[0]; e.element2 = els[1] ?? null; e.swap = els[0]; e.kinKey = key;
  e.hp = e.max = e.max * (els.length > 1 ? 1.5 : 1.3);
  for (const el of els) e.resist[el] = Math.min(e.resist[el] ?? 1, RESIST);
  for (const wk of kinWeak(key)) e.resist[wk] = (e.resist[wk] ?? 1) * WEAK;
  e.immune = new Set([...(e.immune ?? []), ...els.flatMap((el) => ELEMENTAL[el].immune)]);
  if (els.includes("wind")) e.speedMul *= 1.4;
  if (els.includes("water")) e.auras.set("water", 999);
  return e;
}
export function makeElite(w, e, kind) {
  e.elite = kind;
  e.hp = e.max = e.max * 2.2;
  e.tenacity = { mul: T.elite.ccMul, max: T.elite.poise, time: T.elite.unstop, slowFloor: T.elite.slowFloor, poise: 0, unstop: 0 };
  if (kind === "swift") e.speedMul = 1.5;
  if (kind === "warded") e.resist[w.rng.pick(ELEMENTS)] = 0.1;
  if (kind === "shielded") e.shield = e.max * 0.6;
  w.run.elites++;
}

// ---------- the weather: one at a time, with a short quiet between ----------
function startWeather(w, id) {
  const wx = w.weather;
  if (wx.kind || wx.gap > 0 || !inView(w).length) return false;
  const st = skillStats(w, id);
  Object.assign(wx, { kind: SKILLS[id].weather, id, t: st.dur, st, tick: 0.3 });
  if (wx.kind === "lava") for (const e of w.enemies) { e.status.wet = 0; e.auras.delete("water") }
  w.events.push({ type: "weatherStart", kind: wx.kind, dur: st.dur });
  return true;
}
function endWeather(w) {
  const wx = w.weather;
  if (!wx.kind) return;
  w.events.push({ type: "weatherEnd", kind: wx.kind });
  Object.assign(wx, { kind: null, t: 0, st: null, gap: WEATHER.gap });
}
function dropSpot(w, aim, fall) {
  const targets = inView(w);
  let x, y;
  if (targets.length && w.rng.chance(aim)) {
    const e = w.rng.pick(targets), lead = ENEMIES[e.type].speed * speedFactor(e) * fall;
    x = e.x - lead + w.rng.range(-5, 5); y = e.y + w.rng.range(-3, 3);
  } else { x = w.rng.range(WALL_X + 24, W - 12); y = w.rng.range(LANE[0], LANE[1]) }
  return [Math.round(Math.max(WALL_X + 14, Math.min(W - 8, x))), Math.round(Math.max(LANE[0] - 4, Math.min(LANE[1] + 4, y)))];
}
function weatherTick(w) {
  const wx = w.weather, st = wx.st;
  if (wx.kind === "rain") {
    const targets = inView(w), rx = st.puddleR * w.rng.range(0.8, 1.2);
    if (targets.length && w.rng.chance(0.5)) { const e = w.rng.pick(targets); addGround(w, "water", e.x - 6 + w.rng.range(-8, 8), e.y + w.rng.range(-3, 3), rx, GROUND.rainLife, "rain") }
    else addGround(w, "water", w.rng.range(WALL_X + 20, W - 12), w.rng.range(LANE[0], LANE[1]), rx, GROUND.rainLife, "rain");
  } else {
    const kind = wx.kind === "lava" ? "lava" : "bolt", [x, y] = dropSpot(w, st.aim, st.fall);
    w.drops.push({ kind, x, y, hitT: st.fall, st });
    w.events.push({ type: "drop", kind, x, y, fall: st.fall });
  }
}
function landDrop(w, d) {
  const { st, x, y } = d;
  if (d.kind === "lava") {
    for (const e of around(w, x, y, st.radius)) damage(w, e, st.dmg, "fire", { burn: st.burn });
    if (!steamAt(w, x, y, st.radius) && w.rng.chance(st.poolChance)) addGround(w, "lava", x, y, st.poolR, st.poolLife);
  } else {
    const hit = new Set();
    for (const e of around(w, x, y, st.radius)) { hit.add(e); damage(w, e, st.dmg, "volt", { stun: st.stun }) }
    conduct(w, x, y, st.dmg * elemMul(w, "volt"), hit);
    w.hitstop = Math.max(w.hitstop, 0.02);
  }
  w.events.push({ type: "dropHit", kind: d.kind, x, y });
}
function updateWeather(w, dt) {
  const wx = w.weather;
  if (wx.gap > 0) wx.gap = Math.max(0, wx.gap - dt);
  if (wx.kind) {
    wx.t -= dt; wx.tick -= dt;
    w.src = wx.id ?? null;
    while (wx.tick <= 0 && wx.t > 0) { wx.tick += wx.st.every; weatherTick(w) }
    if (wx.t <= 0) endWeather(w);
  }
  for (const d of w.drops) { d.hitT -= dt; if (d.hitT <= 0 && !d.done) { d.done = true; w.src = d.skill ?? wx.id ?? null; landDrop(w, d) } }
  w.src = null;
  w.drops = w.drops.filter((d) => !d.done);
}

// ---------- skills ----------
function updateSkills(w, dt) {
  const cdMul = chapterOf(w).cdMul ?? 1;
  for (const [id, s] of Object.entries(w.skills)) {
    const sk = SKILLS[id];
    if (sk.passive === "chaosseed") continue;
    s.cd -= dt / cdMul;
    if (s.cd > 0) continue;
    const st = skillStats(w, id);
    let fired;
    if (sk.passive === "nova") fired = nova(w);
    else if (sk.kind === "weather") fired = startWeather(w, id);
    else if (sk.kind === "summon") fired = summon(w, id, st);
    else if (sk.kind === "heal") { fired = w.wall.hp < w.wall.max; if (fired) { w.wall.hp = Math.min(w.wall.max, w.wall.hp + st.heal); w.events.push({ type: "mend", n: st.heal }) } }
    else if (sk.kind === "passive") { s.cd = 1; continue }
    else if (st.gold && w.gold < st.gold) { s.cd = 0.3; continue }   // can't pay: wait for gold
    else fired = cast(w, id);
    if (fired) {
      s.cd = st.cd;
      if (st.gold) w.gold -= st.gold;
      if (sk.kind === "weather") { w.mage.pose = "throw"; w.mage.t = 0.6 } else { w.mage.pose = "cast"; w.mage.t = 0.25 }
    } else s.cd = 0.2;
  }
}

// ---------- the ground, wells and timers ----------
function updateGround(w, dt) {
  for (const g of w.grounds) {
    g.life -= dt; g.shockCd -= dt; g.shockT = Math.max(0, g.shockT - dt);
    const G = GROUNDS[g.kind] ?? {};
    if (G.pull) for (const e of alive(w).filter(movable)) if (inGround(g, e.x, e.y) || Math.hypot(e.x - g.x, e.y - g.y) < g.rx * 1.5) {
      const d = Math.hypot(g.x - e.x, g.y - e.y) || 1, k = G.pull * dt * (ENEMIES[e.type].boss ? 0.3 : 1);
      e.x += ((g.x - e.x) / d) * Math.min(k, d); e.y += ((g.y - e.y) / d) * Math.min(k, d);
    }
    if (G.turret) {
      g.tick -= dt;
      if (g.tick <= 0) {
        g.tick = 1;
        const t = alive(w).filter((e) => Math.hypot(e.x - g.x, e.y - g.y) < 70).sort((a, b) => a.x - b.x)[0];
        if (t) { damage(w, t, 10 * w.mods.dmg, "arcane"); w.events.push({ type: "fx", fx: "beam", x: g.x, y: g.y - 10, x2: center(t)[0], y2: center(t)[1], elem: "arcane" }) }
      }
    }
  }
  w.grounds = w.grounds.filter((g) => g.life > 0);
  for (const wl of w.wells) {
    wl.t -= dt;
    for (const e of alive(w).filter(movable)) {
      const d = Math.hypot(wl.x - e.x, (wl.y - e.y) * 1.5);
      if (d > wl.r || d < 1) continue;
      const k = Math.min(d, wl.k * dt * (ENEMIES[e.type].boss ? wl.bossK : 1));
      e.x += ((wl.x - e.x) / d) * k; e.y += ((wl.y - e.y) / d) * k;
    }
  }
  w.wells = w.wells.filter((wl) => wl.t > 0);
  for (const tm of w.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn() } }
  w.timers = w.timers.filter((tm) => !tm.done);
}
/** What the ground does to one monster standing on it this step. Returns its attack-speed factor. */
function groundOn(w, e, dt) {
  let atk = 1, onWater = false;
  e.groundT -= dt;
  const tick = e.groundT <= 0;
  if (tick) e.groundT = 0.5;
  for (const g of ENEMIES[e.type].fly ? [] : w.grounds) {   // flyers pass over it all
    if (!inGround(g, e.x, e.y)) continue;
    const G = GROUNDS[g.kind] ?? {};
    if (g.kind === "water") onWater = true;
    if (G.atk) atk = Math.min(atk, G.atk);
    if (G.slow) applyMud(e, G.slow, 0.3);
    if (g.kind === "water" && ENVS[w.env].freezeWater) applyMud(e, 0.6, 0.3);   // iced over in the snow
    if (!tick) continue;
    if (g.kind === "lava") {
      if (chapterOf(w).n === 3) { if (canRegen(w, e)) e.hp = Math.min(e.max, e.hp + e.max * 0.01) }   // the volcano's own heal them
      else { applyBurn(e, ENEMIES[e.type], 4 * w.mods.dmg); e.auras.delete("water"); e.status.wet = 0 }
    }
    if (G.poison) applyPoison(e, ENEMIES[e.type], G.poison * w.mods.dmg);
    if (G.dps) damage(w, e, G.dps * 0.5 * w.mods.dmg, G.elem, { quiet: true, reaction: true });
    if (G.heal && (g.healAt ?? -1) <= w.t) { g.healAt = w.t + 0.5; healWall(w, 0.5) }
  }
  const E = ENVS[w.env];
  if (tick) {
    if (onWater || raining(w) || (E.soak && w.rng.chance(0.2)) || kin(e, "water")) applyAura(w, e, "water");
    if (E.poisonCap) e.status.poison.max = Math.max(e.status.poison.max, E.poisonCap);
    if (E.regen && canRegen(w, e)) e.hp = Math.min(e.max, e.hp + e.max * E.regen * 0.5);
    if (kin(e, "light")) for (const o of around(w, e.x, e.y, 30, e)) if (canRegen(w, o)) o.hp = Math.min(o.max, o.hp + o.max * 0.01);
  }
  if (kin(e, "dark")) { e.blinkT = (e.blinkT ?? 4) - dt; if (e.blinkT <= 0 && e.state === "walk" && !isHeld(e)) { e.blinkT = 4; w.events.push({ type: "blink", x: e.x, y: e.y }); e.x -= 14 } }
  return atk * (E.atk ?? 1);
}
/** Chapter hazards: now and then the field itself lays something down. */
function updateHazards(w, dt) {
  const E = ENVS[w.env];
  if (E.puddles) { w.envT -= dt; if (w.envT <= 0) { w.envT = E.puddles; addGround(w, "water", w.rng.range(WALL_X + 30, W - 12), w.rng.range(LANE[0], LANE[1]), w.rng.range(7, 11), 6, "env") } }
  if (E.dry) for (const g of w.grounds) if (g.kind === "water") g.life -= dt * (E.dry - 1);
  const hz = chapterOf(w).hazard;
  if (!hz) return;
  w.hazardT -= dt;
  if (w.hazardT > 0) return;
  w.hazardT = 7 + w.rng.range(0, 4);
  addGround(w, hz, w.rng.range(WALL_X + 40, W - 20), w.rng.range(LANE[0], LANE[1]), w.rng.range(10, 16), 6, "hazard");
}

// ---------- elements awaken, and Chaos ----------
function updateAwakening(w) {
  const have = new Set(Object.keys(w.skills).flatMap((id) => SKILLS[id].elems ?? [SKILLS[id].elem]));
  for (const el of w.schoolMarks) {
    if (w.awakened.has(el) || (w.cls === "mage" && !have.has(el)) || (w.elemReacts[el] ?? 0) < AWAKEN) continue;
    w.awakened.add(el);
    w.events.push({ type: "awaken", elem: el });
  }
  if (!w.chaosAwake && w.awakened.size >= 10 && w.chaosUnlocked) { w.chaosAwake = true; w.events.push({ type: "chaosAwake" }) }
}

// ---------- the boss ----------
function updateBoss(w, e, dt) {
  if (!e.boss) return;
  // at a quarter of its life it rages: faster, harder, and it shakes off what holds it
  if (!e.enraged && e.hp < e.max * T.boss.enrage) {
    e.enraged = true; e.speedMul *= 1.4; e.dmgMul *= 1.25;
    if (e.tenacity) { e.tenacity.mul *= 0.5; e.tenacity.unstop = Math.max(e.tenacity.unstop, 4) }
    const st = e.status; st.stun = 0; st.freeze = 0; st.root = 0;
    w.events.push({ type: "enrage", id: e.id, x: e.x, y: e.y });
  }
  // now and then it charges
  if (T.boss.charge > 0 && e.state === "walk") {
    e.bchargeT = (e.bchargeT ?? 7) - dt;
    if (e.bchargeT <= 0 && e.x > WALL_X + 50) { e.bchargeT = 7 / T.boss.charge; e.dash = 0.7; w.events.push({ type: "charge", id: e.id, x: e.x, y: e.y }) }
  }
  if (e.boss !== "chapter") return;
  if (e.bossPhase === 1 && e.hp < e.max * 0.5) {
    e.bossPhase = 2;
    e.shield = e.max * 0.45;
    e.shieldBy = chapterOf(w).boss.shieldBy;
    e.summonT = 3; e.slamT = 6;
    w.events.push({ type: "bossPhase", id: e.id, x: e.x, y: e.y, shieldBy: e.shieldBy });
  }
  if (e.bossPhase === 2) {
    e.summonT -= dt; e.slamT -= dt;
    if (e.summonT <= 0) { e.summonT = 8; for (let i = 0; i < 3; i++) spawn(w, w.rng.pick(["slime", "goblin", "wolf"]), Math.min(W + 4, e.x + 20), Math.round(e.y + w.rng.range(-20, 20)), { elite: false, hp: 0.8 }) }
    if (e.slamT <= 0) { e.slamT = 10; for (const s of Object.values(w.skills)) s.cd += 0.6; w.events.push({ type: "slam", x: e.x, y: e.y }) }
  }
}

// ---------- waves and cards ----------
function startWave(w) {
  w.phase = "wave"; w.waveT = 0; w.chaosThisWave = 0;
  setEnv(w, w.wave === 0 && w.chapter === 1 && !w.endless ? "clear" : w.rng.pick(ENV_POOL[w.endless ? "endless" : w.chapter]));
  w.spawns = w.endless ? endlessList(w.wave, w.rng) : addRoster(w, spawnList(w.wave));
  w.events.push({ type: "wave", n: w.wave + 1, total: totalWaves(w), endless: w.endless });
}
/** The chapter's own kinds (bats, archers, shamans...) mixed into its waves from wave 2. */
function addRoster(w, list) {
  const roster = chapterOf(w).roster ?? [];
  if (!roster.length || w.wave < 1) return list;
  for (let g = 0; g < (w.wave >= 6 ? 2 : 1); g++) {
    const type = w.rng.pick(roster), n = Math.max(1, Math.round((2 + w.wave * 0.6) * T.monster.extra));
    for (let k = 0; k < n; k++) list.push({ t: 3 + g * 7 + k * 1.3, type, opts: {} });
  }
  return list.sort((a, b) => a.t - b.t);
}
/** Change the field's environment (a new one each wave). */
export function setEnv(w, kind) {
  w.env = kind; w.envT = 1;
  w.sight = ENVS[kind].sight ? WALL_X + ENVS[kind].sight : null;
  w.events.push({ type: "env", kind });
}
function offerCards(w, reason) {
  w.phase = "cards"; w.cardReason = reason; w.cards = drawCards(w); w.rerolls = w.rerolls ?? (w.mods.rerolls ?? 0);
  w.events.push({ type: "cards", reason });
}
export function chooseCard(w, i) {
  if (w.phase !== "cards" || !w.cards?.[i]) return false;
  applyCard(w, w.cards[i]);
  w.events.push({ type: "card", card: w.cards[i] });
  w.cards = null;
  if (w.cardReason === "level") {
    w.levelsDue--;
    if (w.levelsDue > 0) offerCards(w, "level"); else w.phase = "wave";
  } else { w.wave++; w.phase = "rest"; w.restT = 3 }
  return true;
}
export function reroll(w) {
  if (w.phase !== "cards" || !(w.rerolls > 0)) return false;
  w.rerolls--; w.cards = drawCards(w); w.events.push({ type: "cards", reason: w.cardReason, reroll: true });
  return true;
}
function gainXp(w) {
  while (w.xp >= xpNext(w.level)) { w.xp -= xpNext(w.level); w.level++; w.levelsDue++; w.events.push({ type: "levelUp", level: w.level }) }
}

// ---------- the step ----------
export function step(w, dt) {
  if (w.phase === "won" || w.phase === "lost" || w.phase === "cards") return;
  w.t += dt;
  if (w.phase === "rest") { w.restT -= dt; if (w.restT <= 0) startWave(w); return }

  // spawns
  w.waveT += dt;
  while (w.spawns.length && w.spawns[0].t <= w.waveT) {
    const s = w.spawns.shift();
    spawn(w, s.type, SPAWN_X + w.rng.range(0, 10), Math.round(w.rng.range(LANE[0] + (s.type === "golem" ? 14 : 0), LANE[1])), s.opts);
  }

  // monsters: the weather and the ground under them, their auras and statuses, their walk and their blows
  const E = ENVS[w.env];
  const slowRain = (raining(w) ? 1 - WEATHER.rain.slow : 1) * (1 - (E.slow ?? 0)) * (1 + (E.haste ?? 0));
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    const def = ENEMIES[e.type];
    const atkGround = groundOn(w, e, dt);
    tickAuras(w, e, dt);
    if (e.status.brittle > 0) e.status.brittle -= dt;
    const due = tickStatus(e, dt);
    if (e.justUnstoppable) { e.justUnstoppable = false; w.events.push({ type: "unstoppable", id: e.id, x: e.x, y: e.y, h: def.cy }) }
    if (due.burn > 0) damage(w, e, due.burn, "burn", { quiet: true, reaction: true });
    if (due.poison > 0 && e.hp > 0) damage(w, e, due.poison * w.mods.dotDmg, "poison", { quiet: true, reaction: true });
    if (due.phys > 0 && e.hp > 0) damage(w, e, due.phys * w.mods.dotDmg, "phys", { quiet: true, reaction: true });   // bleeding, venom
    if (e.elite === "regen" && e.hp > 0 && canRegen(w, e)) e.hp = Math.min(e.max, e.hp + e.max * 0.015 * dt);
    if (e.hp <= 0) continue;
    updateBoss(w, e, dt);
    e.flash = Math.max(0, e.flash - dt);
    if (def.healer) {   // mends those round it
      e.healT = (e.healT ?? def.healer.every) - dt;
      if (e.healT <= 0) {
        e.healT = def.healer.every;
        const near = around(w, e.x, e.y, def.healer.radius).filter((o) => o !== e && o.hp < o.max && !ENEMIES[o.type].boss && canRegen(w, o) && (o.healedAt ?? -99) + def.healer.every <= w.t);
        for (const o of near) { o.healedAt = w.t; o.hp = Math.min(o.max, o.hp + o.max * def.healer.frac) }
        if (near.length) w.events.push({ type: "heal", x: e.x, y: e.y, h: def.cy, r: def.healer.radius, pts: near.map((o) => [o.x, o.y]) });
      }
    }
    if (isHeld(e)) continue;
    const f = speedFactor(e);
    let speed = def.speed * e.speedMul * Math.min(2, fury(w));
    if (def.charger && e.state === "walk") {
      e.chargeT = (e.chargeT ?? def.charger.every) - dt;
      if (e.chargeT <= 0 && e.x > WALL_X + 40) { e.chargeT = def.charger.every; e.dash = def.charger.dur; w.events.push({ type: "charge", id: e.id, x: e.x, y: e.y }) }
    }
    if (e.dash > 0) { e.dash -= dt; speed *= def.charger?.k ?? 3.5 }
    if (e.status.fear > 0) { e.x = Math.min(W + 10, e.x + speed * 0.8 * dt); e.walkT += dt; if (e.state === "attack") e.state = "walk"; continue }
    if (e.state === "walk") {
      e.walkT += dt * f * slowRain;
      e.x -= speed * f * slowRain * dt;
      const stop = WALL_X + (def.ranged ?? 0);
      if (e.x - def.half <= stop) { e.x = stop + def.half; e.state = "attack"; e.atkT = def.bomber ? def.rate : 0; e.blocked = null }
      else if (w.minions.length && !def.fly) { const b = blockerFor(w, e); if (b) { e.state = "attack"; e.atkT = 0; e.blocked = b.id } }
    } else {
      // held up by a summoned golem: beat on it until it falls, then walk on
      const b = e.blocked ? w.minions.find((m) => m.id === e.blocked && m.hp > 0) : null;
      if (e.blocked && !b) { e.state = "walk"; e.blocked = null; continue }
      // knocked back off what it was beating on: walk back to it
      if (b ? e.x - def.half > b.x + 14 : e.x - def.half > WALL_X + (def.ranged ?? 0) + 3) { e.state = "walk"; e.blocked = null; continue }
      e.atkT += dt * slowFactor(e) * atkGround * (e.auras.has("daze") ? AURA.daze.atk : 1);
      if (e.atkT >= def.rate) {
        e.atkT -= def.rate;
        // blinded, it may miss; disarmed or sickened, it hits softer
        if ((e.auras.has("blind") && w.rng.chance(ENVS[w.env]?.blindMiss ?? AURA.blind)) || (w.mods.dodge && w.rng.chance(w.mods.dodge))) { w.events.push({ type: "miss", x: e.x - def.half, y: e.y, h: def.cy }); continue }
        const hit = def.dmg * e.dmgMul * fury(w) * (e.auras.has("dark") && !e.immune?.has("curse") ? AURA.curse.wall : 1) * (e.auras.has("disarm") ? AURA.disarm : 1) * (e.status.weak > 0 ? 0.5 : 1) * (b ? 1 : w.pm.wallTaken);
        if (def.bomber) {   // it goes off on whatever it reached, and is gone
          if (b) hitMinion(w, b, e, hit * 2); else w.wall.hp = Math.max(0, w.wall.hp - hit);
          e.hp = 0;
          w.events.push({ type: "fx", fx: "blast", x: e.x - def.half, y: e.y - 6, elem: "fire", r: 18 }, { type: "death", id: e.id, x: e.x, y: e.y, kind: e.type, bomb: true });
          continue;
        }
        if (b) { hitMinion(w, b, e, hit * (def.boss ? 4 : 1.5)); continue }   // a boss smashes through
        if (def.ranged) w.events.push({ type: "missile", x: e.x - def.half, y: e.y, h: def.cy, x2: WALL_X, y2: e.y, kind: e.type });
        w.wall.hp = Math.max(0, w.wall.hp - hit);
        if (w.mods.thorns) damage(w, e, w.mods.thorns, "earth", { reaction: true, quiet: true });
        w.events.push({ type: "wallHit", x: WALL_X, y: e.y, dmg: hit });
        if (w.mage.pose === "idle") { w.mage.pose = "hurt"; w.mage.t = 0.18 }
      }
    }
    e.y = Math.max(LANE[0] - 6, Math.min(LANE[1] + 6, e.y));
    if (e.x > W + 16) e.x = W + 16;   // never pushed off the field for good
  }
  // the dead: splitters split
  for (const e of w.enemies) if (e.hp <= 0 && e.elite === "splitter" && !e.split) {
    e.split = true;
    for (const dy of [-6, 6]) { const c = spawn(w, e.type, e.x + 4, e.y + dy, { elite: false }); c.hp = c.max = e.max * 0.35 }
  }
  w.enemies = w.enemies.filter((e) => e.hp > 0);
  if (w.mods.regen) w.wall.hp = Math.min(w.wall.max, w.wall.hp + w.mods.regen * dt);

  updateSkills(w, dt);
  updateShots(w, dt);
  updateZones(w, dt);
  updateWeather(w, dt);
  updateGround(w, dt);
  updateHazards(w, dt);
  updateBlackHoles(w, dt);
  if (w.minions.length) updateMinions(w, dt);
  updateAwakening(w);

  // the mage's pose
  if (w.mage.t > 0) { w.mage.t -= dt; if (w.mage.t <= 0) w.mage.pose = "idle" } else w.mage.pose = "idle";

  // the end of things
  if (w.wall.hp <= 0) { w.phase = "lost"; w.events.push({ type: "lost" }); return }
  gainXp(w);
  if (w.levelsDue > 0) { offerCards(w, "level"); return }
  if (!w.spawns.length && !w.enemies.length && !w.blackholes.length) {
    endWeather(w);
    w.weather.gap = 0;
    w.grounds = []; w.drops = []; w.zones = []; w.wells = []; w.timers = []; w.minions = [];
    w.run.waves++;
    if (!w.endless && (w.wave + 1) % 5 === 0) w.run.bosses++;
    if (w.endless && (w.wave + 1) % ENDLESS.bossEvery === 0) w.run.bosses++;
    w.events.push({ type: "waveClear", n: w.wave + 1 });
    if (!w.endless && w.wave >= WAVES.length - 1) { w.phase = "won"; w.events.push({ type: "won" }) }
    else offerCards(w, "wave");
  }
}

/** Take the events pushed since the last call. */
export function drain(w) {
  const ev = w.events;
  w.events = [];
  for (const e of ev) if (e.type === "discover") w.run.discovered.push(e.kind);
  return ev;
}

/** What a run earned, for the profile. */
export function summary(w) {
  return {
    cls: w.cls, chapter: w.chapter, endless: w.endless, won: w.phase === "won", waves: w.run.waves, bosses: w.run.bosses, elites: w.run.elites,
    kills: w.kills, level: w.level, counts: { ...w.counts }, discovered: [...new Set(w.run.discovered)],
    dmgSrc: { ...(w.dmgSrc ?? {}) },
    awakened: [...w.awakened], chaos: w.counts.chaos ?? 0, skills: Object.keys(w.skills), wallLeft: w.wall.hp / w.wall.max,
  };
}

export { SKILLS, ENEMIES, WAVES, CHAPTERS, stats, SKILLS_OF, alive, inBlast };
