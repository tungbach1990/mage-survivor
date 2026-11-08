// The browser side: the hall (talents, elements, gear, codex, achievements, settings), the run setup, the
// fixed-step loop, the HUD, the cards, and settling a run back into the saved profile.

import { loadAssets, browserLoad } from "./assets.js?v=mw7naca9";
import { loadTuning, mountAdmin, tuned } from "./admin.js?v=mw7naca9";
import { inTelegram, telegramUser, telegramInit, cloudLoad, cloudMirror } from "./meta/cloud.js?v=mw7naca9";
import { createRenderer , PW, PH } from "./view.js?v=mw7naca9";
import { createWorld, step, drain, chooseCard, reroll, summary, xpNext } from "./sim/world.js?v=mw7naca9";
import { ENEMIES } from "./sim/enemies.js?v=mw7naca9";
import { SKILLS, stats } from "./data/skills.js?v=mw7naca9";
import { ELEM, ELEMENTS, MARTIAL } from "./data/elements.js?v=mw7naca9";
import { CODEX, REACTION_BY_ID } from "./data/reactions.js?v=mw7naca9";
import { CHAPTERS } from "./data/chapters.js?v=mw7naca9";
import { CLASSES, CLASS_IDS } from "./data/classes.js?v=mw7naca9";
import { PASSIVES, passiveCost } from "./data/passives.js?v=mw7naca9";
import { iconPixels, kindOf, lookOf, SLOT_NAMES, MATERIALS } from "./data/gear.js?v=mw7naca9";
import { dressHero } from "./render/dress.js?v=mw7naca9";
// an item's 12 x 12 icon as a picture (drawn once per kind and rarity)
const iconCache = new Map();
function itemIcon(it) {
  const key = [it.slot, it.cls, kindOf(it)[0], it.rarity].join("|");
  if (iconCache.has(key)) return iconCache.get(key);
  let url = "";
  try { const c = document.createElement("canvas"); c.width = c.height = 12; const g = c.getContext("2d"), im = g.createImageData(12, 12); im.data.set(iconPixels(it)); g.putImageData(im, 0, 0); url = c.toDataURL?.() ?? "" } catch { url = "" }
  iconCache.set(key, url);
  return url;
}
// the hero as dressed now, drawn into a canvas (idle frame)
function drawPreview(cls) {
  const cv = $("gear-preview"); if (!cv?.getContext) return;
  try {
    const s = dressHero(A.heroes?.[cls] ?? A.mage, cls, lookOf(pc(P, cls).gear)), p = s.pic, g = cv.getContext("2d"), im = g.createImageData(s.fw, p.h);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < s.fw; x++) { const v = p.px[y * p.w + x], i = (y * s.fw + x) * 4; im.data[i] = v & 255; im.data[i + 1] = (v >>> 8) & 255; im.data[i + 2] = (v >>> 16) & 255; im.data[i + 3] = v >>> 24 }
    g.clearRect?.(0, 0, cv.width, cv.height); g.putImageData(im, 0, 0);
  } catch { /* no canvas */ }
}
import { ENVS } from "./data/environments.js?v=mw7naca9";
import { ELEMENTAL, RESIST, WEAK, DUALS, kinElems, kinWeak } from "./data/bestiary.js?v=mw7naca9";
import { ENEMIES as KINDS } from "./sim/enemies.js?v=mw7naca9";
import { TALENT_TREES, talentCost, markCost, homeSchool, crossSchool, slotName, mageXpNext, SLOTS, RARITY, ACHIEVEMENTS, MAGE_PERKS } from "./data/meta.js?v=mw7naca9";
import { load, save, exportSave, importSave, freshProfile, runOptions, buyTalent, buyPassive, unlockMark, pc, marksOpen, itemName, equip, unequip, salvage, salvageValue, settle, refreshQuests, claimQuest, questText, classOpen, unlockClass, endlessOpen, chapterOpen, affixText, chaosUnlocked } from "./meta/profile.js?v=mw7naca9";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), g = canvas.getContext("2d"), img = g.createImageData(PW, PH);
const DT = 1 / 60;
const icon = (id) => `assets/sprites/${SKILLS[id].icon}.png`;
const WEATHER_TEXT = {
  rain: "🌧 Mưa: quái −20% tốc độ, bị Ướt · lửa −10%",
  lava: "🌋 Mưa dung nham: lửa +15% · băng −15%",
  thunder: "⚡ Mưa sét: sét +15% · tê liệt lâu hơn",
};

const A = await loadAssets(browserLoad, "assets/");
$("loading").hidden = true;

loadTuning(localStorage);   // the admin's numbers, if any
telegramInit();
// in Telegram, each player's save is their own (a shared phone keeps them apart), and mirrored to Telegram's cloud
const tgUser = telegramUser();
const store = tgUser ? { getItem: (k) => localStorage.getItem(`${k}.${tgUser.id}`), setItem: (k, v) => localStorage.setItem(`${k}.${tgUser.id}`, v) } : localStorage;
let P = load(store), cloudState = inTelegram() ? "loading" : "off";
try {
  const text = await cloudLoad();
  if (text) { const c = importSave(text); if ((c.savedAt ?? 0) > (P.savedAt ?? 0)) P = c }
  if (inTelegram()) cloudState = "saved";
} catch (e) { console.warn("cloud load failed", e); cloudState = "error" }
const mirror = cloudMirror(() => JSON.stringify(P), (s) => { cloudState = s; if (!$("menu").hidden) drawMenu() });
/** Save here, and (in Telegram) to the cloud a moment later. */
function persist() { save(store, P); mirror.schedule() }
refreshQuests(P);
persist();
let w = null, r = null, running = false, paused = false, acc = 0, last = 0, showFps = false, fpsN = 0, fpsT = 0, demo = null;
let pick = { chapter: Math.min(5, P.best.chapter + 1), endless: false, cls: P.lastClass ?? "mage" }, codexSchool = "arcane";

// ======================= the hall =======================
const PAGES = ["menu", "setup", "classes", "passives", "talents", "elements", "gear", "codex", "achievements", "settings", "admin"];
function go(page) {
  if (page === "quit") return finishRun(false);
  for (const p of PAGES) $(p).hidden = p !== page;
  $("summary").hidden = true;
  for (const el of document.querySelectorAll(".crys")) el.textContent = `💎 ${P.crystals}`;
  if (page === "admin") mountAdmin($("admin"), { store: localStorage, onBack: () => go("menu") });
  ({ menu: drawMenu, setup: drawSetup, classes: drawClasses, passives: drawPassives, talents: drawTalents, elements: drawElements, gear: drawGear, codex: drawCodex, achievements: drawAchievements })[page]?.();
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go) });

function drawMenu() {
  const next = mageXpNext(P.mageLevel);
  $("profile-line").innerHTML = `Tài khoản cấp <b>${P.mageLevel}</b> (${P.mageXp}/${next}) · 💎 <b>${P.crystals}</b> · Chương cao nhất: <b>${P.best.chapter}</b>${P.best.endless ? ` · Vô tận: <b>${P.best.endless}</b>` : ""} · Codex ${P.codex.length}/${CODEX.length}${cloudState === "off" ? "" : ` · ${{ loading: "☁ đang tải…", saving: "☁ đang lưu…", saved: "☁ đã lưu lên Telegram", error: "☁ lỗi lưu đám mây (vẫn lưu trên máy)" }[cloudState]}`}${tuned() ? ` · <b style="color:#ffb060">⚙ cấu hình cân bằng tùy chỉnh</b>` : ""}`;
}

const heroImg = (c) => `<img class="hero" src="assets/anims/${CLASSES[c].look}.png" alt="">`;
function drawSetup() {
  if (!classOpen(P, pick.cls)) pick.cls = "mage";
  const ch = $("chapters");
  ch.innerHTML = "";
  for (const c of CHAPTERS) {
    const open = chapterOpen(P, c.n), el = document.createElement("div");
    el.className = `tile chapter ${open ? "" : "locked"} ${!pick.endless && pick.chapter === c.n ? "sel" : ""}`;
    el.innerHTML = `<b>Chương ${c.n}</b><small>${c.name}</small><small>Máu quái x${c.hp} · tinh anh ${Math.round(c.elite * 100)}%</small>`;
    if (open) el.onclick = () => { pick.chapter = c.n; pick.endless = false; drawSetup() };
    ch.appendChild(el);
  }
  const en = document.createElement("div"), eo = endlessOpen(P);
  en.className = `tile chapter ${eo ? "" : "locked"} ${pick.endless ? "sel" : ""}`;
  en.innerHTML = `<b>Vô tận</b><small>${eo ? `Kỷ lục: đợt ${P.best.endless}` : "Mở sau chương 5"}</small>`;
  if (eo) en.onclick = () => { pick.endless = true; drawSetup() };
  ch.appendChild(en);
  // the class: one per run; it starts with its basic attack (no spell to pick)
  const st = $("starts");
  st.innerHTML = "";
  for (const c of CLASS_IDS) {
    const open = classOpen(P, c), b = P.best.byClass?.[c], el = document.createElement("div");
    el.className = `tile cls ${open ? "" : "locked"} ${pick.cls === c ? "sel" : ""}`;
    el.innerHTML = `${heroImg(c)}<b>${CLASSES[c].name}</b><small>${open ? (b ? `Chương ${b.chapter} · ${b.runs} lượt` : "Chưa chơi") : `🔒 ${CLASSES[c].cost} 💎 ở trang Nghề`}</small>`;
    if (open) el.onclick = () => { pick.cls = c; drawSetup() };
    st.appendChild(el);
  }
  $("start-hint").textContent = CLASSES[pick.cls].blurb;
}
function drawClasses() {
  const box = $("class-list");
  box.innerHTML = "";
  for (const c of CLASS_IDS) {
    const open = classOpen(P, c), d = document.createElement("div"), sk = Object.values(SKILLS).filter((s) => s.cls.includes(c) && !s.basic && s.elem !== "chaos");
    d.className = `tile cls-card ${open ? "on" : "locked"}`;
    d.innerHTML = `${heroImg(c)}<b>${CLASSES[c].name}</b><small>${CLASSES[c].blurb}</small><small>Đòn đánh thường: ${SKILLS[`basic_${c}`].name} · ${sk.length} skill · ${{ arcane: "10 nguyên tố", martial: "10 dấu võ thuật", both: "nguyên tố + võ thuật" }[CLASSES[c].school]}</small>`;
    if (!open) { const b = document.createElement("button"); b.textContent = `Mở 💎 ${CLASSES[c].cost}`; b.disabled = P.crystals < CLASSES[c].cost; b.onclick = () => { if (unlockClass(P, c)) { persist(); go("classes") } }; d.appendChild(b) }
    box.appendChild(d);
  }
}
$("go").onclick = () => startRun();

// the class the hall's pages are showing (talents, marks, gear): a bar of the classes the player has
let viewCls = P.lastClass ?? "mage", bagAll = false;
function classBar(page) {
  const bar = $(`${page}-classbar`);
  bar.innerHTML = "";
  if (!classOpen(P, viewCls)) viewCls = "mage";
  for (const c of CLASS_IDS.filter((x) => classOpen(P, x))) {
    const b = document.createElement("button");
    b.textContent = CLASSES[c].name; b.className = viewCls === c ? "on" : "";
    b.onclick = () => { viewCls = c; go(page) };
    bar.appendChild(b);
  }
}
// the passives: five per class, the first its own (level 1 from the start), each to level 10
function drawPassives() {
  classBar("passives");
  const box = $("passive-list"), mine = pc(P, viewCls).passives ?? {};
  box.innerHTML = "";
  for (const ps of PASSIVES[viewCls]) {
    const l = mine[ps.id] ?? 0, max = l >= ps.max, cost = passiveCost(ps, l), el = document.createElement("div");
    el.className = `tile passive ${l ? "on" : "locked"} ${ps.sig ? "sig" : ""}`;
    const now = l ? ps.text(ps.v(l)) : "Chưa học", next = max ? "" : `<small class="next">Cấp ${l + 1}: ${ps.text(ps.v(l + 1))}</small>`;
    el.innerHTML = `<b>${ps.sig ? "★ " : ""}${ps.name}</b> <small>cấp ${l}/${ps.max}${ps.sig ? " · đặc trưng" : ""}</small><small>${now}</small>${next}`;
    const b = document.createElement("button");
    b.textContent = max ? "Tối đa" : `${l ? "Nâng" : "Học"} 💎 ${cost}`;
    b.disabled = max || P.crystals < cost;
    b.onclick = () => { if (buyPassive(P, viewCls, ps.id)) { persist(); go("passives") } };
    el.appendChild(b);
    box.appendChild(el);
  }
}
function drawTalents() {
  classBar("talents");
  const box = $("talent-list"), mine = pc(P, viewCls).talents;
  box.innerHTML = "";
  for (const t of TALENT_TREES[viewCls]) {
    const l = mine[t.id] ?? 0, max = l >= t.max, cost = talentCost(t, l), el = document.createElement("div");
    el.className = `tile ${l ? "on" : ""} ${t.branch === "Đặc trưng" ? "sig" : ""}`;
    el.innerHTML = `<b>${t.name}</b> <small>${t.branch} · cấp ${l}/${t.max}</small><small>${t.text}</small>`;
    const b = document.createElement("button");
    b.textContent = max ? "Tối đa" : `💎 ${cost}`;
    b.disabled = max || P.crystals < cost;
    b.onclick = () => { if (buyTalent(P, viewCls, t.id)) { persist(); go("talents") } };
    el.appendChild(b);
    box.appendChild(el);
  }
}
function drawElements() {
  classBar("elements");
  const open = marksOpen(P, viewCls);
  for (const [id, list] of [["elem-list", ELEMENTS], ["mark-list", MARTIAL]]) {
    const box = $(id);
    box.innerHTML = "";
    for (const mk of list) {
      const has = open.includes(mk), cost = markCost(viewCls, mk), d = document.createElement("div");
      d.className = `tile mark ${has ? "on" : "locked"}`;
      const skills = Object.values(SKILLS).filter((s) => s.cls.includes(viewCls) && (s.elem === mk || s.also?.includes(mk)) && !s.basic).map((s) => s.name).slice(0, 4).join(", ");
      d.innerHTML = `<b style="color:rgb(${ELEM[mk].color})">${ELEM[mk].icon} ${ELEM[mk].name}</b><small>${skills || (crossSchool(viewCls, mk) ? "Tẩm qua trang bị" : "Thẻ tẩm đòn đánh thường")}</small>`;
      if (!has) { const b = document.createElement("button"); b.textContent = `Mở 💎 ${cost}`; b.disabled = P.crystals < cost; b.onclick = () => { if (unlockMark(P, viewCls, mk)) { persist(); go("elements") } }; d.appendChild(b) }
      box.appendChild(d);
    }
  }
  const ok = chaosUnlocked(P, viewCls), need = { arcane: "đủ 10 nguyên tố", martial: "đủ 10 dấu võ thuật", both: "10 dấu bất kỳ" }[homeSchool(viewCls)];
  $("chaos-note").innerHTML = `<b style="color:#ff8ac8">✺ CHAOS</b> · ${ok ? `Đã mở cho ${CLASSES[viewCls].name}: thức tỉnh đủ 10 dấu trong lượt để nhận Chaos Seed` : `${CLASSES[viewCls].name} cần mở ${need}`} · Dấu khác trường phái giá ×1,5 và đi vào trận qua trang bị tẩm dấu.`;
}
function itemTile(it, actions, dim = false) {
  const d = document.createElement("div");
  d.className = `tile item ${dim ? "locked" : ""}`;
  const ic = itemIcon(it), mat = MATERIALS[kindOf(it)[1]]?.name ?? "";
  d.innerHTML = `<div class="item-head">${ic ? `<img class="item-icon rar-b-${it.rarity}" src="${ic}" alt="">` : ""}<div><b class="rar-${it.rarity}">${itemName(it)}</b><small>${SLOT_NAMES[it.slot]} · ${mat} · ${CLASSES[it.cls]?.name ?? ""} · Chương ${it.chapter}</small></div></div><ul>${it.affixes.map((a) => `<li>${affixText(a)}</li>`).join("")}${it.legendary ? `<li class="rar-legendary">★ ${{ bh: "Hố Đen bán kính +50%", hexa: "Sát thương tầng +60%", slot: "+1 ô skill", aura: "Dấu kéo dài gấp rưỡi", resonance: "Sát thương phản ứng +50%", imbue2: "Tỉ lệ tẩm dấu ×2" }[it.legendary]}</li>` : ""}</ul>`;
  for (const [label, fn] of actions) { const b = document.createElement("button"); b.textContent = label; b.onclick = () => { fn(); persist(); go("gear") }; d.appendChild(b) }
  return d;
}
function drawGear() {
  classBar("gear");
  const slots = $("gear-slots"), gear = pc(P, viewCls).gear;
  slots.innerHTML = "";
  for (const s of Object.keys(SLOTS)) {
    const it = gear[s];
    if (it) slots.appendChild(itemTile(it, [["Tháo", () => unequip(P, viewCls, s)]]));
    else { const d = document.createElement("div"); d.className = "tile item empty"; d.innerHTML = `<b>${slotName(s, viewCls)}</b><small>Trống</small>`; slots.appendChild(d) }
  }
  drawPreview(viewCls);
  const filt = $("bag-filter");
  filt.innerHTML = "";
  for (const [all, label] of [[false, `Đồ ${CLASSES[viewCls].name}`], [true, "Tất cả"]]) { const b = document.createElement("button"); b.textContent = label; b.className = bagAll === all ? "on" : ""; b.onclick = () => { bagAll = all; go("gear") }; filt.appendChild(b) }
  const bag = $("bag"), list = P.bag.filter((it) => bagAll || it.cls === viewCls);
  bag.innerHTML = list.length ? "" : "<p class='hint'>Hạ boss bằng nghề này để nhận đồ của nó.</p>";
  for (const it of list) {
    const mine = it.cls === viewCls;
    bag.appendChild(itemTile(it, [...(mine ? [["Trang bị", () => equip(P, viewCls, it.id)]] : []), [`Phân rã +${salvageValue(it)}💎`, () => salvage(P, it.id)]], !mine));
  }
}
function drawCodex() {
  const bz = $("bestiary");
  bz.innerHTML = "";
  for (const [el, k] of Object.entries(ELEMENTAL)) {
    const d = document.createElement("div");
    d.className = "tile";
    d.innerHTML = `<b style="color:rgb(${ELEM[el].color})">${ELEM[el].icon} ${k.name}</b><small>Kháng ${ELEM[el].name} (chỉ nhận ${RESIST * 100}%) · yếu ${ELEM[k.weak].icon} ${ELEM[k.weak].name} (x${WEAK})</small><small>${k.trait}</small>`;
    bz.appendChild(d);
  }
  for (const [key, d] of Object.entries(DUALS)) {
    const els = kinElems(key), t = document.createElement("div");
    t.className = "tile";
    t.innerHTML = `<b>${els.map((e) => ELEM[e].icon).join("")} ${d.name} <small>(song hệ)</small></b><small>Kháng ${els.map((e) => ELEM[e].name).join(" + ")} · yếu ${kinWeak(key).map((e) => ELEM[e].icon + " " + ELEM[e].name).join(", ")}</small><small>Mang đặc điểm của cả hai hệ.</small>`;
    bz.appendChild(t);
  }
  const fmt = (r, f) => Object.entries(r ?? {}).filter(([, v]) => f(v)).map(([e, v]) => `${ELEM[e].icon}${v < 1 ? Math.round(v * 100) + "%" : "×" + v}`).join(" ") || "—";
  const role = (d) => [d.fly && "bay qua golem và mặt đất", d.ranged && "bắn tường từ xa", d.bomber && "tự nổ khi chạm", d.healer && "hồi máu đồng bọn", d.charger && "lao tới", d.boss && "boss: kháng khống chế, nổi điên, lao tới"].filter(Boolean).join(", ");
  for (const d of Object.values(KINDS)) {
    const t = document.createElement("div");
    t.className = "tile";
    t.innerHTML = `<b>${d.name}</b><small>Kháng: ${fmt(d.resist, (v) => v < 1)} · Yếu: ${fmt(d.resist, (v) => v > 1)}</small>${role(d) ? `<small>${role(d)}</small>` : ""}`;
    bz.appendChild(t);
  }
  const ev = $("envs");
  ev.innerHTML = "";
  for (const e of Object.values(ENVS)) { const d = document.createElement("div"); d.className = "tile"; d.innerHTML = `<b>${e.icon} ${e.name}</b><small>${e.vi}</small>`; ev.appendChild(d) }
  $("codex-count").textContent = `${P.codex.length}/${CODEX.length}`;
  // two books: the elemental reactions and the martial combos (tiers and CHAOS belong to both)
  const tabs = $("codex-tabs");
  tabs.innerHTML = "";
  for (const [k, label] of [["arcane", "Nguyên tố"], ["martial", "Võ thuật"]]) { const b = document.createElement("button"); b.textContent = label; b.className = codexSchool === k ? "on" : ""; b.onclick = () => { codexSchool = k; drawCodex() }; tabs.appendChild(b) }
  const box = $("codex-list");
  box.innerHTML = "";
  for (const c of CODEX.filter((x) => !x.school || x.school === codexSchool)) {
    const known = P.codex.includes(c.id), d = document.createElement("div");
    d.className = `tile codex ${known ? "" : "unknown"}`;
    const tag = c.kind === "pair" || c.kind === "triad" ? c.elems.map((e) => ELEM[e].icon).join(" ") : c.kind === "tier" ? `${c.n} dấu` : c.kind === "chaos" ? "10 dấu" : "7–9 dấu";
    d.innerHTML = known ? `<span class="lbl">${c.label}</span> <small>${tag} · ${P.counts[c.id] ?? 0} lần</small><small>${c.vi}</small>` : `<span class="lbl">???</span> <small>${c.kind === "pair" ? tag : "Chưa khám phá"}</small>`;
    box.appendChild(d);
  }
}
function drawAchievements() {
  refreshQuests(P);
  const ql = $("quest-list");
  ql.innerHTML = "";
  P.quests.list.forEach((q, i) => {
    const d = document.createElement("div");
    d.className = `tile quest ${q.done ? "done" : ""}`;
    d.style.width = "420px";
    d.innerHTML = `<b>${questText(q)}</b> <small>${Math.min(q.progress, q.goal)}/${q.goal}</small>`;
    if (q.done && !q.claimed) { const b = document.createElement("button"); b.textContent = "Nhận thưởng"; b.onclick = () => { claimQuest(P, i); persist(); go("achievements") }; d.appendChild(b) }
    else if (q.claimed) d.innerHTML += " <small>✔ Đã nhận</small>";
    ql.appendChild(d);
  });
  $("ach-count").textContent = `${P.achievements.length}/${ACHIEVEMENTS.length}`;
  const box = $("ach-list");
  box.innerHTML = "";
  for (const a of ACHIEVEMENTS) {
    const done = P.achievements.includes(a.id), d = document.createElement("div");
    d.className = `tile ${done ? "on" : "locked"}`;
    d.innerHTML = `<b>${done ? "★" : "☆"} ${a.name}</b><small>${a.text} · 💎 ${a.reward}</small>`;
    box.appendChild(d);
  }
}
$("export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([exportSave(P)], { type: "application/json" }));
  a.download = `msd-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};
$("import").onchange = async (e) => { try { P = importSave(await e.target.files[0].text()); persist(); go("menu") } catch { alert("File lưu không hợp lệ") } };
$("reset").onclick = () => { if (confirm("Xóa toàn bộ tiến độ?")) { P = freshProfile(); refreshQuests(P); persist(); go("menu") } };

// ======================= a run =======================
function startRun() {
  const opts = runOptions(P, { chapter: pick.chapter, endless: pick.endless, cls: pick.cls });
  w = createWorld((Math.random() * 1e9) | 0, opts);
  r = createRenderer(A);
  demo = null; acc = 0; paused = false; running = true;
  for (const p of PAGES) $(p).hidden = true;
  $("hud").hidden = false;
  buildSlots(); buildSigils();
}
function finishRun(won) {
  if (!w || demo) return;
  running = false; paused = false;
  $("pause").hidden = true; $("cards").hidden = true;
  const sum = summary(w), out = settle(P, sum, { seed: w.seed });
  persist();
  $("sum-title").textContent = won ? "CHIẾN THẮNG!" : w.wall.hp <= 0 ? "TƯỜNG ĐÃ SỤP" : "KẾT THÚC LƯỢT";
  const items = out.items.map((it) => `<span class="rar-${it.rarity}">${itemName(it)}</span>`).join(", ");
  $("sum-body").innerHTML = `
    <p>${sum.endless ? "Vô tận" : `Chương ${sum.chapter}`} · qua <b>${sum.waves}</b> đợt · hạ <b>${sum.kills}</b> quái · cấp <b>${sum.level}</b> · thức tỉnh <b>${sum.awakened.length}</b>/10 nguyên tố${sum.chaos ? ` · <b style="color:#ff8ac8">${sum.chaos} lần CHAOS</b>` : ""}</p>
    <p>💎 +<b>${out.crystals}</b>${out.mageLevels ? ` · Tài khoản lên <b>${out.mageLevels}</b> cấp` : ""}</p>
    ${out.discovered.length ? `<p>Khám phá mới: ${out.discovered.map((k) => `<b>${REACTION_BY_ID[k]?.label ?? k}</b>`).join(", ")}</p>` : ""}
    ${items ? `<p>Đồ rơi: ${items}</p>` : ""}
    ${out.achievements.length ? `<p>Thành tích: ${out.achievements.map((a) => `★ ${a.name} (+${a.reward}💎)`).join(", ")}</p>` : ""}
    ${out.quests.length ? `<p>Nhiệm vụ xong: ${out.quests.map(questText).join(", ")} — nhận thưởng ở Thành tích</p>` : ""}
    ${dmgTable(sum.dmgSrc)}`;
  $("summary").hidden = false;
  $("hud").hidden = true;
  startDemo();
}

// the hall's backdrop: a quiet chapter-1 field
function startDemo() { demo = createWorld(1, { skills: { firebolt: 2, icebolt: 1, lightbolt: 1 } }); w = demo; r = createRenderer(A); running = true }

// ---------- the loop ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  let stepped = false;
  if (running && !paused) {
    acc += dt;
    while (acc >= DT) {
      stepped = true;
      acc -= DT;
      if (w.hitstop > 0) { w.hitstop -= DT; r.update(w, [], DT, true) }
      else { step(w, DT); handle(drain(w)) }
      if (!running) break;
    }
  }
  // draw only when the world moved (a 144 Hz screen doesn't draw 144 times a second for 60 steps), and the
  // hall's backdrop at half rate; the HUD at most 20 times a second
  if (stepped) ticks++;
  const due = stepped && (!demo || (ticks & 1) === 0);
  if (w && due) {
    img.data.set(r.draw(w)); g.putImageData(img, 0, 0);
    if (!demo && now - hudAt > 50) { hudAt = now; hud() }
  }
  if (due) fpsN++;
  fpsT += dt;
  if (fpsT >= 0.5) { const s = r ? r.stats() : {}; $("fps").textContent = `${Math.round(fpsN / fpsT)} fps · vẽ ${s.ms ?? 0} ms · ${s.fx ?? 0} fx · chất lượng ${["cao", "vừa", "thấp"][s.quality ?? 0]}`; fpsN = 0; fpsT = 0 }
}
function handle(events) {
  r.update(w, events, DT);
  if (demo) { if (w.phase === "cards") chooseCard(w, 0); if (w.phase === "lost" || w.phase === "won") startDemo(); return }
  for (const ev of events) {
    if (ev.type === "wave") banner(ev.endless ? `VÔ TẬN · ĐỢT ${ev.n}` : ev.n === ev.total ? "ĐỢT CUỐI!" : `ĐỢT ${ev.n}`);
    else if (ev.type === "cards") showCards();
    else if (ev.type === "card") { buildSlots(); if (ev.card.kind === "fuse") banner(`HỢP THỂ: ${SKILLS[ev.card.id].name.toUpperCase()}`) }
    else if (ev.type === "levelUp") toast(`⬆ Cấp ${ev.level}`);
    else if (ev.type === "won") finishRun(true);
    else if (ev.type === "lost") finishRun(false);
    else if (ev.type === "weatherStart") banner({ rain: "MƯA!", lava: "MƯA DUNG NHAM!", thunder: "MƯA SÉT!" }[ev.kind]);
    else if (ev.type === "discover") toast(`✦ KHÁM PHÁ: ${REACTION_BY_ID[ev.kind]?.label ?? ev.kind}`);
    else if (ev.type === "awaken") { toast(`${ELEM[ev.elem].icon} ${ELEM[ev.elem].name} thức tỉnh!`); buildSigils() }
    else if (ev.type === "chaosAwake") banner("CHAOS AWAKENS");
    else if (ev.type === "reaction" && ev.kind === "chaos") banner("✺ CHAOS ✺");
    else if (ev.type === "boss") banner(ev.name);
    else if (ev.type === "env" && ev.kind !== "clear") toast(`${ENVS[ev.kind].icon} ${ENVS[ev.kind].name}: ${ENVS[ev.kind].vi}`, 6000);
    else if (ev.type === "bossPhase") toast(ev.shieldBy === "tier" ? "Khiên boss: chỉ phản ứng TẦNG (3+ nguyên tố) phá được" : "Khiên boss: phá bằng phản ứng");
  }
}

// ---------- HUD ----------
function buildSlots() {
  const box = $("skills");
  box.innerHTML = "";
  for (const id of Object.keys(w.skills)) {
    const s = document.createElement("div"), sk = SKILLS[id];
    s.className = `slot ${sk.kind === "passive" ? "passive" : ""} ${sk.elem === "chaos" ? "chaos" : ""}`;
    s.dataset.id = id;
    s.title = `${sk.name}: ${sk.desc}`;
    s.style.borderColor = ELEM[sk.elem] ? `rgb(${ELEM[sk.elem].color})` : "";
    s.innerHTML = `<img src="${icon(id)}" alt=""><div class="cd"></div><span class="lv"></span>`;
    box.appendChild(s);
  }
}
function buildSigils() {
  const box = $("sigils");
  box.innerHTML = "";
  for (const el of w.schoolMarks ?? ELEMENTS) { const d = document.createElement("div"); d.className = "sigil"; d.dataset.el = el; d.style.color = `rgb(${ELEM[el].color})`; d.textContent = ELEM[el].icon; d.title = ELEM[el].name; box.appendChild(d) }
}
// the HUD writes to the page only what changed (each write can cost the browser a restyle)
let hudAt = 0, ticks = 0;
const shown = new Map();
function set(el, prop, v) {
  const key = el.id + "|" + (el.dataset?.id ?? el.dataset?.el ?? "") + "|" + prop;
  if (shown.get(key) === v) return;
  shown.set(key, v);
  if (prop === "text") el.textContent = v; else if (prop === "hidden") el.hidden = v; else if (prop === "class") el.className = v; else el.style[prop] = v;
}
function hud() {
  set($("wall-fill"), "width", `${((100 * w.wall.hp) / w.wall.max).toFixed(1)}%`);
  set($("wall-text"), "text", `${Math.ceil(w.wall.hp)}/${w.wall.max}`);
  set($("wave"), "text", w.endless ? `Vô tận · đợt ${w.wave + 1}` : `Chương ${w.chapter} · đợt ${Math.min(w.wave + 1, 10)}/10`);
  set($("lvl"), "text", `Lv ${w.level}`);
  set($("xp-fill"), "width", `${Math.min(100, (100 * w.xp) / xpNext(w.level)).toFixed(1)}%`);
  for (const s of $("skills").children) {
    const sk = w.skills[s.dataset.id];
    if (!sk) continue;
    const cd = stats(s.dataset.id, sk.level).cd || 1;
    const cdEl = s.querySelector(".cd"), lvEl = s.querySelector(".lv");
    cdEl.id = lvEl.id = "slot-" + s.dataset.id;
    set(cdEl, "height", `${Math.round(Math.max(0, Math.min(1, sk.cd / cd)) * 20) * 5}%`);
    set(lvEl, "text", String(sk.level));
  }
  for (const d of $("sigils").children) {
    const el = d.dataset.el, n = w.elemReacts[el] ?? 0;
    const u = Math.min(1, n / 10);
    set(d, "class", w.awakened.has(el) ? "sigil awake" : "sigil");
    set(d, "filter", w.awakened.has(el) ? "" : `grayscale(${(1 - u).toFixed(1)}) brightness(${(0.5 + 0.5 * u).toFixed(2)})`);
  }
  const boss = w.enemies.find((e) => ENEMIES[e.type].boss && e.hp > 0);
  set($("boss"), "hidden", !boss);
  if (boss) {
    set($("boss-name"), "text", CHAPTERS[Math.min(5, w.chapter) - 1].boss.name + (boss.tenacity?.unstop > 0 ? " · KHÔNG THỂ CẢN" : boss.enraged ? " · NỔI ĐIÊN" : ""));
    set($("boss-fill"), "width", `${((100 * boss.hp) / boss.max).toFixed(1)}%`);
    set($("boss-shield"), "width", `${((100 * boss.shield) / boss.max).toFixed(1)}%`);
    set($("boss-hint"), "text", boss.shield > 0 ? (boss.shieldBy === "tier" ? "Khiên: TRIAD+ phá thẳng, đòn thường mài dần (Phá giáp mài nhanh)" : "Khiên: phản ứng phá thẳng, đòn thường mài dần (Phá giáp mài nhanh)") : "");
  }
  const E = ENVS[w.env] ?? ENVS.clear, eb = $("env");
  set(eb, "text", `${E.icon} ${E.name}`); eb.title = E.vi;
  const wx = w.weather.kind, b = $("weather");
  set(b, "hidden", !wx);
  if (wx) { set(b, "class", `badge ${wx}`); set(b, "text", WEATHER_TEXT[wx]) }
  set($("fps"), "hidden", !showFps);
}
// the damage report: who did the work this run (skills, combos and tiers, the black hole, damage over time)
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : String(Math.round(n)));
function dmgName(k) {
  if (k === "@chaos") return ["✺ Hố Đen (CHAOS)", "#ff8ac8"];
  if (k === "@dot") return ["🩸 Chảy máu / Nọc / Độc", "#c44a4a"];
  if (k === "@other") return ["Khác (gai tường, nổ, ...)", "#8a809a"];
  if (k.startsWith("#")) { const r = REACTION_BY_ID[k.slice(1)]; return [`⚗ ${r?.label ?? k.slice(1)}`, "#ffe286"] }
  const sk = SKILLS[k];
  return [sk?.name ?? k, sk && ELEM[sk.elem] ? `rgb(${ELEM[sk.elem].color})` : "#d8cce8"];
}
function dmgTable(src) {
  const rows = Object.entries(src ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return "";
  const total = rows.reduce((a, [, v]) => a + v, 0), top = rows.slice(0, 8), rest = rows.slice(8).reduce((a, [, v]) => a + v, 0);
  if (rest > 0) top.push(["@rest", rest]);
  const lines = top.map(([k, v]) => {
    const [name, col] = k === "@rest" ? [`… ${rows.length - 8} nguồn khác`, "#6a6080"] : dmgName(k), pct = (v / total) * 100;
    return `<div class="dmg-row"><span class="dmg-name">${name}</span><span class="dmg-bar"><i style="width:${pct.toFixed(1)}%;background:${col}"></i></span><span class="dmg-num">${fmt(v)} · ${pct < 1 ? "<1" : Math.round(pct)}%</span></div>`;
  }).join("");
  return `<div class="dmg-box"><h3>Thống kê sát thương <small>tổng ${fmt(total)}</small></h3>${lines}</div>`;
}

function banner(text) {
  const b = $("banner");
  b.hidden = false; b.textContent = text;
  b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
  clearTimeout(banner.t); banner.t = setTimeout(() => (b.hidden = true), 2200);
}
function toast(text, ms = 3000) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = text;
  t.style.animationDuration = `${ms}ms`;
  $("toasts").appendChild(t);
  setTimeout(() => t.remove(), ms);
  while ($("toasts").children.length > 5) $("toasts").firstChild.remove();
}

// ---------- cards ----------
function showCards() {
  $("cards-title").textContent = w.cardReason === "level" ? `Lên cấp ${w.level}!` : `Qua đợt ${w.wave + 1}`;
  $("reroll-hint").textContent = w.rerolls > 0 ? `R: đổi thẻ (${w.rerolls})` : "";
  $("reroll-btn").hidden = !(w.rerolls > 0);
  $("reroll-btn").textContent = `🎲 Đổi thẻ (${w.rerolls})`;
  const list = $("card-list");
  list.innerHTML = "";
  w.cards.forEach((c, i) => {
    const el = document.createElement("div"), sk = c.id && SKILLS[c.id];
    el.className = `card ${c.elem === "chaos" ? "chaos" : ""}`;
    if (c.elem && ELEM[c.elem]) el.style.borderColor = `rgb(${ELEM[c.elem].color})`;
    const pic = sk ? `<img src="${icon(c.id)}" alt="">` : c.kind === "mastery" ? `<div style="font-size:32px;color:rgb(${ELEM[c.elem].color})">${ELEM[c.elem].icon}</div>` : `<div style="font-size:30px">${{ stat: "✦", react: "⚗", repair: "🧱", fortify: "🛡" }[c.kind] ?? "✦"}</div>`;
    el.innerHTML = `<span class="key">[${i + 1}]</span>${pic}<h3>${c.title}</h3><p>${c.text}</p>`;
    el.onclick = () => pickCard(i);
    list.appendChild(el);
  });
  $("cards").hidden = false;
}
function pickCard(i) {
  if (!w || demo || w.phase !== "cards") return;
  if (chooseCard(w, i)) { $("cards").hidden = true; handle(drain(w)) }
}

// ---------- input ----------
addEventListener("keydown", (e) => {
  if (e.code === "KeyP") togglePause()
  else if (e.code === "KeyF") showFps = !showFps;
  else if (e.code === "KeyR" && w?.phase === "cards" && !demo) { if (reroll(w)) { drain(w); showCards() } }
  else if (/^Digit[1-4]$/.test(e.code)) pickCard(+e.code.slice(5) - 1);
});

// touch: a pause button on the HUD, a reroll button on the cards
function togglePause() { if (!running || demo || w.phase === "cards") return; paused = !paused; $("pause").hidden = !paused }
$("pause-btn").onclick = togglePause;
$("resume").onclick = togglePause;
$("reroll-btn").onclick = () => { if (w?.phase === "cards" && !demo && reroll(w)) { drain(w); showCards() } };
// the admin page isn't for players: in Telegram it shows only with #admin on the link
if (inTelegram() && location.hash !== "#admin") document.querySelector(".admin-btn")?.remove();

go("menu");
startDemo();
requestAnimationFrame(frame);
void MAGE_PERKS;
