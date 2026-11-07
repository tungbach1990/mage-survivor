// How each skill looks: which pixelfx effect draws its shot, its blast or its zone, in which palette.
// `fit` lets one effect play many parts (a fireball recolored is a venom dart, a void bolt, a mana missile).

import * as fireball from "../../lib/pixelfx/fx/fire/fireball.js";
import * as tracer from "../../lib/pixelfx/fx/projectiles/bullet-tracer.js";
import * as iceLance from "../../lib/pixelfx/fx/ice/ice-lance.js";
import * as energyDisc from "../../lib/pixelfx/fx/projectiles/energy-disc.js";
import * as ballLightning from "../../lib/pixelfx/fx/lightning/ball-lightning.js";
import * as tornado from "../../lib/pixelfx/fx/nature/tornado.js";
import * as voidOrb from "../../lib/pixelfx/fx/shadow/void-orb.js";
import * as plasma from "../../lib/pixelfx/fx/explosions/plasma-explosion.js";
import * as snowBurst from "../../lib/pixelfx/fx/ice/snowflake-burst.js";
import * as waveCrash from "../../lib/pixelfx/fx/water/wave-crash.js";
import * as earthSpike from "../../lib/pixelfx/fx/nature/earth-spike.js";
import * as quake from "../../lib/pixelfx/fx/nature/quake.js";
import * as poisonCloud from "../../lib/pixelfx/fx/nature/poison-cloud.js";
import * as smite from "../../lib/pixelfx/fx/holy/smite.js";
import * as grasping from "../../lib/pixelfx/fx/shadow/grasping-hands.js";
import * as runeCircle from "../../lib/pixelfx/fx/arcane/rune-circle.js";
import { ELEM } from "../data/elements.js";
import * as swordWave from "../fx/sword-wave.js";

const R = (el) => ELEM[el].ramp;
const ramp9 = (el) => [...R(el), "#ffffff"];   // the fireball wants nine steps

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
  basic_mage:   { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 2, speed: 140, palette: ramp9("arcane"), light: 0.45, seed: id % 9 }) } },
  basic_archer: { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 16, speed: 330, palette: R("sunder"), light: 0.25, seed: id }) } },
  doublestrafe: { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 16, speed: 340, palette: R("bleed"), light: 0.3, seed: id }) } },
  pinshot:      { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 20, speed: 360, palette: R("pin"), light: 0.3, seed: id }) } },
  huntersmark:  { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 22, speed: 380, palette: R("expose"), light: 0.45, seed: id }) } },
  chargearrow:  { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 26, speed: 300, palette: R("sunder"), light: 0.4, seed: id }) } },
  blindarrow:   { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 2.5, speed: 120, palette: ramp9("blind"), light: 0.2, seed: id % 9 }) } },
  basic_thief:  { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 9, speed: 300, palette: R("venom"), light: 0.3, seed: id }) } },
  envenom:      { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 12, speed: 320, palette: R("venom"), light: 0.45, seed: id }) } },
  steal:        { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 10, speed: 320, palette: R("bounty"), light: 0.45, seed: id }) } },
  hamstring:    { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 10, speed: 320, palette: R("cripple"), light: 0.3, seed: id }) } },
  basic_acolyte:{ shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 20, speed: 260, palette: R("light"), light: 0.55, seed: id }) } },
  judgment:     { shot: { mod: tracer, opts: (a, id) => ({ angle: a, length: 28, speed: 380, palette: R("expose"), light: 0.55, seed: id }) } },
  mammonite:    { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 3, speed: 120, palette: ramp9("bounty"), light: 0.5, seed: id % 9 }) } },
  cointoss:     { shot: { mod: fireball, opts: (a, id) => ({ angle: a, radius: 1.6, speed: 140, palette: ramp9("bounty"), light: 0.45, seed: id % 9 }) } },
  // the sword waves: a crescent slash flying level (turning it would break up its pixels)
  basic_swordman: { shot: { mod: swordWave, opts: (a, id) => ({ size: 13, palette: R("sunder"), light: 0.4, seed: id }) } },
  swordwave:    { shot: { mod: swordWave, opts: (a, id) => ({ size: 16, palette: R("sunder"), light: 0.45, seed: id }) } },
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
