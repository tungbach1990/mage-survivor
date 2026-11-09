// The idle battle, seen from the side: the hero stands on the left, groups of monsters walk in from the right,
// and they fight where they meet. It never ends: groups keep coming; every 100 kills on a map, its boss. The hero
// dies now and then (a little experience lost), gets back up, and fights on.

import { Rng } from "../../lib/pixelfx/core/math.js?v=mw8wxgia";
import { KINDS, MAPS, mapOf, monsterBase, elemMul, xpToNext, MAX_LEVEL, BOSS_EVERY, BOSS_HP, BOSS_ATK, BOSS_LOOT, DEATH_XP, RESPAWN } from "./data.js?v=mw8wxgia";
import { SKILL_TREE, skillOf, skillAt } from "./skills.js?v=mw8wxgia";
import { heroStats, hitChance, afterDef, CASTERS } from "./hero.js?v=mw8wxgia";
import { BAL } from "./balance.js?v=mw8wxgia";
import { rollGrade } from "../data/loot.js?v=mw8wxgia";

export const FIELD = { w: 180, h: 150, ground: 118, heroX: 34, spawnX: 196 };
const MELEE_GAP = 32, RANGED_GAP = 80, WALK = 1.2;

/** A battle for a hero (its profile object, which it changes: level, xp). */
export function createBattle(seed, hero, opts = {}) {
  const w = {
    t: 0, rng: new Rng(seed), nextId: 1, hero, map: opts.map ?? hero.map ?? 1,
    hs: null, hp: 0, sp: 0, buffs: [], cds: {}, cast: null, basicT: 0.5, regenT: 3,
    monsters: [], walkT: 0.5, phase: "walk", deadT: 0, deaths: [], kills: 0,
    events: [], gained: { xp: 0, gold: 0, kills: 0, items: 0, deaths: 0, levels: 0 },
    onLevel: opts.onLevel ?? null, autoMap: opts.autoMap ?? hero.autoMap ?? true,
  };
  refresh(w); w.hp = w.hs.maxHp; w.sp = w.hs.maxSp;
  return w;
}
/** Work the hero's numbers out again (level, gear, stats or buffs changed). */
export function refresh(w) {
  const b = { atk: 0, aspd: 0, def: 0, crit: 0 };
  for (const x of w.buffs) for (const k of Object.keys(b)) b[k] += x[k] ?? 0;
  const before = w.hs;
  w.hs = heroStats(w.hero, b);
  if (before) { w.hp = Math.min(w.hs.maxHp, w.hp * (w.hs.maxHp / before.maxHp)); w.sp = Math.min(w.hs.maxSp, w.sp) }
}
export const drain = (w) => { const e = w.events; w.events = []; return e };
const alive = (w) => w.monsters.filter((m) => m.hp > 0);

// ---- monsters
function makeMonster(w, kind, lv, boss) {
  const M = mapOf(w.map), K = KINDS[kind], B = monsterBase(lv), bal = BAL.monster;
  const hp = Math.round(B.hp * K.hp * bal.hp * (boss ? BOSS_HP : 1)), elem = M.elems[Math.floor(w.rng.next() * M.elems.length)];
  return {
    id: w.nextId++, kind, lv, elem, boss: !!boss, hp, max: hp,
    atk: B.atk * K.atk * bal.atk * (boss ? BOSS_ATK : 1), def: Math.min(0.6, K.def + (boss ? 0.1 : 0)), hit: B.hit, flee: Math.round(B.flee * K.flee),
    rate: K.rate, range: K.range, atkT: K.rate * 0.6, x: FIELD.spawnX + w.rng.next() * 30, y: FIELD.ground - 4 + w.rng.next() * 10,
    xp: B.xp * K.xp * bal.xp * (boss ? BOSS_LOOT * 4 : 1), gold: B.gold * K.gold * (boss ? BOSS_LOOT * 4 : 1), defCut: 0, defCutT: 0, fly: K.fly ?? 0,
  };
}
function spawnGroup(w) {
  const M = mapOf(w.map), span = M.lv[1] - M.lv[0];
  if (w.kills > 0 && w.kills % BOSS_EVERY === 0 && !w.bossDone) {
    w.bossDone = true;
    w.monsters = [makeMonster(w, M.boss, M.lv[1] + 2, true)];
    w.events.push({ type: "boss", map: w.map });
    return;
  }
  w.bossDone = false;
  const n = 1 + Math.floor(w.rng.next() * 3);
  w.monsters = Array.from({ length: n }, (_, i) => { const m = makeMonster(w, M.kinds[Math.floor(w.rng.next() * M.kinds.length)], M.lv[0] + Math.floor(w.rng.next() * (span + 1)), false); m.x += i * 16; return m });
}

// ---- the hero's blows
function deal(w, m, raw, elem, opts = {}) {
  if (m.hp <= 0) return 0;
  const hs = w.hs;
  if (!opts.sure && !w.rng.chance(hitChance(hs.hit, m.flee))) { w.events.push({ type: "miss", x: m.x, y: m.y }); return 0 }
  const crit = opts.crit || w.rng.chance(hs.crit);
  let dmg = raw * elemMul(elem, m.elem) * (crit ? 1.4 : 1) * (0.92 + 0.16 * w.rng.next());
  dmg = afterDef(dmg, Math.max(0, m.def - m.defCut));
  m.hp -= dmg;
  w.events.push({ type: "dmg", id: m.id, x: m.x, y: m.y - 14 - m.fly, amount: Math.round(dmg), crit, elem: elem ?? "neutral", skill: opts.skill ?? null });
  if (m.hp <= 0) kill(w, m);
  return dmg;
}
function kill(w, m) {
  const xp = Math.round(m.xp * w.hs.xpMul * levelGap(w.hero.level, m.lv)), gold = Math.round(m.gold * w.hs.goldMul);
  w.kills++; w.gained.kills++; w.gained.gold += gold; w.hero.gold = (w.hero.gold ?? 0) + gold;
  w.events.push({ type: "kill", id: m.id, x: m.x, y: m.y, kind: m.kind, boss: m.boss, xp, gold });
  gainXp(w, xp);
  // gear: now and then from anything, surely from a boss
  if (w.rng.chance(m.boss ? 1 : BAL.drop)) { w.gained.items++; w.events.push({ type: "gear", x: m.x, y: m.y, level: mapOf(w.map).id, boss: m.boss, grade: rollGrade(() => w.rng.next(), m.boss ? 0.25 : 0) }) }
}
/** Too weak a monster for the hero's level gives less; a stronger one a little more. */
export const levelGap = (hl, ml) => (ml >= hl ? Math.min(1.3, 1 + 0.03 * (ml - hl)) : Math.max(0.1, 1 - 0.06 * (hl - ml - 5 > 0 ? hl - ml - 5 : 0)));
export function gainXp(w, n) {
  const h = w.hero;
  if (h.level >= MAX_LEVEL) return;
  h.xp = (h.xp ?? 0) + n; w.gained.xp += n;
  let up = 0;
  while (h.level < MAX_LEVEL && h.xp >= xpToNext(h.level)) { h.xp -= xpToNext(h.level); h.level++; up++ }
  if (up) {
    w.gained.levels += up;
    w.events.push({ type: "levelUp", level: h.level });
    w.onLevel?.(h, up);
    refresh(w); w.hp = w.hs.maxHp; w.sp = w.hs.maxSp;
    if (w.autoMap) autoPickMap(w);
  }
}
/** The best map for the hero's level: the highest whose middle it has reached. */
export const bestMap = (level) => [...MAPS].reverse().find((m) => level >= m.lv[0] + 3)?.id ?? 1;
export const mapOpen = (level, id) => level >= mapOf(id).lv[0] || id === 1;
function autoPickMap(w) { const b = bestMap(w.hero.level); if (b > w.map && !(w.retreatUntil > w.hero.level)) setMap(w, b) }
export function setMap(w, id) { if (!mapOpen(w.hero.level, id)) return false; w.map = id; w.hero.map = id; w.kills = 0; w.monsters = []; w.phase = "walk"; w.walkT = WALK; w.events.push({ type: "map", map: id }); return true }

function basicAttack(w, target) {
  const hs = w.hs, raw = hs.wtype === "staff" ? (hs.atk + hs.matk) / 2 : hs.atk;
  w.events.push({ type: "basic", x: target.x, y: target.y - 10 - target.fly, cls: w.hero.cls, wtype: hs.wtype, ranged: !hs.melee });
  deal(w, target, raw * BAL.basic, "neutral");
}
function useSkill(w, id) {
  const sk = skillOf(w.hero.cls, id), lv = w.hero.skills[id], st = skillAt(sk, lv), targets = alive(w), t0 = inReach(w)[0];
  const base = CASTERS.has(w.hero.cls) && sk.cast ? w.hs.matk : w.hs.atk;
  w.events.push({ type: "skill", id, kind: sk.kind, elem: sk.elem, cls: w.hero.cls, x: (t0 ?? targets[0])?.x ?? FIELD.heroX + 40, y: (t0 ?? targets[0])?.y ?? FIELD.ground });
  if (sk.kind === "hit" || sk.kind === "debuff") {
    if (!t0) return;
    for (let i = 0; i < (st.hits ?? 1) && t0.hp > 0; i++) deal(w, t0, base * st.pct / 100 * BAL.skill, sk.elem, { skill: id, crit: !!st.crit });
    if (sk.kind === "debuff") { t0.defCut = st.def; t0.defCutT = st.dur }
  } else if (sk.kind === "area") for (const m of targets) deal(w, m, base * st.pct / 100 * BAL.skill, sk.elem, { skill: id });
  else if (sk.kind === "buff") { w.buffs = w.buffs.filter((b) => b.id !== id); w.buffs.push({ id, atk: st.atk ?? 0, aspd: st.aspd ?? 0, def: st.def ?? 0, crit: st.crit ?? 0, until: w.t + st.dur }); refresh(w) }
  else if (sk.kind === "heal") { const n = w.hs.maxHp * st.pct / 100; w.hp = Math.min(w.hs.maxHp, w.hp + n); w.events.push({ type: "heal", n: Math.round(n) }) }
}
// a melee hero steps up to whatever has stopped in front of it (a ranged one too); the rest reach anything in sight
const inReach = (w) => alive(w).filter((m) => !w.hs.melee || m.arrived || m.x <= FIELD.heroX + MELEE_GAP + 10).sort((a, b) => a.x - b.x);
/** Should the hero use this skill now? (a heal only when hurt, a buff when it's run out, the rest on a target) */
function wants(w, id) {
  const sk = skillOf(w.hero.cls, id);
  if (sk.kind === "heal") return w.hp < w.hs.maxHp * 0.65;
  if (sk.kind === "buff") return !w.buffs.some((b) => b.id === id) && alive(w).length > 0;
  return inReach(w).length > 0;
}

// ---- the step
export function step(w, dt) {
  w.t += dt;
  // buffs run out
  if (w.buffs.some((b) => b.until <= w.t)) { w.buffs = w.buffs.filter((b) => b.until > w.t); refresh(w) }
  // regeneration, every 3 s
  if ((w.regenT -= dt) <= 0) { w.regenT = 3; if (w.phase !== "dead") { w.hp = Math.min(w.hs.maxHp, w.hp + w.hs.regenHp * (w.monsters.length ? 1 : 4)); w.sp = Math.min(w.hs.maxSp, w.sp + w.hs.regenSp * (w.monsters.length ? 1 : 3)) } }
  if (w.phase === "dead") { if ((w.deadT -= dt) <= 0) { w.phase = "walk"; w.walkT = WALK; w.hp = w.hs.maxHp; w.sp = w.hs.maxSp; w.events.push({ type: "revive" }) } return }
  if (w.phase === "walk") { if ((w.walkT -= dt) <= 0) { spawnGroup(w); w.phase = "fight" } return }
  const ms = alive(w);
  if (!ms.length) { w.phase = "walk"; w.walkT = WALK; w.monsters = []; return }
  // monsters come on, then strike
  for (const m of ms) {
    const stop = FIELD.heroX + (m.range ? RANGED_GAP : MELEE_GAP);
    if (m.x > stop) { m.x = Math.max(stop, m.x - 40 * dt); continue }
    m.arrived = true;
    if (m.defCutT > 0 && (m.defCutT -= dt) <= 0) m.defCut = 0;
    if ((m.atkT -= dt) <= 0) {
      m.atkT += m.rate;
      if (!w.rng.chance(hitChance(m.hit, w.hs.flee))) { w.events.push({ type: "dodge" }); continue }
      const d = afterDef(m.atk * (0.9 + 0.2 * w.rng.next()), w.hs.def, w.hs.softDef);
      w.hp -= d;
      w.events.push({ type: "hurt", amount: Math.round(d), from: m.id, ranged: !!m.range });
      if (w.hp <= 0) return die(w);
    }
  }
  // the cast under way
  if (w.cast && (w.cast.t -= dt) <= 0) { const id = w.cast.id; w.cast = null; useSkill(w, id) }
  // the skills: the first ready one (in the hero's order) that it wants and can pay for
  if (!w.cast) {
    const order = w.hero.order?.length ? w.hero.order : SKILL_TREE[w.hero.cls].map((s) => s.id);
    for (const id of order) {
      const lv = w.hero.skills?.[id]; if (!lv || w.hero.off?.[id]) continue;
      if ((w.cds[id] ?? 0) > w.t) continue;
      const sk = skillOf(w.hero.cls, id), st = skillAt(sk, lv);
      if (w.sp < st.sp || !wants(w, id)) continue;
      w.sp -= st.sp; w.cds[id] = w.t + st.cd * w.hs.cdMul;
      const ct = (st.cast ?? 0) * w.hs.castMul;
      if (ct > 0.05) { w.cast = { id, t: ct, total: ct, elem: sk.elem }; w.events.push({ type: "castStart", id, t: ct, elem: sk.elem }) }
      else useSkill(w, id);
      break;
    }
  }
  // the basic attack, at its speed, casting or not
  if ((w.basicT -= dt) <= 0) {
    const t = inReach(w)[0];
    if (t) { basicAttack(w, t); w.basicT += 1 / w.hs.aps } else w.basicT = 0;
  }
}
function die(w) {
  const h = w.hero, loss = Math.floor(xpToNext(h.level) * DEATH_XP);
  h.xp = Math.max(0, (h.xp ?? 0) - loss);
  w.phase = "dead"; w.deadT = RESPAWN; w.hp = 0; w.monsters = []; w.cast = null; w.buffs = []; refresh(w);
  w.gained.deaths++; w.deaths.push(w.t); w.deaths = w.deaths.filter((t) => t > w.t - 120);
  w.events.push({ type: "death", xp: loss });
  // too strong a map: back one (and stay until the next level)
  if (w.autoMap && w.deaths.length >= 3 && w.map > 1) { w.retreatUntil = h.level + 1; setMap(w, w.map - 1); w.deaths = [] }
}
