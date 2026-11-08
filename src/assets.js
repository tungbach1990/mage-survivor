// The pxl art the game draws: strips of frames, the arena, the wall, and for each monster an "actor"
// (its silhouette and colors, the shape pixelfx's status effects wrap). Loaded by the browser (Image) or by
// Node (a PNG decoder passed in), into the same { w, h, px: Uint32Array ABGR } pictures.

export const FRAMES = {
  mage: ["idle0", "idle1", "focus", "cast", "throw", "hurt"],
  monster: ["walk0", "walk1", "walk2", "walk3", "atk0", "atk1", "hurt"],
};
import { ENEMIES } from "./sim/enemies.js?v=mw7owxdc";
export const MONSTERS = ["slime", "goblin", "wolf", "skeleton", "orc", "golem", "bat", "shaman"];
export const ICONS = ["fireball", "firebolt", "iceball", "icebolt", "lightball", "lightbolt", "nova", "meteor"];

const FILES = {
  arena: "scenes/arena_v.png",
  wallh_0: "sprites/wallh_0.png", wallh_1: "sprites/wallh_1.png", wallh_2: "sprites/wallh_2.png",
  wall_0: "sprites/wall_0.png", wall_1: "sprites/wall_1.png", wall_2: "sprites/wall_2.png",
  mage: "anims/mage.png",
  ...Object.fromEntries(["swordman", "archer", "thief", "acolyte", "merchant"].map((c) => [c, `anims/${c}.png`])),
  sum_spirit: "anims/sum_spirit.png", sum_golem: "anims/sum_golem.png", sum_beast: "anims/sum_beast.png",
  ...Object.fromEntries(MONSTERS.map((m) => [m, `anims/${m}.png`])),
};

/** Load every picture through `load(path) -> Promise<{ w, h, px }>`; returns the asset set. */
export async function loadAssets(load, base = "assets/") {
  const pics = {};
  await Promise.all(Object.entries(FILES).map(async ([k, f]) => (pics[k] = await load(base + f))));
  const strip = (pic, n) => ({ pic, n, fw: pic.w / n, fh: pic.h });
  const A = { arena: pics.arena, walls: [pics.wall_0, pics.wall_1, pics.wall_2], wallsH: [pics.wallh_0, pics.wallh_1, pics.wallh_2], mage: strip(pics.mage, FRAMES.mage.length), monsters: {} };
  for (const m of MONSTERS) {
    const s = strip(pics[m], FRAMES.monster.length);
    A.monsters[m] = { ...s, ...anchorOf(s), actor: actorOf(s) };
  }
  A.mage.anchor = anchorOf(A.mage);
  // the heroes: one strip per class, the same six poses as the mage
  A.heroes = { mage: A.mage };
  for (const c of ["swordman", "archer", "thief", "acolyte", "merchant"]) A.heroes[c] = strip(pics[c], FRAMES.mage.length);
  // kinds that wear another's picture
  for (const [type, def] of Object.entries(ENEMIES)) if (def.sprite && !A.monsters[type]) A.monsters[type] = A.monsters[def.sprite];
  A.summons = {};
  for (const b of ["spirit", "golem", "beast"]) { const s = strip(pics[`sum_${b}`], 3); A.summons[b] = { ...s, ...anchorOf(s) } }
  return A;
}

/** The feet of frame 0: the middle of its opaque columns, the row under its lowest opaque pixel. */
function anchorOf(s) {
  let x0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < s.fh; y++) for (let x = 0; x < s.fw; x++)
    if (s.pic.px[y * s.pic.w + x] >>> 24 > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  return { ax: Math.round((x0 + x1) / 2), ay: y1 + 1 };
}

/** Frame 0 as a pixelfx actor: { mask, pixels, x, y, w, h, k, head, chest }, local to the feet. */
function actorOf(s) {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  for (let y = 0; y < s.fh; y++) for (let x = 0; x < s.fw; x++)
    if (s.pic.px[y * s.pic.w + x] >>> 24 > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, data = new Uint8Array(w * h), pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = s.pic.px[(y + y0) * s.pic.w + x + x0];
    if (c >>> 24 > 127) { data[y * w + x] = 1; pixels[y * w + x] = c }
  }
  const ax = Math.round((x0 + x1) / 2);
  const x = x0 - ax, y = -h;
  return { mask: { w, h, data }, pixels, x, y, w, h, k: 2, head: [0, y], chest: [0, Math.round(y * 0.55)] };
}

/** Browser loader: an <img> read back through a canvas. */
export function browserLoad(path) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height);
      ok({ w: img.width, h: img.height, px: new Uint32Array(d.data.buffer.slice(0)) });   // little-endian RGBA bytes = ABGR words
    };
    img.onerror = () => fail(new Error("can't load " + path));
    img.src = path;
  });
}
