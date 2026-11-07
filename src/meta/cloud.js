// Saving to Telegram: inside a Telegram Mini App the save also goes to Telegram's CloudStorage (per user, on
// Telegram's servers, the same on every device). A value holds at most 4096 characters, so the save is cut into
// pieces: save_0 .. save_<n-1>, and save_meta = { n, at } names how many and when.
// Outside Telegram everything stays in localStorage, as before.

const tg = globalThis.Telegram?.WebApp;
const CS = tg?.CloudStorage;
const CHUNK = 3900;

/** In a Telegram Mini App that has CloudStorage (Bot API 6.9+)? */
export const inTelegram = () => !!(tg?.initData && CS && (tg.isVersionAtLeast?.("6.9") ?? true));
export const telegramUser = () => tg?.initDataUnsafe?.user ?? null;

const call = (fn, ...args) => new Promise((ok, fail) => CS[fn](...args, (err, res) => (err ? fail(err) : ok(res))));

/** The save text kept in Telegram, or null. */
export async function cloudLoad() {
  if (!inTelegram()) return null;
  const meta = JSON.parse((await call("getItem", "save_meta")) || "null");
  if (!meta?.n) return null;
  const keys = Array.from({ length: meta.n }, (_, i) => `save_${i}`);
  const parts = await call("getItems", keys);
  const text = keys.map((k) => parts[k] ?? "").join("");
  return text.length ? text : null;
}

/** Put the save text into Telegram (the pieces first, then the meta that points to them). */
export async function cloudSave(text) {
  if (!inTelegram()) return false;
  const n = Math.ceil(text.length / CHUNK);
  const old = JSON.parse((await call("getItem", "save_meta").catch(() => "null")) || "null");
  for (let i = 0; i < n; i++) await call("setItem", `save_${i}`, text.slice(i * CHUNK, (i + 1) * CHUNK));
  await call("setItem", "save_meta", JSON.stringify({ n, at: Date.now() }));
  if (old?.n > n) await call("removeItems", Array.from({ length: old.n - n }, (_, i) => `save_${n + i}`)).catch(() => {});
  return true;
}

/** Every `save` also goes to the cloud, a second after the last change (and at once when the app is hidden). */
export function cloudMirror(getText, onStatus = () => {}) {
  let timer = null, busy = false, again = false;
  const flush = async () => {
    clearTimeout(timer); timer = null;
    if (busy) { again = true; return }
    busy = true; onStatus("saving");
    try { await cloudSave(getText()); onStatus("saved") } catch (e) { onStatus("error", e) }
    busy = false;
    if (again) { again = false; flush() }
  };
  if (inTelegram()) document.addEventListener("visibilitychange", () => { if (document.hidden && timer) flush() });
  return { schedule() { if (!inTelegram()) return; clearTimeout(timer); timer = setTimeout(flush, 1000) }, flush };
}

/** Set the Mini App up: full height, no swipe-to-close while playing, the game's colours. */
export function telegramInit() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  try { tg.setHeaderColor?.("#120e18"); tg.setBackgroundColor?.("#120e18") } catch { /* older clients */ }
}
