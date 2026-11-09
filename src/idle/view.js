// The idle battle drawn from the side: the map's sky and hills (sliding by while the hero walks on), the hero on
// the left as it's dressed and armed, the monsters on the right with their element's glow, the blows' effects,
// the damage numbers, the loot flying in, and the bars over heads.

import { createFrame, clearFrame, createFx, Rng, FONTS } from "../../lib/pixelfx/core/index.js?v=mw8wxgia";
import * as hitSpark from "../../lib/pixelfx/fx/impacts/hit-spark.js?v=mw8wxgia";
import * as bluntHit from "../../lib/pixelfx/fx/impacts/blunt-hit.js?v=mw8wxgia";
import * as swordSlash from "../../lib/pixelfx/fx/melee/sword-slash.js?v=mw8wxgia";
import * as daggerFlurry from "../../lib/pixelfx/fx/melee/dagger-flurry.js?v=mw8wxgia";
import * as dmgNumber from "../../lib/pixelfx/fx/ui/damage-number.js?v=mw8wxgia";
import * as healFx from "../../lib/pixelfx/fx/holy/heal.js?v=mw8wxgia";
import * as poof from "../../lib/pixelfx/fx/spawn/poof.js?v=mw8wxgia";
import { blastOf } from "../render/looks.js?v=mw8wxgia";
import { dressHero } from "../render/dress.js?v=mw8wxgia";
import { lookOf } from "../data/gear.js?v=mw8wxgia";
import { ELEM } from "../data/elements.js?v=mw8wxgia";
import { GRADE } from "../data/loot.js?v=mw8wxgia";
import { mapOf } from "./data.js?v=mw8wxgia";
import { FIELD } from "./world.js?v=mw8wxgia";

export const VW = FIELD.w, VH = FIELD.h;
const W = VW, H = VH;
const pack = (r, g, b) => (0xff000000 | (Math.max(0, Math.min(255, b | 0)) << 16) | (Math.max(0, Math.min(255, g | 0)) << 8) | Math.max(0, Math.min(255, r | 0))) >>> 0;
const hexes = (pal) => pal;
const NUM = Object.fromEntries(Object.entries(ELEM).map(([k, v]) => [k, v.ramp]));
NUM.neutral = ["#2a2430", "#4a4250", "#7a7084", "#aaa0b4", "#d6ccde", "#f2ecf6", "#ffffff", "#ffffff"];
const COL = Object.fromEntries(Object.entries(ELEM).map(([k, v]) => [k, v.color]));
COL.neutral = [220, 220, 230];
// each map's ground colours: [far hills, near hills, ground top, ground, ground dark]
const GROUNDS = {
  grass: [[96, 150, 110], [70, 128, 74], [118, 186, 84], [86, 150, 62], [58, 108, 44]],
  forest: [[60, 110, 90], [40, 90, 60], [90, 150, 70], [64, 118, 52], [40, 84, 36]],
  swamp: [[90, 110, 80], [70, 90, 60], [110, 130, 70], [86, 104, 58], [58, 72, 40]],
  cave: [[60, 52, 70], [46, 40, 56], [110, 100, 110], [84, 76, 88], [56, 50, 62]],
  lava: [[110, 50, 40], [80, 36, 30], [150, 70, 40], [96, 44, 34], [60, 26, 24]],
  snow: [[170, 190, 220], [140, 170, 210], [236, 244, 255], [196, 212, 236], [150, 170, 200]],
  ruins: [[70, 60, 90], [54, 46, 72], [110, 100, 120], [84, 76, 96], [56, 50, 66]],
  temple: [[210, 190, 150], [180, 160, 120], [236, 220, 170], [200, 180, 130], [150, 130, 96]],
  shore: [[70, 90, 130], [50, 70, 110], [210, 196, 150], [170, 156, 116], [120, 110, 84]],
  void: [[60, 30, 90], [40, 20, 70], [90, 60, 130], [64, 40, 100], [40, 24, 70]],
};

export function createIdleRenderer(A) {
  const frame = createFrame(W, H), pic = new Uint32Array(W * H), out = new Uint8ClampedArray(W * H * 4), out32 = new Uint32Array(out.buffer);
  const rng = new Rng(7);
  let fxs = [], flyers = [], scroll = 0, clock = 0, heroPose = 0, poseT = 0, hurtT = 0, shake = 0, bg = null, bgMap = -1, castBar = null;
  const flash = new Map();   // monster id -> time it flashes white

  // ---- background: sky, two rows of hills, the ground (cached per map; slid by `scroll`)
  function buildBg(map) {
    const M = mapOf(map), G = GROUNDS[M.ground] ?? GROUNDS.grass, sky = M.sky, wide = W * 2;
    const b = new Uint32Array(wide * H), r = new Rng(map * 31);
    const hill = (amp, base, freq, seed) => Array.from({ length: wide }, (_, x) => base - amp * (0.5 + 0.5 * Math.sin((x / wide) * Math.PI * 2 * freq + seed)) - amp * 0.3 * Math.sin((x / wide) * Math.PI * 2 * freq * 3 + seed * 2));
    const far = hill(22, FIELD.ground - 40, 2, r.next() * 6), near = hill(14, FIELD.ground - 16, 3, r.next() * 6);
    for (let y = 0; y < H; y++) for (let x = 0; x < wide; x++) {
      let c;
      if (y >= FIELD.ground - 6) { const d = y - (FIELD.ground - 6); c = d < 2 ? G[2] : d < 22 ? G[3] : G[4]; if (((x * 7 + y * 13) % 23) === 0) c = G[4] }
      else if (y >= near[x]) c = G[1];
      else if (y >= far[x]) c = G[0];
      else { const k = y / (FIELD.ground - 40); c = [sky[0] + (255 - sky[0]) * k * 0.35, sky[1] + (255 - sky[1]) * k * 0.35, sky[2] + (255 - sky[2]) * k * 0.25] }
      b[y * wide + x] = pack(c[0], c[1], c[2]);
    }
    return { px: b, wide };
  }

  // ---- helpers
  const put = (x, y, rgb, k = 1) => {
    const X = x | 0, Y = y | 0; if (X < 0 || Y < 0 || X >= W || Y >= H || !(k > 0)) return;
    const i = Y * W + X, c = pic[i], r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255; if (k > 1) k = 1;
    pic[i] = pack(r + (rgb[0] - r) * k, g + (rgb[1] - g) * k, b + (rgb[2] - b) * k);
  };
  const rect = (x, y, w, h, rgb, k = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, rgb, k) };
  function blit(strip, f, x, y, tint = null, flip = false) {
    const s = strip.pic, fw = strip.fw;
    for (let j = 0; j < s.h; j++) {
      const Y = y + j; if (Y < 0 || Y >= H) continue;
      for (let i = 0; i < fw; i++) {
        const c = s.px[j * s.w + f * fw + (flip ? fw - 1 - i : i)]; if (c >>> 24 < 128) continue;
        const X = x + i; if (X < 0 || X >= W) continue;
        pic[Y * W + X] = tint ? tint(c) : c | 0xff000000;
      }
    }
  }
  function add(mod, o, life = 0.6) { if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return; if (fxs.length > 30) fxs.shift(); fxs.push({ fx: createFx(mod, { seed: rng.int(0, 99), ...o }), age: 0, life }) }
  function text(str, x, y, rgb, k = 1) {
    const F = FONTS.small ?? FONTS.big; let cx = x;
    for (const ch of str) { const g = F.glyphs[ch]; if (g) g.rows.forEach((row, ry) => row.forEach((on, rx) => { if (on) { put(cx + rx + 1, y + ry + 1, [10, 8, 14], k * 0.8); put(cx + rx, y + ry, rgb, k) } })); cx += (g?.w ?? F.space) + F.gap }
    return cx - x;
  }
  const textW = (str) => { const F = FONTS.small ?? FONTS.big; let n = 0; for (const ch of str) n += (F.glyphs[ch]?.w ?? F.space) + F.gap; return n };

  // ---- events -> effects
  function onEvent(ev, w) {
    const hx = FIELD.heroX + 8, hy = FIELD.ground - 24;
    switch (ev.type) {
      case "basic":
        heroPose = ev.ranged ? 4 : 3; poseT = 0.18;
        if (ev.ranged) flyers.push({ x0: hx + 6, y0: hy, x1: ev.x, y1: ev.y, t: 0, life: 0.14, col: ev.wtype === "staff" ? [200, 170, 255] : [230, 220, 200], kind: ev.wtype === "staff" ? "orb" : "arrow" });
        else add(ev.wtype === "dagger" ? daggerFlurry : swordSlash, { x: ev.x - 6, y: ev.y, scale: 0.6, palette: hexes(NUM.neutral), light: 0.3 }, 0.22);
        break;
      case "skill": {
        heroPose = 3; poseT = 0.3;
        if (ev.kind === "heal") { add(healFx, { x: hx, y: FIELD.ground - 2, light: 0.6 }, 0.9); break }
        if (ev.kind === "buff") { for (let i = 0; i < 12; i++) flyers.push({ x0: hx, y0: hy + 10, x1: hx + Math.cos(i) * 14, y1: hy - 6 + Math.sin(i) * 10, t: 0, life: 0.5, col: COL[ev.elem] ?? [255, 230, 140], kind: "mote" }); break }
        const b = blastOf(ELEM[ev.elem] ? ev.elem : "arcane");
        if (ev.kind === "area") for (const m of w.monsters) { if (m.hp > -1e9) add(b.mod, { x: m.x, y: FIELD.ground - 4, ...b.opts, light: 0.5 }, b.life) }
        else { flyers.push({ x0: hx + 6, y0: hy, x1: ev.x, y1: ev.y - 10, t: 0, life: 0.16, col: COL[ev.elem] ?? [255, 255, 255], kind: "orb", big: true }); add(b.mod, { x: ev.x, y: ev.y - 6, ...b.opts, light: 0.5 }, b.life * 0.7) }
        break;
      }
      case "dmg":
        flash.set(ev.id, clock + 0.08);
        add(dmgNumber, { x: ev.x, y: ev.y, text: String(ev.amount), palette: hexes(NUM[ev.elem] ?? NUM.neutral), scale: ev.crit ? 2 : 1 }, 0.9);
        if (!ev.skill) add(ev.crit ? bluntHit : hitSpark, { x: ev.x, y: ev.y + 4, height: 0, palette: hexes(NUM.neutral), light: 0.4 }, 0.35);
        break;
      case "miss": add(dmgNumber, { x: ev.x, y: ev.y - 14, text: "MISS", palette: hexes(NUM.neutral) }, 0.7); break;
      case "hurt": hurtT = 0.15; shake = Math.min(2, shake + 0.8); add(dmgNumber, { x: hx, y: hy - 14, text: String(ev.amount), palette: ["#3a0a0a", "#7a1414", "#c02424", "#ff4a4a", "#ff8a8a", "#ffd0d0", "#ffffff", "#ffffff"] }, 0.8); break;
      case "dodge": add(dmgNumber, { x: hx, y: hy - 14, text: "NÉ", palette: hexes(NUM.wind) }, 0.6); break;
      case "kill": add(poof, { x: ev.x, y: FIELD.ground - 4, light: 0.3 }, 0.5); if (ev.gold) flyers.push({ x0: ev.x, y0: FIELD.ground - 8, x1: hx, y1: hy, t: 0, life: 0.6, col: [255, 214, 80], kind: "coin" }); break;
      case "gear": flyers.push({ x0: ev.x, y0: FIELD.ground - 10, x1: hx, y1: hy, t: 0, life: 0.9, col: GRADE[ev.grade]?.color ?? [255, 255, 255], kind: "gem" }); break;
      case "heal": add(dmgNumber, { x: hx, y: hy - 18, text: "+" + ev.n, palette: hexes(NUM.wind) }, 0.8); break;
      case "levelUp": for (let i = 0; i < 24; i++) flyers.push({ x0: hx, y0: FIELD.ground, x1: hx + (i % 2 ? 1 : -1) * (4 + (i % 5) * 3), y1: hy - 30 - (i % 7) * 3, t: 0, life: 0.9, col: [255, 236, 140], kind: "mote" }); break;
      case "map": bg = null; break;
    }
  }

  function update(w, events, dt) {
    clock += dt;
    for (const ev of events) onEvent(ev, w);
    for (const f of fxs) { f.fx.update(dt); f.age += dt }
    fxs = fxs.filter((f) => f.age < f.life && !f.fx.done());
    for (const f of flyers) f.t += dt;
    flyers = flyers.filter((f) => f.t < f.life);
    if (w.phase === "walk") scroll += dt * 30;
    poseT -= dt; hurtT -= dt; shake = Math.max(0, shake - dt * 8);
    castBar = w.cast ? { k: 1 - w.cast.t / w.cast.total, elem: w.cast.elem } : null;
  }

  function draw(w) {
    if (!bg || bgMap !== w.map) { bg = buildBg(w.map); bgMap = w.map }
    const off = Math.floor(scroll) % bg.wide;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pic[y * W + x] = bg.px[y * bg.wide + ((x + off) % bg.wide)];
    // the monsters (back to front)
    for (const m of [...w.monsters].filter((m) => m.hp > 0).sort((a, b) => a.y - b.y)) drawMonster(m);
    // the hero
    drawHero(w);
    // effects
    clearFrame(frame);
    for (const f of fxs) f.fx.draw(frame, "back");
    for (const f of fxs) f.fx.draw(frame, "front");
    over();
    drawFlyers();
    drawBars(w);
    // out (shaken a little when hurt)
    const sx = Math.round(Math.sin(clock * 90) * shake);
    if (!sx) out32.set(pic);
    else for (let y = 0; y < H; y++) { const r = y * W; for (let x = 0; x < W; x++) out32[r + x] = pic[r + Math.max(0, Math.min(W - 1, x - sx))] }
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
  function drawHero(w) {
    const h = w.hero, t = h.gear?.weapon ? h.gear.weapon.wtype : "fist";
    const strip = dressHero(A.armed?.[h.cls]?.[t] ?? A.heroes?.[h.cls] ?? A.mage, h.cls, lookOf(h.gear));
    const dead = w.phase === "dead";
    let f = dead ? 5 : hurtT > 0 ? 5 : poseT > 0 ? heroPose : w.cast ? 2 : Math.floor(clock * 2) % 2;
    const bob = w.phase === "walk" && !dead ? Math.round(Math.abs(Math.sin(clock * 9)) * 2) : 0;
    const ax = A.mage.anchor?.ax ?? 23, ay = A.mage.anchor?.ay ?? 58;
    // shadow
    for (let i = -8; i <= 8; i++) put(FIELD.heroX + i, FIELD.ground, [0, 0, 0], 0.25 * (1 - Math.abs(i) / 9));
    blit(strip, f, Math.round(FIELD.heroX - ax), Math.round(FIELD.ground - ay - bob), dead ? (c) => pack((c & 255) * 0.4, ((c >>> 8) & 255) * 0.4, ((c >>> 16) & 255) * 0.5) : null);
  }
  function drawMonster(m) {
    const s = A.monsters[m.kind] ?? A.monsters.slime; if (!s) return;
    const fl = (flash.get(m.id) ?? 0) > clock, walking = !m.arrived;
    const f = fl ? 6 : walking ? Math.floor(clock * 8 + m.id) % 4 : (m.atkT / m.rate < 0.2 ? 5 : 4) * (Math.floor(clock * 3 + m.id) % 3 === 0 ? 1 : 0) || 0;
    const col = COL[m.elem] ?? COL.neutral, tinted = m.elem !== "neutral";
    const scale = m.boss ? 1 : 1;
    const x = Math.round(m.x - s.ax * scale), y = Math.round(m.y - s.ay - m.fly);
    for (let i = -7; i <= 7; i++) put(m.x + i, m.y, tinted ? col : [0, 0, 0], tinted ? 0.35 : 0.25);
    blit(s, f, x, y, fl ? () => 0xffffffff : tinted ? (c) => pack((c & 255) * 0.65 + col[0] * 0.35, ((c >>> 8) & 255) * 0.65 + col[1] * 0.35, ((c >>> 16) & 255) * 0.65 + col[2] * 0.35) : null);
    // health bar and level
    const bw = m.boss ? 40 : 18, bx = Math.round(m.x - bw / 2), by = y - 5;
    rect(bx - 1, by - 1, bw + 2, 4, [10, 8, 14], 0.85);
    rect(bx, by, Math.max(1, Math.round(bw * m.hp / m.max)), 2, m.boss ? [255, 120, 60] : [230, 70, 70]);
    text(`${m.boss ? "BOSS " : ""}LV${m.lv}`, bx, by - 8, m.boss ? [255, 200, 120] : [230, 230, 240], 0.9);
  }
  function drawFlyers() {
    for (const f of flyers) {
      const k = Math.min(1, f.t / f.life), e = f.kind === "coin" || f.kind === "gem" ? k * k : k;
      const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - (f.kind === "coin" || f.kind === "gem" ? Math.sin(k * Math.PI) * 18 : 0);
      if (f.kind === "arrow") { for (let i = 0; i < 6; i++) put(x - i, y, f.col, 1 - i / 7) }
      else if (f.kind === "orb") { const r = f.big ? 3 : 2; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) put(x + i, y + j, f.col, 1 - (i * i + j * j) / (r * r + 1) * 0.6); for (let i = 1; i < 6; i++) put(x - i * 2, y, f.col, 0.5 - i * 0.08) }
      else if (f.kind === "coin") { put(x, y, f.col); put(x + 1, y, f.col); put(x, y + 1, [200, 150, 40]); put(x + 1, y + 1, [200, 150, 40]) }
      else if (f.kind === "gem") { for (const [i, j] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) put(x + i, y + j, f.col); put(x, y - 1, [255, 255, 255]) }
      else put(x, y, f.col, 1 - k);
    }
  }
  function drawBars(w) {
    // the cast bar over the hero
    if (castBar) { const bx = FIELD.heroX - 12, by = FIELD.ground - 66; rect(bx - 1, by - 1, 26, 4, [10, 8, 14], 0.85); rect(bx, by, Math.round(24 * castBar.k), 2, COL[castBar.elem] ?? [200, 200, 255]) }
    if (w.phase === "dead") { const s = "ĐÃ NGÃ"; text(s, Math.round(W / 2 - textW(s) / 2), 40, [255, 120, 120]); const r = `Hồi sinh sau ${Math.ceil(w.deadT)}s`; text(r, Math.round(W / 2 - textW(r) / 2), 52, [230, 230, 240]) }
  }
  return { update, draw };
}
