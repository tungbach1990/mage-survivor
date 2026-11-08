// How each skill looks: which pixelfx effect draws its shot, its blast or its zone, in which palette.
// `fit` lets one effect play many parts (a fireball recolored is a venom dart, a void bolt, a mana missile).

import * as fireball from "../../lib/pixelfx/fx/fire/fireball.js?v=mw7ojhf9";
import * as tracer from "../../lib/pixelfx/fx/projectiles/bullet-tracer.js?v=mw7ojhf9";
import * as iceLance from "../../lib/pixelfx/fx/ice/ice-lance.js?v=mw7ojhf9";
import * as energyDisc from "../../lib/pixelfx/fx/projectiles/energy-disc.js?v=mw7ojhf9";
import * as ballLightning from "../../lib/pixelfx/fx/lightning/ball-lightning.js?v=mw7ojhf9";
import * as tornado from "../../lib/pixelfx/fx/nature/tornado.js?v=mw7ojhf9";
import * as voidOrb from "../../lib/pixelfx/fx/shadow/void-orb.js?v=mw7ojhf9";
import * as plasma from "../../lib/pixelfx/fx/explosions/plasma-explosion.js?v=mw7ojhf9";
import * as snowBurst from "../../lib/pixelfx/fx/ice/snowflake-burst.js?v=mw7ojhf9";
import * as waveCrash from "../../lib/pixelfx/fx/water/wave-crash.js?v=mw7ojhf9";
import * as earthSpike from "../../lib/pixelfx/fx/nature/earth-spike.js?v=mw7ojhf9";
import * as quake from "../../lib/pixelfx/fx/nature/quake.js?v=mw7ojhf9";
import * as poisonCloud from "../../lib/pixelfx/fx/nature/poison-cloud.js?v=mw7ojhf9";
import * as smite from "../../lib/pixelfx/fx/holy/smite.js?v=mw7ojhf9";
import * as grasping from "../../lib/pixelfx/fx/shadow/grasping-hands.js?v=mw7ojhf9";
import * as runeCircle from "../../lib/pixelfx/fx/arcane/rune-circle.js?v=mw7ojhf9";
import { ELEM } from "../data/elements.js?v=mw7ojhf9";
import * as swordWave from "../fx/sword-wave.js?v=mw7ojhf9";

const R = (el) => ELEM[el].ramp;
const ramp9 = (el) => [...R(el), "#ffffff"];   // the fireball wants nine steps
// a tracer's smoke trail by grade: faint grey at first, longer and paler later
const TRAIL = [["#1c1c20", "#2a2a30", "#3a3a42", "#4a4a52", "#5a5a62"], ["#202024", "#34343c", "#4a4a54", "#62626c", "#7a7a84"], ["#1a2a40", "#2a4a6a", "#4a7aa0", "#8ab8e0", "#d0ecff"], ["#2a2a40", "#4a4a7a", "#8a8ac0", "#c8c8f0", "#ffffff"]];

// shot: { mod, opts(angle, id) , dy } ; blast: { mod, opts, life, fade } ; zone: { mod, opts, life, cache }
export const LOOKS = {
  firebolt:  { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 26, speed: 260, palette: R("fire"), light: 0.55, seed: id }) } },
  fireball:  { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 3.5, speed: 110, light: 0.5, seed: id % 9 }) }, blast: "fire" },
  icebolt:   { shot: { mod: iceLance, opts: (a, id) => ({ angle: a, length: 18, light: 0.5, seed: id }) } },
  iceball:   { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 3.5, speed: 90, palette: ramp9("ice"), light: 0.5, seed: id % 9 }) }, blast: "snow" },
  lightball: { shot: { mod: ballLightning, opts: (a, id) => ({ light: 0.6, seed: id }), dy: 40 } },
  waterjet:  { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 22, speed: 300, palette: R("water"), smoke: ["#1a2a40", "#2a4a6a", "#4a7aa0", "#8ab8e0", "#d0ecff"], light: 0.3, seed: id }) } },
  windblade: { shot: { mod: energyDisc, opts: (a, id) => ({ angle: a, palette: R("wind"), size: 0.7, light: 0.4, seed: id }) } },
  tornado:   { shot: { mod: tornado, opts: (a, id) => ({ height: 34, light: 0.2, seed: id }), dy: 30, cache: 2 } },
  venomdart: { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 2.2, speed: 140, palette: ramp9("poison"), light: 0.4, seed: id % 9 }) } },
  holylance: { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 34, speed: 420, palette: R("light"), light: 0.6, seed: id }) } },
  shadoworb: { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 4.5, speed: 30, palette: ramp9("dark"), light: 0.45, seed: id % 9 }) } },
  missiles:  { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 1.8, speed: 120, palette: ramp9("arcane"), light: 0.45, seed: id % 9 }) } },
  // ---- the classes' shots: arrows and knives are thin streaks, coins and bags little balls
  // the basic attacks: b = { g (grade 0-3 from the level), pal (plain, its element, or an imbued mark) }
  basic_mage:   { shot: { mod: fireball, opts: (a, id, b) => ({ angle: a, radius: 1.3 + 0.45 * (b?.g ?? 2), speed: 140, palette: [...(b?.pal ?? R("arcane")), "#ffffff"], light: [0.06, 0.18, 0.35, 0.55][b?.g ?? 2], seed: id % 9 }) } },
  basic_archer: { shot: { mod: tracer, opts: (a, id, b) => ({ angle: a, length: [9, 12, 15, 20][b?.g ?? 2], speed: 330, palette: b?.pal ?? R("sunder"), smoke: TRAIL[b?.g ?? 2], light: [0.03, 0.1, 0.25, 0.45][b?.g ?? 2], seed: id }) } },
  doublestrafe: { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 16, speed: 340, palette: R("bleed"), light: 0.3, seed: id }) } },
  pinshot:      { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 20, speed: 360, palette: R("pin"), light: 0.3, seed: id }) } },
  huntersmark:  { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 22, speed: 380, palette: R("expose"), light: 0.45, seed: id }) } },
  chargearrow:  { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 26, speed: 300, palette: R("sunder"), light: 0.4, seed: id }) } },
  blindarrow:   { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 2.5, speed: 120, palette: ramp9("blind"), light: 0.2, seed: id % 9 }) } },
  basic_thief:  { shot: { mod: tracer, opts: (a, id, b) => ({ angle: a, length: [6, 8, 10, 13][b?.g ?? 2], speed: 300, palette: b?.pal ?? R("venom"), smoke: TRAIL[b?.g ?? 2], light: [0.03, 0.1, 0.25, 0.45][b?.g ?? 2], seed: id }) } },
  envenom:      { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 12, speed: 320, palette: R("venom"), light: 0.45, seed: id }) } },
  steal:        { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 10, speed: 320, palette: R("bounty"), light: 0.45, seed: id }) } },
  hamstring:    { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 10, speed: 320, palette: R("cripple"), light: 0.3, seed: id }) } },
  basic_acolyte:{ shot: { mod: tracer, opts: (a, id, b) => ({ angle: a, length: [10, 14, 18, 24][b?.g ?? 2], speed: 260, palette: b?.pal ?? R("light"), smoke: TRAIL[b?.g ?? 2], light: [0.08, 0.2, 0.4, 0.6][b?.g ?? 2], seed: id }) } },
  judgment:     { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 28, speed: 380, palette: R("expose"), light: 0.55, seed: id }) } },
  mammonite:    { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 3, speed: 120, palette: ramp9("bounty"), light: 0.5, seed: id % 9 }) } },
  cointoss:     { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 1.6, speed: 140, palette: ramp9("bounty"), light: 0.45, seed: id % 9 }) } },
  // the sword waves: a crescent slash flying level (turning it would break up its pixels)
  basic_swordman: { shot: { mod: swordWave, opts: (a, id, b) => ({ angle: a, size: 13, palette: b?.pal ?? R("sunder"), light: 0.4, seed: id }) } },
  swordwave:    { shot: { mod: swordWave, opts: (a, id, b, ev) => ({ angle: a, size: (ev?.half ?? 16) * 1.58, palette: R("sunder"), light: 0.45, seed: id }) } },
  venomcloud:   { zone: { mod: poisonCloud, opts: (r) => ({ spread: r / 40, palette: R("venom") }), cache: 3 } },
  magnus:       { zone: { mod: runeCircle, opts: () => ({ palette: R("light") }), cache: 3 } },
  purify:       { zone: { mod: smite, opts: () => ({}), life: 1.6, cache: 2 } },
  aquabenedicta:{ zone: { mod: waveCrash, opts: () => ({ palette: R("water") }), life: 1.2, cache: 2 } },
  // zones
  tidal:     { zone: { mod: waveCrash, opts: () => ({ palette: R("water") }), life: 1.5, cache: 2, scale: 0.5 } },
  stonespike:{ zone: { mod: earthSpike, opts: () => ({ height: 22 }), life: 1.1, cache: 2 } },
  quake:     { zone: { mod: quake, opts: (r) => ({ reach: r * 2 }), life: 1.5, cache: 2 } },
  toxiccloud:{ zone: { mod: poisonCloud, opts: (r) => ({ spread: r / 40 }), cache: 3 } },
  smite:     { zone: { mod: smite, opts: () => ({}), life: 1.6, cache: 2 } },
  grasping:  { zone: { mod: grasping, opts: () => ({}), life: 1.8, cache: 2 } },
  runecircle:{ zone: { mod: runeCircle, opts: () => ({}), cache: 3 } },
};

/** A burst of an element (a ball landing, a reaction's blast). */
export function blastOf(elem) {
  if (elem === "ice") return { mod: snowBurst, opts: {}, life: 1.4, fade: 0.5 };
  const r = R(elem ?? "arcane");
  return { mod: plasma, opts: { palette: [r[0], r[1], r[2], r[3], r[4], r[6], "#ffffff"], accent: [r[0], r[2], r[4], r[5], r[6]] }, life: 1, fade: 0.4 };
}
