#!/usr/bin/env node
/**
 * formulario-que-no-miente — prueba un formulario como lo haría un usuario
 * y como lo haría un lector de pantalla.
 *
 *   node formulario.mjs ./fixture/bad.html
 *   node formulario.mjs https://tuweb.com/contacto --submit "Enviar"
 *
 * No envía nada real: intercepta POST/PUT y los cuenta.
 * Sale con 1 si alguna prueba falla.
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

process.on("uncaughtException", (e) => {
  console.error(`error: ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(2);
});

const DEFAULTS = { url: null, out: "shots", width: 1280, height: 900, wait: 700, settle: 250 };

function readConfig(file, required = true) {
  if (!file) return {};
  if (!existsSync(file)) {
    if (required) throw new Error(`no existe el config: ${file}`);
    return {};
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

function parse(argv) {
  const flags = {};
  let url = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const k = eq === -1 ? a.slice(2) : a.slice(2, eq);
      if (eq !== -1) {
        flags[k] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) throw new Error(`--${k} necesita un valor`);
        flags[k] = argv[++i];
      }
    } else url = a;
  }
  const { config, ...overrides } = flags;
  const opts = { ...DEFAULTS, ...readConfig(new URL("./config.json", import.meta.url), false), ...readConfig(config), ...overrides };
  for (const k of Object.keys(overrides)) if (!(k in DEFAULTS)) throw new Error(`flag desconocido --${k}`);
  if (!url) url = opts.url;
  if (!url) throw new Error("uso: formulario <url-o-ruta> [--out shots]");
  const out = {
    ...opts,
    url,
    width: Number(opts.width),
    height: Number(opts.height),
    wait: Number(opts.wait),
    settle: Number(opts.settle),
  };
  for (const k of ["width", "height", "wait", "settle"]) {
    if (!Number.isFinite(out[k]) || out[k] < 0) throw new Error(`--${k} inválido: ${out[k]}`);
  }
  if (typeof out.out !== "string" || !out.out) throw new Error("--out necesita un nombre de carpeta");
  return out;
}

const toUrl = (u) => (/^https?:\/\//.test(u) ? u : pathToFileURL(resolve(u)).href);

const FIELDS = `(() => {
  const out = [];
  const els = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll("input, textarea, select")) els.push(el);
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
  for (const el of els) {
    const t = (el.getAttribute("type") || el.tagName).toLowerCase();
    if (["submit", "button", "reset", "image", "file", "hidden"].includes(t)) continue;
    if (el.disabled) continue;
    const label = el.labels && el.labels.length
      ? (el.labels[0].innerText || "").trim()
      : "";
    const named = label ||
      (el.getAttribute("aria-label") || "").trim() ||
      (el.getAttribute("aria-labelledby")
        ? (document.getElementById(el.getAttribute("aria-labelledby")) || {}).innerText || ""
        : "").trim() ||
      (el.getAttribute("title") || "").trim();
    out.push({
      name: el.getAttribute("name") || el.id || el.tagName.toLowerCase(),
      type: t,
      label: (named || "").trim(),
      autocomplete: (el.getAttribute("autocomplete") || "").toLowerCase(),
      required: el.required === true || el.getAttribute("aria-required") === "true",
    });
  }
  return out;
})()`;

function setValues(value) {
  const setNative = (el, v) => {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype
      : el.tagName === "SELECT" ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value") && Object.getOwnPropertyDescriptor(proto, "value").set;
    if (setter) setter.call(el, v);
    else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const els = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll("input, textarea, select")) els.push(el);
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
  for (const el of els) {
    const t = (el.getAttribute("type") || el.tagName).toLowerCase();
    if (["submit", "button", "reset", "image", "file", "hidden"].includes(t)) continue;
    if (el.disabled) continue;
    if (t === "checkbox" || t === "radio") {
      el.checked = value !== "__empty__";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      continue;
    }
    if (value === "__empty__") {
      if (el.tagName === "SELECT") setNative(el, "");
      else setNative(el, "");
      continue;
    }
    if (el.tagName === "SELECT") {
      const opts = [...el.options].filter((o) => o.value !== "");
      if (opts.length) setNative(el, opts[Math.min(1, opts.length - 1)].value);
      continue;
    }
    const sample =
      t === "email" ? "prueba@example.com" :
      t === "tel" ? "600123456" :
      t === "url" ? "https://example.com" :
      t === "number" ? "3" :
      t === "date" ? "2026-01-01" :
      t === "password" ? "Passw0rd!123" :
      t === "search" ? "prueba" : "Texto de prueba";
    setNative(el, value === "__spaces__" ? "   " : sample);
  }
}

const STATE = `(() => ({
  url: location.href,
  active: document.activeElement
    ? (document.activeElement.getAttribute("name") || document.activeElement.tagName.toLowerCase())
    : null,
  invalid: [...document.querySelectorAll("[aria-invalid='true']")].map((e) => e.getAttribute("name") || e.id),
  live: [...document.querySelectorAll("[aria-live], [role='alert']")]
    .map((e) => (e.innerText || "").trim()).filter(Boolean),
  visibleErrors: [...document.querySelectorAll("[class*='error'], [data-error], .error, .invalid")]
    .filter((e) => e.offsetParent !== null && (e.innerText || "").trim()).length,
}))()`;

const { url, out, width, height, wait, settle } = parse(process.argv.slice(2));

const browser = await chromium.launch();
// sin service workers: se saltan page.route y el formulario saldría a la red de verdad
const page = await browser.newPage({ viewport: { width, height }, serviceWorkers: "block" });

let posts = 0;
let navs = 0;
let submitting = false;
let loading = false;
const reset = () => { posts = 0; navs = 0; };

await page.route("**/*", async (route) => {
  const req = route.request();
  if (["POST", "PUT", "PATCH"].includes(req.method())) {
    posts++;
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  }
  // un formulario GET navega con los datos: se corta para no enviarlos de verdad.
  // Las navegaciones que hacemos nosotros (load) no se tocan.
  if (!loading && submitting && req.method() === "GET" && req.resourceType() === "document") {
    navs++;
    return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>cortado</title>" });
  }
  return route.continue();
});

const load = async () => {
  loading = true;
  try {
    await page.goto(toUrl(url), { waitUntil: "load" });
    // `load` no espera a las webfonts: sin esto se mide con la fuente de respaldo
    await page.evaluate(() => document.fonts.ready.then(() => true));
  } finally {
    loading = false;
  }
  await page.waitForTimeout(settle);
};

const submit = async () => {
  const loc = page.locator('button[type="submit"], input[type="submit"], form button').first();
  try {
    await loc.click({ timeout: 3000 });
    return true;
  } catch {
    return false;
  }
};

/** Ejecuta un envío y devuelve los intentos contados y si el botón se pudo pulsar. */
const attempt = async () => {
  submitting = true;
  const clicked = await submit();
  await page.waitForTimeout(wait);
  submitting = false;
  return { attempts: posts + navs, clicked };
};

await load();
const fields = await page.evaluate(FIELDS);
if (!fields.length) {
  console.error("no se encontraron campos de formulario");
  process.exit(2);
}

const results = [];
const add = (name, ok, detail) => results.push({ name, ok, detail });

// 1. nombre accesible en cada campo
const nameless = fields.filter((f) => !f.label);
add("nombre accesible", nameless.length === 0, nameless.length ? nameless.map((f) => f.name).join(", ") : `${fields.length} campos`);

// 2. envío vacío bloqueado
reset();
await page.evaluate(setValues, "__empty__");
const empty = await attempt();
let st = await page.evaluate(STATE);
add(
  "envío vacío bloqueado",
  empty.clicked && empty.attempts === 0,
  !empty.clicked ? "no se pudo pulsar el botón de envío" : empty.attempts === 0 ? "0 peticiones" : `${empty.attempts} peticiones enviadas`,
);

// 3. error anunciado (aria-live o role=alert) y campo marcado
const announced = st.live.length > 0;
const marked = st.invalid.length > 0;
add(
  "error anunciado",
  announced && marked,
  announced ? (marked ? st.live[0].slice(0, 40) : "hay aria-live pero ningún aria-invalid") : "sin aria-live ni role=alert",
);

// 4. el foco vuelve a un campo marcado como inválido
add(
  "foco al primer error",
  st.invalid.length > 0 && st.invalid.includes(st.active),
  st.invalid.length ? `foco en ${st.active}` : "ningún campo con aria-invalid",
);
const visibleErrors = st.visibleErrors;

// 5. solo espacios no cuenta como relleno
await load();
reset();
await page.evaluate(setValues, "__spaces__");
const spaces = await attempt();
st = await page.evaluate(STATE);
add(
  "espacios no cuentan",
  spaces.clicked && spaces.attempts === 0,
  !spaces.clicked ? "no se pudo pulsar el botón de envío" : spaces.attempts === 0 ? "0 peticiones" : `${spaces.attempts} peticiones enviadas`,
);

// 6. doble clic no duplica el envío
await load();
reset();
await page.evaluate(setValues, "__fill__");
const filled = await page.evaluate(() => {
  const els = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll("input, textarea")) els.push(el);
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
  return els.map((e) => e.value).filter(Boolean).length;
});
const loc = page.locator('button[type="submit"], input[type="submit"], form button').first();
submitting = true;
await loc
  .evaluate((el) => {
    el.click();
    el.click();
  })
  .catch(() => {});
await page.waitForTimeout(wait);
submitting = false;
const doubleAttempts = posts + navs;
add(
  "doble envío",
  filled > 0 && doubleAttempts === 1,
  filled === 0 ? "no se pudieron rellenar los campos" : `${doubleAttempts} peticiones con doble clic`,
);

// 7. autocompletado en campos conocidos
const want = (f) =>
  f.type === "email" || /email|correo/i.test(f.name) ? ["email", "username"]
  : f.type === "tel" || /tel|phone|movil/i.test(f.name) ? ["tel"]
  : /nombre|name/i.test(f.name) ? ["name", "given-name", "family-name"]
  : null;
const missing = fields.filter((f) => want(f) && !want(f).includes(f.autocomplete)).map((f) => f.name);
add("autocompletado", missing.length === 0, missing.length ? `sin autocomplete: ${missing.join(", ")}` : "ok");

if (visibleErrors || results.some((r) => !r.ok)) {
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: `${out}/formulario.png`, fullPage: true });
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\nformulario: ${url}`);
console.log(`${fields.length} campos, ${results.length} pruebas\n`);
for (const r of results) {
  console.log(`  ${r.ok ? "OK   " : "FALLO"}  ${r.name.padEnd(22)} ${r.detail}`);
}
if (failed.length) {
  console.log(`\nfallo: ${failed.length} de ${results.length} pruebas`);
  console.log(`captura: ${out}/formulario.png`);
  process.exit(1);
}
console.log(`\nok: ${results.length} de ${results.length} pruebas`);
