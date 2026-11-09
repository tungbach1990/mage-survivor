// The idle battle drawn at 3/4 from above (as Ragnarok): the map's ground in tiles, its trees and rocks, the
// monsters wandering and the hero walking among them in eight directions, all sorted by depth; the camera follows
// the hero. On top: the blows' effects, arrows and spells flying, damage numbers, health bars, a ring under the
// hero's target, the cast bar, the loot flying in.

import { createFrame, clearFrame, createFx, Rng, FONTS } from "../../lib/pixelfx/core/index.js?v=mw92mcdd";
import * as hitSpark from "../../lib/pixelfx/fx/impacts/hit-spark.js?v=mw92mcdd";
import * as bluntHit from "../../lib/pixelfx/fx/impacts/blunt-hit.js?v=mw92mcdd";
import * as swordSlash from "../../lib/pixelfx/fx/melee/sword-slash.js?v=mw92mcdd";
import * as dmgNumber from "../../lib/pixelfx/fx/ui/damage-number.js?v=mw92mcdd";
import * as healFx from "../../lib/pixelfx/fx/holy/heal.js?v=mw92mcdd";
import * as poof from "../../lib/pixelfx/fx/spawn/poof.js?v=mw92mcdd";
import { blastOf } from "../render/looks.js?v=mw92mcdd";
import { ELEM } from "../data/elements.js?v=mw92mcdd";
import { GRADE } from "../data/loot.js?v=mw92mcdd";
import { MATERIALS, kindOf } from "../data/gear.js?v=mw92mcdd";
import { mapOf } from "./data.js?v=mw92mcdd";
import { GRID, mapGrid } from "./world.js?v=mw92mcdd";

export const VW = 180, VH = 200, TW = 16, TH = 12;
const W = VW, H = VH, WW = GRID * TW, WH = GRID * TH;
const pack = (r, g, b) => (0xff000000 | (Math.max(0, Math.min(255, b | 0)) << 16) | (Math.max(0, Math.min(255, g | 0)) << 8) | Math.max(0, Math.min(255, r | 0))) >>> 0;
const NUM = Object.fromEntries(Object.entries(ELEM).map(([k, v]) => [k, v.ramp]));
NUM.neutral = ["#2a2430", "#4a4250", "#7a7084", "#aaa0b4", "#d6ccde", "#f2ecf6", "#ffffff", "#ffffff"];
const HURT = ["#3a0a0a", "#7a1414", "#c02424", "#ff4a4a", "#ff8a8a", "#ffd0d0", "#ffffff", "#ffffff"];
const COL = Object.fromEntries(Object.entries(ELEM).map(([k, v]) => [k, v.color]));
COL.neutral = [220, 220, 230];
// each map's ground: [base, light, dark] and what stands on its blocked tiles
const GROUNDS = {
  grass: { c: [[92, 156, 70], [118, 186, 84], [70, 128, 56]], deco: ["tree", "bush", "rock"] },
  forest: { c: [[70, 128, 60], [90, 150, 70], [50, 100, 44]], deco: ["pine", "tree", "bush"] },
  swamp: { c: [[88, 104, 62], [110, 128, 74], [62, 76, 46]], deco: ["dead", "bush", "tomb"] },
  cave: { c: [[96, 88, 100], [118, 110, 120], [70, 64, 76]], deco: ["rock", "crystal", "pillar"] },
  lava: { c: [[96, 56, 44], [124, 72, 52], [64, 36, 32]], deco: ["lava", "rock", "dead"] },
  snow: { c: [[214, 226, 244], [236, 244, 255], [180, 196, 222]], deco: ["ice", "pine", "rock"] },
  ruins: { c: [[96, 90, 110], [118, 112, 130], [70, 66, 84]], deco: ["pillar", "tomb", "dead"] },
  temple: { c: [[200, 184, 140], [224, 210, 166], [168, 150, 112]], deco: ["pillar", "crystal", "palm"] },
  shore: { c: [[200, 186, 140], [222, 210, 166], [168, 154, 112]], deco: ["palm", "rock", "bush"] },
  void: { c: [[56, 40, 84], [76, 56, 110], [40, 28, 62]], deco: ["void", "crystal", "pillar"] },
};

// each class's own cloth on its figure (art3q.px.js's palette), dark to light: what armour worn recolours
const hexc = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const CLOTH = {
  swordman: ["#3c4452", "#6a7486", "#a8b2c2", "#e2e8f0"], mage: ["#2c1640", "#4e2a76", "#7a4ab0"], archer: ["#1f3a24", "#2f6a36", "#5ea05a"],
  thief: ["#1c1826", "#33304a", "#58547a"], acolyte: ["#a8a29a", "#d8d2c6", "#f6f2ea"], merchant: ["#4a3020", "#7a5434", "#a87c4e"],
};
const key3 = (r, g, b) => (r << 16) | (g << 8) | b;
export function createIdleRenderer(A) {
  // a hero's sheet in the body armour's material (made once per class, weapon and material)
  const dressed = new Map();
  function sheetFor(h) {
    const wt = h.gear?.weapon ? h.gear.weapon.wtype : "fist", base = A.q?.[`${h.cls}_${wt}`] ?? A.q?.[`${h.cls}_fist`];
    const body = h.gear?.body, mat = body ? kindOf(body)[1] : null, ramp = MATERIALS[mat]?.ramp, from = CLOTH[h.cls];
    if (!base || !ramp || !from) return base;
    const key = `${h.cls}_${wt}_${mat}`;
    if (dressed.has(key)) return dressed.get(key);
    const map = new Map(from.map((hx, i) => { const c = hexc(hx), t = ramp[Math.min(ramp.length - 1, 1 + Math.round((i * (ramp.length - 2)) / Math.max(1, from.length - 1)))]; return [key3(...c), (0xff000000 | (t[2] << 16) | (t[1] << 8) | t[0]) >>> 0] }));
    const p = base.pic, px = new Uint32Array(p.px.length);
    for (let i = 0; i < px.length; i++) { const c = p.px[i], k = key3(c & 255, (c >>> 8) & 255, (c >>> 16) & 255); px[i] = c >>> 24 > 127 && map.has(k) ? map.get(k) : c }
    const s = { ...base, pic: { ...p, px } };
    dressed.set(key, s);
    return s;
  }
  const frame = createFrame(W, H), pic = new Uint32Array(W * H), out = new Uint8ClampedArray(W * H * 4), out32 = new Uint32Array(out.buffer);
  const rng = new Rng(7);
  let fxs = [], flyers = [], clock = 0, ground = null, groundMap = -1, camX = 0, camY = 0, camSet = false, shake = 0;
  let heroAnim = { move: "idle", t: 0 }, castBar = null;
  const flash = new Map(), mAnim = new Map();   // monster id -> flash until; -> when it last struck

  // ---- the ground of a map, drawn once: tiles in three tones, a faint seam at each tile's top and left
  function buildGround(map) {
    const M = mapOf(map), G = GROUNDS[M.ground] ?? GROUNDS.grass, g = mapGrid(map), px = new Uint32Array(WW * WH), r = new Rng(map * 131 + 7);
    // a smooth noise (value noise on a 20 px lattice, two octaves) between the dark and light tones, specks and tufts
    const L = [], N = 24; for (let i = 0; i < N * N; i++) L.push(r.next());
    const at = (x, y) => L[((y % N) + N) % N * N + (((x % N) + N) % N)];
    const noise = (x, y, s) => { const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, sm = (t) => t * t * (3 - 2 * t), a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1); return (a + (b - a) * sm(u)) * (1 - sm(v)) + (c + (d - c) * sm(u)) * sm(v) };
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const n = noise(x, y, 22) * 0.7 + noise(x + 99, y + 57, 7) * 0.3, step = Math.round(n * 4) / 4;
      let c = step < 0.5 ? mix(G.c[2], G.c[0], step * 2) : mix(G.c[0], G.c[1], (step - 0.5) * 2);
      const h = (x * 73856093 ^ y * 19349663) >>> 0;
      if (h % 97 === 0) c = G.c[1]; else if (h % 89 === 0) c = G.c[2];
      if (h % 211 === 0 && y > 1) { px[(y - 1) * WW + x] = pack(G.c[1][0] * 1.08, G.c[1][1] * 1.08, G.c[1][2] * 1.08) }
      px[y * WW + x] = pack(c[0], c[1], c[2]);
    }
    return { px, deco: G.deco, grid: g };
  }

  // ---- helpers
  const put = (x, y, rgb, k = 1) => {
    const X = x | 0, Y = y | 0; if (X < 0 || Y < 0 || X >= W || Y >= H || !(k > 0)) return;
    const i = Y * W + X, c = pic[i], r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255; if (k > 1) k = 1;
    pic[i] = pack(r + (rgb[0] - r) * k, g + (rgb[1] - g) * k, b + (rgb[2] - b) * k);
  };
  const rect = (x, y, w, h, rgb, k = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, rgb, k) };
  const ellipse = (cx, cy, rx, ry, rgb, k, ring = false) => {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const d = (x / rx) ** 2 + (y / ry) ** 2; if (d <= 1 && (!ring || d > 0.55)) put(cx + x, cy + y, rgb, k * (ring ? 1 : 1 - d * 0.5)) }
  };
  /** A piece of a picture (sx, sy, sw, sh) laid at (x, y); tint(c) recolours, flip mirrors. */
  function blitPic(p, sx, sy, sw, sh, x, y, tint, flip) {
    for (let j = 0; j < sh; j++) {
      const Y = y + j; if (Y < 0 || Y >= H) continue;
      for (let i = 0; i < sw; i++) {
        const X = x + i; if (X < 0 || X >= W) continue;
        const c = p.px[(sy + j) * p.w + sx + (flip ? sw - 1 - i : i)]; if (c >>> 24 < 128) continue;
        pic[Y * W + X] = tint ? tint(c) : c | 0xff000000;
      }
    }
  }
  function add(mod, o, life = 0.6) { if (fxs.length > 30) fxs.shift(); fxs.push({ fx: createFx(mod, { seed: rng.int(0, 99), ...o }), age: 0, life }) }
  // effects live in the world: placed by world position (lifted `lift` px), moved with the camera each frame
  const addAt = (mod, wx, wy, lift, o, life) => { if (Number.isFinite(wx) && Number.isFinite(wy)) add(mod, { ...o, x: 0, y: 0, wx, wy, lift }, life) };
  function text(str, x, y, rgb, k = 1) {
    const F = FONTS.mini ?? FONTS.big; let cx = x;
    for (const ch of str) { const g = F.glyphs[ch]; if (g) g.rows.forEach((row, ry) => row.forEach((on, rx) => { if (on) { put(cx + rx + 1, y + ry + 1, [10, 8, 14], k * 0.8); put(cx + rx, y + ry, rgb, k) } })); cx += (g?.w ?? F.space) + F.gap }
    return cx - x;
  }
  const textW = (str) => { const F = FONTS.mini ?? FONTS.big; let n = 0; for (const ch of str) n += (F.glyphs[ch]?.w ?? F.space) + F.gap; return n };

  // ---- events -> effects
  function onEvent(ev, w) {
    switch (ev.type) {
      case "basic":
        heroAnim = { move: "strike", t: 0 };
        if (ev.ranged) flyers.push({ x0: ev.fromX, y0: ev.fromY, h0: 18, x1: ev.x, y1: ev.y, h1: 10 + ev.fly, t: 0, life: 0.16, col: ev.wtype === "staff" ? [200, 170, 255] : [236, 226, 200], kind: ev.wtype === "staff" ? "orb" : "arrow" });
        else addAt(swordSlash, ev.x, ev.y, 10, { scale: 0.5, palette: NUM.neutral, light: 0.3 }, 0.2);
        break;
      case "castStart": heroAnim = { move: "cast", t: 0 }; break;
      case "skill": {
        heroAnim = { move: ev.kind === "buff" || ev.kind === "heal" || ev.elem !== "neutral" ? "cast" : "strike", t: 0 };
        if (ev.kind === "heal") { addAt(healFx, ev.x, ev.y, 0, { light: 0.6 }, 0.9); break }
        if (ev.kind === "buff") { for (let i = 0; i < 12; i++) flyers.push({ x0: ev.fromX, y0: ev.fromY, h0: 4, x1: ev.fromX + Math.cos(i) * 0.8, y1: ev.fromY + Math.sin(i) * 0.5, h1: 26, t: 0, life: 0.55, col: COL[ev.elem] ?? [255, 230, 140], kind: "mote" }); break }
        const b = blastOf(ELEM[ev.elem] ? ev.elem : "arcane");
        if (ev.kind === "area") { addAt(b.mod, ev.x, ev.y, 0, { ...b.opts, light: 0.5 }, b.life); for (let k = 0; k < 3; k++) addAt(b.mod, ev.x + (k - 1) * 1.1, ev.y + ((k * 7) % 3 - 1) * 0.8, 0, { ...b.opts, light: 0.4 }, b.life * 0.8) }
        else { flyers.push({ x0: ev.fromX, y0: ev.fromY, h0: 18, x1: ev.x, y1: ev.y, h1: 12, t: 0, life: 0.18, col: COL[ev.elem] ?? [255, 255, 255], kind: "orb", big: true }); addAt(b.mod, ev.x, ev.y, 8, { ...b.opts, light: 0.5 }, b.life * 0.7) }
        break;
      }
      case "dmg":
        flash.set(ev.id, clock + 0.08);
        addAt(dmgNumber, ev.x, ev.y, 26 + ev.fly, { text: String(ev.amount), palette: NUM[ev.elem] ?? NUM.neutral, scale: ev.crit ? 2 : 1 }, 0.9);
        if (!ev.skill) addAt(ev.crit ? bluntHit : hitSpark, ev.x, ev.y, 10 + ev.fly, { height: 0, palette: NUM.neutral, light: 0.4 }, 0.35);
        break;
      case "miss": addAt(dmgNumber, ev.x, ev.y, 28, { text: "MISS", palette: NUM.neutral }, 0.7); break;
      case "hurt":
        shake = Math.min(1.5, shake + 0.6); if (heroAnim.move !== "cast") heroAnim = { move: "hurt", t: 0 }; mAnim.set(ev.from, clock);
        addAt(dmgNumber, ev.x, ev.y, 30, { text: String(ev.amount), palette: HURT }, 0.8);
        if (ev.ranged) flyers.push({ x0: ev.fromX, y0: ev.fromY, h0: 14, x1: ev.x, y1: ev.y, h1: 14, t: 0, life: 0.2, col: COL[ev.elem] ?? [255, 120, 120], kind: "orb" });
        break;
      case "dodge": addAt(dmgNumber, ev.x, ev.y, 30, { text: "DODGE", palette: NUM.wind }, 0.6); break;
      case "kill": addAt(poof, ev.x, ev.y, 0, { light: 0.3 }, 0.5); if (ev.gold) flyers.push({ x0: ev.x, y0: ev.y, h0: 4, x1: w.hx, y1: w.hy, h1: 14, t: 0, life: 0.6, col: [255, 214, 80], kind: "coin" }); break;
      case "gear": flyers.push({ x0: ev.x, y0: ev.y, h0: 6, x1: w.hx, y1: w.hy, h1: 16, t: 0, life: 0.9, col: GRADE[ev.grade]?.color ?? [255, 255, 255], kind: "gem" }); break;
      case "heal": addAt(dmgNumber, ev.x, ev.y, 34, { text: "+" + ev.n, palette: NUM.wind }, 0.8); break;
      case "levelUp": for (let i = 0; i < 24; i++) flyers.push({ x0: ev.x, y0: ev.y, h0: 0, x1: ev.x + (i % 2 ? 1 : -1) * 0.3 * (i % 5), y1: ev.y, h1: 34 + (i % 7) * 3, t: 0, life: 0.9, col: [255, 236, 140], kind: "mote" }); break;
      case "death": heroAnim = { move: "dead", t: 0 }; break;
      case "revive": case "map": heroAnim = { move: "idle", t: 0 }; camSet = false; break;
    }
  }

  function update(w, events, dt) {
    clock += dt;
    for (const ev of events) onEvent(ev, w);
    for (const f of fxs) { f.fx.update(dt); f.age += dt }
    fxs = fxs.filter((f) => f.age < f.life && !f.fx.done());
    for (const f of flyers) f.t += dt;
    flyers = flyers.filter((f) => f.t < f.life);
    heroAnim.t += dt;
    shake = Math.max(0, shake - dt * 8);
    castBar = w.cast ? { k: 1 - w.cast.t / w.cast.total, elem: w.cast.elem } : null;
    // the camera: on the hero, a little low on the screen, eased; kept inside the map
    const tx = Math.max(0, Math.min(WW - W, w.hx * TW - W / 2)), ty = Math.max(0, Math.min(WH - H, w.hy * TH - H * 0.58));
    if (!camSet) { camX = tx; camY = ty; camSet = true } else { const k = Math.min(1, dt * 5); camX += (tx - camX) * k; camY += (ty - camY) * k }
  }

  // ---- the figures
  function figFrame(sheet, move, dir, t, loop = true) {
    const m = sheet.moves[move] ?? sheet.moves.idle, ms = move === "walk" ? 0.11 : move === "idle" ? 0.28 : move === "strike" ? 0.07 : 0.14;
    let f = Math.floor(t / ms); f = loop ? f % m.frames : Math.min(m.frames - 1, f);
    return { sx: f * sheet.fw, sy: (m.row + dir) * sheet.fh };
  }
  function drawHero(w, [x, y]) {
    const h = w.hero, sheet = sheetFor(h);
    ellipse(x, y, 7, 3, [0, 0, 0], 0.3);
    if (!sheet) return;
    let move = heroAnim.move, t = heroAnim.t;
    if (w.phase === "dead") move = "dead";
    else if ((move === "strike" && t > 0.3) || (move === "hurt" && t > 0.2) || (move === "cast" && !w.cast && t > 0.45) || move === "dead") move = "idle";
    if (move === "idle" && w.moving) { move = "walk"; t = clock } else if (move === "idle") t = clock;
    const { sx, sy } = figFrame(sheet, move, w.face, t, move === "walk" || move === "idle" || move === "cast");
    blitPic(sheet.pic, sx, sy, sheet.fw, sheet.fh, x - sheet.pivot[0], y - sheet.pivot[1], w.phase === "dead" ? (c) => pack((c & 255) * 0.5, ((c >>> 8) & 255) * 0.5, ((c >>> 16) & 255) * 0.6) : null, false);
  }
  function drawMonster(m, [x, y], target) {
    const fl = (flash.get(m.id) ?? 0) > clock, col = COL[m.elem] ?? COL.neutral, tinted = m.elem !== "neutral";
    const sheet = A.q?.[m.kind];
    if (target) ellipse(x, y, m.boss ? 12 : 8, m.boss ? 5 : 4, [255, 80, 80], 0.8, true);
    ellipse(x, y, m.boss ? 10 : 6, m.boss ? 4 : 3, tinted ? col : [0, 0, 0], tinted ? 0.35 : 0.28);
    const tint = fl ? () => 0xffffffff : tinted ? (c) => pack((c & 255) * 0.7 + col[0] * 0.3, ((c >>> 8) & 255) * 0.7 + col[1] * 0.3, ((c >>> 16) & 255) * 0.7 + col[2] * 0.3) : null;
    let top;
    if (sheet) {
      const at = mAnim.get(m.id) ?? -9, move = clock - at < 0.28 ? "strike" : m.moving ? "walk" : "idle";
      const { sx, sy } = figFrame(sheet, move, m.face, move === "strike" ? clock - at : clock + m.id * 0.13, move !== "strike");
      blitPic(sheet.pic, sx, sy, sheet.fw, sheet.fh, x - sheet.pivot[0], y - sheet.pivot[1] - m.fly, tint, false);
      top = y - sheet.pivot[1] + (m.kind === "wolf" ? 18 : 10) - m.fly;
    } else {
      // the slime and the bat: their strips (walk 0-3, strike 4-5, hurt 6), mirrored when facing right
      const s = A.monsters?.[m.kind] ?? A.monsters?.slime; if (!s) return;
      const f = fl ? 6 : m.moving ? Math.floor(clock * 8 + m.id) % 4 : clock - (mAnim.get(m.id) ?? -9) < 0.25 ? 5 : Math.floor(clock * 3 + m.id) % 2;
      const lift = m.fly ? 12 + Math.round(Math.sin(clock * 5 + m.id) * 2) : 0;
      blitPic(s.pic, f * s.fw, 0, s.fw, s.pic.h, x - s.ax, y - s.ay - lift, tint, m.face >= 5);
      top = y - s.ay - lift;
    }
    // a health bar once hurt (a boss's always, with its level)
    if (m.hp < m.max || m.boss) {
      const bw = m.boss ? 30 : 16, bx = Math.round(x - bw / 2), by = top - 4;
      rect(bx - 1, by - 1, bw + 2, 4, [10, 8, 14], 0.85);
      rect(bx, by, Math.max(1, Math.round(bw * m.hp / m.max)), 2, m.boss ? [255, 140, 60] : [230, 70, 70]);
      if (m.boss) { const s = `BOSS LV${m.lv}`; text(s, Math.round(x - textW(s) / 2), by - 8, [255, 200, 120], 0.95) }
    }
  }
  function drawDeco(kind, [x, y]) {
    const p = A.deco?.[kind]; if (!p) return;
    blitPic(p, 0, 0, p.w, p.h, x - (p.w >> 1), y - p.h + 2, null, false);
  }

  function draw(w) {
    if (!ground || groundMap !== w.map) { ground = buildGround(w.map); groundMap = w.map }
    const sx = Math.round(Math.sin(clock * 90) * shake), cx = Math.round(camX) - sx, cy = Math.round(camY);
    // the ground: the camera's window of the map
    for (let y = 0; y < H; y++) { const gy = y + cy; if (gy < 0 || gy >= WH) { pic.fill(0xff101018, y * W, y * W + W); continue } const row = gy * WW; for (let x = 0; x < W; x++) { const gx = x + cx; pic[y * W + x] = gx >= 0 && gx < WW ? ground.px[row + gx] : 0xff101018 } }
    // everything standing, back to front: the decorations in view, the monsters, the hero
    const items = [], g = ground.grid;
    const tx0 = Math.max(0, Math.floor(cx / TW) - 1), tx1 = Math.min(GRID - 1, Math.ceil((cx + W) / TW) + 1), ty0 = Math.max(0, Math.floor(cy / TH) - 1), ty1 = Math.min(GRID - 1, Math.ceil((cy + H) / TH) + 3);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (g.blocked[ty * GRID + tx]) items.push({ y: ty + 0.9, k: 0, kind: ground.deco[((g.deco[ty * GRID + tx] || 1) - 1) % ground.deco.length], tx, ty });
    for (const m of w.monsters) if (m.hp > 0) items.push({ y: m.y, k: 1, m });
    items.push({ y: w.hy, k: 2 });
    items.sort((a, b) => a.y - b.y);
    const S = (x, y) => [Math.round(x * TW - cx), Math.round(y * TH - cy)];
    for (const it of items) {
      if (it.k === 0) drawDeco(it.kind, S(it.tx + 0.5, it.ty + 1));
      else if (it.k === 1) drawMonster(it.m, S(it.m.x, it.m.y), it.m === w.target);
      else drawHero(w, S(w.hx, w.hy));
    }
    // the effects, placed in the world
    clearFrame(frame);
    for (const f of fxs) { const o = f.fx.options; if (o.wx != null) { const [x, y] = S(o.wx, o.wy); o.x = x; o.y = y - (o.lift ?? 0) } }
    for (const f of fxs) f.fx.draw(frame, "back");
    for (const f of fxs) f.fx.draw(frame, "front");
    over();
    drawFlyers(S);
    // the cast bar over the hero; the fallen notice
    const [hx, hy] = S(w.hx, w.hy);
    if (castBar) { rect(hx - 13, hy - 46, 26, 4, [10, 8, 14], 0.85); rect(hx - 12, hy - 45, Math.round(24 * castBar.k), 2, COL[castBar.elem] ?? [200, 200, 255]) }
    if (w.phase === "dead") { const s = "DA NGA"; text(s, Math.round(W / 2 - textW(s) / 2), 30, [255, 120, 120]); const r = `HOI SINH ${Math.ceil(w.deadT)}S`; text(r, Math.round(W / 2 - textW(r) / 2), 40, [230, 230, 240]) }
    out32.set(pic);
    return out;
  }
  function over() {
    const C = frame.color, L = frame.light;
    for (let i = 0; i < W * H; i++) {
      const c = C[i], l = L[i]; if (!c && !l) continue;
      const d = pic[i], a = (c >>> 24) / 255;
      let r = d & 255, g = (d >>> 8) & 255, b = (d >>> 16) & 255;
      if (a > 0) { r += ((c & 255) - r) * a; g += (((c >>> 8) & 255) - g) * a; b += (((c >>> 16) & 255) - b) * a }
      if (l) { r += l & 255; g += (l >>> 8) & 255; b += (l >>> 16) & 255 }
      pic[i] = pack(r, g, b);
    }
  }
  function drawFlyers(S) {
    for (const f of flyers) {
      const k = Math.min(1, f.t / f.life), e = f.kind === "coin" || f.kind === "gem" ? k * k : k;
      const [x0, y0] = S(f.x0, f.y0), [x1, y1] = S(f.x1, f.y1);
      const x = x0 + (x1 - x0) * e, y = y0 - f.h0 + (y1 - f.h1 - (y0 - f.h0)) * e - (f.kind === "coin" || f.kind === "gem" ? Math.sin(k * Math.PI) * 14 : 0);
      if (f.kind === "arrow") { const dx = x1 - x0, dy = (y1 - f.h1) - (y0 - f.h0), n = Math.hypot(dx, dy) || 1; for (let i = 0; i < 6; i++) put(x - (dx / n) * i, y - (dy / n) * i, f.col, 1 - i / 7) }
      else if (f.kind === "orb") { const r = f.big ? 3 : 2; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) put(x + i, y + j, f.col, 1 - (i * i + j * j) / (r * r + 1) * 0.6) }
      else if (f.kind === "coin") { put(x, y, f.col); put(x + 1, y, f.col); put(x, y + 1, [200, 150, 40]); put(x + 1, y + 1, [200, 150, 40]) }
      else if (f.kind === "gem") { for (const [i, j] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) put(x + i, y + j, f.col); put(x, y - 1, [255, 255, 255]) }
      else put(x, y, f.col, 1 - k);
    }
  }
  return { update, draw };
}
