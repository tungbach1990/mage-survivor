// Allies on the field: summoned by `summon` skills, they live a while (or until beaten down), then go.
// Spirits cast from by the wall, beasts run at the nearest monster, golems plant themselves in the path and
// monsters that reach one stop to beat on it instead of the wall (world.js). A fusion alternates its two
// elements hit by hit, so its own blows set off their reaction.

import { ENEMIES } from "./enemies.js?v=mw6zzix7";
import { SKILLS } from "../data/skills.js?v=mw6zzix7";
import { CHAPTERS } from "../data/chapters.js?v=mw6zzix7";
import { damage, stun, steamAt } from "./combat.js?v=mw6zzix7";
import { applySlow } from "./status.js?v=mw6zzix7";
import { W, WALL_X, LANE, center, alive, inView, around, nearest, addGround, addWell, densest, movable } from "./field.js?v=mw6zzix7";

const BLOCK = 8;   // how far in front of a golem a monster stops

export const minionsOf = (w, id) => w.minions.filter((m) => m.skill === id && m.hp > 0);
/** A summon's marks: those the class has open; none open, it just hits ("phys": no mark). */
const elemsOf = (w, sk) => { const e = sk.elems.filter((m) => !w.unlocked || w.unlocked.has(m)); return e.length ? e : ["phys"] };
/** Where a falcon hovers: over the hero's head (the second one a little behind). */
export const perch = (slot) => [58 - slot * 4, 118 + (slot ? 16 : 0)];

/**
 * A falcon's hunt: from its perch it picks the foremost monster in reach, stoops on it, rakes it with its
 * talons (its marks, by turns) and climbs back to the perch to wait for the next dive.
 */
function hunt(w, m, dt) {
  const st = m.st;
  if (m.state === "perch") {
    const [px, py] = perch(m.slot);
    m.x += (px - m.x) * Math.min(1, dt * 6); m.y += (py - m.y) * Math.min(1, dt * 6);
    if (m.atkT > 0) return;
    const e = inView(w).filter((o) => o.x - WALL_X <= st.range).sort((a, b) => a.x - b.x)[0];
    if (!e) { m.atkT = 0.2; return }
    m.state = "dive"; m.target = e.id;
    w.events.push({ type: "falconDive", id: m.id, x: m.x, y: m.y });
    return;
  }
  if (m.state === "dive") {
    const e = w.enemies.find((o) => o.id === m.target && o.hp > 0);
    if (!e) { m.state = "return"; return }
    const [tx, ty] = center(e), dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy), step = st.speed * dt;
    if (d > step + 2) { m.x += (dx / d) * step; m.y += (dy / d) * step; return }
    m.x = tx; m.y = ty;
    for (let i = 0; i < (st.claws ?? 1); i++) if (e.hp > 0) strike(w, m, e);
    m.atk = 0.2;
    w.events.push({ type: "claw", id: m.id, x: tx, y: ty, elem: m.elems[(m.hits + 1) % m.elems.length] });
    m.state = "return";
    return;
  }
  // climbing back, a little slower than the stoop
  const [px, py] = perch(m.slot), dx = px - m.x, dy = py - m.y, d = Math.hypot(dx, dy), step = st.speed * 0.7 * dt;
  if (d > step + 1) { m.x += (dx / d) * step; m.y += (dy / d) * step; return }
  m.x = px; m.y = py; m.state = "perch"; m.atkT = st.rate;
}

/** Summon one ally of skill `id` (if there's room). Returns whether it did. */
export function summon(w, id, st) {
  if (!inView(w).length || minionsOf(w, id).length >= st.max) return false;
  const sk = SKILLS[id];
  if (sk.body === "falcon") {
    // a falcon: no health, it doesn't go away; it hovers over the archer's head between dives
    const n = minionsOf(w, id).length, [px, py] = perch(n);
    const m = { id: w.nextId++, skill: id, body: "falcon", elems: elemsOf(w, sk), x: px, y: py, hp: 1, max: 1, life: Infinity, invulnerable: true, atkT: 0.4 + n * 0.5, hits: 0, st, slot: n, state: "perch", target: null, flash: 0, atk: 0, tick: 0 };
    w.minions.push(m);
    w.events.push({ type: "summon", id: m.id, skill: id, body: m.body, elems: m.elems, x: px, y: py });
    return true;
  }
  const c = densest(w) ?? { y: (LANE[0] + LANE[1]) / 2 };
  const y = Math.round(Math.max(LANE[0] + 4, Math.min(LANE[1] - 4, c.y + w.rng.range(-14, 14))));
  const x = sk.body === "golem" ? WALL_X + 34 + w.rng.range(0, 30) : sk.body === "spirit" ? WALL_X + 14 + w.rng.range(0, 16) : WALL_X + 20;
  // as sturdy against this chapter's blows as the first chapter's
  const hp = st.hp * (w.mods?.summonHp ?? 1) * (CHAPTERS[Math.min(5, w.chapter ?? 1) - 1]?.dmg ?? 1);
  const m = { id: w.nextId++, skill: id, body: sk.body, elems: elemsOf(w, sk), x, y, hp, max: hp, life: st.life, atkT: 0.3, hits: 0, st, revived: false, tick: 0, flash: 0, atk: 0 };
  w.minions.push(m);
  w.events.push({ type: "summon", id: m.id, skill: id, body: m.body, elems: m.elems, x, y });
  return true;
}

function strike(w, m, e) {
  w.src = m.skill;
  const st = m.st, elem = m.elems[m.hits++ % m.elems.length];
  const r = damage(w, e, st.dmg, elem, { burn: st.burn, poison: st.poison, stacks: st.stacks, stun: st.stun, freezeAt3: st.freezeAt3, push: st.push, summon: true });
  if (st.drain) w.wall.hp = Math.min(w.wall.max, w.wall.hp + st.dmg * st.drain);
  if (m.skill === "plague") e.plague = true;
  return r;
}

function shoot(w, m) {
  const st = m.st, from = [m.x + 6, m.y - 14];
  const list = inView(w).filter((e) => e.x - m.x <= st.range && e.x > m.x).sort((a, b) => a.x - b.x);
  if (!list.length) return false;
  const targets = st.split ? list.slice(0, st.split) : [list[0]];
  for (const e of targets) {
    const elem = m.elems[m.hits % m.elems.length];
    w.events.push({ type: "fx", fx: "beam", x: from[0], y: from[1] + 6, x2: center(e)[0], y2: center(e)[1], elem });
    w.events.push({ type: "impact", elem, x: center(e)[0], y: center(e)[1] });
    strike(w, m, e);
  }
  if (st.chains) {   // the bolt leaps on
    let last = targets[0]; const hit = new Set(targets);
    for (let i = 1; i < st.chains; i++) {
      const next = nearest(w, last.x, last.y, 1, hit)[0];
      if (!next || Math.hypot(next.x - last.x, next.y - last.y) > 50) break;
      w.events.push({ type: "chain", pts: [center(last), center(next)], ids: [next.id], elem: m.elems[0] });
      hit.add(next); damage(w, next, st.dmg * 0.7, "volt", { stun: st.stun, summon: true }); last = next;
    }
  }
  return true;
}

function bite(w, m, dt) {
  const st = m.st, e = nearest(w, m.x, m.y, 1)[0];
  if (!e) { m.x = Math.max(WALL_X + 14, m.x - st.speed * 0.5 * dt); return false }
  const def = ENEMIES[e.type], reach = def.half + 8, dx = e.x - reach - m.x, dy = e.y - m.y, d = Math.hypot(dx, dy);
  if (d > 3) { const k = Math.min(d, st.speed * dt); m.x += (dx / d) * k; m.y += (dy / d) * k; m.walking = true; return false }
  m.walking = false;
  if (m.atkT > 0) return false;
  strike(w, m, e);
  w.events.push({ type: "impact", elem: m.elems[0], x: e.x - def.half, y: e.y, h: def.cy });
  return true;
}

function punch(w, m) {
  const st = m.st;
  const e = alive(w).filter((o) => o.x > m.x && o.x - ENEMIES[o.type].half - m.x <= BLOCK + 6 && Math.abs(o.y - m.y) < 16).sort((a, b) => a.x - b.x)[0];
  if (!e) return false;
  strike(w, m, e);
  w.events.push({ type: "impact", elem: m.elems[m.hits % m.elems.length], x: e.x - ENEMIES[e.type].half, y: e.y, h: ENEMIES[e.type].cy });
  if (st.chains) { let last = e; const hit = new Set([e]); for (let i = 0; i < st.chains; i++) { const n = nearest(w, last.x, last.y, 1, hit)[0]; if (!n || Math.hypot(n.x - last.x, n.y - last.y) > 50) break; w.events.push({ type: "chain", pts: [center(last), center(n)], ids: [n.id], elem: "volt" }); hit.add(n); damage(w, n, st.dmg * 0.6, "volt", { stun: st.stun, summon: true }); last = n } }
  if (st.push && movable(e)) e.x += st.push;
  return true;
}

/** A monster blocked by a golem hit it: this is the blow. */
export function hitMinion(w, m, e, amount) {
  m.hp -= amount; m.flash = 0.12;
  w.events.push({ type: "minionHit", id: m.id, x: m.x, y: m.y });
  const st = m.st;
  if (st.thorns) damage(w, e, st.thorns, "earth", { reaction: true, quiet: true });
  if (st.puddle) { e.auras.set("water", 5); e.status.wet = 5 }
  if (st.chillBack) applySlow(e, ENEMIES[e.type], true);   // three chills freeze it
}

/** The golem standing in this monster's way, if any. */
export function blockerFor(w, e) {
  const def = ENEMIES[e.type];
  for (const m of w.minions) if (m.body === "golem" && m.hp > 0 && e.x > m.x && e.x - def.half <= m.x + BLOCK && Math.abs(e.y - m.y) < 14) return m;
  return null;
}

export function updateMinions(w, dt) {
  for (const m of w.minions) {
    if (m.dead) continue;
    const st = m.st;
    m.life -= dt; m.atkT -= dt; m.flash = Math.max(0, m.flash - dt); m.atk = Math.max(0, m.atk - dt); m.tick -= dt;
    let did = false;
    if (m.body === "falcon") { hunt(w, m, dt); continue }
    if (m.hp > 0 && m.life > 0) {
    if (m.body === "spirit") { if (m.atkT <= 0) did = shoot(w, m) }
    else if (m.body === "beast") did = bite(w, m, dt);
    else if (m.atkT <= 0) did = punch(w, m);
    if (did) { m.atkT = st.rate; m.atk = 0.18 }
    else if (m.atkT <= 0) m.atkT = 0.1;
    }
    // what each one does on its own
    if (st.heal) w.wall.hp = Math.min(w.wall.max, w.wall.hp + st.heal * dt);
    if (m.tick <= 0) {
      m.tick = 1;
      if (st.puddle && !w.grounds.some((g) => g.kind === "water" && Math.hypot(g.x - m.x, g.y - m.y) < 8)) addGround(w, "water", m.x + 6, m.y, st.puddle, 3, "summon");
      if (st.steam) { m.steamT = (m.steamT ?? 0) - 1; if (m.steamT <= 0) { m.steamT = st.steam; addGround(w, "steam", m.x + 14, m.y, 16, 2); for (const o of around(w, m.x + 14, m.y, 16)) damage(w, o, st.dmg * 0.5, "steam", { reaction: true }) } }
      if (st.well) { m.wellT = (m.wellT ?? 1) - 1; if (m.wellT <= 0) { const c = densest(w); if (c) { m.wellT = st.well; addWell(w, c.x, c.y, 36, 30, 1.5); w.events.push({ type: "fx", fx: "well", x: c.x, y: c.y, r: 36, t: 1.5, elem: "arcane" }) } } }
    }
    if (st.lava && m.walking) { m.lavaT = (m.lavaT ?? 0) - dt; if (m.lavaT <= 0) { m.lavaT = st.lava; addGround(w, "lava", m.x, m.y, 8, 3, "summon") } }
    m.x = Math.max(WALL_X + 10, Math.min(W - 10, m.x)); m.y = Math.max(LANE[0] - 4, Math.min(LANE[1] + 4, m.y));
    if (m.hp <= 0 || m.life <= 0) {
      if (m.skill === "phoenix" && !m.revived) {   // bursts into flame and rises again
        for (const o of around(w, m.x + 20, m.y, 30)) damage(w, o, st.dmg * 2, "fire", { reaction: true });
        steamAt(w, m.x + 20, m.y, 20);
        w.events.push({ type: "fx", fx: "blast", x: m.x + 10, y: m.y, elem: "fire", r: 30 });
        Object.assign(m, { hp: m.max, life: st.life, revived: true });
        continue;
      }
      m.hp = 0; m.dead = true;
      w.events.push({ type: "minionDie", id: m.id, x: m.x, y: m.y, elems: m.elems });
    }
  }
  w.minions = w.minions.filter((m) => !m.dead);
}
