// Dressing a hero: its six frames repainted with what it wears. The body, the headgear, the belt and the boots
// take their item's material; gloves cover the hands; a cloak hangs behind; an off-hand piece sits in the back
// hand; an amulet at the neck, a ring at the hand; the weapon's head takes its material. Cached per class and look.

import { MATERIALS, RARITY_GEM } from "../data/gear.js?v=mw7owxdc";

// the heroes' poses (as game/art.px.js draws them), in frame order idle0 idle1 focus cast throw hurt
const POSES = [
  { dx: 0, dy: 0, hand: [25, 45], back: [13, 47], s1: [26, 23] },
  { dx: 0, dy: 1, hand: [25, 46], back: [13, 48], s1: [26, 24] },
  { dx: 0, dy: 1, hand: [26, 41], back: [22, 45], s1: [27, 21] },
  { dx: 2, dy: 1, hand: [31, 42], back: [12, 47], s1: [40, 30] },
  { dx: -1, dy: 0, hand: [27, 31], back: [10, 44], s1: [28, 11] },
  { dx: -2, dy: 1, hand: [22, 46], back: [11, 46], s1: [16, 25] },
];
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// what is never repainted: ink, hair, skin, eyes (and, but for the merchant's cart, wood)
const KEEP = new Set(["#2a1a2c", "#5c2a22", "#8e4a2c", "#c47040", "#eaa060", "#c47a6a", "#eab096", "#ffdcc4", "#1c1430", "#3c4ea8"].map((h) => rgb(h).join(",")));
const WOOD = new Set(["#8e5a32", "#c48a50", "#4a2c22"].map((h) => rgb(h).join(",")));
const SKIN = new Set(["#c47a6a", "#eab096", "#ffdcc4"].map((h) => rgb(h).join(",")));
const pack = (c) => (0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
const unpack = (c) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
const lum = ([r, g, b]) => r * 0.3 + g * 0.59 + b * 0.11;
const tone = (ramp, l) => ramp[l < 55 ? 0 : l < 95 ? 1 : l < 150 ? 2 : l < 205 ? 3 : 4];

const cache = new Map();
/** The class's strip dressed in `look` ({ slot: { mat, rarity } }); the bare strip when nothing is worn. */
export function dressHero(strip, cls, look) {
  const key = cls + "|" + Object.entries(look ?? {}).map(([s, l]) => s + ":" + l.mat + ":" + l.rarity).sort().join(",");
  if (!look || !Object.keys(look).length) return strip;
  if (cache.has(key)) return cache.get(key);
  const src = strip.pic, W = src.w, H = src.h, fw = strip.fw, px = new Uint32Array(src.px);
  const mat = (slot) => (look[slot] ? MATERIALS[look[slot].mat]?.ramp : null);
  const at = (f, x, y) => (x >= 0 && y >= 0 && x < fw && y < H ? y * W + f * fw + x : -1);
  const keep = (c, slot) => { const k = unpack(c).join(","); return KEEP.has(k) || (cls !== "merchant" && slot !== "weapon" && WOOD.has(k)) || lum(unpack(c)) < 40 };
  const paint = (f, x0, y0, x1, y1, ramp, slot) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = at(f, x, y); if (i < 0) continue;
      const c = px[i]; if (c >>> 24 < 128 || keep(c, slot)) continue;
      px[i] = pack(tone(ramp, lum(unpack(c))));
    }
  };
  POSES.forEach((p, f) => {
    if (f * fw >= W) return;
    const X = 12 + p.dx, Y = p.dy;
    // a cloak behind: only where the frame is empty
    const cl = mat("cloak");
    if (cl) for (let y = 39 + Y; y <= 56; y++) {
      const spread = Math.floor((y - 39 - Y) * 0.3), xa = X - 2 - spread, xb = X + 4;
      for (let x = xa; x <= xb; x++) { const i = at(f, x, y); if (i < 0 || px[i] >>> 24 >= 128) continue; px[i] = pack(y >= 55 ? cl[0] : x === xa ? cl[1] : x - xa < 2 ? cl[2] : cl[3]) }
    }
    const body = mat("body"); if (body) paint(f, X - 4, 38, X + 20, 49, body, "body");
    const head = mat("head"); if (head) paint(f, X - 6, 6, X + 20, 28 + Y, head, "head");
    const belt = mat("belt"); if (belt) paint(f, X, 50, X + 12, 50, belt, "belt");
    const boots = mat("boots"); if (boots) paint(f, X - 1, 51, X + 13, 57, boots, "boots");
    const wpn = mat("weapon"); if (wpn) paint(f, p.s1[0] - 3, p.s1[1] - 3, p.s1[0] + 3, p.s1[1] + 3, wpn, "weapon");
    // gloves over the hands (skin included)
    const gl = mat("gloves");
    if (gl) for (const [hx, hy] of [p.hand, p.back]) for (let y = hy - 1; y <= hy + 1; y++) for (let x = hx - 1; x <= hx + 1; x++) {
      const i = at(f, x, y); if (i < 0 || px[i] >>> 24 < 128) continue;
      if (SKIN.has(unpack(px[i]).join(",")) || Math.hypot(x - hx, y - hy) < 1.2) px[i] = pack(gl[x < hx ? 2 : 3]);
    }
    // the off-hand piece in the back hand: a round shield or a small orb / book in its material
    const oh = mat("offhand");
    if (oh) {
      const [bx, by] = p.back, gem = RARITY_GEM[look.offhand.rarity] ?? RARITY_GEM.common;
      for (let y = -4; y <= 4; y++) for (let x = -3; x <= 3; x++) {
        const d = Math.hypot(x / 3.2, y / 4.2); if (d > 1) continue;
        const i = at(f, bx - 2 + x, by - 2 + y); if (i < 0) continue;
        px[i] = pack(d > 0.8 ? oh[0] : x < 0 ? oh[3] : oh[2]);
      }
      const i = at(f, bx - 2, by - 2); if (i >= 0) px[i] = pack(gem);
    }
    // an amulet at the neck, a ring at the hand: a gem in the rarity's colour
    if (look.amulet) { const g = RARITY_GEM[look.amulet.rarity], m = mat("amulet"); for (const [x, y, c] of [[X + 6, 40, g], [X + 5, 39, m[3]], [X + 7, 39, m[3]]]) { const i = at(f, x, y); if (i >= 0) px[i] = pack(c) } }
    if (look.ring) { const i = at(f, p.hand[0], p.hand[1] - 1); if (i >= 0) px[i] = pack(RARITY_GEM[look.ring.rarity]) }
  });
  const out = { ...strip, pic: { ...src, px } };
  cache.set(key, out);
  return out;
}

/** How grand the hero's gear is: the number of epic and legendary pieces (the view gives them an aura). */
export const gearGlow = (look) => {
  let epic = 0, leg = 0;
  for (const l of Object.values(look ?? {})) { if (l.rarity === "legendary") leg++; else if (l.rarity === "epic") epic++ }
  return { epic, leg };
};
