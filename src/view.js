// Draws the world into RGBA bytes (no DOM): the arena (tinted by chapter), the ground, the wall, the mage, the
// monsters (their auras as coloured pips, elites glowing, shields, instability), the weather, the reactions
// (labels, tier sigils, beams, wells), the black hole bending the picture round it, and every pixelfx effect.
// The browser puts the bytes on a canvas; Node writes them to PNGs.

import { createFrame, clearFrame, createFx, painterFor, hex, Rng, FONTS } from "../lib/pixelfx/core/index.js";
import * as hitSpark from "../lib/pixelfx/fx/impacts/hit-spark.js";
import * as frostNova from "../lib/pixelfx/fx/ice/frost-nova.js";
import * as zapHit from "../lib/pixelfx/fx/lightning/zap-hit.js";
import * as poof from "../lib/pixelfx/fx/spawn/poof.js";
import * as dmgNumber from "../lib/pixelfx/fx/ui/damage-number.js";
import * as burning from "../lib/pixelfx/fx/status/burning.js";
import * as frozen from "../lib/pixelfx/fx/status/frozen.js";
import * as electrified from "../lib/pixelfx/fx/lightning/electrified.js";
import * as slowed from "../lib/pixelfx/fx/status/slowed.js";
import * as poisoned from "../lib/pixelfx/fx/status/poisoned.js";
import * as cursed from "../lib/pixelfx/fx/status/cursed.js";
import * as bluntHit from "../lib/pixelfx/fx/impacts/blunt-hit.js";
import * as eclipse from "../lib/pixelfx/fx/shadow/eclipse.js";
import * as blackHole from "../lib/pixelfx/fx/shadow/black-hole.js";
import * as implosion from "../lib/pixelfx/fx/explosions/implosion.js";
import * as darkExplosion from "../lib/pixelfx/fx/shadow/dark-explosion.js";
import * as rainCloud from "./fx/rain-cloud.js";
import * as swordSlash from "../lib/pixelfx/fx/melee/sword-slash.js";
import * as spinSlash from "../lib/pixelfx/fx/melee/spin-slash.js";
import * as daggerFlurry from "../lib/pixelfx/fx/melee/dagger-flurry.js";
import * as healFx from "../lib/pixelfx/fx/holy/heal.js";
import { LOOKS, blastOf } from "./render/looks.js";
import { FRAMES } from "./assets.js";
import { ENEMIES } from "./sim/enemies.js";
import { W, H, MAGE_FEET } from "./sim/field.js";
import { ELEM, ELEMENTS } from "./data/elements.js";
import { REACTION_BY_ID } from "./data/reactions.js";
import { CHAPTERS, ELITES } from "./data/chapters.js";
import { BLACK_HOLE } from "./sim/chaos.js";

const MAGE_AT = [6, 62];
const WALL_AT = 58;
const MAX_LABELS = 6;
const CLOUDS = {
  rain: ["#4a5064", "#5c6278", "#70778e", "#868da4", "#9ea5ba", "#b6bccf", "#ced3e2"],
  lava: ["#3a2c28", "#4c3a32", "#604a3e", "#765a4a", "#8c6c5a", "#a4806a", "#bc967e"],
  thunder: ["#2a2638", "#383248", "#48405c", "#5a5070", "#6c6286", "#80769c", "#968cb2"],
};
const NUM = Object.fromEntries(Object.entries(ELEM).map(([k, v]) => [k, v.ramp]));
NUM.burn = NUM.fire; NUM.steam = ["#1a1e26", "#3a404c", "#6a7280", "#9aa2b0", "#c8ced8", "#e4e8ee", "#f6f8fa", "#ffffff"];
const COL = Object.fromEntries(Object.entries(ELEM).map(([k, v]) => [k, v.color]));
COL.tier = [255, 240, 200]; COL.steam = [230, 236, 245];
const VOLT_LINE = [hex("#5a24a0"), hex("#c08cff"), hex("#f6ecff"), hex("#ffffff")];
const pack = (r, g, b) => (0xff000000 | (Math.min(255, Math.max(0, b | 0)) << 16) | (Math.min(255, Math.max(0, g | 0)) << 8) | Math.min(255, Math.max(0, r | 0))) >>> 0;
/** c blended toward rgb by k (0..1): integer work only, no clamping needed inside that range. */
const mixTo = (c, rgb, k) => {
  const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
  return (0xff000000 | ((b + (rgb[2] - b) * k) << 16) | ((g + (rgb[1] - g) * k) << 8) | (r + (rgb[0] - r) * k)) >>> 0;
};
const hash2 = (x, y, t) => { let h = (x * 374761393 + y * 668265263 + t * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 };
const hsv = (h) => { const f = (n) => { const k = (n + h * 6) % 6; return 255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))) }; return [f(5), f(3), f(1)] };
const toHex = (c) => hex("#" + c.map((v) => Math.min(255, Math.round(v)).toString(16).padStart(2, "0")).join(""));
const GROUND_COL = {
  mud: [[110, 78, 46], [84, 58, 34]], sand: [[220, 190, 120], [190, 158, 96]], tar: [[30, 26, 30], [70, 80, 40]],
  hallowed: [[255, 230, 140], [255, 250, 210]], void: [[40, 16, 60], [130, 70, 200]], miasma: [[130, 200, 60], [90, 140, 40]],
  swamp: [[70, 90, 40], [110, 130, 50]], vortex: [[120, 230, 190], [220, 255, 240]], runestone: [[90, 70, 110], [255, 110, 220]],
};

export function createRenderer(A) {
  const frame = createFrame(W, H), pic = new Uint32Array(W * H), out = new Uint8ClampedArray(W * H * 4), out32 = new Uint32Array(out.buffer), tmp = new Uint32Array(W * H);
  // how much the renderer allows itself; lowered on its own when frames run long (see draw)
  const QUALITY = [
    { fx: 52, overlays: 9, numbers: 11, every: 2, motes: 90 },
    { fx: 40, overlays: 6, numbers: 8, every: 3, motes: 60 },
    { fx: 30, overlays: 4, numbers: 6, every: 4, motes: 40 },
  ];
  let Q = QUALITY[0], level = 0, ema = 0, drawn = 0, born = 0, firsts = 0;
  // a finished effect hands its frames back for the next one (allocating them is what the GC chews on)
  const pool = [];
  const takeFrame = () => pool.pop() ?? createFrame(W, H);
  const release = (f) => { for (const fr of Object.values(f.cache?.frames ?? {})) if (pool.length < 40) pool.push(fr) };
  const rng = new Rng(99);
  const fxs = [], byShot = new Map(), overlays = new Map();
  const bolts = [], labels = [], stones = [], rings = [], beams = [], sigils = [];
  let shake = 0, shakeT = 0, numbers = 0, clock = 0, rainK = 0, lavaK = 0, flash = 0, flashCol = [236, 226, 255], space = 0;
  const DROPS = Array.from({ length: 140 }, () => ({ x: rng.range(-20, W + 10), y: rng.range(4, H - 2), period: rng.range(0.42, 0.6), off: rng.next(), len: rng.int(4, 6) }));
  const STARS = Array.from({ length: 60 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), p: rng.range(0, 6) }));
  const MOTES = Array.from({ length: 90 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), v: rng.range(0.6, 1.4), p: rng.range(0, 6.3) }));
  let env = "clear", envK = 0, blinks = [];
  const WATER = [74, 106, 154], WATER_RIM = [154, 196, 240];

  function add(mod, o, extra = {}) {
    if (fxs.length >= Q.fx && !extra.must) {
      const i = fxs.findIndex((f) => f.kind === "deco");
      if (i < 0) return null;
      if (fxs[i].number) numbers--;
      release(fxs[i]); fxs.splice(i, 1);
    }
    const e = { fx: createFx(mod, o), age: 0, life: extra.life ?? Infinity, kind: extra.kind ?? "deco", fade: extra.fade ?? 0, ...extra };
    // every effect is repainted every other step (30 fps, as pixel effects are drawn) and shown from its
    // cached picture in between; a shot's picture is slid along to where the shot is now
    const cache = extra.cache ?? (e.kind === "shot" || extra.number ? Q.every : Q.every + 1);
    // repaints are spread over the steps (a burst of effects born together would otherwise all repaint on the same ones)
    e.cache = { every: cache, tick: born++ % cache, frames: {}, box: {}, at: {}, n: 0, dirty: { back: true, front: true } };
    fxs.push(e);
    return e;
  }
  const spark = (x, y, elem, life = 0.5) => add(hitSpark, { x, y, height: 0, palette: NUM[elem] ?? NUM.arcane, light: 0.5, seed: rng.int(0, 99) }, { life });
  const blast = (x, y, elem, r = 18) => { const b = blastOf(ELEM[elem] ? elem : "arcane"); add(b.mod, { x, y, ...b.opts, light: 0.55, seed: rng.int(0, 99) }, { life: b.life * Math.min(1.3, 0.6 + r / 40), fade: b.fade }) };
  const label = (id, x, y, n) => {
    const r = REACTION_BY_ID[id];
    if (!r || labels.length >= 6) return;
    const color = n ? [255, 236, 150] : id === "unstable" ? [255, 140, 220] : [220, 210, 255];
    labels.push({ text: r.label, color, x: Math.round(x), y: Math.round(y) - 4, t: 0, big: n >= 5 || id === "chaos", rainbow: id === "chaos" || n === 6 });
  };

  // a plain label over the field (not a reaction): ENRAGE, UNSTOPPABLE
  const note = (text, x, y, color, big = false) => { if (labels.length < MAX_LABELS) labels.push({ text, color, x: Math.round(x), y: Math.round(y), t: 0, big }) };

  // ---------- events -> effects ----------
  function onEvent(ev) {
    switch (ev.type) {
      case "shot": {
        const look = LOOKS[ev.skill]?.shot, ang = Math.atan2(ev.vy, ev.vx);
        if (!look) break;
        const e = add(look.mod, { x: ev.x, y: ev.y + (look.dy ?? 0), ...look.opts(ang, ev.id) }, { kind: "shot", must: true, dy: look.dy, cache: look.cache });
        if (e) byShot.set(ev.id, e);
        break;
      }
      case "shotEnd": { const e = byShot.get(ev.id); if (e) { e.fx.stop(); e.life = e.age + 0.3; byShot.delete(ev.id) } break }
      case "impact": spark(ev.x, ev.y, ev.elem); break;
      case "explode": blast(ev.x, ev.y, ev.elem, ev.r); shake = Math.max(shake, 1.5); break;
      case "zone": {
        const z = LOOKS[ev.skill]?.zone;
        if (z) add(z.mod, { x: ev.x, y: ev.y, ...z.opts(ev.r), light: 0.45, seed: rng.int(0, 99) }, { life: z.life ?? ev.life + 0.4, fade: 0.4, cache: z.cache });
        else blast(ev.x, ev.y, ev.elem, ev.r);
        rings.push({ x: ev.x, y: ev.y, r: ev.r, t: 0, life: 0.4, col: COL[ev.elem] });
        break;
      }
      case "nova":
        add(frostNova, { x: ev.x, y: ev.y, reach: ev.r * 1.2, light: 0.6, actor: { ...A.monsters.slime.actor, mask: { w: 1, h: 1, data: new Uint8Array(1) }, pixels: new Uint32Array(1), w: 1, h: 1, x: 0, y: -1 } }, { life: 2.2, fade: 0.6, must: true });
        shake = Math.max(shake, 2);
        break;
      case "zap":
        bolts.push({ pts: ev.to.map((p) => [ev.from, p]), t: 0, life: 0.12, col: ev.elem });
        if (ev.elem === "volt") for (const p of ev.to.slice(0, 2)) add(zapHit, { x: p[0], y: p[1], light: 0.5, seed: rng.int(0, 99) }, { life: 0.5, fade: 0.2 });
        break;
      case "chain":
        bolts.push({ pts: ev.pts.slice(1).map((p, i) => [ev.pts[i], p]), t: 0, life: 0.22, thick: true, col: ev.elem });
        for (const p of ev.pts.slice(1, 4)) add(zapHit, { x: p[0], y: p[1], light: 0.6, seed: rng.int(0, 99) }, { life: 0.6, fade: 0.25 });
        shake = Math.max(shake, 1);
        break;
      case "dmg": {
        if (numbers >= Q.numbers || ((ev.elem === "burn" || ev.elem === "steam" || ev.elem === "poison") && numbers > Q.numbers / 2)) break;
        const x = Math.round(ev.x + rng.range(-3, 3)), y = Math.round(ev.y);
        const box = [Math.max(0, x - 30), Math.max(0, y - 52), Math.min(W - 1, x + 46), Math.min(H - 1, y + 16)];
        if (box[0] > box[2] || box[1] > box[3]) break;
        numbers++;
        add(dmgNumber, { x, y, text: String(ev.amount), palette: NUM[ev.elem] ?? NUM.fire, seed: rng.int(0, 99) }, { life: 1.05, number: true, cache: 2, box });
        break;
      }
      case "death": add(poof, { x: ev.x, y: ev.y, light: 0.4, seed: rng.int(0, 99) }, { life: 1.2, fade: 0.4 }); if (ev.boss) shake = Math.max(shake, 4); break;
      case "wallHit": add(bluntHit, { x: ev.x + 2, y: ev.y + 4, height: 4, seed: rng.int(0, 99) }, { life: 0.6, fade: 0.2 }); shake = Math.max(shake, 1); break;
      case "weatherStart":
        for (const [i, x] of [125, 215, 305].entries())
          add(rainCloud, { x: x + rng.range(-8, 8), y: 124 + (i % 2) * 8, cloud: CLOUDS[ev.kind], seed: 8 + i * 5 + rng.int(0, 9) }, { life: ev.dur + 0.9, fade: 0.9, must: true, vel: [-4, 0], kind: "weather", cache: 6 });
        break;
      case "dropHit":
        if (ev.kind === "lava") { spark(ev.x, ev.y, "fire", 0.45); shake = Math.max(shake, 0.8) }
        else { bolts.push({ pts: [[[ev.x + rng.range(-14, 14), -6], [ev.x, ev.y]]], t: 0, life: 0.2, thick: true, big: true }); add(zapHit, { x: ev.x, y: ev.y, light: 0.6, seed: rng.int(0, 99) }, { life: 0.6, fade: 0.2 }); flash = 0.18; flashCol = [236, 226, 255]; shake = Math.max(shake, 2) }
        break;
      case "puddleShock":
        if (ev.pts.length) bolts.push({ pts: ev.pts.map((p) => [ev.from, p]), t: 0, life: 0.22, thick: true });
        for (const p of ev.pts.slice(0, 4)) add(zapHit, { x: p[0], y: p[1], light: 0.5, seed: rng.int(0, 99) }, { life: 0.5, fade: 0.2 });
        shake = Math.max(shake, 1.5);
        break;
      case "reaction":
        label(ev.kind, ev.x, ev.y, ev.tier);
        if (ev.tier) { sigils.push({ x: ev.x, y: ev.y + 6, n: ev.tier, elems: ev.elems, t: 0, life: ev.tier === 5 ? 1.7 : 0.9 }); shake = Math.max(shake, ev.tier * 0.6); if (ev.tier >= 6) { flash = 0.2; flashCol = [255, 250, 230] } }
        break;
      case "fx":
        if (ev.fx === "blast") blast(ev.x, ev.y, ev.elem, ev.r);
        else if (ev.fx === "burst" || ev.fx === "shards" || ev.fx === "star") spark(ev.x, ev.y, ev.elem, 0.6);
        else if (ev.fx === "ring" || ev.fx === "well") rings.push({ x: ev.x, y: ev.y + 6, r: ev.r, t: 0, life: ev.fx === "well" ? ev.t : 0.5, col: COL[ev.elem], well: ev.fx === "well" });
        else if (ev.fx === "skybolt") { bolts.push({ pts: [[[ev.x + rng.range(-10, 10), -6], [ev.x, ev.y + 6]]], t: 0, life: 0.22, thick: true, big: true, col: ev.elem }); spark(ev.x, ev.y + 6, ev.elem) }
        else if (ev.fx === "eclipse") { add(eclipse, { x: ev.x, y: ev.y, light: 0.5, seed: rng.int(0, 99) }, { life: 1.2, fade: 0.5, cache: 2 }); flash = 0.2; flashCol = [40, 20, 60] }
        else if (ev.fx === "beam" || ev.fx === "ray") beams.push({ x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, t: 0, life: ev.fx === "ray" ? 0.4 : 0.25, col: COL[ev.elem] ?? [255, 255, 255], w: ev.fx === "ray" ? 3 : 1 });
        else if (ev.fx === "seed") rings.push({ x: ev.x, y: ev.y, r: 6, t: 0, life: 0.3, col: [255, 255, 255] });
        break;
      case "obsidian": stones.push({ x: ev.x, y: ev.y, rx: ev.rx, t: 0 }); spark(ev.x, ev.y - 2, "earth", 0.6); shake = Math.max(shake, 1.5); break;
      case "blackhole":
        if (ev.phase === "rift") { flash = 0.25; flashCol = [120, 60, 200]; shake = Math.max(shake, 2); add(blackHole, { x: ev.x, y: ev.y + 62, light: 0.7, seed: 4 }, { life: BLACK_HOLE.rift + BLACK_HOLE.pull + 0.1, fade: 0.2, must: true, cache: 2, kind: "bh" }) }
        else if (ev.phase === "collapse") add(implosion, { x: ev.x, y: ev.y, light: 0.7, seed: 3 }, { life: 0.8, fade: 0.3, must: true, kind: "bh" });
        else if (ev.phase === "blast") { add(darkExplosion, { x: ev.x, y: ev.y + 40, light: 0.8, seed: 5 }, { life: 1.6, fade: 0.6, must: true, cache: 2, kind: "bh" }); flash = 0.35; flashCol = [255, 255, 255]; shake = Math.max(shake, 6); rings.push({ x: ev.x, y: ev.y, r: ev.r * 1.6, t: 0, life: 0.6, col: [255, 220, 255] }) }
        break;
      case "shieldBreak": spark(ev.x, ev.y - 10, "ice", 0.6); break;
      case "bossPhase": flash = 0.2; flashCol = [140, 200, 255]; shake = Math.max(shake, 3); break;
      case "slam": shake = Math.max(shake, 4); break;
      case "env": if (ev.kind !== env) { env = ev.kind; envK = 0 } break;
      case "blink": blinks.push({ x: ev.x, y: ev.y, t: 0 }); break;
      case "summon": rings.push({ x: ev.x, y: ev.y, r: 14, t: 0, life: 0.45, col: COL[ev.elems[0]] }); if (ev.elems[1]) rings.push({ x: ev.x, y: ev.y, r: 20, t: 0, life: 0.55, col: COL[ev.elems[1]] }); add(poof, { x: ev.x, y: ev.y, light: 0.5, seed: rng.int(0, 99) }, { life: 0.8, fade: 0.3 }); break;
      case "melee": {
        // a swing at the gate: a slash (a spin for the wide ones, a flurry of daggers), in the mark's colour
        const mod = ev.repeat > 1 ? daggerFlurry : ev.width >= 60 ? spinSlash : swordSlash;
        add(mod, { x: ev.x + (mod === spinSlash ? 18 : 4), y: ev.y + 4, palette: NUM[ev.elem] ?? NUM.sunder, light: 0.45, seed: rng.int(0, 99) }, { life: 0.7, fade: 0.25 });
        shake = Math.max(shake, ev.width >= 60 ? 2 : 1);
        break;
      }
      case "dash": beams.push({ x: ev.x, y: ev.y - 8, x2: ev.x2, y2: ev.y - 8, t: 0, life: 0.3, col: COL[ev.elem] ?? [220, 220, 230], w: 3 }); spark(ev.x2, ev.y - 8, ev.elem, 0.4); shake = Math.max(shake, 2); break;
      case "mend": add(healFx, { x: 30, y: 118, light: 0.5, seed: rng.int(0, 99) }, { life: 1.2, fade: 0.4, must: true }); break;
      case "miss": spark(ev.x, ev.y, "blind", 0.3); break;
      case "gold": spark(30, 100, "bounty", 0.4); break;
      case "missile": beams.push({ x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, t: 0, life: 0.18, col: ev.kind === "shaman" ? [90, 230, 255] : [240, 230, 200], w: 1 }); spark(ev.x2 + 2, ev.y2, ev.kind === "shaman" ? "ice" : "earth", 0.35); break;
      case "heal": rings.push({ x: ev.x, y: ev.y + 4, r: ev.r, t: 0, life: 0.5, col: [120, 255, 140] }); for (const p of ev.pts.slice(0, 5)) beams.push({ x: ev.x, y: ev.y, x2: p[0], y2: p[1], t: 0, life: 0.3, col: [140, 255, 150], w: 1 }); break;
      case "charge": spark(ev.x + 6, ev.y - 2, "earth", 0.4); shake = Math.max(shake, 1); break;
      case "enrage": flash = 0.2; flashCol = [255, 60, 40]; shake = Math.max(shake, 3); note("ENRAGE", ev.x, ev.y - 30, [255, 90, 70], true); break;
      case "unstoppable": note("UNSTOPPABLE", ev.x, ev.y - 10, [255, 210, 90]); rings.push({ x: ev.x, y: ev.y + 8, r: 18, t: 0, life: 0.5, col: [255, 210, 90] }); break;
      case "minionDie": add(poof, { x: ev.x, y: ev.y, light: 0.4, seed: rng.int(0, 99) }, { life: 1, fade: 0.4 }); break;
    }
  }

  // ---------- status overlays: the strongest few on the monsters nearest the wall ----------
  function syncOverlays(w) {
    const want = new Map();
    for (const e of w.enemies.filter((m) => m.hp > 0).sort((a, b) => a.x - b.x)) {
      if (want.size >= Q.overlays) break;
      const st = e.status, def = ENEMIES[e.type];
      const kind = st.freeze > 0 ? "frozen" : st.stun > 0 ? "stun" : st.burn.stacks ? "burn" : st.poison.stacks >= 3 ? "poison" : e.auras.has("dark") ? "curse" : def.boss && st.slow.stacks ? "slow" : null;
      if (kind) want.set(`${e.id}:${kind}`, { e, kind });
    }
    for (const [key, o] of overlays) if (!want.has(key)) { o.fx.stop(); o.life = o.age + 0.3; o.follow = null; overlays.delete(key) }
    for (const [key, { e, kind }] of want) {
      if (overlays.has(key)) continue;
      const actor = A.monsters[e.type].actor, mod = { burn: burning, frozen, stun: electrified, slow: slowed, poison: poisoned, curse: cursed }[kind];
      const o = add(mod, { x: e.x, y: e.y, actor, light: 0.45, seed: e.id }, { kind: "overlay", must: true, follow: e.id });
      if (o) overlays.set(key, o);
    }
  }

  // ---------- the step ----------
  function update(w, events, dt, frozenTime = false) {
    clock += dt;
    for (const ev of events) onEvent(ev);
    syncOverlays(w);
    const byId = new Map(w.enemies.map((e) => [e.id, e]));
    const shots = new Map(w.shots.map((s) => [s.id, s]));
    for (const [id, e] of byShot) { const s = shots.get(id); if (s) { e.fx.options.x = s.x; e.fx.options.y = s.y + (e.dy ?? 0); if (s.target) e.fx.options.angle = Math.atan2(s.vy, s.vx) } }
    for (const f of fxs) {
      if (f.follow) { const e = byId.get(f.follow); if (e) { f.fx.options.x = Math.round(e.x); f.fx.options.y = Math.round(e.y - (ENEMIES[e.type].fly ?? 0)) } }
      if (f.vel) { f.fx.options.x += f.vel[0] * dt; f.fx.options.y += f.vel[1] * dt }
      if (!frozenTime) { f.fx.update(dt); f.age += dt; if (f.cache && ++f.cache.tick % f.cache.every === 0) { f.cache.dirty.back = true; f.cache.dirty.front = true } }
    }
    for (let i = fxs.length - 1; i >= 0; i--) { const f = fxs[i]; if (f.age >= f.life || (f.fx.done() && f.kind !== "overlay")) { if (f.number) numbers--; release(f); fxs.splice(i, 1) } }
    for (const list of [bolts, labels, stones, rings, beams, sigils]) for (const b of list) b.t += dt;
    const keep = (list, f) => { for (let i = list.length - 1; i >= 0; i--) if (!f(list[i])) list.splice(i, 1) };
    keep(bolts, (b) => b.t < b.life); keep(labels, (l) => l.t < (l.big ? 1.3 : 0.9)); keep(stones, (s) => s.t < 1.4); keep(rings, (r) => r.t < r.life); keep(beams, (b) => b.t < b.life); keep(sigils, (s) => s.t < s.life);
    shakeT += dt; shake = Math.max(0, shake - dt * 10); flash = Math.max(0, flash - dt);
    const kind = w.weather.kind;
    space += ((w.blackholes.length ? 1 : 0) - space) * Math.min(1, dt * 4);
    rainK += Math.max(-dt / 0.5, Math.min(dt / 0.5, (kind === "rain" ? 1 : kind === "thunder" ? 0.5 : 0) - rainK));
    lavaK += Math.max(-dt / 0.6, Math.min(dt / 0.6, (kind === "lava" ? 1 : 0) - lavaK));
    if (w.env && w.env !== env) { env = w.env; envK = 0 }
    envK = Math.min(1, envK + dt);
    for (const b of blinks) b.t += dt;
    blinks = blinks.filter((b) => b.t < 0.35);
  }

  // ---------- drawing helpers ----------
  function blit(strip, f, x, y, tint) {
    const { pic: s, fw } = strip;
    for (let j = 0; j < s.h; j++) {
      const Y = y + j; if (Y < 0 || Y >= H) continue;
      for (let i = 0; i < fw; i++) { const c = s.px[j * s.w + f * fw + i]; if (c >>> 24 < 128) continue; const X = x + i; if (X < 0 || X >= W) continue; pic[Y * W + X] = (tint ? tint(c) : c) | 0xff000000 }
    }
  }
  // a sprite frame's outline: the pixels just outside it, found once per frame and kept
  const rims = new Map();
  function rimOf(strip, f) {
    let per = rims.get(strip.pic);
    if (!per) rims.set(strip.pic, (per = []));
    if (per[f]) return per[f];
    const { pic: s, fw } = strip, on = (i, j) => i >= 0 && j >= 0 && i < fw && j < s.h && s.px[j * s.w + f * fw + i] >>> 24 > 127, pts = [];
    for (let j = -1; j <= s.h; j++) for (let i = -1; i <= fw; i++) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) pts.push(i, j);
    return (per[f] = pts);
  }
  function outline(strip, f, x, y, col, k) {
    const pts = rimOf(strip, f);
    for (let n = 0; n < pts.length; n += 2) put(x + pts[n], y + pts[n + 1], col, k);
  }
  function darken(cx, cy, rx, ry, k) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const X = Math.round(cx + x), Y = Math.round(cy + y);
      if (X < 0 || Y < 0 || X >= W || Y >= H || (x / rx) ** 2 + (y / ry) ** 2 > 1) continue;
      const c = pic[Y * W + X]; pic[Y * W + X] = pack((c & 255) * k, ((c >>> 8) & 255) * k, ((c >>> 16) & 255) * k);
    }
  }
  // one pixel blended toward rgb by k: the most called thing in here, so integers and no allocation
  const put = (x, y, rgb, k) => {
    if (!(k > 0) || x < -0.5 || y < -0.5) return;
    const X = (x + 0.5) | 0, Y = (y + 0.5) | 0;
    if (X >= W || Y >= H) return;
    const i = Y * W + X, c = pic[i], r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
    if (k > 1) k = 1;
    pic[i] = (0xff000000 | ((b + (rgb[2] - b) * k) << 16) | ((g + (rgb[1] - g) * k) << 8) | (r + (rgb[0] - r) * k)) >>> 0;
  };
  const line = (x0, y0, x1, y1, rgb, k, wdt = 1) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; put(x, y, rgb, k); if (wdt > 1) { put(x, y + 1, rgb, k * 0.7); put(x + 1, y, rgb, k * 0.5) } if (wdt > 2) { put(x, y - 1, rgb, k * 0.5); put(x - 1, y, rgb, k * 0.4) } }
  };
  // the tight box of what was drawn, searched within the effect's own box when it's known
  const FULL = [0, 0, W - 1, H - 1];
  function boxOf(src, within = FULL) {
    const C = src.color, L = src.light; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = within[1]; y <= within[3]; y++) for (let x = within[0], i = y * W + x; x <= within[2]; x++, i++) if (C[i] || L[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }
  // an effect's own box on the screen, from its size and origin (turned ones: the circle they can sweep)
  function boxFor(f, pad = 4) {
    const m = f.fx.meta, o = f.fx.options;
    if (!m?.size || !m.origin) return FULL;
    let x0, y0, x1, y1;
    if (o.angle || o.flip) {
      const R = Math.hypot(Math.max(m.origin[0], m.size[0] - m.origin[0]), Math.max(m.origin[1], m.size[1] - m.origin[1]));
      x0 = o.x - R; x1 = o.x + R; y0 = o.y - R; y1 = o.y + R;
    } else { x0 = o.x - m.origin[0]; y0 = o.y - m.origin[1]; x1 = x0 + m.size[0]; y1 = y0 + m.size[1] }
    const b = [Math.max(0, Math.floor(x0) - pad), Math.max(0, Math.floor(y0) - pad), Math.min(W - 1, Math.ceil(x1) + pad), Math.min(H - 1, Math.ceil(y1) + pad)];
    return b[0] > b[2] || b[1] > b[3] ? null : b;
  }
  function clearBox(fr, b) {
    const C = fr.color, L = fr.light;
    for (let y = b[1]; y <= b[3]; y++) { const i = y * W; C.fill(0, i + b[0], i + b[2] + 1); L.fill(0, i + b[0], i + b[2] + 1) }
  }
  /** Lay a frame's box over the picture (optionally slid by dx, dy: a moving shot's cached picture). */
  function overFrame(k = 1, src = frame, box = FULL, dx = 0, dy = 0) {
    const C = src.color, L = src.light;
    const ya = Math.max(box[1], -dy), yb = Math.min(box[3], H - 1 - dy), xa = Math.max(box[0], -dx), xb = Math.min(box[2], W - 1 - dx);
    for (let y = ya; y <= yb; y++) for (let x = xa, i = y * W + x, o = i + dy * W + dx; x <= xb; x++, i++, o++) {
      const c = C[i], l = L[i]; if (!c && !l) continue;
      const d = pic[o], a = ((c >>> 24) / 255) * k;
      let r = d & 255, g = (d >>> 8) & 255, b = (d >>> 16) & 255;
      if (a > 0) { r += ((c & 255) - r) * a; g += (((c >>> 8) & 255) - g) * a; b += (((c >>> 16) & 255) - b) * a }
      if (l) { r += (l & 255) * k; g += ((l >>> 8) & 255) * k; b += ((l >>> 16) & 255) * k }
      pic[o] = (0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r)) >>> 0;
    }
  }
  // the shared scratch frame: only the part effects drew on is laid over and wiped
  let dirty = null;
  const grow = (b) => { if (!b) return; dirty = !dirty ? b.slice() : [Math.min(dirty[0], b[0]), Math.min(dirty[1], b[1]), Math.max(dirty[2], b[2]), Math.max(dirty[3], b[3])] };
  const flush = (k = 1) => { if (!dirty) return; overFrame(k, frame, dirty); clearBox(frame, dirty); dirty = null };
  function drawFx(list, layer) {
    for (const f of list) {
      const k = f.fade && f.life !== Infinity ? Math.min(1, Math.max(0, (f.life - f.age) / f.fade)) : 1;
      if (k <= 0) continue;
      const c = f.cache;
      if (!c) { f.fx.draw(frame, layer); grow(boxFor(f)); if (k < 1) flush(k); continue }
      // repaint its picture when due: wipe what it drew last time (all of it now and then, for strays), draw, find its box
      // repaint its picture when due: wipe what it drew last time (all of it now and then, for strays), draw, find its box
      if (!c.frames[layer]) {
        if (firsts >= 8) continue;   // a burst of new effects: some show up a step later rather than all in one long frame
        firsts++;
        c.frames[layer] = takeFrame(); c.dirty[layer] = true; c.box[layer] = FULL;
      }
      const o = f.fx.options;
      if (c.dirty[layer]) {
        const fr = c.frames[layer];
        if (c.box[layer] && ++c.n % 8) clearBox(fr, c.box[layer]); else clearFrame(fr);
        f.fx.draw(fr, layer);
        c.dirty[layer] = false;
        c.box[layer] = f.box ?? boxOf(fr, boxFor(f) ?? FULL);
        c.at[layer] = [o.x, o.y];
      }
      if (!c.box[layer]) continue;
      const moves = f.kind === "shot" || f.follow || f.vel, at = c.at[layer];
      overFrame(k, c.frames[layer], c.box[layer], moves ? Math.round(o.x - at[0]) : 0, moves ? Math.round(o.y - at[1]) : 0);
    }
    flush();
  }
  function drawBolts() {
    const p = painterFor(frame);
    for (const b of bolts) {
      const c = b.col && b.col !== "volt" && COL[b.col] ? COL[b.col] : null;
      const main = c ? toHex(c.map((v) => v + 70)) : null, edge = c ? toHex(c) : null;
      for (const [a, z] of b.pts) {
        const n = Math.max(3, Math.round(Math.hypot(z[0] - a[0], z[1] - a[1]) / 7)), jit = b.big ? 5 : 3, pts = [a];
        for (let i = 1; i < n; i++) { const u = i / n; pts.push([a[0] + (z[0] - a[0]) * u + rng.range(-jit, jit), a[1] + (z[1] - a[1]) * u + rng.range(-jit * 0.6, jit * 0.6)]) }
        pts.push(z);
        for (const [x, y] of pts) grow([Math.max(0, Math.floor(x) - 10), Math.max(0, Math.floor(y) - 10), Math.min(W - 1, Math.ceil(x) + 10), Math.min(H - 1, Math.ceil(y) + 10)]);
        const k = 1 - b.t / b.life;
        for (let i = 1; i < pts.length; i++) {
          if (b.thick) { p.line(pts[i - 1][0] + 1, pts[i - 1][1], pts[i][0] + 1, pts[i][1], edge ?? VOLT_LINE[1]); p.line(pts[i - 1][0], pts[i - 1][1] + 1, pts[i][0], pts[i][1] + 1, edge ?? VOLT_LINE[1]) }
          p.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], main ?? (k > 0.5 ? VOLT_LINE[3] : VOLT_LINE[2]));
          if (i % (b.big ? 2 : 1) === 0) p.glow(pts[i][0], pts[i][1], 6, edge ?? VOLT_LINE[1], 0.25 * k);
        }
      }
    }
    flush();
  }

  // ---------- the ground ----------
  function drawGround(w) {
    for (const g of w.grounds) {
      const k = Math.min(1, g.life / 1.5) * Math.min(1, (g.max - g.life) / 0.3 + 0.2);
      const x0 = Math.max(0, Math.floor(g.x - g.rx)), x1 = Math.min(W - 1, Math.ceil(g.x + g.rx)), y0 = Math.max(0, Math.floor(g.y - g.ry)), y1 = Math.min(H - 1, Math.ceil(g.y + g.ry));
      if (g.kind === "steam" || g.kind === "miasma") { drawHaze(g, k, g.kind === "steam" ? [236, 240, 246] : [150, 220, 70]); continue }
      if (g.kind === "runestone") { drawRunestone(g, k); continue }
      const shock = g.shockT > 0 ? g.shockT / 0.25 : 0, tick = Math.floor(clock * 6);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - g.x) / g.rx, dy = (y + 0.5 - g.y) / g.ry, d = dx * dx + dy * dy;
        if (d > 1) continue;
        const i = y * W + x;
        if (g.kind === "water") {
          const rim = d > 0.62 && dy < 0, edge = d > 0.8 && dy >= 0;
          let c = mixTo(pic[i], rim ? WATER_RIM : edge ? [44, 66, 104] : d < 0.25 && dx < 0 ? [120, 160, 210] : WATER, (rim ? 0.7 : 0.62) * k);
          if (shock > 0 && hash2(x, y, Math.floor(clock * 30)) < 0.35 + 0.4 * shock) c = mixTo(c, [236, 220, 255], 0.75 * shock);
          pic[i] = c;
        } else if (g.kind === "lava") {
          const n = hash2(x >> 1, y, tick + (x >> 3)), crust = d > 0.72;
          pic[i] = mixTo(pic[i], crust ? (dy < 0 ? [96, 44, 30] : [58, 26, 22]) : n > 0.86 ? [255, 226, 120] : n > 0.5 ? [246, 120, 36] : d < 0.3 ? [255, 168, 60] : [196, 60, 24], (crust ? 0.8 : 0.9) * k);
        } else {
          const [a, b] = GROUND_COL[g.kind] ?? [[120, 120, 120], [160, 160, 160]];
          const n = hash2(x >> 1, y, (g.kind === "void" || g.kind === "hallowed" ? tick : 0) + (x >> 2));
          const spiral = g.kind === "vortex" ? Math.sin(Math.atan2(dy, dx) * 3 + d * 8 - clock * 10) > 0.3 : false;
          pic[i] = mixTo(pic[i], n > 0.8 || spiral ? b : a, (d > 0.8 ? 0.5 : 0.7) * k);
        }
      }
      if (g.kind === "lava" || g.kind === "hallowed" || g.kind === "void") {
        const glow = g.kind === "lava" ? [255, 140, 60] : g.kind === "hallowed" ? [255, 240, 170] : [160, 80, 230];
        for (let y = Math.max(0, y0 - 3); y <= Math.min(H - 1, y1 + 3); y++) for (let x = Math.max(0, x0 - 4); x <= Math.min(W - 1, x1 + 4); x++) {
          const d = ((x + 0.5 - g.x) / (g.rx + 4)) ** 2 + ((y + 0.5 - g.y) / (g.ry + 3)) ** 2;
          if (d <= 1 && ((x + 0.5 - g.x) / g.rx) ** 2 + ((y + 0.5 - g.y) / g.ry) ** 2 > 1) put(x, y, glow, 0.25 * (1 - d) * k);
        }
      } else if (g.kind === "water" && rainK > 0) {
        const ph = (clock * 1.6 + g.id * 0.37) % 1, rr = 1 + ph * g.rx * 0.5, cx = g.x + Math.sin(g.id * 7.1 + Math.floor(clock * 1.6 + g.id * 0.37)) * g.rx * 0.4;
        for (let a = 0; a < 16; a++) put(cx + Math.cos((a / 16) * Math.PI * 2) * rr, g.y + Math.sin((a / 16) * Math.PI * 2) * rr * 0.45, WATER_RIM, 0.6 * (1 - ph) * k * rainK);
      }
    }
    for (const s of stones) {
      const k = 1 - Math.max(0, (s.t - 1) / 0.4), heat = Math.max(0, 1 - s.t / 0.6);
      for (let y = Math.floor(s.y - s.rx * 0.45); y <= s.y + s.rx * 0.45; y++) for (let x = Math.floor(s.x - s.rx); x <= s.x + s.rx; x++) {
        const d = ((x + 0.5 - s.x) / s.rx) ** 2 + ((y + 0.5 - s.y) / (s.rx * 0.45)) ** 2;
        if (d <= 1) put(x, y, heat > 0 && hash2(x, y, 9) < heat * 0.5 ? [200, 70, 30] : hash2(x >> 2, y >> 1, 3) > 0.5 ? [70, 62, 84] : [30, 26, 38], 0.9 * k);
      }
    }
  }
  function drawHaze(g, k, col) {
    for (let y = Math.max(0, Math.floor(g.y - g.ry)); y <= Math.min(H - 1, g.y + g.ry); y++) for (let x = Math.max(0, Math.floor(g.x - g.rx)); x <= Math.min(W - 1, g.x + g.rx); x++) {
      const d = ((x + 0.5 - g.x) / g.rx) ** 2 + ((y + 0.5 - g.y) / g.ry) ** 2;
      if (d <= 1) put(x, y, col, 0.32 * (1 - d * 0.6) * k);
    }
    for (let j = 0; j < 5; j++) {
      const u = (clock * 0.8 + j / 5 + g.id * 0.13) % 1, px = g.x + Math.sin(j * 2.3 + g.id) * g.rx * 0.6, py = g.y - u * 16, r = 2 + u * 4, a = 0.45 * (1 - u) * k;
      for (let y = Math.floor(py - r); y <= py + r; y++) for (let x = Math.floor(px - r); x <= px + r; x++) { const d = ((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2) / (r * r); if (d <= 1) put(x, y, col, a * (1 - d)) }
    }
  }
  function drawRunestone(g, k) {
    darken(g.x, g.y, 5, 2, 0.7);
    for (let y = -14; y <= 0; y++) for (let x = -2; x <= 2; x++) put(g.x + x, g.y + y, x === -2 ? [60, 46, 74] : [104, 84, 124], k);
    const on = 0.5 + 0.5 * Math.sin(clock * 6);
    for (const [x, y] of [[0, -11], [0, -7], [-1, -9], [1, -9], [0, -3]]) put(g.x + x, g.y + y, [255, 120, 230], (0.5 + 0.5 * on) * k);
  }
  function drawDrops(w) {
    for (const d of w.drops) {
      const u = 1 - d.hitT / d.st.fall;
      if (d.kind === "lava") {
        const rr = 3 + (1 - u) * 3;
        for (let a = 0; a < 12; a++) put(d.x + Math.cos(a * 0.52) * rr, d.y + Math.sin(a * 0.52) * rr * 0.45, [255, 120, 40], 0.5 + 0.3 * u);
        const sx = d.x + 30 * (1 - u), sy = d.y - 150 * (1 - u);
        for (let j = 0; j < 7; j++) put(sx + j * 0.28, sy - j * 1.4, j < 2 ? [255, 236, 140] : j < 4 ? [255, 140, 40] : [190, 50, 20], 0.95 - j * 0.1);
      } else {
        const rr = 2 + (1 - u) * 9, on = Math.floor(clock * 16) % 2;
        for (let a = 0; a < 18; a++) put(d.x + Math.cos(a * 0.35) * rr, d.y + Math.sin(a * 0.35) * rr * 0.45, on ? [220, 190, 255] : [140, 90, 230], 0.75);
      }
    }
  }
  function drawRain(k = rainK) {
    const n = Math.round(DROPS.length * Math.min(1, k * 1.2));
    for (let i = 0; i < n; i++) {
      const d = DROPS[i], u = (clock / d.period + d.off) % 1, fall = 46, x = Math.round(d.x - u * fall * 0.18), y = Math.round(d.y - (1 - u) * fall);
      if (u < 0.86) for (let j = 0; j < d.len; j++) put(x + Math.round(j * 0.18), y - j, j < 2 ? [165, 181, 224] : [109, 124, 171], 0.65);
      else { const s = (u - 0.86) / 0.14, X = Math.round(d.x - 0.86 * fall * 0.18); for (const sx of [-1, 1]) put(X + sx * Math.round(1 + s * 2), d.y - Math.sin(s * Math.PI) * 2, [165, 181, 224], 0.6 * (1 - s)) }
    }
  }

  // ---------- environments: a grade under everything, particles over it ----------
  // [mulR, mulG, mulB, addR, addG, addB]: the arena's light in each
  const GRADE = {
    sun: [1.08, 1.03, 0.86, 10, 6, 0], rain: [0.88, 0.92, 1.0, 0, 0, 8], snow: [0.92, 0.96, 1.04, 30, 34, 40],
    fog: [0.9, 0.9, 0.92, 26, 28, 32], sandstorm: [1.0, 0.92, 0.72, 34, 22, 0], miasma: [0.86, 1.0, 0.78, 0, 10, 0],
    night: [0.5, 0.42, 0.6, 6, 0, 10], aurora: [0.62, 0.7, 0.86, 0, 6, 14],
  };
  function envUnder(dst = pic, k = envK, kind = env) {
    const g = GRADE[kind]; if (!g) return;
    const m = g.slice(0, 3).map((v) => Math.round((1 + (v - 1) * k) * 256)), a = g.slice(3).map((v) => v * k);
    for (let i = 0; i < W * H; i++) {
      const c = dst[i];
      const r = Math.min(255, (((c & 255) * m[0]) >> 8) + a[0]), gg = Math.min(255, ((((c >>> 8) & 255) * m[1]) >> 8) + a[1]), b = Math.min(255, ((((c >>> 16) & 255) * m[2]) >> 8) + a[2]);
      dst[i] = (0xff000000 | (b << 16) | (gg << 8) | r) >>> 0;
    }
  }
  // the arena of a chapter in an environment's full light, made once
  const graded = {};
  function gradedFor(n, kind) {
    const key = n + ":" + kind;
    if (graded[key]) return graded[key];
    const a = new Uint32Array(arenaFor(n));
    envUnder(a, 1, kind);
    return (graded[key] = a);
  }
  function envOver(w) {
    const k = envK;
    const motes = Q.motes;
    if (env === "snow") for (let n = 0; n < motes; n++) { const p = MOTES[n]; const y = (p.y + clock * 14 * p.v) % (H + 4) - 2, x = ((p.x + Math.sin(clock * p.v + p.p) * 6 - clock * 5) % W + W) % W; put(x, y, [255, 255, 255], 0.9 * k); if (p.v > 1.1) put(x + 1, y, [230, 240, 255], 0.6 * k) }
    else if (env === "sandstorm") for (let n = 0; n < motes; n++) { const p = MOTES[n]; const x = ((p.x - clock * 120 * p.v) % W + W) % W, y = p.y + Math.sin(clock * 3 + p.p) * 3; for (let j = 0; j < 4; j++) put(x + j, y, [230, 196, 130], (0.7 - j * 0.15) * k) }
    else if (env === "miasma") for (const p of MOTES.slice(0, 40)) { const y = ((p.y - clock * 6 * p.v) % H + H) % H, x = p.x + Math.sin(clock + p.p) * 8, on = 0.4 + 0.4 * Math.sin(clock * 2 + p.p); put(x, y, [170, 240, 80], on * k); put(x + 1, y, [120, 200, 60], on * 0.5 * k) }
    else if (env === "night") {
      for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) { const d = Math.hypot(x, y); if (d <= 7) put(290 + x, 22 + y, d > 5.5 ? [255, 120, 110] : [210, 50, 50], k) }
      for (const s of STARS.slice(0, 30)) if (s.y < 70) put(s.x, s.y * 0.6, [255, 230, 230], k * (0.4 + 0.4 * Math.sin(clock * 3 + s.p)));
    } else if (env === "aurora") {
      // the curtain, in integer blends: a column at a time
      for (let x = 0; x < W; x++) {
        const top = (6 + Math.sin(x * 0.03 + clock * 0.8) * 6 + Math.sin(x * 0.011 - clock * 0.5) * 8) | 0, col = hsv((0.33 + 0.25 * Math.sin(x * 0.01 + clock * 0.3) + 1) % 1);
        const R = col[0] | 0, G = col[1] | 0, B = col[2] | 0;
        for (let y = 0; y < 26; y++) {
          const Y = top + y; if (Y < 0 || Y >= H) continue;
          const q = (0.32 * (1 - y / 26) * k * 256) | 0, p = 256 - q, i = Y * W + x, c = pic[i];
          pic[i] = (0xff000000 | ((((c >>> 16) & 255) * p + B * q) >> 8) << 16 | ((((c >>> 8) & 255) * p + G * q) >> 8) << 8 | (((c & 255) * p + R * q) >> 8)) >>> 0;
        }
      }
      for (const s of STARS) if (s.y < 90) put(s.x, s.y * 0.5, [240, 250, 255], k * (0.5 + 0.5 * Math.sin(clock * 4 + s.p)));
    } else if (env === "sun") {
      for (let b = 0; b < 4; b++) { const x0 = 120 + b * 52 + Math.sin(clock * 0.4 + b) * 6; for (let y = 0; y < H; y += 1) { const x = x0 + y * 0.45; for (let j = 0; j < 6; j++) put(x + j, y, [255, 240, 180], 0.08 * k * (1 - y / H)) } }
    } else if (env === "fog" && w.sight) {
      // thick past what the spells can see
      for (let x = Math.max(0, w.sight - 40); x < W; x++) { const a = Math.min(0.75, ((x - (w.sight - 40)) / 60) * 0.75) * k, q = Math.round(a * 256), p = 256 - q; for (let y = 0; y < H; y++) { const i = y * W + x, c = pic[i], n = 200 + ((Math.sin(x * 0.05 + y * 0.08 + clock * 0.6) * 18) | 0); pic[i] = (0xff000000 | ((((c >>> 16) & 255) * p + (n + 8) * q) >> 8) << 16 | ((((c >>> 8) & 255) * p + n * q) >> 8) << 8 | (((c & 255) * p + n * q) >> 8)) >>> 0 } }
    }
  }

  // ---------- reactions: rings, beams, sigils, labels ----------
  function drawRings() {
    for (const r of rings) {
      const u = r.t / r.life, col = r.col ?? [255, 255, 255];
      if (r.well) {
        for (let a = 0; a < 3; a++) for (let s = 0; s < 40; s++) { const t = s / 40, ang = a * 2.09 + t * 6 - clock * 8, rr = r.r * (1 - t); put(r.x + Math.cos(ang) * rr, r.y + Math.sin(ang) * rr * 0.45, col, 0.7 * t * (1 - u * 0.5)) }
        continue;
      }
      const rr = r.r * (0.3 + 0.7 * u), k = 1 - u;
      for (let a = 0; a < 48; a++) put(r.x + Math.cos(a * 0.131) * rr, r.y + Math.sin(a * 0.131) * rr * 0.45, col, 0.9 * k);
    }
  }
  function drawBeams() {
    for (const b of beams) { const k = 1 - b.t / b.life; line(b.x, b.y, b.x2, b.y2, b.col, 0.95 * k, b.w); if (b.w > 1) line(b.x, b.y, b.x2, b.y2, [255, 255, 255], 0.7 * k) }
  }
  // the tiers: a turning figure on the ground (triangle, square, pentagram, hexagram), its corners in the elements
  function drawSigils() {
    for (const s of sigils) {
      const u = s.t / s.life, n = s.n, R = [0, 0, 0, 16, 22, 28, 30][n] * (n === 5 ? 1 : 0.6 + 0.4 * Math.min(1, u * 3)), k = u < 0.8 ? 1 : (1 - u) / 0.2, spin = clock * (n === 5 ? 2 : 1.2);
      const pts = Array.from({ length: n }, (_, i) => { const a = spin + (i / n) * Math.PI * 2; return [s.x + Math.cos(a) * R, s.y + Math.sin(a) * R * 0.45] });
      const els = s.elems.slice(-n);
      for (let i = 0; i < n; i++) {
        const j = n >= 5 ? (i + 2) % n : (i + 1) % n, col = COL[els[i % els.length]] ?? [255, 255, 255];
        line(pts[i][0], pts[i][1], pts[j][0], pts[j][1], col, 0.9 * k);
        if (n === 6) line(pts[i][0], pts[i][1], pts[(i + 1) % n][0], pts[(i + 1) % n][1], col, 0.6 * k);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(pts[i][0] + dx, pts[i][1] + dy, col, k);
      }
      if (n === 5) for (let a = 0; a < 60; a++) put(s.x + Math.cos(a * 0.105) * R * 1.15, s.y + Math.sin(a * 0.105) * R * 0.52, [255, 140, 230], 0.6 * k);
    }
  }
  function drawLabels() {
    const F = FONTS.big;
    for (const l of labels) {
      const sc = l.big ? 2 : 1, life = l.big ? 1.3 : 0.9;
      const a = l.t < life - 0.3 ? 1 : (life - l.t) / 0.3, y0 = Math.max(2, Math.round(l.y - 16 * sc - l.t * 14));
      let wsum = 0; for (const ch of l.text) wsum += ((F.glyphs[ch]?.w ?? F.space) + F.gap) * sc;
      let x = Math.max(2, Math.min(W - wsum - 2, Math.round(l.x - wsum / 2)));
      const pen = [];
      for (const ch of l.text) {
        const g = F.glyphs[ch];
        if (g) g.rows.forEach((row, ry) => row.forEach((on, rx) => { if (on) for (let j = 0; j < sc; j++) for (let i = 0; i < sc; i++) pen.push([x + rx * sc + i, y0 + ry * sc + j]) }));
        x += ((g?.w ?? F.space) + F.gap) * sc;
      }
      for (const [px, py] of pen) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) put(px + ox, py + oy, [20, 14, 26], 0.85 * a);
      for (const [px, py] of pen) put(px, py, l.t < 0.08 ? [255, 255, 255] : l.rainbow ? hsv(((px / 40 + clock * 1.5) % 1 + 1) % 1) : l.color, a);
    }
  }

  // ---------- summons: a grey body painted in its element's ramp (a fusion: top in one, bottom in the other) ----------
  const RAMP = Object.fromEntries(Object.entries(ELEM).map(([k, v]) => [k, v.ramp.map((h) => { const n = parseInt(h.slice(1), 16); return pack(n >> 16, (n >> 8) & 255, n & 255) })]));
  const painted = {};
  function bodyIn(body, elems) {
    const key = body + ":" + elems.join("+");
    if (painted[key]) return painted[key];
    const s = A.summons[body], src = s.pic, px = new Uint32Array(src.px), split = Math.round(src.h * 0.5);
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = y * src.w + x, c = px[i];
      if (c >>> 24 < 128) continue;
      const v = c & 255, idx = v < 40 ? 0 : v < 80 ? 2 : v < 120 ? 3 : v < 165 ? 4 : v < 210 ? 5 : v < 245 ? 6 : 7;
      const el = elems.length > 1 && (y > split || (y === split && x % 2)) ? elems[1] : elems[0];
      px[i] = RAMP[el][idx];
    }
    return (painted[key] = { ...s, pic: { ...src, px } });
  }
  function drawMinion(m) {
    const s = bodyIn(m.body, m.elems), f = m.atk > 0 ? 2 : Math.floor(clock * 3 + m.id) % 2, bob = m.body === "spirit" ? Math.round(Math.sin(clock * 4 + m.id) * 1.5) - 6 : 0;
    if (m.life < 1.5 && Math.floor(clock * 10) % 2) return;   // about to go: blinking
    darken(m.x, m.y, Math.round(s.fw / 3), 2, 0.7);
    const x = Math.round(m.x) - s.ax, y = Math.round(m.y) - s.ay + bob;
    outline(s, f, x, y, COL[m.elems[m.elems.length - 1]], 0.35 + 0.2 * Math.sin(clock * 5 + m.id));
    blit(s, f, x, y, m.flash > 0 ? (c) => mixTo(c, [255, 255, 255], 0.7) : null);
    if (m.hp < m.max) { const bw = 14, bx = Math.round(m.x - bw / 2), by = y - 3, fill = Math.round(bw * Math.max(0, m.hp / m.max)); for (let i = 0; i < bw; i++) put(bx + i, by, i < fill ? [90, 220, 120] : [30, 40, 34], 1) }
  }

  // ---------- monsters ----------
  function enemyTint(e) {
    const st = e.status;
    if (e.flash > 0.04) return (c) => mixTo(c, [255, 255, 255], 0.75);
    if (st.stun > 0 && Math.floor(clock * 14) % 2) return (c) => mixTo(c, [235, 220, 255], 0.55);
    if (st.freeze > 0) return (c) => mixTo(c, [170, 225, 255], 0.55);
    if (e.auras.size >= 7) { const col = hsv((clock * 2 + e.id * 0.1) % 1); return (c) => mixTo(c, col, 0.3) }
    if (st.root > 0) return (c) => mixTo(c, [90, 60, 120], 0.3);
    if (st.slow.stacks) return (c) => mixTo(c, [120, 190, 255], 0.22 * Math.min(2, st.slow.stacks));
    if (st.burn.stacks) { const k = 0.18 + 0.1 * Math.sin(clock * 20); return (c) => mixTo(c, st.burn.black > 0 ? [80, 30, 120] : [255, 120, 40], k) }
    if (st.poison.stacks) return (c) => mixTo(c, [140, 220, 60], 0.08 * st.poison.stacks);
    if (e.enraged && Math.floor(clock * 6) % 2) return (c) => mixTo(c, [255, 60, 40], 0.35);
    if (e.element) return (c) => mixTo(c, COL[e.element], 0.42);
    if (ENEMIES[e.type].tint) { const t = ENEMIES[e.type].tint; return (c) => mixTo(c, t, 0.45) }
    if (e.swap) return (c) => mixTo(c, COL[e.swap], 0.22);
    return null;
  }
  function enemyFrame(e) {
    const def = ENEMIES[e.type];
    if (e.flash > 0.06) return 6;
    if (e.status.freeze > 0 || e.status.stun > 0) return e.state === "attack" ? 4 : Math.floor(e.walkT * 8) % 4;
    if (e.state === "attack") { const ph = e.atkT / def.rate; return ph < 0.15 ? 5 : ph > 0.55 ? 4 : 0 }
    return Math.floor(e.walkT * 8) % 4;
  }
  function drawPips(e, m, lift = 0) {
    const n = e.auras.size; if (!n) return;
    const els = [...e.auras.keys()], top = Math.round(e.y - lift - m.ay - 3), span = n * 3 - 1, x0 = Math.round(e.x - span / 2);
    for (let i = 0; i < n; i++) { const c = COL[els[i]]; put(x0 + i * 3, top, c, 1); put(x0 + i * 3 + 1, top, c, 1); put(x0 + i * 3, top - 1, c, 0.8); put(x0 + i * 3 + 1, top - 1, c, 0.8) }
  }
  function drawTag(text, x, y, col) {
    const F = FONTS.mini; let wsum = 0; for (const ch of text) wsum += (F.glyphs[ch]?.w ?? F.space) + F.gap;
    let cx = Math.round(x - wsum / 2);
    for (const ch of text) { const g = F.glyphs[ch]; if (g) g.rows.forEach((row, ry) => row.forEach((on, rx) => { if (on) { put(cx + rx, y + ry + 1, [10, 8, 14], 0.8); put(cx + rx, y + ry, col, 1) } })); cx += (g?.w ?? F.space) + F.gap }
  }

  // the black hole: the picture swirled and pulled toward it, its accretion ring turning
  function lens(w) {
    for (const bh of w.blackholes) {
      const R = BLACK_HOLE.reach, strength = bh.phase === "rift" ? bh.t / BLACK_HOLE.rift : bh.phase === "pull" || bh.phase === "collapse" ? 1 : 0;
      if (strength <= 0) continue;
      tmp.set(pic);
      // the swirl is smooth, so its trigonometry is worked out once per 2x2 block and shared by the four
      const x0 = Math.max(0, Math.floor(bh.x - R)) & ~1, x1 = Math.min(W, bh.x + R), y0 = Math.max(0, Math.floor(bh.y - R)) & ~1, y1 = Math.min(H, bh.y + R);
      const VOID = [30, 0, 50], RIM = pack(255, 200, 255), CORE = pack(0, 0, 0), core = 9 * strength, rim = 7 * strength;
      for (let by = y0; by < y1; by += 2) for (let bx = x0; bx < x1; bx += 2) {
        const dx = bx + 0.5 - bh.x, dy = (by + 0.5 - bh.y) * 1.6, d = Math.hypot(dx, dy);
        if (d >= R + 2) continue;
        const u = Math.max(0, 1 - d / R), ang = Math.atan2(dy, dx) + u * u * 2.8 * strength + clock * 0.6 * u, sd = d * (1 + 0.9 * u * strength);
        const ox = Math.round(bh.x + Math.cos(ang) * sd) - bx, oy = Math.round(bh.y + (Math.sin(ang) * sd) / 1.6) - by, k = 0.5 * u * strength;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const x = bx + i, y = by + j;
          if (x >= x1 || y >= y1) continue;
          const pd = Math.hypot(x - bh.x, (y - bh.y) * 1.6);
          if (pd >= R) continue;
          let c;
          if (pd < core) c = pd > rim ? RIM : CORE;
          else { const sx = x + ox, sy = y + oy; c = mixTo(sx >= 0 && sy >= 0 && sx < W && sy < H ? tmp[sy * W + sx] : 0xff000000, VOID, k) }
          pic[y * W + x] = c;
        }
      }
      for (let a = 0; a < 90; a++) { const ang = a * 0.07 + clock * 5, rr = 14 + Math.sin(a * 0.7 + clock * 9) * 1.5; put(bh.x + Math.cos(ang) * rr, bh.y + Math.sin(ang) * rr * 0.4, hsv((a / 90 + clock) % 1), 0.85 * strength) }
    }
  }

  // the arena in its chapter's light, made once per chapter
  const arenas = {};
  function arenaFor(n) {
    if (arenas[n]) return arenas[n];
    const t = CHAPTERS[Math.min(5, n) - 1]?.tint, a = new Uint32Array(A.arena.px);
    if (t) for (let i = 0; i < a.length; i++) { const c = a[i]; a[i] = pack((c & 255) * t[0], ((c >>> 8) & 255) * t[1], ((c >>> 16) & 255) * t[2]) }
    return (arenas[n] = a);
  }
  // the whole picture washed toward a colour (a flash, the torn sky), in integer steps
  function wash([r, g, b], k) {
    const q = Math.round(Math.min(1, k) * 256), p = 256 - q, R = r * q, G = g * q, B = b * q;
    for (let i = 0; i < W * H; i++) { const c = pic[i]; pic[i] = (0xff000000 | ((((c >>> 16) & 255) * p + B) >> 8) << 16 | ((((c >>> 8) & 255) * p + G) >> 8) << 8 | (((c & 255) * p + R) >> 8)) >>> 0 }
  }

  function draw(w) {
    const t0 = performance.now();
    firsts = 0;
    if (++drawn % 30 === 0) clearFrame(frame);   // now and then wipe the scratch frame whole, in case an effect drew past its box
    if (env === "clear") pic.set(arenaFor(w.chapter));
    else if (envK >= 1) pic.set(gradedFor(w.chapter, env));
    else { pic.set(arenaFor(w.chapter)); envUnder() }
    if (lavaK > 0.01) { const g = 1 - 0.07 * lavaK, b = 1 - 0.15 * lavaK; for (let i = 0; i < W * H; i++) { const c = pic[i]; pic[i] = pack(c & 255, ((c >>> 8) & 255) * g, ((c >>> 16) & 255) * b) } }
    if (space > 0.01) {
      wash([24, 8, 44], 0.55 * space);
      for (const s of STARS) put(s.x, s.y, [255, 255, 255], space * (0.5 + 0.5 * Math.sin(clock * 4 + s.p)));
    }

    if (w.grounds.length || stones.length) drawGround(w);
    if (w.drops.length) drawDrops(w);
    if (sigils.length) drawSigils();
    drawFx(fxs.filter((f) => f.under), "back");
    drawFx(fxs.filter((f) => !f.under && f.kind === "overlay"), "back");

    darken(MAGE_FEET[0], MAGE_FEET[1], 9, 2, 0.72);
    const pose = { idle: Math.floor(clock / 0.35) % 2 ? "idle1" : "idle0", cast: "cast", focus: "focus", throw: "throw", hurt: "hurt" }[w.mage.pose] ?? "idle0";
    blit(A.heroes?.[w.cls] ?? A.mage, FRAMES.mage.indexOf(pose), MAGE_AT[0], MAGE_AT[1]);
    const wr = w.wall.hp / w.wall.max, wall = A.walls[wr > 0.66 ? 0 : wr > 0.33 ? 1 : 2];
    for (let y = 0; y < H; y++) for (let x = 0; x < wall.w; x++) { const c = wall.px[y * wall.w + x]; if (c >>> 24 > 127) pic[y * W + WALL_AT + x] = c | 0xff000000 }

    for (const m of [...w.minions].sort((a, b) => a.y - b.y)) drawMinion(m);
    const list = w.enemies.filter((e) => e.hp > 0).sort((a, b) => a.y - b.y);
    for (const e of list) {
      const m = A.monsters[e.type], def = ENEMIES[e.type], lift = def.fly ?? 0, f = enemyFrame(e), fx = Math.round(e.x) - m.ax, fy = Math.round(e.y - lift) - m.ay;
      darken(e.x, e.y, lift ? def.half - 2 : def.half, Math.max(2, def.half / 4), lift ? 0.85 : 0.7);
      if (e.tenacity?.unstop > 0) outline(m, f, fx, fy, [255, 210, 90], 0.6 + 0.3 * Math.sin(clock * 10));
      if (e.elite) outline(m, f, fx, fy, ELITES[e.elite].color, 0.55 + 0.35 * Math.sin(clock * 6 + e.id));
      else if (e.element) outline(m, f, fx, fy, COL[e.element2 ?? e.element], e.element2 ? 0.75 : 0.45);
      if (e.auras.size >= 7) outline(m, f, fx, fy, hsv((clock * 3 + e.id * 0.2) % 1), 0.9);
      blit(m, f, fx, fy, enemyTint(e));
      if (e.shield > 0) { const r = Math.max(def.half, def.cy) + 4, cx = e.x, cy = e.y - def.cy; for (let a = 0; a < 40; a++) put(cx + Math.cos(a * 0.157) * r, cy + Math.sin(a * 0.157) * r * 0.9, e.shieldBy === "tier" ? [255, 220, 120] : [140, 200, 255], 0.55 + 0.25 * Math.sin(clock * 5 + a)) }
      if (e.status.wet > 0) { const u = (clock * 2 + e.id * 0.31) % 1; put(e.x + 2 - (e.id % 5), e.y - def.cy + u * def.cy, [130, 190, 250], 0.85 * (1 - u)) }
      if (e.hp < e.max && !def.boss) {
        const bw = Math.max(10, def.half * 2), bx = Math.round(e.x - bw / 2), by = Math.round(e.y - lift - m.ay + 2), fill = Math.round(bw * Math.max(0, e.hp / e.max));
        for (let i = 0; i < bw; i++) { if (bx + i < 0 || bx + i >= W || by < 0) continue; pic[by * W + bx + i] = i < fill ? pack(220, 60, 60) : pack(40, 24, 34) }
      }
      drawPips(e, m, lift);
      if (e.elite) drawTag(ELITES[e.elite].tag, e.x, Math.round(e.y - lift - m.ay - 11), ELITES[e.elite].color);
    }

    drawFx(fxs.filter((f) => !f.number && f.kind !== "weather" && f.kind !== "bh"), "front");
    if (bolts.length) drawBolts();
    if (rings.length) drawRings();
    if (beams.length) drawBeams();
    if (w.blackholes.length) lens(w);
    drawFx(fxs.filter((f) => f.kind === "bh"), "front");
    if (rainK > 0.01 || (env === "rain" && envK > 0)) drawRain(env === "rain" ? Math.max(rainK, 0.45 * envK) : rainK);
    if (env !== "clear") envOver(w);
    for (const b of blinks) for (let a = 0; a < 16; a++) put(b.x + Math.cos(a * 0.4) * (3 + b.t * 30), b.y - 8 + Math.sin(a * 0.4) * (3 + b.t * 30) * 0.6, [150, 80, 200], 1 - b.t / 0.35);
    drawFx(fxs.filter((f) => f.kind === "weather"), "front");
    if (flash > 0) wash(flashCol, Math.min(1, flash / 0.18) * 0.3);
    if (labels.length) drawLabels();
    drawFx(fxs.filter((f) => f.number), "front");

    // out: the picture's words are already RGBA bytes; copy whole rows (shifted by the shake)
    const sx = Math.round(Math.sin(shakeT * 91) * shake), sy = Math.round(Math.cos(shakeT * 67) * shake * 0.6);
    if (!sx && !sy) out32.set(pic);
    else for (let y = 0; y < H; y++) {
      const src = Math.max(0, Math.min(H - 1, y - sy)) * W, dst = y * W;
      if (sx >= 0) { out32.set(pic.subarray(src, src + W - sx), dst + sx); out32.fill(pic[src], dst, dst + sx) }
      else { out32.set(pic.subarray(src - sx, src + W), dst); out32.fill(pic[src + W - 1], dst + W + sx, dst + W) }
    }
    adapt(performance.now() - t0);
    return out;
  }
  // too slow for long: draw less (fewer effects, slower repaints); quick again for long: back up
  let slowFor = 0, fastFor = 0;
  let pinned = false;
  function adapt(ms) {
    if (pinned) return;
    ema = ema ? ema * 0.95 + ms * 0.05 : ms;
    if (ema > 14 && level < QUALITY.length - 1) { if (++slowFor > 90) { level++; Q = QUALITY[level]; slowFor = 0; ema = 0 } } else slowFor = 0;
    if (ema < 7 && level > 0) { if (++fastFor > 300) { level--; Q = QUALITY[level]; fastFor = 0; ema = 0 } } else fastFor = 0;
  }

  return { update, draw, setQuality: (l) => { pinned = l !== null; if (pinned) { level = Math.max(0, Math.min(QUALITY.length - 1, l)); Q = QUALITY[level] } }, stats: () => ({ fx: fxs.length, overlays: overlays.size, numbers, labels: labels.length, quality: level, ms: +ema.toFixed(2) }) };
}

export { ELEMENTS };
