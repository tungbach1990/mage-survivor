// The admin page: turn how strong the monsters, the skills and the reactions are, without touching code. Every
// field is a multiplier on the designed value (empty = as designed); it saves itself to localStorage and the
// game reads it live. "Chạy thử" plays the bot against the current numbers right here, so a change can be
// judged before anyone plays it.

import { T, setTuning, DEFAULT_TUNING, TUNING_KEY } from "./data/tuning.js?v=mw7naca9";
import { ENEMIES } from "./sim/enemies.js?v=mw7naca9";
import { SKILLS } from "./data/skills.js?v=mw7naca9";
import { ELEM, ELEMENTS, MARKS } from "./data/elements.js?v=mw7naca9";
import { CLASSES, CLASS_IDS } from "./data/classes.js?v=mw7naca9";
import { CODEX } from "./data/reactions.js?v=mw7naca9";
import { trial } from "./sim/bot.js?v=mw7naca9";

export function loadTuning(store) { try { setTuning(JSON.parse(store.getItem(TUNING_KEY) ?? "{}")) } catch { setTuning({}) } return T }
export function saveTuning(store) { store.setItem(TUNING_KEY, JSON.stringify(T)) }
/** Is anything off its designed value? */
export const tuned = () => JSON.stringify(T) !== JSON.stringify(DEFAULT_TUNING());

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (k.startsWith("on")) el[k] = v; else if (v !== undefined && v !== null) el.setAttribute(k, v);
  for (const c of kids.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
};

export function mountAdmin(root, { store, onBack }) {
  let tab = "monsters", skillCls = "all";
  const save = () => { saveTuning(store); status.textContent = tuned() ? "● Đang dùng cấu hình tùy chỉnh (đã lưu)" : "Cấu hình gốc" };
  const status = h("span", { class: "adm-status" });

  /**
   * A number input for an override: `get(create)` gives the object holding it (made on first change),
   * `key` its field, `def` the designed value. Empty or equal to it removes the override.
   */
  function num(get, key, def = 1, { step = 0.05, min = 0, clean } = {}) {
    const v = get(false)?.[key];
    const input = h("input", { type: "number", step, min, value: v ?? "", placeholder: String(+def.toFixed(3)) });
    if (v !== undefined && v !== def) input.classList.add("changed");
    input.onchange = () => {
      const x = input.value === "" ? undefined : +input.value, obj = get(true);
      if (x === undefined || x === def || Number.isNaN(x)) delete obj[key]; else obj[key] = x;
      input.classList.toggle("changed", obj[key] !== undefined);
      clean?.(); save();
    };
    return input;
  }
  /** A setting that always has a value (the tuning's own fields). */
  function field(obj, key, label, hint, step = 0.05) {
    const d = DEFAULT_TUNING();
    const def = key.split(".").reduce((o, k) => o?.[k], d);
    const [a, b] = key.split("."), holder = b ? obj[a] : obj, k = b ?? a;
    const input = h("input", { type: "number", step, value: holder[k] });
    if (holder[k] !== def) input.classList.add("changed");
    input.onchange = () => { holder[k] = input.value === "" ? def : +input.value; input.classList.toggle("changed", holder[k] !== def); save() };
    return h("label", { class: "adm-field", title: hint }, h("span", {}, label), input, h("small", {}, hint));
  }
  function toggle(get, clean) {
    const c = h("input", { type: "checkbox" });
    c.checked = !get(false)?.off;
    c.onchange = () => { const obj = get(true); if (c.checked) delete obj.off; else obj.off = true; clean(); save() };
    return c;
  }
  const slot = (map, id) => (map[id] ??= {});
  const prune = (map) => { for (const [k, v] of Object.entries(map)) { if (v.resist && !Object.keys(v.resist).length) delete v.resist; if (!Object.keys(v).length) delete map[k] } };

  const TABS = {
    monsters: ["Quái", () => [
      h("div", { class: "adm-row" },
        field(T, "monster.hp", "Máu ×", "mọi quái"), field(T, "monster.dmg", "Sát thương ×", "đánh tường, đánh triệu hồi"), field(T, "monster.speed", "Tốc độ ×", "đi bộ"),
        field(T, "monster.elite", "Tỉ lệ tinh anh ×", ""), field(T, "monster.kin", "Tỉ lệ quái nguyên tố ×", ""), field(T, "monster.extra", "Số quái đặc biệt ×", "dơi, cung thủ, pháp sư...")),
      h("p", { class: "hint" }, "Từng loài: hệ số máu / sát thương / tốc độ, và kháng từng nguyên tố (nhân sát thương nhận vào: 0,5 = chỉ nhận một nửa, 1,5 = nhận thêm 50%). Ô trống = giá trị thiết kế (chữ mờ)."),
      h("div", { class: "adm-scroll" }, h("table", { class: "adm" },
        h("tr", {}, h("th", {}, "Loài"), h("th", {}, "Máu×"), h("th", {}, "ST×"), h("th", {}, "Tốc×"), h("th", { title: "Hệ số sát thương vật lý nhận vào" }, "VL×"), ...ELEMENTS.map((el) => h("th", { title: ELEM[el].name, style: `color:rgb(${ELEM[el].color})` }, ELEM[el].icon))),
        ...Object.entries(ENEMIES).map(([type, def]) => {
          const clean = () => prune(T.types), own = (c) => (c ? slot(T.types, type) : T.types[type]);
          const cell = (key) => h("td", {}, num(own, key, 1, { clean }));
          return h("tr", {}, h("td", {}, `${def.name}${def.boss ? " (boss)" : ""}`), cell("hp"), cell("dmg"), cell("speed"), h("td", {}, num(own, "phys", def.phys ?? 1, { clean })),
            ...ELEMENTS.map((el) => h("td", {}, num((c) => (c ? (slot(T.types, type).resist ??= {}) : T.types[type]?.resist), el, def.resist?.[el] ?? 1, { clean }))));
        }))),
    ]],
    boss: ["Boss & tinh anh", () => [
      h("h3", {}, "Boss"),
      h("div", { class: "adm-row" },
        field(T, "boss.hp", "Máu ×", ""), field(T, "boss.dmg", "Sát thương ×", ""),
        field(T, "boss.ccMul", "Thời gian khống chế ×", "choáng/đóng băng/giữ chân/sợ ngắn lại"),
        field(T, "boss.poise", "Ngưỡng kháng (giây)", "tổng khống chế trước khi KHÔNG THỂ CẢN", 0.1),
        field(T, "boss.unstop", "Không thể cản (giây)", "miễn mọi khống chế, đẩy, hút", 0.5),
        field(T, "boss.slowFloor", "Tốc độ tối thiểu", "làm chậm không xuống dưới mức này"),
        field(T, "boss.enrage", "Nổi điên khi còn", "tỉ lệ máu (0 = tắt)"),
        field(T, "boss.charge", "Tần suất lao tới ×", "0 = tắt", 0.1)),
      h("h3", {}, "Tinh anh"),
      h("div", { class: "adm-row" },
        field(T, "elite.ccMul", "Thời gian khống chế ×", ""), field(T, "elite.poise", "Ngưỡng kháng (giây)", "", 0.1),
        field(T, "elite.unstop", "Không thể cản (giây)", "", 0.5), field(T, "elite.slowFloor", "Tốc độ tối thiểu", "")),
      h("h3", {}, "Triệu hồi"),
      h("div", { class: "adm-row" }, field(T, "summon.hp", "Máu ×", ""), field(T, "summon.dmg", "Sát thương ×", "")),
    ]],
    skills: ["Skill", () => [
      h("p", { class: "hint" }, "Hệ số sát thương và hồi chiêu của từng skill (hồi chiêu < 1 là nhanh hơn). Bỏ chọn để skill không còn xuất hiện trong thẻ."),
      h("div", { class: "adm-row" }, "Nghề: ", ...["all", ...CLASS_IDS].map((c) => h("button", { class: skillCls === c ? "on" : "", onclick: () => { skillCls = c; render() } }, c === "all" ? "Tất cả" : CLASSES[c].name))),
      h("div", { class: "adm-scroll" }, h("table", { class: "adm" },
        h("tr", {}, h("th", {}, ""), h("th", {}, "Skill"), h("th", {}, "Hệ"), h("th", {}, "Kiểu"), h("th", {}, "Sát thương×"), h("th", {}, "Hồi chiêu×"), h("th", {}, "Bật")),
        ...Object.entries(SKILLS).filter(([, s]) => skillCls === "all" || s.cls?.includes(skillCls)).map(([id, s]) => {
          const clean = () => prune(T.skills), o = (c) => (c ? slot(T.skills, id) : T.skills[id]);
          const row = h("tr", {}, h("td", {}, h("img", { src: `assets/sprites/${s.icon}.png`, class: "adm-icon" })), h("td", {}, s.name),
            h("td", {}, (s.elems ?? [s.elem]).map((e) => ELEM[e]?.icon ?? "✺").join("")), h("td", {}, s.kind),
            h("td", {}, num(o, "dmg", 1, { clean })), h("td", {}, num(o, "cd", 1, { clean })), h("td", {}, toggle(o, clean)));
          return row;
        }))),
    ]],
    reactions: ["Cộng hưởng", () => [
      h("p", { class: "hint" }, "Hệ số sát thương của từng phản ứng (cặp, tầng TRIAD→HEXA, bộ ba, CHAOS). Bỏ chọn để tắt phản ứng."),
      h("div", { class: "adm-scroll" }, h("table", { class: "adm" },
        h("tr", {}, h("th", {}, "Phản ứng"), h("th", {}, "Loại"), h("th", {}, "Mô tả"), h("th", {}, "Sát thương×"), h("th", {}, "Bật")),
        ...CODEX.filter((c) => c.kind !== "unstable").map((c) => {
          const o = (cr) => (cr ? slot(T.reactions, c.id) : T.reactions[c.id]), clean = () => prune(T.reactions);
          const kind = c.kind === "pair" ? c.elems.map((e) => ELEM[e].icon).join("+") : c.kind === "tier" ? `${c.n} hệ` : c.kind === "triad" ? c.elems.map((e) => ELEM[e].icon).join("") : "10 hệ";
          const row = h("tr", {}, h("td", { class: "lbl" }, c.label), h("td", {}, kind), h("td", { class: "desc" }, c.vi), h("td", {}, num(o, "dmg", 1, { clean })), h("td", {}, toggle(o, clean)));
          return row;
        }))),
    ]],
    elements: ["Nguyên tố & dấu", () => [
      h("p", { class: "hint" }, "Hệ số sát thương của mọi đòn mang từng nguyên tố hoặc dấu võ thuật (cộng dồn với thời tiết và môi trường)."),
      h("div", { class: "adm-row" }, ...MARKS.map((el) => h("label", { class: "adm-field" }, h("span", { style: `color:rgb(${ELEM[el].color})` }, `${ELEM[el].icon} ${ELEM[el].name}`), num(() => T.elements, el, 1)))),
    ]],
    test: ["Chạy thử", () => {
      const prof = h("select", {}, h("option", { value: "fresh" }, "Tài khoản mới"), h("option", { value: "half" }, "Nâng cấp một nửa"), h("option", { value: "full" }, "Nâng cấp đầy + đồ"));
      const ch = h("select", {}, ...[1, 2, 3, 4, 5].map((n) => h("option", { value: n }, `Chương ${n}`)));
      const seeds = h("input", { type: "number", value: 6, min: 1, max: 40, step: 1 });
      const out = h("table", { class: "adm" }, h("tr", {}, h("th", {}, "Cấu hình"), h("th", {}, "Thắng"), h("th", {}, "Đợt TB"), h("th", {}, "Boss bị khống chế"), h("th", {}, "Tốc độ boss"), h("th", {}, "CHAOS/lượt")));
      const prog = h("span", { class: "hint" });
      const go = h("button", { class: "big" }, "▶ Chạy");
      go.onclick = async () => {
        go.disabled = true;
        const n = +seeds.value, rs = [];
        for (let i = 1; i <= n; i++) { prog.textContent = `Đang chạy lượt ${i}/${n}…`; await new Promise((r) => setTimeout(r, 0)); rs.push(trial({ profile: prof.value, chapter: +ch.value }, [i])) }
        const avg = (k) => rs.reduce((a, r) => a + r[k], 0) / n;
        out.append(h("tr", {}, h("td", {}, `${prof.selectedOptions[0].text} · ch${ch.value} · ${tuned() ? "tùy chỉnh" : "gốc"}`), h("td", {}, `${rs.reduce((a, r) => a + r.won, 0)}/${n}`),
          h("td", {}, avg("waves").toFixed(1)), h("td", {}, `${(avg("bossHeld") * 100).toFixed(0)}%`), h("td", {}, `${(avg("bossSpeed") * 100).toFixed(0)}%`), h("td", {}, avg("chaos").toFixed(1))));
        prog.textContent = "Xong."; go.disabled = false;
      };
      return [h("p", { class: "hint" }, "Bot chơi trọn các lượt với cấu hình hiện tại (vài giây mỗi lượt). Mục tiêu gợi ý: chương 1 tài khoản mới thắng ≥ 60%, chương 3 nâng cấp một nửa ≈ 50%, chương 5 đầy đủ ≈ 40%."),
        h("div", { class: "adm-row" }, prof, ch, h("label", {}, "Số lượt ", seeds), go, prog), out];
    }],
  };

  function render() {
    root.innerHTML = "";
    const tabs = h("div", { class: "adm-tabs" }, ...Object.entries(TABS).map(([k, [label]]) => h("button", { class: tab === k ? "on" : "", onclick: () => { tab = k; render() } }, label)));
    const file = h("input", { type: "file", accept: ".json", hidden: true });
    file.onchange = async () => { try { setTuning(JSON.parse(await file.files[0].text())); save(); render() } catch { alert("File cấu hình không hợp lệ") } };
    const bar = h("div", { class: "adm-bar" },
      h("button", { onclick: onBack }, "← Sảnh"),
      h("button", { onclick: () => { if (confirm("Đưa mọi thông số về thiết kế gốc?")) { setTuning({}); save(); render() } } }, "Khôi phục gốc"),
      h("button", { onclick: () => { const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(T, null, 1)], { type: "application/json" })), download: "msd-tuning.json" }); a.click() } }, "Xuất cấu hình"),
      h("button", { onclick: () => file.click() }, "Nhập cấu hình"), file, status);
    root.append(h("h2", {}, "Quản trị cân bằng"), bar, tabs, h("div", { class: "adm-body" }, ...TABS[tab][1]()));
    save();
  }
  render();
}
