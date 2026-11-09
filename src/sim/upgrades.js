// The cards: offered at every level-up and after every wave. Learn a skill of the run's class (a Mage's only of
// unlocked elements), level one up (a basic attack to 8), fuse two summons, a stat, mastery of an awakened mark,
// a reaction card (from chapter 2), an imbue (martial classes: the basic attack carries a mark the class's book
// lacks, so every class can gather all ten), the wall, and once the class's ten marks have awakened, Chaos Seed.

import { SKILLS, maxLevel, reqOf, milestoneText, stats } from "../data/skills.js?v=mw9eebqq";
const levelText = (id, next) => { const m = milestoneText(id, next); return m ? `★ Cấp ${next}: ${m}` : "Mạnh hơn, hồi chiêu nhanh hơn." };
import { ELEM, MARTIAL, schoolOf } from "../data/elements.js?v=mw9eebqq";
import { CLASSES } from "../data/classes.js?v=mw9eebqq";
import { T, skillT } from "../data/tuning.js?v=mw9eebqq";

export const BASE_SLOTS = 12;
const STATS = [
  { id: "dmg", title: "Sức mạnh", text: "+10% sát thương mọi đòn.", apply: (w) => (w.mods.dmg *= 1.1) },
  { id: "cd", title: "Thần tốc", text: "−8% hồi chiêu mọi skill.", apply: (w) => (w.mods.cd *= 0.92) },
  { id: "area", title: "Bành trướng", text: "+12% diện rộng.", apply: (w) => (w.mods.area *= 1.12) },
  { id: "auraDur", title: "Lưu ấn", text: "Dấu và aura kéo dài thêm 20%.", apply: (w) => (w.mods.auraDur *= 1.2) },
];
const REACTS = [
  { id: "reactDmg", title: "Cộng hưởng", text: "+20% sát thương phản ứng và combo.", apply: (w) => (w.mods.reactDmg *= 1.2) },
  { id: "tierDmg", title: "Tầng tầng lớp lớp", text: "+25% sát thương TRIAD/QUADRA/PENTA/HEXA.", apply: (w) => (w.mods.tierDmg *= 1.25) },
  { id: "focus", title: "Hội tụ", text: "Đòn đơn mục tiêu ưu tiên quái nhiều dấu hơn.", apply: (w) => (w.mods.focus += 0.5) },
];

const owned = (w) => Object.keys(w.skills);
const slots = (w) => BASE_SLOTS + (w.mods.slots ?? 0);
const marksOfSkill = (sk) => [...(sk.elems ?? [sk.elem]), ...(sk.also ?? [])];
const elemsOwned = (w) => new Set(owned(w).flatMap((id) => marksOfSkill(SKILLS[id])));
const cls = (w) => w.cls ?? "mage";
/** Can this run's class learn the skill? (a Mage only skills of the elements unlocked) */
export const learnable = (w, id) => {
  const sk = SKILLS[id];
  if (!sk.cls.includes(cls(w)) || sk.basic || id === "chaosseed" || skillT(id).off) return false;
  // every class: a skill shows up only once all the marks it needs are unlocked
  return reqOf(id).every((m) => w.unlocked.has(m));
};
/** The martial marks a class's own book never leaves: offered as imbues for its basic attack. */
export const imbuesFor = (c) => {
  if (CLASSES[c]?.school === "arcane") return [];
  const has = new Set(Object.values(SKILLS).filter((s) => s.cls.includes(c)).flatMap(marksOfSkill));
  return MARTIAL.filter((m) => !has.has(m));
};

export function cardPool(w) {
  const cards = [], have = elemsOwned(w);
  for (const [id, sk] of Object.entries(SKILLS)) {
    const s = w.skills[id];
    if (sk.fuse) {   // a fusion: offered once both halves are owned, it takes their place
      if (!sk.cls.includes(cls(w))) continue;
      const [a, b] = sk.fuse;
      if (!s && w.skills[a] && w.skills[b]) cards.push({ kind: "fuse", id, elem: sk.elem, title: `Hợp thể: ${sk.name}`, text: sk.desc, weight: 7 });
      else if (s && s.level < maxLevel(id)) cards.push({ kind: "level", id, elem: sk.elem, title: `${sk.name} cấp ${s.level + 1}`, text: levelText(id, s.level + 1), weight: 2 });
      continue;
    }
    if (s) { if (s.level < maxLevel(id)) cards.push({ kind: "level", id, elem: sk.elem, title: `${sk.name} cấp ${s.level + 1}`, text: sk.basic ? sk.desc : levelText(id, s.level + 1), weight: 2 }); continue }
    if (owned(w).length >= slots(w) || !learnable(w, id)) continue;
    // past six marks, the missing ones come first
    const marks = marksOfSkill(sk), fresh = marks.some((m) => !have.has(m));
    const wanted = have.size >= 6 && fresh ? 6 : fresh ? 3 : 2;
    cards.push({ kind: "learn", id, elem: sk.elem, title: `Học ${sk.name}`, text: sk.desc, weight: wanted });
  }
  if (false) for (const m of imbuesFor(cls(w))) if (!w.imbue.has(m) && w.unlocked.has(m)) cards.push({ kind: "imbue", elem: m, title: `Tẩm ${ELEM[m].name}`, text: `Đòn đánh thường để lại thêm dấu ${ELEM[m].name}.`, weight: 3 });
  for (const s of STATS) cards.push({ kind: "stat", id: s.id, title: s.title, text: s.text, weight: 1 });
  if (w.chapter >= 2) for (const r of REACTS) cards.push({ kind: "react", id: r.id, title: r.title, text: r.text, weight: 1 });
  for (const el of w.awakened) if (!w.mastery.has(el)) cards.push({ kind: "mastery", elem: el, title: `Tinh thông ${ELEM[el].name}`, text: `+25% sát thương các đòn mang dấu ${ELEM[el].name}.`, weight: 2 });
  if (w.wall.hp < w.wall.max) cards.push({ kind: "repair", title: "Sửa tường", text: "Hồi 35 máu cho tường.", weight: w.wall.hp < w.wall.max * 0.5 ? 4 : 1 });
  cards.push({ kind: "fortify", title: "Gia cố tường", text: "+25 máu tối đa và hồi 25 máu.", weight: 1 });
  return cards;
}

/** n different cards, weighted; Chaos Seed guaranteed once the class's marks have all awakened. */
export function drawCards(w, n = 3) {
  n += w.mods.choices ?? 0;
  const pool = cardPool(w), out = [];
  if (w.chaosAwake && !w.skills.chaosseed && w.chaosUnlocked) out.push({ kind: "learn", id: "chaosseed", elem: "chaos", title: "CHAOS SEED", text: SKILLS.chaosseed.desc, weight: 0 });
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let r = w.rng.next() * total, i = 0;
    while (r > pool[i].weight && i < pool.length - 1) { r -= pool[i].weight; i++ }
    out.push(pool.splice(i, 1)[0]);
  }
  if (!out.some((c) => c.kind === "learn" || c.kind === "level")) {
    const skill = cardPool(w).find((c) => c.kind === "learn" || c.kind === "level");
    if (skill) out[out.length - 1] = skill;
  }
  return out;
}

/** The passive skills' effect on the run: damage, the wall's damage taken, gold. */
export function refreshPassives(w) {
  // the class's own strength (balanced so each can hold the wall), the admin's word, then the passives
  const c = CLASSES[w.cls ?? "mage"], t = T.classes?.[w.cls ?? "mage"] ?? {};
  // a new player's class: its "early" factor, fading as its tree fills (gone by the time it's half full)
  // and its "mid" factor, strongest with half the tree (a class that is weak mid-game, strong at both ends)
  const nv = w.novice ?? 0;
  // the early factor holds fully while less than 30% of the tree is bought, and is gone by half
  w.power = (c?.power ?? 1) * (t.dmg ?? 1) * (1 + ((c?.early ?? 1) - 1) * Math.max(0, Math.min(1, (nv - 0.5) / 0.2))) * (1 + ((c?.mid ?? 1) - 1) * Math.max(0, 1 - Math.abs(nv - 0.5) * 2));   // on the skills' own numbers (skillStats)
  w.pm = { dmg: 1, wallTaken: (t.wallTaken ?? 1) * (w.mods?.wallTaken ?? 1), gold: w.mods?.gold ?? 1 };
  for (const [id, s] of Object.entries(w.skills)) {
    if (SKILLS[id].passive !== "mod") continue;
    const st = stats(id, s.level);
    if (st.dmg) w.pm.dmg *= st.dmg;
    if (st.wallTaken) w.pm.wallTaken *= st.wallTaken;
    if (st.gold) w.pm.gold *= st.gold;
  }
}

export function applyCard(w, card) {
  if (card.kind === "learn") w.skills[card.id] = { level: 1, cd: 0.4 };
  else if (card.kind === "fuse") {
    const [a, b] = SKILLS[card.id].fuse, level = Math.max(w.skills[a]?.level ?? 1, w.skills[b]?.level ?? 1);
    delete w.skills[a]; delete w.skills[b];
    w.minions = (w.minions ?? []).filter((m) => m.skill !== a && m.skill !== b);
    w.skills[card.id] = { level, cd: 0.3 };
  }
  else if (card.kind === "level") w.skills[card.id].level++;
  else if (card.kind === "imbue") w.imbue.add(card.elem);
  else if (card.kind === "stat") STATS.find((s) => s.id === card.id).apply(w);
  else if (card.kind === "react") REACTS.find((s) => s.id === card.id).apply(w);
  else if (card.kind === "mastery") { w.mastery.add(card.elem); w.mods.elem[card.elem] = (w.mods.elem[card.elem] ?? 1) * 1.25 }
  else if (card.kind === "repair") w.wall.hp = Math.min(w.wall.max, w.wall.hp + 35);
  else if (card.kind === "fortify") { w.wall.max += 25; w.wall.hp = Math.min(w.wall.max, w.wall.hp + 25) }
  refreshPassives(w);
}
