// Status effects: burn (damage over time), slow (stacks; three freeze), freeze, stun, poison (stacks, spreads
// on death), root (held in place), fear (walks back), arcane charge (bursts at 5), judged (the next hit hurts more).
// Every rule lives here so the tests can pin it down. The auras (what elements a monster carries) live in combat.js.

export const BURN = { dur: 3, tick: 0.5, maxStacks: 3 };
export const SLOW = { dur: 2.5, per: 0.4, floor: 0.3, maxStacks: 3 };
export const FREEZE = { immune: 2 };
export const STUN = { immune: 1 };
export const POISON = { dur: 5, tick: 0.5, maxStacks: 5 };

/**
 * Tenacity: bosses and elites take crowd control shortened (x mul); `max` seconds of it close together and
 * they shake it all off and turn UNSTOPPABLE for `time` s. Returns the duration to apply (0: none).
 */
export function cc(e, dur) {
  const t = e.tenacity;
  if (!t) return dur;
  if (t.unstop > 0) return 0;
  const d = dur * t.mul;
  t.poise += d;
  if (t.poise >= t.max) {
    t.poise = 0; t.unstop = t.time;
    const st = e.status; st.stun = 0; st.freeze = 0; st.root = 0; st.fear = 0;
    e.justUnstoppable = true;
    return 0;
  }
  return d;
}
export const unstoppable = (e) => (e.tenacity?.unstop ?? 0) > 0;

export function freshStatus() {
  return {
    burn: { stacks: 0, t: 0, tick: 0, dps: 0, black: 0 },
    slow: { stacks: 0, t: 0 },
    freeze: 0, freezeImmune: 0,
    stun: 0, stunImmune: 0,
    wet: 0,
    poison: { stacks: 0, t: 0, tick: 0, dps: 0, max: POISON.maxStacks, fast: 0 },
    root: 0,          // held in place, still hits
    fear: 0,          // walking back
    charge: 0,        // arcane stacks
    judged: false,    // the next hit +30%
    mud: 0,           // slowed by mud/tar/drowning, separate from chill
    dots: {},         // bleed and venom: { stacks, t, tick, dps }
    dotFast: 0,       // TOXIC WOUND: dots tick twice as fast
    weak: 0,          // NAUSEA: half as hard on the wall
  };
}

/** A damage-over-time mark (bleed, venom): stacks up to `max`, 5 s, ticking every half second. */
export function applyDot(e, kind, dps, stacks = 1, max = 5) {
  const d = (e.status.dots[kind] ??= { stacks: 0, t: 0, tick: 0.5, dps: 0 });
  if (!d.stacks) d.tick = 0.5;
  d.stacks = Math.min(max, d.stacks + stacks);
  d.t = 5;
  d.dps = Math.max(d.dps, dps);
}

/** Soak for `dur` s (no effect of its own; it sets up reactions). */
export function applyWet(e, dur) { e.status.wet = Math.max(e.status.wet, dur) }

/** Light a burn: a stack more (up to 3), its time refreshed; dps is the strongest applied. */
export function applyBurn(e, def, dps) {
  if (def.burnImmune || e.immune?.has("burn")) return false;
  const b = e.status.burn;
  if (b.stacks === 0) b.tick = BURN.tick;
  b.stacks = Math.min(BURN.maxStacks, b.stacks + 1);
  b.t = BURN.dur;
  b.dps = Math.max(b.dps, dps);
  e.status.wet = 0;   // fire dries
  return true;
}

/** Poison: stacks (up to its cap), refreshed; the strongest dps holds. */
export function applyPoison(e, def, dps, stacks = 1) {
  if (def.poisonImmune || e.immune?.has("poison")) return false;
  const p = e.status.poison;
  if (p.stacks === 0) p.tick = POISON.tick;
  p.stacks = Math.min(p.max, p.stacks + stacks);
  p.t = POISON.dur;
  p.dps = Math.max(p.dps, dps);
  return true;
}

/** A slow stack. Returns true when it froze the target (three stacks and `freezeAt3`). */
export function applySlow(e, def, freezeAt3 = false) {
  if (e.immune?.has("chill")) return false;
  const s = e.status.slow;
  s.stacks = Math.min(SLOW.maxStacks, s.stacks + 1);
  s.t = SLOW.dur;
  if (freezeAt3 && s.stacks >= 3) {
    s.stacks = 1;
    return applyFreeze(e, def, 1.5);
  }
  return false;
}

/** Freeze for `dur` s; a boss is only slowed hard. Not while immune (unless `force`). */
export function applyFreeze(e, def, dur, force = false) {
  const st = e.status;
  if (e.immune?.has("freeze")) return false;
  if (def.boss) { st.slow.stacks = 2; st.slow.t = SLOW.dur; return false }
  if (!force && (st.freezeImmune > 0 || st.freeze > 0)) return false;
  const d = cc(e, dur);
  if (d <= 0) return false;
  st.freeze = Math.max(st.freeze, d);
  return true;
}

/** Stun for `dur` s (a boss half as long). Not while immune: chains of stuns can't lock a target forever. */
export function applyStun(e, def, dur) {
  const st = e.status;
  if (st.stunImmune > 0 || st.stun > 0 || e.immune?.has("stun")) return false;
  const d = cc(e, dur);
  if (d <= 0) return false;
  st.stun = d;
  return true;
}

/** Root (held where it stands, still hitting) and fear (walking back): a boss shrugs off half. */
export function applyRoot(e, def, dur) { if (e.immune?.has("root") || e.status.root > 0) return; const d = cc(e, dur); if (d > 0) e.status.root = d }
export function applyFear(e, def, dur) { if (def.boss || e.immune?.has("fear") || e.status.fear > 0) return; const d = cc(e, dur); if (d > 0) e.status.fear = d }
/** Mud, tar, drowning: a slow of its own, `k` the speed left. */
export function applyMud(e, k, dur) { if (e.immune?.has("mud")) return; e.status.mud = Math.max(e.status.mud, dur); e.status.mudK = Math.min(e.status.mudK ?? 1, k) }

export const slowFactor = (e) => {
  const st = e.status;
  const chill = st.slow.stacks ? Math.max(SLOW.floor, 1 - SLOW.per * Math.min(2, st.slow.stacks)) : 1;
  const k = chill * (st.mud > 0 ? st.mudK ?? 1 : 1) * (e.auras?.has("cripple") ? 0.65 : 1), t = e.tenacity;
  // the tenacious can't be slowed past a point (bosses keep 70%, elites 50%), and not at all when unstoppable
  return t ? (t.unstop > 0 ? 1 : Math.max(k, t.slowFloor ?? 0.5)) : k;
};
export const isHeld = (e) => e.status.freeze > 0 || e.status.stun > 0;
export const speedFactor = (e) => (isHeld(e) || e.status.root > 0 ? 0 : slowFactor(e));

/** Run the clocks for dt; returns { burn, poison } damage due this step (the caller deals it). */
export function tickStatus(e, dt) {
  const st = e.status;
  let burn = 0, poison = 0;
  const b = st.burn;
  if (b.stacks) {
    b.tick -= dt;
    while (b.tick <= 1e-9 && b.t > 1e-9) { burn += b.dps * BURN.tick * b.stacks * (b.black > 0 ? 2 : 1); b.tick += BURN.tick }
    b.t -= dt;
    if (b.black > 0) b.black -= dt;
    if (b.t <= 1e-9) { b.stacks = 0; b.dps = 0; b.t = 0; b.black = 0 }
  }
  const p = st.poison;
  if (p.stacks) {
    const tick = p.fast > 0 ? POISON.tick / 2 : POISON.tick;
    p.tick -= dt;
    while (p.tick <= 1e-9 && p.t > 1e-9) { poison += p.dps * POISON.tick * p.stacks * (st.slow.stacks && p.frost > 0 ? 2 : 1); p.tick += tick }
    p.t -= dt;
    if (p.fast > 0) p.fast -= dt;
    if (p.frost > 0) p.frost -= dt;
    if (p.t <= 1e-9) { p.stacks = 0; p.dps = 0; p.t = 0; p.max = POISON.maxStacks }
  }
  let phys = 0;
  for (const d of Object.values(st.dots)) {
    if (!d.stacks) continue;
    d.tick -= dt * (st.dotFast > 0 ? 2 : 1);
    while (d.tick <= 1e-9 && d.t > 1e-9) { phys += d.dps * 0.5 * d.stacks; d.tick += 0.5 }
    d.t -= dt;
    if (d.t <= 1e-9) { d.stacks = 0; d.dps = 0; d.t = 0 }
  }
  if (st.dotFast > 0) st.dotFast -= dt;
  if (st.weak > 0) st.weak -= dt;
  if (st.wet > 0) st.wet = Math.max(0, st.wet - dt);
  const ten = e.tenacity;
  if (ten) { if (ten.unstop > 0) ten.unstop = Math.max(0, ten.unstop - dt); ten.poise = Math.max(0, ten.poise - dt * 0.15) }
  if (st.root > 0) st.root = Math.max(0, st.root - dt);
  if (st.fear > 0) st.fear = Math.max(0, st.fear - dt);
  if (st.mud > 0) { st.mud -= dt; if (st.mud <= 0) { st.mud = 0; st.mudK = 1 } }
  if (st.slow.stacks) { st.slow.t -= dt; if (st.slow.t <= 0) { st.slow.stacks = 0; st.slow.t = 0 } }
  if (st.freeze > 0) { st.freeze -= dt; if (st.freeze <= 0) { st.freeze = 0; st.freezeImmune = FREEZE.immune } }
  else if (st.freezeImmune > 0) st.freezeImmune = Math.max(0, st.freezeImmune - dt);
  if (st.stun > 0) { st.stun -= dt; if (st.stun <= 0) { st.stun = 0; st.stunImmune = STUN.immune } }
  else if (st.stunImmune > 0) st.stunImmune = Math.max(0, st.stunImmune - dt);
  return { burn, poison, phys };
}
