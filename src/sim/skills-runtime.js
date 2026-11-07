// The skill archetypes, run from the data in data/skills.js: bolt, ball, chain, orb, zone, passive (weather
// lives in world.js). Each hit goes through damage(), which leaves the element's aura and sets off reactions.

import { ENEMIES } from "./enemies.js";
import { SKILLS, WEATHER, stats } from "../data/skills.js";
import { T, skillT } from "../data/tuning.js";
import { damage, applyAura, steamAt, obsidianAt, stun } from "./combat.js";
import { applyFreeze, applyRoot, applyPoison, speedFactor } from "./status.js";
import { W, H, GEM, WALL_X, center, alive, inView, around, pickTarget, densest, addGround, addWell, movable } from "./field.js";

export const IMBUE_CHANCE = 0.25;
/** A skill's numbers now, with the run's modifiers: cooldown, area, and fire slowed by the rain. */
export function skillStats(w, id) {
  const st = { ...stats(id, w.skills[id].level) };
  const tu = skillT(id);
  if (st.dmg) st.dmg *= (tu.dmg ?? 1) * (SKILLS[id].kind === "summon" ? T.summon.dmg : 1) * (w.power ?? 1);
  if (st.hp) st.hp *= T.summon.hp;
  if (st.cd) st.cd *= (w.mods?.cd ?? 1) * (tu.cd ?? 1);
  if (st.radius) st.radius *= w.mods?.area ?? 1;
  if (SKILLS[id].elem === "fire" && w.weather?.kind === "rain" && st.speed) st.speed *= WEATHER.rain.fireSpeed;
  // the marks it leaves besides its own: the skill's, and (a basic attack) those it was imbued with
  // (an imbue clings to a quarter of the blows, or ten marks would come far too easily)
  const imbued = SKILLS[id].basic && w.imbue?.size ? [...w.imbue].filter(() => w.rng.chance(IMBUE_CHANCE)) : [];
  const also = [...(SKILLS[id].also ?? []), ...imbued];
  if (also.length) st.also = also;
  return st;
}
/** What a hit of this skill carries: its element effect's strength. */
const carry = (st) => ({ burn: st.burn, poison: st.poison, stun: st.stun, freezeAt3: st.freezeAt3, push: st.push, stacks: st.stacks, also: st.also });
/** After a blow lands: a basic attack's extras (an Acolyte's light mends the wall, a Merchant's cart drops a coin). */
function perks(w, st) { if (st.mend) w.wall.hp = Math.min(w.wall.max, w.wall.hp + st.mend); if (st.coin) w.gold += 1 }

function aimAt(e, speed) {
  // lead the target: where it will be when the shot arrives
  const [cx, cy] = center(e), d = Math.hypot(cx - GEM[0], cy - GEM[1]), v = ENEMIES[e.type].speed * speedFactor(e);
  return [cx - v * (d / speed), cy];
}
function shoot(w, id, st, tx, ty, extra = {}) {
  const d = Math.hypot(tx - GEM[0], ty - GEM[1]) || 1;
  const s = { id: w.nextId++, skill: id, elem: SKILLS[id].elem, kind: SKILLS[id].kind, x: GEM[0], y: GEM[1], vx: ((tx - GEM[0]) / d) * st.speed, vy: ((ty - GEM[1]) / d) * st.speed, left: d, st, hit: new Set(), pierced: 0, ...extra };
  w.shots.push(s);
  w.events.push({ type: "shot", id: s.id, skill: id, elem: s.elem, kind: s.kind, x: s.x, y: s.y, vx: s.vx, vy: s.vy });
  return s;
}

// ---------- casting ----------
export function cast(w, id) {
  const sk = SKILLS[id], st = skillStats(w, id);
  switch (sk.kind) {
    case "bolt": {
      const e = pickTarget(w); if (!e) return false;
      const n = st.count ?? 1;
      for (let i = 0; i < n; i++) {
        const [x, y] = aimAt(e, st.speed);
        shoot(w, id, st, x, y + (i - (n - 1) / 2) * 10, { target: st.homing ? e.id : null, delay: i * 0.08 });
      }
      return true;
    }
    case "ball": { const c = densest(w); if (!c) return false; shoot(w, id, st, c.x, c.y - 4); return true }
    case "orb": {
      const c = densest(w); if (!c) return false;
      const s = shoot(w, id, st, c.x, c.y - 8);
      s.life = st.life; s.tickT = 0.15; s.left = Infinity;
      return true;
    }
    case "chain": {
      const first = pickTarget(w); if (!first) return false;
      const hit = [first], pts = [GEM, center(first)];
      while (hit.length < st.chains) {
        const last = hit[hit.length - 1], [lx, ly] = center(last);
        const next = alive(w).filter((e) => !hit.includes(e)).map((e) => [e, Math.hypot(center(e)[0] - lx, center(e)[1] - ly)])
          .filter(([, d]) => d <= st.jump).sort((a, b) => a[1] - b[1])[0];
        if (!next) break;
        hit.push(next[0]); pts.push(center(next[0]));
      }
      w.events.push({ type: "chain", pts, ids: hit.map((e) => e.id), elem: sk.elem, skill: id });
      for (const e of hit) damage(w, e, st.dmg, sk.elem, carry(st));
      return true;
    }
    case "zone": {
      let x, y;
      if (sk.at === "target") { const e = pickTarget(w); if (!e) return false; [x, y] = [e.x, e.y] }
      else if (sk.at === "strongest") { const e = inView(w).sort((a, b) => b.hp - a.hp)[0]; if (!e) return false; [x, y] = [e.x, e.y] }
      else { const c = densest(w, 26); if (!c) return false; [x, y] = [c.x, c.y] }
      const z = { id: w.nextId++, skill: id, elem: sk.elem, x, y, st, t: 0, life: st.life ?? 0, tickT: 0 };
      w.events.push({ type: "zone", skill: id, elem: sk.elem, x, y, r: st.radius, life: st.life ?? 0.6 });
      if (!st.life) zoneHit(w, z); else w.zones.push(z);
      return true;
    }
    case "melee": {
      // a swing at what is near the wall: the nearest one and its neighbours in a band `width` tall
      const near = alive(w).filter((e) => e.x - ENEMIES[e.type].half <= WALL_X + st.reach).sort((a, b) => a.x - b.x);
      if (!near.length) {
        if (st.wave) { const e = pickTarget(w); if (!e) return false; shoot(w, id, { ...st, speed: 220, pierce: 5, dmg: st.dmg * 0.8 }, ...aimAt(e, 220)); return true }
        return false;
      }
      const y0 = near[0].y, hit = near.filter((e) => Math.abs(e.y - y0) <= st.width / 2).slice(0, st.targets ?? 1);
      for (let r = 0; r < (st.repeat ?? 1); r++) for (const e of hit) {
        if (e.hp <= 0) continue;
        damage(w, e, st.dmg * (st.vsAttack && e.state === "attack" ? st.vsAttack : 1), sk.elem, { ...carry(st), push: undefined });
        if (st.push && e.hp > 0 && movable(e)) e.x += st.push * (ENEMIES[e.type].boss ? 0.2 : 1);
        perks(w, st);
      }
      w.events.push({ type: "melee", skill: id, elem: sk.elem, x: WALL_X + 6, y: y0, reach: st.reach, width: st.width, n: hit.length, repeat: st.repeat ?? 1 });
      if (st.wave) { const e = pickTarget(w); if (e) shoot(w, id, { ...st, speed: 220, pierce: 5, dmg: st.dmg * 0.8 }, ...aimAt(e, 220)) }
      return true;
    }
    case "dash": {
      // a charge down the row where they're thickest: everything in the band takes it and is shoved back
      const c = densest(w, 20); if (!c) return false;
      const hit = alive(w).filter((e) => Math.abs(e.y - c.y) <= st.width && e.x <= WALL_X + st.length);
      if (!hit.length) return false;
      for (const e of hit) { damage(w, e, st.dmg, sk.elem, { ...carry(st), push: undefined }); if (st.push && e.hp > 0 && movable(e)) e.x += st.push * (ENEMIES[e.type].boss ? 0.2 : 1) }
      w.events.push({ type: "dash", skill: id, elem: sk.elem, x: WALL_X, x2: WALL_X + st.length, y: c.y });
      return true;
    }
    default: return false;
  }
}

function zoneHit(w, z) {
  const { st, elem } = z;
  for (const e of around(w, z.x, z.y, st.radius)) {
    damage(w, e, st.dmg, elem, carry(st));
    if (st.coin) w.gold += 1;
    if (e.hp <= 0) continue;
    if (st.root) applyRoot(e, ENEMIES[e.type], st.root);
    if (st.push) e.x += st.push * (ENEMIES[e.type].boss ? 0.2 : 1);
  }
  if (st.puddle) addGround(w, "water", z.x, z.y, st.radius * st.puddle, 6, "skill");
  if (elem === "ice") obsidianAt(w, z.x, z.y, st.radius * 0.7);
  if (elem === "fire") steamAt(w, z.x, z.y, st.radius * 0.6);
}
export function updateZones(w, dt) {
  for (const z of w.zones) {
    z.t += dt; z.tickT -= dt;
    if (z.tickT <= 0) { z.tickT += z.st.tick ?? 0.5; zoneHit(w, z) }
  }
  w.zones = w.zones.filter((z) => z.t < z.life);
}

// ---------- shots in flight ----------
function burst(w, s) {
  const { st, elem } = s, x = s.x, y = s.y + 4;
  for (const e of around(w, x, y, st.radius)) damage(w, e, st.dmg, elem, carry(st));
  if (elem === "fire") steamAt(w, x, y, st.radius * 0.6);
  if (elem === "ice") obsidianAt(w, x, y, st.radius * 0.7);
  if (st.puddle) addGround(w, "water", x, y, st.radius * st.puddle, 6, elem === "ice" ? "ice" : "skill");
  w.events.push({ type: "explode", skill: s.skill, elem, x, y, r: st.radius });
  w.hitstop = Math.max(w.hitstop, 0.05);
}
export function updateShots(w, dt) {
  for (const s of w.shots) {
    if (s.dead) continue;
    if (s.delay > 0) { s.delay -= dt; continue }
    if (s.target) {   // homing: steer toward the target while it lives
      const t = w.enemies.find((e) => e.id === s.target && e.hp > 0);
      if (t) { const [tx, ty] = center(t), sp = Math.hypot(s.vx, s.vy), d = Math.hypot(tx - s.x, ty - s.y) || 1, k = Math.min(1, dt * 6); s.vx += ((tx - s.x) / d * sp - s.vx) * k; s.vy += ((ty - s.y) / d * sp - s.vy) * k }
    }
    const step = Math.hypot(s.vx, s.vy) * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.left -= step;
    if (s.kind === "orb") {
      s.life -= dt; s.tickT -= dt;
      if (s.st.pull) for (const e of around(w, s.x, s.y + 8, s.st.radius * 1.6)) { const d = Math.hypot(s.x - e.x, s.y + 8 - e.y) || 1, k = s.st.pull * dt * (ENEMIES[e.type].boss ? 0.2 : 1); e.x += ((s.x - e.x) / d) * k; e.y += ((s.y + 8 - e.y) / d) * k * 0.5 }
      if (s.tickT <= 0) {
        s.tickT += s.st.tick;
        const near = alive(w).filter((e) => Math.hypot(center(e)[0] - s.x, center(e)[1] - s.y) <= s.st.radius + ENEMIES[e.type].r);
        if (near.length) w.events.push({ type: "zap", from: [s.x, s.y], to: near.map(center), ids: near.map((e) => e.id), elem: s.elem });
        for (const e of near) {
          damage(w, e, s.st.dmg, s.elem, { quiet: true, ...carry(s.st), stun: undefined });
          if (e.hp > 0 && s.st.stunChance && w.rng.chance(s.st.stunChance)) stun(w, e, s.st.stun);
        }
      }
      if (s.life <= 0 || s.x > W + 20) s.dead = true;
      continue;
    }
    const touch = alive(w).filter((e) => !s.hit.has(e.id) && Math.hypot(center(e)[0] - s.x, center(e)[1] - s.y) <= ENEMIES[e.type].r + 3);
    if (s.kind === "ball") {
      if (touch.length || s.left <= 0) { burst(w, s); s.dead = true }
    } else {
      for (const e of touch) {
        s.hit.add(e.id);
        if (s.pierced === 0 && s.st.puddle) { obsidianAt(w, e.x, e.y, 3); addGround(w, "water", e.x, e.y, s.st.puddle, 6, "ice") }
        if (s.elem === "fire") steamAt(w, e.x, e.y, 3);
        damage(w, e, s.st.dmg, s.elem, carry(s.st));
        perks(w, s.st);
        if (s.st.push && s.elem !== "wind" && e.hp > 0 && movable(e)) e.x += s.st.push * (ENEMIES[e.type].boss ? 0.2 : 1);
        w.events.push({ type: "impact", skill: s.skill, elem: s.elem, x: s.x, y: s.y });
        if (++s.pierced >= (s.st.pierce ?? 1)) { s.dead = true; break }
      }
      if (s.target && !s.dead && s.left < -60) s.dead = true;
    }
    if (s.x > W + 30 || s.x < -30 || s.y < -30 || s.y > H + 30) s.dead = true;
  }
  for (const s of w.shots) if (s.dead && !s.gone) { s.gone = true; w.events.push({ type: "shotEnd", id: s.id }) }
  w.shots = w.shots.filter((s) => !s.dead);
}

// ---------- passives ----------
/** Frost Nova: when monsters hit the wall, ice bursts round them. Returns true when it went off. */
export function nova(w) {
  const st = skillStats(w, "nova");
  const at = alive(w).filter((e) => e.state === "attack");
  if (!at.length) return false;
  const y = at.reduce((a, e) => a + e.y, 0) / at.length, cx = WALL_X + 16;
  for (const e of around(w, cx, y, st.radius)) {
    damage(w, e, st.dmg, "ice");
    if (e.hp > 0 && applyFreeze(e, ENEMIES[e.type], st.freeze)) w.events.push({ type: "frozen", id: e.id });
  }
  obsidianAt(w, cx, y, st.radius * 0.6);
  addGround(w, "water", cx, y, st.radius * 0.6, 6, "ice");
  w.events.push({ type: "nova", x: cx, y, r: st.radius });
  return true;
}

export { applyAura, applyPoison, addWell };
