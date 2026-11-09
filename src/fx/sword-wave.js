// A sword wave: the crescent of a sword stroke flung through the air. A broad moon of steel, its leading edge
// white-hot, cooling to blue-grey toward its back, tapering to needle tips; behind it a smear of fading steel
// (the stroke's trail), and a few sparks shed off the tips. Facing +x (the game turns it with `angle`).
import { fit, rng, WHITE } from "../../lib/pixelfx/core/index.js?v=mw94uhhp";

export const meta = {
  name: "Sword wave",
  desc: "A crescent slash of steel flung forward: white leading edge, tapering tips, a fading smear behind.",
  tags: ["projectile", "slash", "sword", "melee", "directional", "loop"],
  size: [150, 130],
  origin: [100, 65],
  duration: 0.4,
  loop: true,
  fps: 30,
  bg: "sky",
  options: { palette: ["#141a26", "#2c3a52", "#56709a", "#8eaed6", "#c8e0fa", "#eef8ff", "#ffffff"], size: 17, seed: 3 },
};

/** Across the crescent at (x, y): 0 outside, else 0 (back edge) .. 1 (leading edge). */
function moon(x, y, R, thick) {
  const H = R * 0.96;
  if (Math.abs(y) > H) return 0;
  const cx = 2 - R, r1 = Math.hypot(x - cx, y);              // the leading circle, its front at x = 2
  if (r1 > R || x < cx + R * 0.15) return 0;                   // its front half only
  const taper = Math.pow(1 - (y / H) ** 2, 0.8);               // broad in the middle, a needle at the tips
  const back = thick * taper;
  if (back < 0.5) return 0;
  const d = R - r1;                                            // depth in from the leading edge
  return d > back ? 0 : 1 - d / back;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), R = o.size, S = o.seed, fr = Math.floor(t * 30 + 1e-6);
  const thick = (4 + R * 0.16) * (1 + 0.1 * Math.sin(fr * 1.9));

  // the trail: the stroke smeared back along its path, fading and thinning
  for (let x = Math.floor(-R - 26); x <= 3; x++) for (let y = -R; y <= R; y++) {
    let best = 0;
    for (let k = 2; k <= 22; k += 2) { const u = moon(x + k, y, R, thick * (1 - k / 30)); if (u) best = Math.max(best, (1 - k / 24) * (0.4 + 0.6 * u)) }
    best *= 1 - Math.abs(y / R) ** 3;   // the smear thins toward the tips
    if (best > 0 && !moon(x, y, R, thick)) p.blend(x + 0.5, y + 0.5, best > 0.5 ? C[4] : C[3], best * 0.55);
  }
  // the crescent: white along its leading edge, pale steel in the body, the back edge darker
  for (let x = Math.floor(-R - 2); x <= 3; x++) for (let y = -R; y <= R; y++) {
    const u = moon(x + 0.5, y + 0.5, R, thick);
    if (!u) continue;
    p.px(x + 0.5, y + 0.5, u > 0.78 ? WHITE : u > 0.55 ? C[6] : u > 0.3 ? C[5] : u > 0.12 ? C[4] : C[3]);
  }
  // sparks shed off the tips
  for (let i = 0; i < 4; i++) {
    const s = rng(fr, i, S + 7), side = i % 2 ? 1 : -1, y = side * R * s.range(0.75, 1.05), x = -s.range(2, 14);
    p.px(x, y, s.chance(0.5) ? WHITE : C[5]);
  }
  // light along the blade
  p.glowLine(0, -R * 0.75, 0, R * 0.75, 7, C[4], 0.3);
  p.glow(1, 0, 8, C[6], 0.3);
}
