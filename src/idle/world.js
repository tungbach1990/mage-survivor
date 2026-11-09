// The idle battle on a map seen from above at 3/4 (as Ragnarok): a grid of tiles with trees and rocks in the
// way, monsters wandering about it, and the hero walking from one to the next like a bot: the nearest it can
// reach, up to its weapon's range, and fight. It never ends. Every 100 kills on a map, its boss comes for the
// hero. The hero falls now and then (a little experience lost), gets back up at the map's middle, and goes on.

import { Rng } from "../../lib/pixelfx/core/math.js?v=mw92mcdd";
import { KINDS, MAPS, mapOf, monsterBase, elemMul, xpToNext, MAX_LEVEL, BOSS_EVERY, BOSS_HP, BOSS_ATK, BOSS_LOOT, DEATH_XP, RESPAWN } from "./data.js?v=mw92mcdd";
import { SKILL_TREE, skillOf, skillAt } from "./skills.js?v=mw92mcdd";
import { heroStats, hitChance, afterDef, CASTERS } from "./hero.js?v=mw92mcdd";
import { BAL } from "./balance.js?v=mw92mcdd";
import { rollGrade } from "../data/loot.js?v=mw92mcdd";

// the map, in tiles; the hero's and monsters' paces (tiles a second); ranges
export const GRID = 24;
export const FIELD = { cols: GRID, rows: GRID };
const HERO_SPEED = 4, MELEE_RANGE = 1.25, FAR_RANGE = 6, AREA = 2, AGGRO = 2.4, MON_RANGED = 4.5;
const AGGRESSIVE = new Set(["wolf", "skeleton", "orc", "golem", "shaman"]);
// the eight facings (as Ragnarok: S, SW, W, NW, N, NE, E, SE), from a step's direction
export const DIRS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
export const faceOf = (dx, dy, prev = 0) => {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return prev;
  const a = Math.atan2(dx, dy);   // 0 = down (S), +pi/2 = right (E)
  return ((Math.round(-a / (Math.PI / 4)) % 8) + 8) % 8;
};

// ---------- the map: obstacles from its seed, kept clear around the middle ----------
const blockCache = new Map();
/** The map's blocked tiles (a Uint8Array GRID*GRID, 1 = tree/rock/pillar), and what stands on each (decor kind 1..). */
export function mapGrid(id) {
  if (blockCache.has(id)) return blockCache.get(id);
  const r = new Rng(id * 977 + 13), b = new Uint8Array(GRID * GRID), deco = new Uint8Array(GRID * GRID);
  const c = GRID / 2;
  for (let n = 0; n < 16; n++) {
    const x0 = 1 + Math.floor(r.next() * (GRID - 2)), y0 = 1 + Math.floor(r.next() * (GRID - 2)), size = 1 + Math.floor(r.next() * 3), kind = 1 + Math.floor(r.next() * 3);
    for (let k = 0; k < size; k++) {
      const x = Math.max(0, Math.min(GRID - 1, x0 + Math.floor(r.next() * 3) - 1)), y = Math.max(0, Math.min(GRID - 1, y0 + Math.floor(r.next() * 3) - 1));
      if (Math.abs(x - c) <= 2 && Math.abs(y - c) <= 2) continue;
      b[y * GRID + x] = 1; deco[y * GRID + x] = kind;
    }
  }
  for (let i = 0; i < GRID; i++) for (const [x, y] of [[i, 0], [i, GRID - 1], [0, i], [GRID - 1, i]]) { b[y * GRID + x] = 1; deco[y * GRID + x] = 1 }
  // no closed-off pockets: anything not reached from the middle is filled in
  const seen = new Uint8Array(GRID * GRID), q = [c * GRID + c]; seen[q[0]] = 1;
  while (q.length) { const i = q.pop(), x = i % GRID, y = (i / GRID) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, j = Y * GRID + X; if (X >= 0 && Y >= 0 && X < GRID && Y < GRID && !b[j] && !seen[j]) { seen[j] = 1; q.push(j) } } }
  for (let i = 0; i < b.length; i++) if (!b[i] && !seen[i]) { b[i] = 1; deco[i] = deco[i] || 2 }
  const g = { blocked: b, deco };
  blockCache.set(id, g);
  return g;
}
export const free = (g, x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID && !g.blocked[y * GRID + x];

/** A* on the grid (8 ways, no cutting corners): the tile centres to walk through, or null. */
export function findPath(g, sx, sy, tx, ty, limit = 600) {
  sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
  if (!free(g, tx, ty)) {
    let best = null, bd = 1e9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, y = ty + dy; if (free(g, x, y)) { const d = (x - sx) ** 2 + (y - sy) ** 2; if (d < bd) { bd = d; best = [x, y] } } }
    if (!best) return null; [tx, ty] = best;
  }
  if (sx === tx && sy === ty) return [[tx + 0.5, ty + 0.5]];
  const N = GRID * GRID, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const open = [sy * GRID + sx]; gs[open[0]] = 0;
  const h = (i) => { const x = i % GRID, y = (i / GRID) | 0, dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy) };
  let n = 0;
  while (open.length && n++ < limit) {
    let bi = 0, bf = Infinity;
    for (let k = 0; k < open.length; k++) { const f = gs[open[k]] + h(open[k]); if (f < bf) { bf = f; bi = k } }
    const cur = open.splice(bi, 1)[0];
    if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % GRID, cy = (cur / GRID) | 0;
    if (cx === tx && cy === ty) {
      const path = []; for (let i = cur; i !== -1 && i !== sy * GRID + sx; i = from[i]) path.push([(i % GRID) + 0.5, ((i / GRID) | 0) + 0.5]);
      return path.reverse();
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const X = cx + dx, Y = cy + dy;
      if (!free(g, X, Y) || (dx && dy && (!free(g, cx + dx, cy) || !free(g, cx, cy + dy)))) continue;
      const j = Y * GRID + X, c = gs[cur] + (dx && dy ? 1.414 : 1);
      if (c < gs[j]) { gs[j] = c; from[j] = cur; open.push(j) }
    }
  }
  return null;
}

/** A battle for a hero (its profile object, which it changes: level, xp, gold). */
export function createBattle(seed, hero, opts = {}) {
  const w = {
    t: 0, rng: new Rng(seed), nextId: 1, hero, map: opts.map ?? hero.map ?? 1,
    hs: null, hp: 0, sp: 0, buffs: [], cds: {}, cast: null, basicT: 0.5, regenT: 3,
    hx: GRID / 2 + 0.5, hy: GRID / 2 + 0.5, face: 0, path: null, pathT: 0, target: null, moving: false,
    monsters: [], respawns: [], phase: "fight", deadT: 0, deaths: [], kills: 0,
    events: [], gained: { xp: 0, gold: 0, kills: 0, items: 0, deaths: 0, levels: 0 },
    onLevel: opts.onLevel ?? null, autoMap: opts.autoMap ?? hero.autoMap ?? true, want: 0,
  };
  refresh(w); w.hp = w.hs.maxHp; w.sp = w.hs.maxSp;
  enterMap(w);
  return w;
}
function enterMap(w) {
  w.grid = mapGrid(w.map); w.monsters = []; w.respawns = []; w.kills = 0;
  w.hx = GRID / 2 + 0.5; w.hy = GRID / 2 + 0.5; w.path = null; w.target = null;
  w.want = 6 + Math.floor(w.rng.next() * 5);
  for (let i = 0; i < w.want; i++) spawnMonster(w);
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
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ---------- monsters ----------
function makeMonster(w, kind, lv, boss, x, y) {
  const M = mapOf(w.map), K = KINDS[kind], B = monsterBase(lv), bal = BAL.monster;
  const hp = Math.round(B.hp * K.hp * bal.hp * (boss ? BOSS_HP : 1)), elem = M.elems[Math.floor(w.rng.next() * M.elems.length)];
  return {
    id: w.nextId++, kind, lv, elem, boss: !!boss, hp, max: hp, x, y, face: Math.floor(w.rng.next() * 8),
    atk: B.atk * K.atk * bal.atk * (boss ? BOSS_ATK : 1), def: Math.min(0.6, K.def + (boss ? 0.1 : 0)), hit: B.hit, flee: Math.round(B.flee * K.flee),
    rate: K.rate, ranged: K.range > 0, atkT: K.rate * 0.6, speed: (K.fly ? 3.2 : 2.6) * (kind === "wolf" ? 1.25 : kind === "golem" ? 0.75 : 1),
    xp: B.xp * K.xp * bal.xp * (boss ? BOSS_LOOT * 4 : 1), gold: B.gold * K.gold * (boss ? BOSS_LOOT * 4 : 1), defCut: 0, defCutT: 0, fly: K.fly ?? 0,
    aggro: !!boss, path: null, pathT: 0, idleT: w.rng.next() * 2, moving: false, attacking: 0, goal: null,
  };
}
/** A free tile far enough from the hero. */
function spawnTile(w, minD = 6) {
  for (let k = 0; k < 60; k++) {
    const x = 1 + Math.floor(w.rng.next() * (GRID - 2)), y = 1 + Math.floor(w.rng.next() * (GRID - 2));
    if (free(w.grid, x, y) && dist(x + 0.5, y + 0.5, w.hx, w.hy) >= minD && !w.monsters.some((m) => m.hp > 0 && Math.floor(m.x) === x && Math.floor(m.y) === y)) return [x + 0.5, y + 0.5];
  }
  return [1.5, 1.5];
}
function spawnMonster(w) {
  const M = mapOf(w.map), span = M.lv[1] - M.lv[0], [x, y] = spawnTile(w);
  const m = makeMonster(w, M.kinds[Math.floor(w.rng.next() * M.kinds.length)], M.lv[0] + Math.floor(w.rng.next() * (span + 1)), false, x, y);
  w.monsters.push(m);
  return m;
}
function spawnBoss(w) {
  const M = mapOf(w.map);
  const corners = [[2.5, 2.5], [GRID - 2.5, 2.5], [2.5, GRID - 2.5], [GRID - 2.5, GRID - 2.5]].sort((a, b) => dist(b[0], b[1], w.hx, w.hy) - dist(a[0], a[1], w.hx, w.hy));
  let [x, y] = corners[0];
  if (!free(w.grid, Math.floor(x), Math.floor(y))) [x, y] = spawnTile(w, 8);
  const m = makeMonster(w, M.boss, M.lv[1] + 2, true, x, y);
  w.monsters.push(m);
  w.events.push({ type: "boss", map: w.map, id: m.id });
}

// ---------- walking ----------
/** Move the hero (isHero: w.hx/w.hy) or a monster along a path toward a goal; faces the way it goes. */
function walk(w, a, gx, gy, speed, dt, isHero) {
  const ax = isHero ? w.hx : a.x, ay = isHero ? w.hy : a.y;
  if ((a.pathT -= dt) <= 0 || !a.path || !a.path.length) { a.path = findPath(w.grid, ax, ay, gx, gy) ?? []; a.pathT = 0.5 + w.rng.next() * 0.3 }
  let left = speed * dt, x = ax, y = ay, moved = false;
  while (left > 0 && a.path.length) {
    const [px, py] = a.path[0], d = dist(x, y, px, py);
    if (d <= left) { if (d > 1e-6) a.face = faceOf(px - x, py - y, a.face); x = px; y = py; left -= d; a.path.shift() }
    else { const k = left / d; a.face = faceOf(px - x, py - y, a.face); x += (px - x) * k; y += (py - y) * k; left = 0 }
    moved = true;
  }
  if (!a.path.length && left > 0 && dist(x, y, gx, gy) > 0.05 && free(w.grid, Math.floor(gx), Math.floor(gy))) {
    const d = dist(x, y, gx, gy), k = Math.min(1, left / d); a.face = faceOf(gx - x, gy - y, a.face); x += (gx - x) * k; y += (gy - y) * k; moved = true;
  }
  if (isHero) { w.hx = x; w.hy = y } else { a.x = x; a.y = y }
  a.moving = moved;
}

// ---------- the hero's blows ----------
function deal(w, m, raw, elem, opts = {}) {
  if (m.hp <= 0) return 0;
  const hs = w.hs;
  m.aggro = true;
  if (!opts.sure && !w.rng.chance(hitChance(hs.hit, m.flee))) { w.events.push({ type: "miss", id: m.id, x: m.x, y: m.y, fly: m.fly }); return 0 }
  const crit = opts.crit || w.rng.chance(hs.crit);
  let dmg = raw * elemMul(elem, m.elem) * (crit ? 1.4 : 1) * (0.92 + 0.16 * w.rng.next());
  dmg = afterDef(dmg, Math.max(0, m.def - m.defCut));
  m.hp -= dmg;
  w.events.push({ type: "dmg", id: m.id, x: m.x, y: m.y, fly: m.fly, amount: Math.round(dmg), crit, elem: elem ?? "neutral", skill: opts.skill ?? null });
  if (m.hp <= 0) kill(w, m);
  return dmg;
}
function kill(w, m) {
  const xp = Math.round(m.xp * w.hs.xpMul * levelGap(w.hero.level, m.lv)), gold = Math.round(m.gold * w.hs.goldMul);
  w.kills++; w.gained.kills++; w.gained.gold += gold; w.hero.gold = (w.hero.gold ?? 0) + gold;
  w.events.push({ type: "kill", id: m.id, x: m.x, y: m.y, kind: m.kind, boss: m.boss, xp, gold });
  if (w.target === m) w.target = null;
  if (!m.boss) w.respawns.push(w.t + 4 + w.rng.next() * 4);
  gainXp(w, xp);
  if (w.rng.chance(m.boss ? 1 : BAL.drop)) { w.gained.items++; w.events.push({ type: "gear", x: m.x, y: m.y, level: mapOf(w.map).id, boss: m.boss, grade: rollGrade(() => w.rng.next(), m.boss ? 0.25 : 0) }) }
  if (w.kills % BOSS_EVERY === 0 && !w.monsters.some((o) => o.boss && o.hp > 0)) spawnBoss(w);
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
    w.events.push({ type: "levelUp", level: h.level, x: w.hx, y: w.hy });
    w.onLevel?.(h, up);
    refresh(w); w.hp = w.hs.maxHp; w.sp = w.hs.maxSp;
    if (w.autoMap) autoPickMap(w);
  }
}
/** The best map for the hero's level: the highest it's 3 levels into. */
export const bestMap = (level) => [...MAPS].reverse().find((m) => level >= m.lv[0] + 3)?.id ?? 1;
export const mapOpen = (level, id) => level >= mapOf(id).lv[0] || id === 1;
function autoPickMap(w) { const b = bestMap(w.hero.level); if (b > w.map && !(w.retreatUntil > w.hero.level)) setMap(w, b) }
export function setMap(w, id) { if (!mapOpen(w.hero.level, id)) return false; w.map = id; w.hero.map = id; enterMap(w); w.events.push({ type: "map", map: id }); return true }

export const reachOf = (w) => (w.hs.melee ? MELEE_RANGE : FAR_RANGE);
const inRange = (w, m) => !!m && m.hp > 0 && dist(w.hx, w.hy, m.x, m.y) <= reachOf(w) + (m.boss ? 0.4 : 0);
function basicAttack(w, target) {
  const hs = w.hs, raw = hs.wtype === "staff" ? (hs.atk + hs.matk) / 2 : hs.atk;
  w.face = faceOf(target.x - w.hx, target.y - w.hy, w.face);
  w.events.push({ type: "basic", id: target.id, x: target.x, y: target.y, fly: target.fly, fromX: w.hx, fromY: w.hy, cls: w.hero.cls, wtype: hs.wtype, ranged: !hs.melee });
  deal(w, target, raw * BAL.basic, "neutral");
}
function useSkill(w, id) {
  const sk = skillOf(w.hero.cls, id), lv = w.hero.skills[id], st = skillAt(sk, lv), t0 = inRange(w, w.target) ? w.target : null;
  const base = CASTERS.has(w.hero.cls) && sk.cast ? w.hs.matk : w.hs.atk;
  if (t0) w.face = faceOf(t0.x - w.hx, t0.y - w.hy, w.face);
  w.events.push({ type: "skill", id, kind: sk.kind, elem: sk.elem, cls: w.hero.cls, x: t0?.x ?? w.hx, y: t0?.y ?? w.hy, fromX: w.hx, fromY: w.hy, r: AREA, target: t0?.id ?? null });
  if (sk.kind === "hit" || sk.kind === "debuff") {
    if (!t0) return;
    for (let i = 0; i < (st.hits ?? 1) && t0.hp > 0; i++) deal(w, t0, base * st.pct / 100 * BAL.skill, sk.elem, { skill: id, crit: !!st.crit });
    if (sk.kind === "debuff") { t0.defCut = st.def; t0.defCutT = st.dur }
  } else if (sk.kind === "area") { if (!t0) return; const cx = t0.x, cy = t0.y; for (const m of alive(w)) if (dist(m.x, m.y, cx, cy) <= AREA) deal(w, m, base * st.pct / 100 * BAL.skill, sk.elem, { skill: id }) }
  else if (sk.kind === "buff") { w.buffs = w.buffs.filter((b) => b.id !== id); w.buffs.push({ id, atk: st.atk ?? 0, aspd: st.aspd ?? 0, def: st.def ?? 0, crit: st.crit ?? 0, until: w.t + st.dur }); refresh(w) }
  else if (sk.kind === "heal") { const n = w.hs.maxHp * st.pct / 100; w.hp = Math.min(w.hs.maxHp, w.hp + n); w.events.push({ type: "heal", n: Math.round(n), x: w.hx, y: w.hy }) }
}
/** Should the hero use this skill now? (a heal only when hurt, a buff when it's run out, the rest on a target in range) */
function wants(w, id) {
  const sk = skillOf(w.hero.cls, id);
  if (sk.kind === "heal") return w.hp < w.hs.maxHp * 0.65;
  if (sk.kind === "buff") return !w.buffs.some((b) => b.id === id) && !!w.target && dist(w.hx, w.hy, w.target.x, w.target.y) < 5;
  return inRange(w, w.target);
}
/** The hero's next target: a boss above all, then what's fighting it, then the nearest. */
function pickTarget(w) {
  const ms = alive(w); if (!ms.length) return null;
  const score = (m) => dist(w.hx, w.hy, m.x, m.y) - (m.boss ? 100 : 0) - (m.aggro ? 4 : 0);
  return ms.reduce((a, b) => (score(b) < score(a) ? b : a));
}

// ---------- the step ----------
export function step(w, dt) {
  w.t += dt;
  if (w.buffs.some((b) => b.until <= w.t)) { w.buffs = w.buffs.filter((b) => b.until > w.t); refresh(w) }
  if ((w.regenT -= dt) <= 0) { w.regenT = 3; if (w.phase !== "dead") { const calm = !w.monsters.some((m) => m.aggro && m.hp > 0); w.hp = Math.min(w.hs.maxHp, w.hp + w.hs.regenHp * (calm ? 3 : 1)); w.sp = Math.min(w.hs.maxSp, w.sp + w.hs.regenSp * (calm ? 2 : 1)) } }
  // monsters come back after a while; the map keeps its number
  w.monsters = w.monsters.filter((m) => m.hp > 0);
  while (w.respawns.length && w.respawns[0] <= w.t) { w.respawns.shift(); if (w.monsters.filter((m) => !m.boss).length < w.want) spawnMonster(w) }
  if (w.phase === "dead") { if ((w.deadT -= dt) <= 0) { w.phase = "fight"; w.hp = w.hs.maxHp; w.sp = w.hs.maxSp; w.events.push({ type: "revive", x: w.hx, y: w.hy }) } else { for (const m of w.monsters) wanderOne(w, m, dt); return } }
  // the monsters: wander, or (angry, or the hero too close to an aggressive one) chase and strike
  for (const m of w.monsters) {
    if (m.defCutT > 0 && (m.defCutT -= dt) <= 0) m.defCut = 0;
    m.attacking = Math.max(0, m.attacking - dt);
    const d = dist(m.x, m.y, w.hx, w.hy);
    if (!m.aggro && AGGRESSIVE.has(m.kind) && d < AGGRO) m.aggro = true;
    if (!m.aggro) { wanderOne(w, m, dt); continue }
    const range = m.ranged ? MON_RANGED : 1.05 + (m.boss ? 0.4 : 0);
    if (d > range) { walk(w, m, w.hx, w.hy, m.speed, dt, false); m.atkT = Math.min(m.atkT, m.rate * 0.6); continue }
    m.moving = false; m.face = faceOf(w.hx - m.x, w.hy - m.y, m.face);
    if ((m.atkT -= dt) <= 0) {
      m.atkT += m.rate; m.attacking = 0.3;
      if (!w.rng.chance(hitChance(m.hit, w.hs.flee))) { w.events.push({ type: "dodge", x: w.hx, y: w.hy }); continue }
      const dmg = afterDef(m.atk * (0.9 + 0.2 * w.rng.next()), w.hs.def, w.hs.softDef);
      w.hp -= dmg;
      w.events.push({ type: "hurt", amount: Math.round(dmg), from: m.id, ranged: m.ranged, x: w.hx, y: w.hy, fromX: m.x, fromY: m.y, elem: m.elem });
      if (w.hp <= 0) return die(w);
    }
  }
  // the hero: a target, walk up to it, fight
  w.retargetT = (w.retargetT ?? 0) - dt;
  if (!w.target || w.target.hp <= 0 || (w.retargetT <= 0 && !inRange(w, w.target))) { const n = pickTarget(w); if (n !== w.target) w.path = null; w.target = n; w.retargetT = 1 }
  const t = w.target;
  w.moving = false;
  if (t && !inRange(w, t) && !w.cast) {
    const d = dist(w.hx, w.hy, t.x, t.y), k = Math.max(0, (d - reachOf(w) * 0.7) / d);
    walk(w, w, w.hx + (t.x - w.hx) * k, w.hy + (t.y - w.hy) * k, HERO_SPEED, dt, true);
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
      w.sp -= st.sp; w.cds[id] = w.t + st.cd * w.hs.cdMul * BAL.cd;
      const ct = (st.cast ?? 0) * w.hs.castMul;
      if (ct > 0.05) { w.cast = { id, t: ct, total: ct, elem: sk.elem }; w.events.push({ type: "castStart", id, t: ct, elem: sk.elem }) }
      else useSkill(w, id);
      break;
    }
  }
  // the basic attack, at its speed, when the target's in range
  if ((w.basicT -= dt) <= 0) {
    if (inRange(w, t)) { basicAttack(w, t); w.basicT += 1 / w.hs.aps } else w.basicT = 0;
  }
}
function wanderOne(w, m, dt) {
  if (!m.goal && (m.idleT -= dt) > 0) { m.moving = false; return }
  if (!m.goal) {
    for (let k = 0; k < 8; k++) { const x = Math.floor(m.x) + Math.floor(w.rng.next() * 7) - 3, y = Math.floor(m.y) + Math.floor(w.rng.next() * 7) - 3; if (free(w.grid, x, y)) { m.goal = [x + 0.5, y + 0.5]; m.path = null; break } }
    if (!m.goal) { m.idleT = 1; return }
  }
  walk(w, m, m.goal[0], m.goal[1], m.speed * 0.45, dt, false);
  if (dist(m.x, m.y, m.goal[0], m.goal[1]) < 0.1 || !m.path?.length && !m.moving) { m.goal = null; m.idleT = 1 + w.rng.next() * 2.5 }
}
function die(w) {
  const h = w.hero, loss = Math.floor(xpToNext(h.level) * DEATH_XP);
  h.xp = Math.max(0, (h.xp ?? 0) - loss);
  w.phase = "dead"; w.deadT = RESPAWN; w.hp = 0; w.cast = null; w.buffs = []; w.target = null; refresh(w);
  w.gained.deaths++; w.deaths.push(w.t); w.deaths = w.deaths.filter((t) => t > w.t - 120);
  w.events.push({ type: "death", xp: loss, x: w.hx, y: w.hy });
  // back up at the map's middle; the monsters forget it
  w.hx = GRID / 2 + 0.5; w.hy = GRID / 2 + 0.5; w.path = null;
  // the boss goes away when it wins (it comes again after another hundred)
  if (w.monsters.some((m) => m.boss)) w.events.push({ type: "bossLeaves" });
  w.monsters = w.monsters.filter((m) => !m.boss);
  for (const m of w.monsters) { m.aggro = false; m.goal = null }
  if (w.autoMap && w.deaths.length >= 3 && w.map > 1) { w.retreatUntil = h.level + 1; setMap(w, w.map - 1); w.deaths = [] }
}
