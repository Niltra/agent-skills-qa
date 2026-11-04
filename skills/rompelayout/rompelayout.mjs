#!/usr/bin/env node
/**
 * rompelayout — find where your UI breaks in other languages.
 *
 *   node rompelayout.mjs ./site/{locale}.html --locales es,en,de
 *   node rompelayout.mjs https://site.com/{locale} --locales es,en,de
 *
 * Exits 1 when a non-base locale has layout problems, so CI can gate on it.
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

const DEFAULTS = { locales: ["es", "en", "de"], width: 1280, out: "shots", base: null, maxItems: 40, settle: 120, scroll: true, maxScroll: 16000 };

function readConfig(file) {
  if (!file) return {};
  if (!existsSync(file)) throw new Error(`no existe el config: ${file}`);
  return JSON.parse(readFileSync(file, "utf8"));
}

const CHECK = `(() => {
  const doc = document.documentElement;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 8 && r.height > 8 && s.visibility !== "hidden" && s.display !== "none";
  };
  const label = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(s + "#" + n.id); break; }
      if (n.className && typeof n.className === "string") {
        s += "." + n.className.trim().split(/\\s+/).slice(0, 2).join(".");
      }
      parts.unshift(s);
    }
    return parts.join(" > ");
  };
  const path = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      let i = 1;
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.tagName === n.tagName) i++;
      }
      parts.unshift(n.tagName.toLowerCase() + ":" + i);
    }
    return parts.join(">");
  };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg")) continue;
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const bad = [];
    const clips = s.overflowX === "hidden" || s.overflowX === "clip" || s.textOverflow === "ellipsis";
    const ellipsis = s.textOverflow === "ellipsis";
    if (clips) {
      for (const c of el.children) {
        const cr = c.getBoundingClientRect();
        if (cr.width && (cr.right > r.right + 1 || cr.left < r.left - 1)) {
          bad.push("child-out");
          break;
        }
      }
    }
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    const text = el.textContent.replace(/\\s+/g, " ").trim().slice(0, 80);
    if (clips && el.scrollWidth > el.clientWidth + 1) bad.push("clipped-x");
    if ((s.overflowY === "hidden" || s.overflowY === "clip") && el.scrollHeight > el.clientHeight + 1) {
      bad.push("clipped-y");
    }
    if (own && (r.right > doc.clientWidth + 1 || r.left < -1)) bad.push("viewport");
    if (bad.length) {
      el.setAttribute("data-rl", String(out.length));
      out.push({ id: out.length, path: path(el), sel: label(el), text, bad, ellipsis, w: Math.round(r.width) });
    }
  }
  return {
    items: out.slice(0, __MAX__),
    pageScroll: doc.scrollWidth > doc.clientWidth + 1,
  };
})()`;

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
  const opts = {
    ...DEFAULTS,
    ...readConfig(new URL("./config.json", import.meta.url)),
    ...readConfig(config),
    ...overrides,
  };
  for (const k of Object.keys(overrides)) {
    if (!(k in DEFAULTS)) throw new Error(`flag desconocido --${k}`);
  }
  if (!url) throw new Error("uso: rompelayout <url-o-ruta-con-{locale}> --locales es,en,de");
  const list = Array.isArray(opts.locales) ? opts.locales : String(opts.locales).split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.length) throw new Error("--locales no puede estar vacío");
  if (list.length > 1 && !url.includes("{locale}")) {
    throw new Error("la URL no contiene {locale}: todos los idiomas cargarían la misma página");
  }
  const out = {
    url,
    ...opts,
    locales: list,
    width: Number(opts.width),
    maxItems: Number(opts.maxItems),
    settle: Number(opts.settle),
    maxScroll: Number(opts.maxScroll),
  };
  for (const [k, min] of [["width", 1], ["maxItems", 1], ["settle", 0], ["maxScroll", 0]]) {
    if (!Number.isFinite(out[k]) || out[k] < min) throw new Error(`--${k} inválido: ${out[k]}`);
  }
  if (typeof out.out !== "string" || !out.out) throw new Error("--out necesita un nombre de carpeta");
  return out;
}

function urlFor(template, locale) {
  const filled = template.replace("{locale}", locale);
  if (/^https?:\/\//.test(filled)) return filled;
  return pathToFileURL(resolve(filled)).href;
}

const { url, locales, width, out, base, maxItems, settle, scroll, maxScroll } = parse(process.argv.slice(2));
const baseLocale = base || locales[0];
const CHECK_CODE = CHECK.replace("__MAX__", String(maxItems));

const wantsScroll = !(scroll === false || scroll === "false" || scroll === 0 || scroll === "0");

// Los sitios con animaciones al hacer scroll no existen hasta que se recorre la página.
async function warmScroll(page) {
  if (!wantsScroll) return;
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  for (let y = 0; y < Math.min(h, Number(maxScroll)); y += vh) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function waitFonts(page) {
  await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
}

// content-visibility:auto deja secciones sin renderizar al volver arriba.
async function revealAll(page) {
  await page.addStyleTag({ content: "*,*::before,*::after{content-visibility:visible!important}" }).catch(() => {});
}

const CANVAS = `(() => {
  const vw = innerWidth, vh = innerHeight;
  let area = 0;
  for (const c of document.querySelectorAll("canvas")) {
    const r = c.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) continue;
    const w = Math.min(r.right, vw) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (w > 0 && h > 0) area += w * h;
  }
  return Math.min(1, area / (vw * vh));
})()`;

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });

const report = [];
for (const locale of locales) {
  const res = await page.goto(urlFor(url, locale), { waitUntil: "load" });
  if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()} en ${urlFor(url, locale)}`);
  await waitFonts(page);
  await warmScroll(page);
  await revealAll(page);
  await page.waitForTimeout(settle);
  let result;
  let canvas = 0;
  try {
    canvas = await page.evaluate(CANVAS);
  } catch {}
  try {
    result = await page.evaluate(CHECK_CODE);
  } catch {
    result = { items: [], pageScroll: false, error: true };
  }
  report.push({ locale, canvas, ...result });
}

// Lo que ya está roto en el idioma base no lo causa la traducción: se descuenta.
const baseReport = report.find((r) => r.locale === baseLocale);
const baseItems = baseReport?.items || [];
const baseKeys = new Set(baseItems.map((i) => i.path));
const baseScroll = Boolean(baseReport?.pageScroll);
const baseline = baseItems.length + (baseScroll ? 1 : 0);

for (const r of report) {
  r.fresh = r.locale === baseLocale ? [] : r.items.filter((i) => !baseKeys.has(i.path));
  r.freshScroll = r.locale !== baseLocale && r.pageScroll && !baseScroll;
  r.shot = null;
}

// Un recorte con ellipsis puede ser intencionado; solo es fallo si no hay puntos suspensivos,
// o si el elemento se sale del contenedor o de la pantalla.
const hard = (it) =>
  it.bad.includes("viewport") ||
  (!it.ellipsis && it.bad.some((b) => b === "child-out" || b.startsWith("clipped")));

for (const r of report) {
  r.freshHard = r.fresh.filter(hard);
  r.freshSoft = r.fresh.filter((it) => !hard(it));
}

for (const r of report) {
  if (!r.freshHard.length && !r.freshScroll) continue;
  await page.goto(urlFor(url, r.locale), { waitUntil: "load" });
  await waitFonts(page);
  await warmScroll(page);
  await revealAll(page);
  await page.waitForTimeout(settle);
  const again = await page.evaluate(CHECK_CODE).catch(() => ({ items: [] }));
  const keys = new Set(r.freshHard.map((i) => i.path));
  const ids = again.items.filter((i) => keys.has(i.path)).map((i) => i.id);
  await page
    .evaluate((list) => {
      for (const id of list) {
        const el = document.querySelector(`[data-rl="${id}"]`);
        if (el) {
          el.style.outline = "3px solid #ff3b30";
          el.style.outlineOffset = "2px";
        }
      }
    }, ids)
    .catch(() => {});
  r.shot = `${out}/${r.locale}.png`;
  await page.screenshot({ path: r.shot, fullPage: true });
}

await browser.close();

let failed = false;
console.log(`\n${"locale".padEnd(9)}${"fallos".padEnd(9)}${"revisar".padEnd(9)}${"base".padEnd(7)}notas`);
console.log("-".repeat(64));
for (const r of report) {
  const n = r.freshHard.length + (r.freshScroll ? 1 : 0);
  const extra = r.error
    ? "no se pudo medir"
    : r.locale === baseLocale
      ? "referencia"
      : r.freshScroll
        ? "scroll horizontal nuevo"
        : "";
  if (n > 0 && r.locale !== baseLocale) failed = true;
  console.log(`${r.locale.padEnd(9)}${String(n).padEnd(9)}${String(r.freshSoft.length).padEnd(9)}${String(baseline).padEnd(7)}${extra}`);
}
if (baseline > 0) {
  console.log(`\n${baseline} problemas ya existen en ${baseLocale}: no los causa la traducción y no cuentan.`);
}
for (const r of report) {
  if (!r.freshHard.length) continue;
  console.log(`\n${r.locale}${r.shot ? `  → ${r.shot}` : ""}`);
  for (const it of r.freshHard) {
    console.log(`  [${it.bad.join(",").padEnd(15)}] ${it.sel}`);
    console.log(`  ${" ".repeat(17)}"${it.text}"`);
  }
}
const soft = report.reduce((n, r) => n + r.freshSoft.length, 0);
if (soft) console.log(`\n${soft} recortes con ellipsis: puede ser intencionado, revisar a ojo.`);
const canvasMax = Math.max(...report.map((r) => r.canvas || 0));
if (canvasMax > 0.3) {
  console.log(`\n${Math.round(canvasMax * 100)}% de la ventana es canvas: el contenido 3D no se puede medir.`);
}
const unmeasured = report.filter((r) => r.error).map((r) => r.locale);
if (unmeasured.length) {
  console.log(`\nfallo: no se pudo medir ${unmeasured.join(", ")}. Sin medición no hay veredicto.`);
  process.exit(2);
}
console.log("");
if (failed) {
  const broken = report.filter((r) => r.freshHard.length + (r.freshScroll ? 1 : 0) > 0 && r.locale !== baseLocale).map((r) => r.locale);
  console.log(`fallo: ${broken.join(", ")} rompe el layout solo en ese idioma`);
  process.exit(1);
}
console.log("ok: ningún elemento se rompe solo por cambiar de idioma");
