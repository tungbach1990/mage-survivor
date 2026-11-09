// Mage Survivor — the idle RPG. The battle runs all the time; the tabs below it are where the hero learns
// skills, spends stat points, wears gear, picks a map, and where the six heroes and the passives live.

import { loadAssets, browserLoad } from "./assets.js?v=mw92mcdd";
import { createIdleRenderer, VW, VH } from "./idle/view.js?v=mw92mcdd";
import { createBattle, step, drain, refresh, setMap, bestMap, mapOpen, GRID, mapGrid } from "./idle/world.js?v=mw92mcdd";
import { MAPS, mapOf, xpToNext, MAX_LEVEL, BOSS_EVERY, ELEM_NAME, BEATS } from "./idle/data.js?v=mw92mcdd";
import { SKILL_TREE, skillOf, skillAt, canLearn, SKILL_MAX } from "./idle/skills.js?v=mw92mcdd";
import { heroStats, CLASS_IDS } from "./idle/hero.js?v=mw92mcdd";
import { PASSIVE_TREE, passiveCost } from "./idle/passives.js?v=mw92mcdd";
import { itemName, itemPower, lineText, salvageValue, refineCost, refineChance, REFINE_MAX } from "./idle/items.js?v=mw92mcdd";
import { STAT_PLAN } from "./idle/bot.js?v=mw92mcdd";
import {
  load, save, exportSave, importSave, freshProfile, heroOf, raiseStat, statPointsLeft, skillPointsLeft, learnSkill, resetPoints, resetCost, onLevel,
  claimDrop, equip, unequip, salvage, salvageFiltered, refine, buyPassive, notePace, offlineGains, BAG_SIZE,
} from "./idle/profile.js?v=mw92mcdd";
import { STAT_IDS, statCost } from "./data/stats.js?v=mw92mcdd";
import { CLASSES } from "./data/classes.js?v=mw92mcdd";
import { GRADES, GRADE, baseOf } from "./data/loot.js?v=mw92mcdd";
import { WTYPES, STARTER } from "./data/weapons.js?v=mw92mcdd";
import { iconPixels, kindOf, SLOT_IDS, SLOT_NAMES } from "./data/gear.js?v=mw92mcdd";
import { dressHero } from "./render/dress.js?v=mw92mcdd";
import { lookOf } from "./data/gear.js?v=mw92mcdd";
import { inTelegram, telegramUser, telegramInit, cloudLoad, cloudMirror } from "./meta/cloud.js?v=mw92mcdd";

const $ = (id) => document.getElementById(id);
const DT = 1 / 60;
const canvas = $("screen"), g = canvas.getContext("2d"), img = g.createImageData(VW, VH);
const A = await loadAssets(browserLoad, "assets/");
$("loading").hidden = true;

// ---------- the save (per Telegram user; mirrored to Telegram's cloud) ----------
telegramInit();
const tgUser = telegramUser();
const store = tgUser ? { getItem: (k) => localStorage.getItem(`${k}.${tgUser.id}`), setItem: (k, v) => localStorage.setItem(`${k}.${tgUser.id}`, v) } : localStorage;
let P = load(store);
try { const text = await cloudLoad(); if (text) { const c = importSave(text); if ((c.savedAt ?? 0) > (P.savedAt ?? 0)) P = c } } catch (e) { console.warn("cloud load failed", e) }
const mirror = cloudMirror(() => JSON.stringify(P), () => {});
function persist() { P.lastSeen = Date.now(); save(store, P); mirror.schedule() }

// ---------- the battle ----------
let w = null, r = createIdleRenderer(A), tab = P.settings.tab ?? "skills", acc = 0, last = 0, hudT = 0, paceT = 0, saveT = 0, panelT = 0;
const pace = { xp: 0, gold: 0, kills: 0, sec: 0 };
function startBattle() {
  const h = heroOf(P);
  onLevel(h);
  w = createBattle(Date.now() % 100000, h, { onLevel: (hero) => { onLevel(hero); toast(`⬆ Lên cấp ${hero.level}!`, 2200); if (tab === "skills" || tab === "stats") drawPanel() } });
  r = createIdleRenderer(A);
}

// ---------- offline ----------
const away = offlineGains(P);
if (away) {
  const hh = Math.floor(away.sec / 3600), mm = Math.round((away.sec % 3600) / 60);
  $("offline-body").innerHTML = `<p>Vắng mặt <b>${hh ? `${hh} giờ ` : ""}${mm} phút</b>${away.sec >= 8 * 3600 - 1 ? " (tối đa 8 giờ)" : ""}. ${CLASSES[P.current].name} vẫn chiến đấu:</p>
    <ul><li>⚔ Hạ <b>${away.kills}</b> quái</li><li>✨ +<b>${away.xp.toLocaleString("vi")}</b> kinh nghiệm${away.levels ? ` · lên <b>${away.levels}</b> cấp` : ""}</li><li>💰 +<b>${away.gold.toLocaleString("vi")}</b> vàng</li>
    <li>🎒 <b>${away.items}</b> trang bị vào túi${away.salvaged ? ` · ♻ ${away.salvaged} món phân rã (+${away.crystals}💎)` : ""}</li></ul>`;
  $("offline").hidden = false;
}
$("offline-ok").onclick = () => { $("offline").hidden = true; persist() };
startBattle();
persist();

// ---------- the top bar ----------
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? (n / 1e3).toFixed(1) + "k" : String(Math.floor(n)));
function drawTop() {
  const h = heroOf(P), hs = w.hs, M = mapOf(w.map);
  $("hero-name").textContent = CLASSES[h.cls].name;
  $("hero-lv").textContent = `Lv ${h.level}`;
  $("gold").textContent = `💰 ${fmt(h.gold ?? 0)}`;
  $("crys").textContent = `💎 ${fmt(P.crystals)}`;
  const need = xpToNext(h.level), xk = h.level >= MAX_LEVEL ? 1 : (h.xp ?? 0) / need;
  $("xp-fill").style.width = `${(xk * 100).toFixed(1)}%`;
  $("xp-text").textContent = h.level >= MAX_LEVEL ? "MAX" : `${(xk * 100).toFixed(1)}%`;
  $("hp-fill").style.width = `${Math.max(0, (w.hp / hs.maxHp) * 100).toFixed(1)}%`; $("hp-text").textContent = `${Math.max(0, Math.round(w.hp))}/${hs.maxHp}`;
  $("sp-fill").style.width = `${((w.sp / hs.maxSp) * 100).toFixed(1)}%`; $("sp-text").textContent = `${Math.round(w.sp)}/${hs.maxSp}`;
  $("map-name").textContent = `${M.id}. ${M.name} (Lv ${M.lv[0]}–${M.lv[1]})`;
  const k = w.kills % BOSS_EVERY;
  $("boss-text").textContent = w.monsters.some((m) => m.boss && m.hp > 0) ? "⚠ BOSS!" : `Boss: ${k}/${BOSS_EVERY}`;
  $("boss-fill").style.width = `${(k / BOSS_EVERY) * 100}%`;
  $("stats-dot").hidden = statPointsLeft(h) < 2 && skillPointsLeft(h) < 1;
  $("gear-dot").hidden = !P.bag.some((it) => it.fresh && it.cls === h.cls);
  drawSkillbar();
}
function drawSkillbar() {
  const h = heroOf(P), bar = $("skillbar");
  const ids = SKILL_TREE[h.cls].filter((s) => h.skills[s.id]).map((s) => s.id);
  const key = ids.join(",") + "|" + Object.keys(h.off ?? {}).filter((k) => h.off[k]).join(",");
  if (bar._key !== key) {
    bar._key = key; bar.innerHTML = "";
    for (const id of ids) {
      const b = document.createElement("button"); b.className = "sk"; b.dataset.id = id;
      b.textContent = skillOf(h.cls, id).name.split(" ").map((x) => x[0]).join("").slice(0, 3);
      b.title = skillOf(h.cls, id).name;
      b.onclick = () => { h.off = h.off ?? {}; h.off[id] = !h.off[id]; toast(`${skillOf(h.cls, id).name}: ${h.off[id] ? "TẮT tự dùng" : "BẬT tự dùng"}`, 1500); drawSkillbar() };
      bar.appendChild(b);
    }
  }
  for (const b of bar.children) {
    const id = b.dataset.id, cd = Math.max(0, (w.cds[id] ?? 0) - w.t);
    b.className = `sk${h.off?.[id] ? " off" : ""}${cd > 0 ? " cd" : ""}${w.cast?.id === id ? " casting" : ""}`;
    b.style.setProperty?.("--cd", cd > 0 ? `${Math.min(1, cd / (skillAt(skillOf(h.cls, id), h.skills[id]).cd || 1)) * 100}%` : "0%");
  }
}
const SPEEDS = [1, 2, 4, 8];
function drawSpeed() { $("speed-btn").textContent = `⏩ x${P.speed ?? 1}`; $("speed-btn").className = (P.speed ?? 1) > 1 ? "on" : "" }
$("speed-btn").onclick = () => { P.speed = SPEEDS[(SPEEDS.indexOf(P.speed ?? 1) + 1) % SPEEDS.length]; drawSpeed() };
drawSpeed();

// ---------- toasts ----------
function toast(text, ms = 2600) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = text;
  const box = $("toasts"); box.appendChild(t);
  while (box.children.length > 4) box.children[0].remove?.();
  setTimeout(() => t.remove?.(), ms);
}

// ---------- events from the battle ----------
function handle(events) {
  const h = heroOf(P);
  for (const ev of events) {
    if (ev.type === "kill") { P.totals.kills++; pace.kills++; pace.xp += ev.xp; pace.gold += ev.gold; if (ev.boss) { P.totals.bosses++; toast(`👑 Hạ boss ${mapOf(w.map).name}!`, 3000) } }
    else if (ev.type === "gear") {
      const it = claimDrop(P, h.cls, ev.level, ev.grade);
      if (it.salvaged) { if (GRADES.indexOf(it.rarity) >= 3) toast(`♻ ${GRADE[it.rarity].name} phân rã +${it.salvaged}💎`, 1600) }
      else toast(`🎁 ${itemName(it)}${itemPower(it) > itemPower(h.gear[it.slot]) ? " ▲ mạnh hơn!" : ""}`, 3200);
      if (tab === "gear") panelT = 0;
    } else if (ev.type === "death") { P.totals.deaths++; toast(`💀 Ngã! −${fmt(ev.xp)} kinh nghiệm`, 2500) }
    else if (ev.type === "map") { toast(`🗺 Sang ${mapOf(ev.map).name}`, 2500); if (tab === "maps") drawPanel() }
    else if (ev.type === "boss") toast(`⚠ Boss ${mapOf(w.map).name} xuất hiện!`, 2500);
  }
  return events;
}

// ---------- the loop ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, last ? (now - last) / 1000 : DT); last = now;
  acc = Math.min(acc + dt * (P.speed ?? 1), DT * 32);
  let steps = 0;
  while (acc >= DT && steps < 32) { step(w, DT); r.update(w, handle(drain(w)), DT); acc -= DT; steps++ }
  const px = r.draw(w); img.data.set(px); g.putImageData(img, 0, 0);
  P.totals.playSec += dt;
  if ((hudT -= dt) <= 0) { hudT = 0.15; drawTop() }
  if ((paceT += dt * (P.speed ?? 1)) >= 10) { notePace(heroOf(P), paceT, pace.xp, pace.gold, pace.kills); pace.xp = pace.gold = pace.kills = 0; paceT = 0 }
  if ((saveT += dt) >= 15) { saveT = 0; persist() }
  if ((panelT -= dt) <= 0) { panelT = 1; if (tab === "stats" || tab === "gear" || tab === "maps") livePanel() }
}
requestAnimationFrame(frame);
addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") persist() });
addEventListener("pagehide", () => persist());

// ======================= the tabs =======================
for (const b of document.querySelectorAll("#tabs button")) b.onclick = () => { tab = b.dataset.tab; P.settings.tab = tab; drawPanel() };
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
function btn(label, fn, dis = false, cls = "") { const b = el("button", cls); b.textContent = label; b.disabled = dis; b.onclick = () => { fn(); persist(); drawPanel(); drawTop() }; return b }
function drawPanel() {
  for (const b of document.querySelectorAll("#tabs button")) b.className = b.dataset.tab === tab ? "on" : "";
  const p = $("panel"); p.innerHTML = "";
  ({ skills: drawSkills, stats: drawStats, gear: drawGear, maps: drawMaps, heroes: drawHeroes, more: drawMore })[tab]?.(p);
}
// the parts that change while you look: redrawn once a second (only if nothing's being pressed)
function livePanel() { if (tab === "maps") drawPanel(); else if (tab === "stats") drawPanel() }

// ---- skills
function drawSkills(p) {
  const h = heroOf(P), left = skillPointsLeft(h);
  p.appendChild(el("div", "head", `<b>Điểm kỹ năng: ${left}</b> <small>(1 điểm mỗi cấp; mỗi skill tối đa ${SKILL_MAX})</small>`));
  const auto = el("label", "check"); auto.appendChild(btn(`${h.autoSkills ? "✔" : "✖"} Tự học skill khi lên cấp`, () => { h.autoSkills = !h.autoSkills; if (h.autoSkills) onLevel(h) }, false, h.autoSkills ? "on" : "")); p.appendChild(auto);
  for (const sk of SKILL_TREE[h.cls]) {
    const lv = h.skills[sk.id] ?? 0, st = skillAt(sk, Math.max(1, lv)), nx = skillAt(sk, Math.min(SKILL_MAX, lv + 1));
    const locked = h.level < sk.lv || (sk.req && !h.skills[sk.req]);
    const d = el("div", `tile skill${locked ? " locked" : ""}`);
    const what = describe(sk, lv ? st : nx);
    d.innerHTML = `<div class="sk-head"><b>${sk.name}</b> <small class="elem e-${sk.elem}">${ELEM_NAME[sk.elem]}</small> <span class="lv">${lv}/${SKILL_MAX}</span></div>
      <small>${what}</small>${lv && lv < SKILL_MAX ? `<small class="next">Cấp ${lv + 1}: ${describe(sk, nx)}</small>` : ""}
      ${locked ? `<small class="lock">🔒 Cần cấp ${sk.lv}${sk.req ? ` và học ${skillOf(h.cls, sk.req).name}` : ""}</small>` : ""}`;
    if (!locked) {
      d.appendChild(btn(lv ? "+1" : "Học", () => { learnSkill(h, sk.id); refresh(w) }, left < 1 || lv >= SKILL_MAX));
      if (lv) d.appendChild(btn(h.off?.[sk.id] ? "▶ Bật tự dùng" : "⏸ Tắt tự dùng", () => { h.off = h.off ?? {}; h.off[sk.id] = !h.off[sk.id] }));
    }
    p.appendChild(d);
  }
  p.appendChild(el("p", "hint", "Skill tự dùng khi đủ SP và hồi chiêu xong, theo thứ tự trên xuống. Chạm biểu tượng skill dưới khung trận để bật/tắt nhanh."));
  p.appendChild(btn(`Tẩy điểm kỹ năng (${resetCost(h) ? `💎 ${resetCost(h)}` : "miễn phí lần đầu"})`, () => { if (resetPoints(P, h, "skills")) { if (h.autoSkills) onLevel(h); refresh(w) } }, P.crystals < resetCost(h)));
}
function describe(sk, st) {
  const sp = `${Math.round(st.sp)} SP · hồi ${st.cd.toFixed(1)}s${st.cast ? ` · niệm ${st.cast}s` : ""}`;
  if (sk.kind === "hit") return `Đánh 1 mục tiêu ${Math.round(st.pct)}%${st.hits > 1 ? ` × ${st.hits} lần` : ""}${sk.crit ? ", luôn chí mạng" : ""} · ${sp}`;
  if (sk.kind === "area") return `Đánh cả nhóm ${Math.round(st.pct)}% · ${sp}`;
  if (sk.kind === "debuff") return `Đánh ${Math.round(st.pct)}% và giảm ${Math.round(st.def * 100)}% DEF quái ${st.dur}s · ${sp}`;
  if (sk.kind === "heal") return `Hồi ${Math.round(st.pct)}% máu (khi máu dưới 65%) · ${sp}`;
  const parts = [st.atk && `ATK +${Math.round(st.atk * 100)}%`, st.aspd && `tốc đánh +${Math.round(st.aspd * 100)}%`, st.def && `giảm sát thương nhận ${Math.round(st.def * 100)}%`, st.crit && `chí mạng +${Math.round(st.crit * 100)}%`].filter(Boolean);
  return `Tăng ${parts.join(", ")} trong ${Math.round(st.dur)}s · ${sp}`;
}

// ---- stats
const STAT_TEXT = { str: "ATK cận chiến", agi: "Tốc đánh, né", vit: "Máu, giảm sát thương, hồi máu", int: "MATK (phép), SP", dex: "Trúng, ATK cung, niệm nhanh", luk: "Chí mạng" };
function drawStats(p) {
  const h = heroOf(P), left = statPointsLeft(h), hs = w.hs;
  p.appendChild(el("div", "head", `<b>Điểm chỉ số: ${left}</b>`));
  p.appendChild(btn(`${h.autoStats ? "✔" : "✖"} Tự cộng điểm theo nghề (${STAT_PLAN[h.cls].map(([s]) => s.toUpperCase()).join(" > ")})`, () => { h.autoStats = !h.autoStats; if (h.autoStats) { onLevel(h); refresh(w) } }, false, h.autoStats ? "on" : ""));
  const grid = el("div", "stat-grid");
  for (const s of STAT_IDS) {
    const row = el("div", "stat-row");
    row.innerHTML = `<b>${s.toUpperCase()}</b> <span class="v">${h.stats[s]}<small> (${hs.totals[s]})</small></span><small>${STAT_TEXT[s]}</small>`;
    row.appendChild(btn(`+ (${statCost(h.stats[s])})`, () => { raiseStat(h, s); refresh(w) }, statCost(h.stats[s]) > left));
    row.appendChild(btn("+10", () => { raiseStat(h, s, 10); refresh(w) }, statCost(h.stats[s]) > left));
    grid.appendChild(row);
  }
  p.appendChild(grid);
  p.appendChild(el("div", "tile derived", `Máu <b>${hs.maxHp}</b> · SP <b>${hs.maxSp}</b> · ATK <b>${Math.round(hs.atk)}</b> · MATK <b>${Math.round(hs.matk)}</b><br>
    DEF <b>${Math.round(hs.def * 100)}%</b> (+${Math.round(hs.softDef)}) · HIT <b>${hs.hit}</b> · FLEE <b>${hs.flee}</b> · Chí mạng <b>${(hs.crit * 100).toFixed(1)}%</b><br>
    ASPD <b>${Math.round(hs.aspd)}</b> (${hs.aps.toFixed(2)} đòn/giây) · Niệm ×${hs.castMul.toFixed(2)} · Hồi máu ${hs.regenHp.toFixed(0)}/3s<br>
    Kinh nghiệm ×${hs.xpMul.toFixed(2)} · Vàng ×${hs.goldMul.toFixed(2)}`));
  p.appendChild(btn(`Tẩy điểm chỉ số (${resetCost(h) ? `💎 ${resetCost(h)}` : "miễn phí lần đầu"})`, () => { if (resetPoints(P, h, "stats")) { if (h.autoStats) onLevel(h); refresh(w) } }, P.crystals < resetCost(h)));
}

// ---- gear
const iconCache = new Map();
function itemIcon(it) {
  const key = [it.slot, it.cls, kindOf(it)[0], it.rarity].join("|");
  if (iconCache.has(key)) return iconCache.get(key);
  let url = "";
  try { const c = document.createElement("canvas"); c.width = c.height = 12; const gg = c.getContext("2d"), im = gg.createImageData(12, 12); im.data.set(iconPixels(it)); gg.putImageData(im, 0, 0); url = c.toDataURL?.() ?? "" } catch { url = "" }
  iconCache.set(key, url); return url;
}
let openItem = null;
function itemTile(it, actions, cmpTo) {
  const d = el("div", `tile item rar-b-${it.rarity}`), b = baseOf(it, STARTER[it.cls]) ?? {}, pw = itemPower(it), wp = cmpTo !== undefined ? itemPower(cmpTo) : null, ic = itemIcon(it);
  const base = b.atk != null ? `⚔ ATK ${b.atk}` : b.def != null ? `🛡 DEF ${b.def}${b.hp ? ` · ❤ +${b.hp}` : ""}` : b.stat ? `✦ +${b.v} ${b.stat.toUpperCase()}` : "";
  const wt = it.slot === "weapon" ? WTYPES[it.wtype ?? STARTER[it.cls]] : null;
  d.innerHTML = `<div class="item-head">${ic ? `<img class="item-icon" src="${ic}" alt="">` : ""}<div><b class="rar-${it.rarity}">${it.fresh ? "🆕 " : ""}${itemName(it)}</b>
    <small>${SLOT_NAMES?.[it.slot] ?? it.slot}${wt ? ` · ${wt.name}${wt.two ? " (2 tay)" : ""}` : ""}</small></div></div>
    <div class="power">⚔ Lực chiến <b>${pw}</b>${wp == null ? "" : pw > wp ? ` <span class="up">▲${pw - wp}</span>` : pw < wp ? ` <span class="down">▼${wp - pw}</span>` : ""}</div>
    <div class="base">${base}</div><ul>${(it.lines ?? []).map((l) => `<li>${lineText(l, it.refine ?? 0)}</li>`).join("")}</ul>`;
  const row = el("div", "actions");
  for (const [label, fn, dis] of actions) row.appendChild(btn(label, fn, dis));
  d.appendChild(row);
  return d;
}
function drawGear(p) {
  const h = heroOf(P);
  // the hero as dressed
  const prev = el("div", "gear-top");
  const total = Object.values(h.gear).reduce((a, it) => a + itemPower(it), 0);
  prev.innerHTML = `<b>${CLASSES[h.cls].name}</b> · Tổng lực chiến <b>${total}</b> · Túi ${P.bag.length}/${BAG_SIZE}`;
  p.appendChild(prev);
  const slots = el("div", "slots");
  for (const s of SLOT_IDS) {
    const it = h.gear[s];
    if (it) slots.appendChild(itemTile(it, [["Tháo", () => { unequip(P, h.cls, s); refresh(w) }, it.starter && false], [`✦ +${(it.refine ?? 0) + 1}`, () => doRefine(it), (it.refine ?? 0) >= REFINE_MAX]]));
    else slots.appendChild(el("div", "tile item empty", `<b>${SLOT_NAMES?.[s] ?? s}</b><small>${s === "weapon" ? "Tay không: đấm" : "Trống"}</small>`));
  }
  p.appendChild(slots);
  p.appendChild(lootFilter());
  const mine = P.bag.filter((it) => it.cls === h.cls).sort((a, b) => itemPower(b) - itemPower(a));
  p.appendChild(el("h3", null, `Túi đồ (${mine.length} món của ${CLASSES[h.cls].name}${P.bag.length > mine.length ? ` · ${P.bag.length - mine.length} của nghề khác` : ""})`));
  const bag = el("div", "bag");
  for (const it of mine) bag.appendChild(itemTile(it, [["Mặc", () => { equip(P, h.cls, it.id); refresh(w) }], [`♻ +${salvageValue(it)}💎`, () => salvage(P, it.id)]], h.gear[it.slot] ?? null));
  p.appendChild(bag);
  for (const it of P.bag) if (it.cls === h.cls) delete it.fresh;
}
function doRefine(it) {
  const c = refineCost(it), h = heroOf(P);
  if ((h.gold ?? 0) < c.gold || P.crystals < c.crystals) return toast(`Cần 💰 ${fmt(c.gold)} và 💎 ${c.crystals} để tinh luyện`, 2500);
  const res = refine(P, it.id);
  toast(res === "ok" ? `✦ Tinh luyện lên +${it.refine}!` : res === "fail" ? `✖ Thất bại, còn +${it.refine}` : "Không thể tinh luyện", 2500);
  refresh(w);
}
function lootFilter() {
  const d = el("div", "tile loot-filter");
  d.appendChild(el("b", null, "♻ Nhặt và phân rã"));
  d.appendChild(el("small", "hint", " (💎 chỉ có từ phân rã)"));
  const row = el("div", "row wrap");
  for (const gname of GRADES) { const on = P.lootKeep.includes(gname); row.appendChild(btn(`${on ? "✔" : "✖"} ${GRADE[gname].name}`, () => { P.lootKeep = on ? P.lootKeep.filter((x) => x !== gname) : [...P.lootKeep, gname] }, false, `rar-${gname} ${on ? "on" : "off"}`)) }
  d.appendChild(row);
  d.appendChild(btn(`${P.autoSalvage ? "✔" : "✖"} Tự phân rã đồ yếu hơn đồ đang mặc`, () => { P.autoSalvage = !P.autoSalvage }, false, P.autoSalvage ? "on" : ""));
  d.appendChild(btn("♻ Phân rã ngay theo bộ lọc", () => { const got = salvageFiltered(P); toast(got ? `♻ +${got}💎` : "Không có món nào cần phân rã", 2000) }));
  return d;
}

// ---- maps
function miniMap() {
  const S = 4, n = GRID * S, c = document.createElement("canvas"); c.width = c.height = n; c.className = "minimap";
  try {
    const gg = c.getContext("2d"), im = gg.createImageData(n, n), g = mapGrid(w.map), dot = (x, y, rgb, r = 1) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const X = Math.round(x * S) + i, Y = Math.round(y * S) + j; if (X >= 0 && Y >= 0 && X < n && Y < n) { const k = (Y * n + X) * 4; im.data[k] = rgb[0]; im.data[k + 1] = rgb[1]; im.data[k + 2] = rgb[2]; im.data[k + 3] = 255 } } };
    for (let ty = 0; ty < GRID; ty++) for (let tx = 0; tx < GRID; tx++) for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const k = ((ty * S + j) * n + tx * S + i) * 4, b = g.blocked[ty * GRID + tx]; im.data[k] = b ? 40 : 70; im.data[k + 1] = b ? 70 : 110; im.data[k + 2] = b ? 50 : 80; im.data[k + 3] = 255 }
    for (const m of w.monsters) if (m.hp > 0) dot(m.x, m.y, m.boss ? [255, 160, 40] : [230, 70, 70], m.boss ? 2 : 1);
    dot(w.hx, w.hy, [255, 255, 255], 2);
    gg.putImageData(im, 0, 0);
  } catch { /* no canvas */ }
  return c;
}
function drawMaps(p) {
  const h = heroOf(P);
  p.appendChild(miniMap());
  p.appendChild(btn(`${w.autoMap ? "✔" : "✖"} Tự động lên map hợp cấp (lùi map nếu ngã 3 lần trong 2 phút)`, () => { w.autoMap = h.autoMap = !w.autoMap }, false, w.autoMap ? "on" : ""));
  for (const M of MAPS) {
    const open = mapOpen(h.level, M.id), here = w.map === M.id;
    const d = el("div", `tile map${here ? " here" : ""}${open ? "" : " locked"}`);
    d.innerHTML = `<b>${M.id}. ${M.name}</b> <small>Lv ${M.lv[0]}–${M.lv[1]}</small><br><small>Quái hệ ${M.elems.map((e) => ELEM_NAME[e]).join(", ")}${M.elems.filter((e) => e !== "neutral").length ? ` · khắc: ${M.elems.filter((e) => e !== "neutral").map((e) => ELEM_NAME[Object.keys(BEATS).find((k) => BEATS[k] === e)] ?? "?").join(", ")}` : ""} · đồ cấp ${M.id}${here ? ` · đã hạ ${w.kills}` : ""}</small>`;
    if (open && !here) d.appendChild(btn("Đến đây", () => { setMap(w, M.id) }));
    if (!open) d.appendChild(el("small", "lock", `🔒 Cần cấp ${M.lv[0]}`));
    p.appendChild(d);
  }
}

// ---- heroes and passives
function heroPic(cls) {
  try {
    const h = P.heroes[cls], t = h.gear.weapon ? h.gear.weapon.wtype : "fist", sh = A.q[`${cls}_${t}`] ?? A.q[`${cls}_fist`], pic = sh.pic, row = sh.moves.idle.row * sh.fh;
    const c = document.createElement("canvas"); c.width = sh.fw; c.height = sh.fh;
    const gg = c.getContext("2d"), im = gg.createImageData(sh.fw, sh.fh);
    for (let y = 0; y < sh.fh; y++) for (let x = 0; x < sh.fw; x++) { const v = pic.px[(row + y) * pic.w + x], i = (y * sh.fw + x) * 4; im.data[i] = v & 255; im.data[i + 1] = (v >>> 8) & 255; im.data[i + 2] = (v >>> 16) & 255; im.data[i + 3] = v >>> 24 }
    gg.putImageData(im, 0, 0);
    return c.toDataURL?.() ?? "";
  } catch { return "" }
}
function drawHeroes(p) {
  const list = el("div", "heroes");
  for (const c of CLASS_IDS) {
    const h = P.heroes[c], cur = P.current === c, url = heroPic(c);
    const d = el("div", `tile hero${cur ? " here" : ""}`);
    d.innerHTML = `${url ? `<img class="hero" src="${url}" alt="">` : ""}<b>${CLASSES[c].name}</b><small>Lv ${h.level} · ${mapOf(h.map).name}</small>`;
    if (!cur) d.appendChild(btn("Chơi", () => { notePace(heroOf(P), Math.max(1, paceT), pace.xp, pace.gold, pace.kills); paceT = 0; P.current = c; startBattle() }));
    list.appendChild(d);
  }
  p.appendChild(list);
  const h = heroOf(P);
  p.appendChild(el("h3", null, `Nội tại của ${CLASSES[h.cls].name} <small>(mua bằng 💎, tối đa cấp 10)</small>`));
  for (const ps of PASSIVE_TREE[h.cls]) {
    const l = h.passives[ps.id] ?? 0, c = passiveCost(l);
    const d = el("div", "tile passive", `<b>${ps.name}</b> <span class="lv">${l}/${ps.max}</span><br><small>+${(ps.per * 100).toFixed(1)}% ${ps.text} mỗi cấp · hiện +${(ps.per * l * 100).toFixed(1)}%</small>`);
    d.appendChild(btn(l >= ps.max ? "Tối đa" : `Nâng 💎 ${c}`, () => { buyPassive(P, h.cls, ps.id); refresh(w) }, l >= ps.max || P.crystals < c));
    p.appendChild(d);
  }
}

// ---- more: records, settings, the save
function drawMore(p) {
  const T = P.totals, hrs = (T.playSec / 3600).toFixed(1);
  p.appendChild(el("div", "tile", `<b>Thành tích</b><br><small>Đã hạ <b>${T.kills.toLocaleString("vi")}</b> quái · <b>${T.bosses}</b> boss · ngã ${T.deaths} lần · phân rã ${T.salvaged} món · chơi ${hrs} giờ<br>
    Cấp cao nhất: <b>${Math.max(...CLASS_IDS.map((c) => P.heroes[c].level))}</b> · Tổng cấp 6 nghề: <b>${CLASS_IDS.reduce((a, c) => a + P.heroes[c].level, 0)}</b></small>`));
  if (P.migratedFrom != null) p.appendChild(el("div", "tile", `<small>Đã chuyển từ bản thủ thành: giữ trang bị, hoàn ${P.refund ?? 0}💎 từ nâng cấp cũ.</small>`));
  const s = el("div", "tile");
  s.appendChild(el("b", null, "Lưu game"));
  s.appendChild(btn("Sao chép mã lưu", () => { const t = exportSave(P); navigator.clipboard?.writeText(t); toast("Đã sao chép mã lưu", 1800) }));
  s.appendChild(btn("Nhập mã lưu", () => { const t = prompt?.("Dán mã lưu:"); if (t) { try { P = importSave(t); startBattle(); toast("Đã nhập", 1800) } catch { toast("Mã lưu không hợp lệ", 2000) } } }));
  s.appendChild(btn("Chơi lại từ đầu", () => { if (confirm("Xóa toàn bộ tiến trình?")) { P = freshProfile(); startBattle() } }));
  p.appendChild(s);
  p.appendChild(el("p", "hint", `Mẹo: game vẫn tính khi bạn tắt (tối đa 8 giờ, 70% tốc độ gần nhất). ${inTelegram() ? "Tiến trình được lưu lên Telegram." : ""}`));
}

drawPanel();
drawTop();
