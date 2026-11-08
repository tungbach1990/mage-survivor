// The field: its geometry, who is where, and what lies on the ground. Shared by world.js, combat.js and the
// reactions, so none of them has to import the others.

import { ENEMIES, LANE } from "./enemies.js?v=mw80eoce";

export const W = 320, H = 180;
export const WALL_X = 80;                 // the wall's outer face
export const GEM = [47, 118];             // where spells leave the staff (the middle of the lanes)
export const MAGE_FEET = [29, 118];
export { LANE };

// on the ground: where it stands (how tall it is, the view lifts its effects by; events carry it as `h`)
export const center = (e) => [e.x, e.y];
export const alive = (w) => w.enemies.filter((e) => e.hp > 0);
/** What the spells can see: in fog, only what has come close. */
export const inView = (w) => { const far = Math.min(W - 14, w.sight ?? W); return alive(w).filter((e) => e.x <= far) };
/** Can it be pushed, pulled or blown about? (earth and wind kin can't) */
export const movable = (e) => !e.immune?.has("push") && !(e.tenacity?.unstop > 0);
export const inBlast = (e, x, y, r) => Math.hypot(e.x - x, (e.y - y) * 1.5) <= r + ENEMIES[e.type].half * 0.5;
export const around = (w, x, y, r, skip) => alive(w).filter((o) => o !== skip && inBlast(o, x, y, r));
export const nearest = (w, x, y, n, skip = new Set()) =>
  alive(w).filter((o) => !skip.has(o)).map((o) => [o, Math.hypot(o.x - x, o.y - y)]).sort((a, b) => a[1] - b[1]).slice(0, n).map(([o]) => o);

/** The one to shoot: among the three nearest the wall, the one carrying the most auras (focus fire builds auras). */
export function pickTarget(w) {
  const near = inView(w).sort((a, b) => a.x - b.x).slice(0, 3);
  if (!near.length) return null;
  const focus = w.mods?.focus ?? 0;
  return near.reduce((best, e) => (score(e) > score(best) ? e : best));
  function score(e) { return e.auras.size * (1 + focus) - (e.x - near[0].x) * 0.05 }
}
export const nearestToWall = (w) => inView(w).reduce((best, e) => (!best || e.x < best.x ? e : best), null);
/** The point (feet) with the most monsters within r round it. */
export function densest(w, r = 24) {
  const list = inView(w);
  let best = null, bestN = -1;
  for (const e of list) {
    let n = 0, sx = 0, sy = 0;
    for (const o of list) if (Math.hypot(o.x - e.x, (o.y - e.y) * 1.4) < r) { n++; sx += o.x; sy += o.y }
    if (n > bestN || (n === bestN && e.x < best.x)) { bestN = n; best = { x: sx / n, y: sy / n, n } }
  }
  return best;
}

// ---------- the ground ----------
// What each kind of ground does to whoever stands in it (world.js applies it every step).
export const GROUNDS = {
  water:    {},
  lava:     { burn: 4 },
  steam:    { atk: 0.7, dps: 3, elem: "steam" },
  mud:      { slow: 0.5 },
  sand:     { atk: 0.5 },
  tar:      { slow: 0.7, poison: 2 },
  hallowed: { dps: 4, elem: "light", heal: true },
  void:     { dps: 6, elem: "dark", pull: 8 },
  miasma:   { poison: 2 },
  vortex:   { pull: 34 },
  runestone:{ turret: "arcane" },
  swamp:    { slow: 0.5, poison: 2 },
  stone:    {},
};
export const GROUND_MAX = 16;

export function addGround(w, kind, x, y, rx, life, src = kind) {
  x = Math.round(Math.max(WALL_X + 8, Math.min(W - 6, x)));
  y = Math.round(Math.max(LANE[0] - 4, Math.min(LANE[1] + 4, y)));
  const g = { id: w.nextId++, kind, x, y, rx, ry: rx * 0.45, life, max: life, src, shockCd: 0, shockT: 0, tick: 0 };
  w.grounds.push(g);
  while (w.grounds.length > GROUND_MAX) w.grounds.shift();   // the oldest goes first
  return g;
}
export const inGround = (g, x, y) => ((x - g.x) / g.rx) ** 2 + ((y - g.y) / g.ry) ** 2 <= 1;
export const touching = (a, b) => ((a.x - b.x) / (a.rx + b.rx)) ** 2 + ((a.y - b.y) / (a.ry + b.ry)) ** 2 <= 1;
/** Does a circle of radius r at (x, y) (flattened like the ground) reach ground g? */
export const reaches = (g, x, y, r) => ((x - g.x) / (g.rx + r)) ** 2 + ((y - g.y) / (g.ry + r * 0.45)) ** 2 <= 1;
export const groundsAt = (w, x, y, kind) => w.grounds.filter((g) => (!kind || g.kind === kind) && inGround(g, x, y));

/** A body of water: the given puddles and every puddle touching them, and so on. */
export function waterBody(w, starts) {
  const group = new Set(starts), queue = [...starts];
  while (queue.length) {
    const a = queue.pop();
    for (const b of w.grounds) if (b.kind === "water" && !group.has(b) && touching(a, b)) { group.add(b); queue.push(b) }
  }
  return group;
}

/** A pull toward a point for a while (vortex, void, the black hole): { x, y, r, k px/s, t }. */
export function addWell(w, x, y, r, k, t, bossK = 0.3) { w.wells.push({ x, y, r, k, t, bossK }) }
