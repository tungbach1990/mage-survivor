// A rain cloud: pixelfx's storm cloud (lightning/storm-cloud.js) with the storm taken out. Its billows, its
// shading as one mass and its scud are kept; no discharges, no bolt, no sparks, and no rain of its own (the game
// draws the rain over the whole field). A light grey-blue, so the day stays bright under it.
// The cloud's shapes follow pixelfx's storm cloud, MIT License (see .agents/skills/pixelfx/LICENSE).
import { clamp, rng, smooth, loopNoise, tileNoise, fit } from "../../lib/pixelfx/core/index.js?v=mw7pwjdj";

export const meta = {
  name: "Rain cloud",
  desc: "A soft grey rain cloud drifting overhead, billows boiling slowly, ragged scud under its flat base.",
  tags: ["weather", "cloud", "rain", "loop"],
  size: [168, 176],
  origin: [84, 164],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { cloud: ["#4a5064", "#5c6278", "#70778e", "#868da4", "#9ea5ba", "#b6bccf", "#ced3e2"], seed: 8 },
};

const N = 90, BASE = -100, TOP = -156, TH = 0.35, VIS = Math.sqrt(1 - Math.sqrt(TH));
const BILLOWS = [
  [-6, -132, 17], [18, -127, 14], [-28, -122, 12], [38, -118, 10], [0, -142, 12],
  [14, -149, 19, 0.38], [40, -148, 14, 0.34],
  [-48, -113, 10], [55, -110, 9], [-17, -115, 13], [22, -113, 12],
  [-42, -104, 11], [-10, -104, 12], [20, -104, 11], [48, -103, 9], [-63, -104, 7], [66, -103, 6],
];
const W0 = -84, H0 = TOP - 6, GW = 168, GH = BASE + 8 - H0;
const FIELD = new Float32Array(GW * GH), GX = new Float32Array(GW * GH), GY = new Float32Array(GW * GH);

function billows(seed, ph) {
  return BILLOWS.map(([x, y, v, sq = 1], i) => {
    const top = y < -112 && sq === 1, boil = 0.82 + 0.3 * Math.sin(Math.PI * ((ph + i * 0.37) % 1)) ** 2;
    return { sq, x: x + 3.5 * loopNoise(ph, 0.7, seed + i) + (sq < 1 ? 4 * loopNoise(ph, 0.5, seed + i + 90) : 0), y: y + 2 * loopNoise(ph, 0.7, seed + i + 30) - (top ? 4 * (boil - 0.97) : 0), r: (v * (top ? boil : 1 + 0.08 * loopNoise(ph, 0.6, seed + i + 60))) / VIS };
  });
}

function cloud(p, B, ph, seed, K) {
  FIELD.fill(0); GX.fill(0); GY.fill(0);
  for (const b of B) {
    const r2 = b.r * b.r, ry = b.r * b.sq;
    for (let y = Math.max(0, Math.floor(b.y - ry - H0)); y < Math.min(GH, Math.ceil(b.y + ry - H0)); y++)
      for (let x = Math.max(0, Math.floor(b.x - b.r - W0)); x < Math.min(GW, Math.ceil(b.x + b.r - W0)); x++) {
        const dx = x + W0 + 0.5 - b.x, dy = (y + H0 + 0.5 - b.y) / b.sq, d2 = (dx * dx + dy * dy) / r2;
        if (d2 >= 1) continue;
        const j = y * GW + x, u = 1 - d2;
        FIELD[j] += u * u;
        GX[j] += (-4 * u * dx) / r2;
        GY[j] += (-4 * u * dy) / (r2 * b.sq);
      }
  }
  const n = K.length;
  for (let y = 0; y < GH; y++) {
    const cy = y + H0 + 0.5;
    for (let x = 0; x < GW; x++) {
      const j = y * GW + x;
      if (FIELD[j] < TH - 0.06) continue;
      const cx = x + W0 + 0.5, base = BASE + 1.5 * tileNoise(cx * 0.12 + 9 * ph, 3, 9, 0, seed + 5);
      const F = FIELD[j] * (1 - smooth(base - 3, base, cy)) + 0.05 * tileNoise(cx * 0.21 + 18 * ph, cy * 0.21, 18, 0, seed);
      if (F < TH) continue;
      const gl = Math.hypot(GX[j], GY[j]) || 1, lam = -(GX[j] * 0.42 + GY[j] * 0.9) / gl, edge = Math.min(1, gl * 5) * (F < TH + 0.08 ? 1 : 0.55);
      const h = 1 - 2 * clamp((cy - TOP) / (BASE - TOP));
      let i = 2.7 + 2.2 * h + 1.3 * lam * edge + 0.4 * tileNoise(cx * 0.16 + 12 * ph, cy * 0.16, 12, 0, seed + 9);
      if (F < TH + 0.05 && lam > 0.3 && h > -0.5) i += 1;
      if (cy > base - 6) i -= 1;
      p.px(cx, cy, K[clamp(Math.round(i), 0, n - 1)]);
    }
  }
}

function scud(p, ph, seed, K) {
  const r = rng(seed, 13);
  for (let w = 0; w < 6; w++) {
    const x0 = r.range(-60, 60), y0 = BASE + r.range(3, 9), rx = r.range(10, 20), ry = r.range(1.3, 2.2), off = r.next(), u = (ph + off) % 1, a = Math.sin(Math.PI * u) ** 0.8;
    const xc = x0 + 16 * (u - 0.5);
    for (let y = Math.floor(y0 - ry - 1); y <= y0 + ry + 1; y++)
      for (let x = Math.floor(xc - rx - 1); x <= xc + rx + 1; x++) {
        const dx = (x + 0.5 - xc) / rx, dy = (y + 0.5 - y0) / ry, nz = tileNoise((x + 0.5) * 0.35 + 10 * ph + w * 7, (y + 0.5) * 0.5, 10, 0, seed + 20 + w);
        const v = (1 - dx * dx - dy * dy) * a + 0.6 * nz - 0.25;
        if (v > 0) p.blend(x + 0.5, y + 0.5, v > 0.4 ? K[3] : K[4], Math.min(0.6, 0.2 + v * 0.7));
      }
  }
}

export function draw(p, t, o) {
  const K = fit(o.cloud, 7), ph = (Math.floor(t * 30 + 1e-6) % N) / N;
  scud(p, ph, o.seed, K);
  cloud(p, billows(o.seed, ph), ph, o.seed, K);
}
