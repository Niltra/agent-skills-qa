#!/usr/bin/env node
/**
 * contraste-real â€” mide el contraste WCAG contra los pÃ­xeles que hay detrÃ¡s
 * del texto, incluidas imÃ¡genes, degradados y vÃ­deo.
 *
 *   node contraste.mjs https://tuweb.com --level AA
 *   node contraste.mjs ./fixture/index.html --level AAA --out shots
 *
 * Truco: oculta el texto, captura el fondo real, compara contra el color del texto.
 * Sale con 1 si algÃºn texto no llega al umbral.
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULTS = {
  url: null,
  out: "shots",
  width: 1280,
  height: 900,
  level: "AA",
  target: null,
  largeTextPx: 24,
  largeBoldPx: 18.66,
  maxItems: 30,
  settle: 300,
};

const THRESHOLDS = {
  AA: { normal: 4.5, large: 3 },
  AAA: { normal: 7, large: 4.5 },
};

function readConfig(file) {
  if (!file) return {};
  if (!existsSync(file)) throw new Error(`no existe el config: ${file}`);
  return JSON.parse(readFileSync(file, "utf8"));
}

function parse(argv) {
  const flags = {};
  let url = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      flags[k] = v ?? argv[++i];
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
  if (!url) url = opts.url;
  if (!url) throw new Error("uso: contraste <url-o-ruta> [--level AA|AAA] [--out shots]");
  const level = String(opts.level).toUpperCase();
  if (!THRESHOLDS[level]) throw new Error(`level debe ser AA o AAA, no ${opts.level}`);
  return {
    ...opts,
    url,
    level,
    target: opts.target === null ? null : Number(opts.target),
    width: Number(opts.width),
    height: Number(opts.height),
    maxItems: Number(opts.maxItems),
    settle: Number(opts.settle),
  };
}

const toUrl = (u) => (/^https?:\/\//.test(u) ? u : pathToFileURL(resolve(u)).href);

const COLLECT = `(() => {
  const out = [];
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
  for (const el of document.querySelectorAll("body *")) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    if (!own) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) continue;
    if (s.color === "rgba(0, 0, 0, 0)" || s.webkitTextFillColor === "rgba(0, 0, 0, 0)") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
    const m = s.color.match(/[\\d.]+/g);
    if (!m || m.length < 3) continue;
    el.setAttribute("data-cr", String(out.length));
    out.push({
      id: out.length,
      sel: label(el),
      text: own.replace(/\\s+/g, " ").slice(0, 70),
      color: m.slice(0, 3).map(Number),
      size: parseFloat(s.fontSize),
      weight: Number(s.fontWeight) || 400,
      x: r.left + window.scrollX,
      y: r.top + window.scrollY,
      w: r.width,
      h: r.height,
    });
  }
  return out;
})()`;

const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

const { url, out, width, height, level, target, largeTextPx, largeBoldPx, maxItems, settle } =
  parse(process.argv.slice(2));
const thresholds = THRESHOLDS[level];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(toUrl(url), { waitUntil: "load" });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(settle);

const items = await page.evaluate(COLLECT);

const tag = await page.addStyleTag({
  content: `body, body * { color: transparent !important; -webkit-text-fill-color: transparent !important;
            text-shadow: none !important; caret-color: transparent !important; }`,
});
await page.waitForTimeout(80);
const shot = await page.screenshot({ fullPage: true, animations: "disabled" });
await tag.evaluate((el) => el.remove());
const b64 = shot.toString("base64");

const measured = await page.evaluate(
  async ({ b64, items, largeTextPx, largeBoldPx }) => {
    if (!items.length) return [];
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const fl = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r, g, b) => 0.2126 * fl(r) + 0.7152 * fl(g) + 0.0722 * fl(b);
    const out = [];
    for (const it of items) {
      const inset = 2;
      const sx = Math.max(0, Math.round(it.x) + inset);
      const sy = Math.max(0, Math.round(it.y) + inset);
      const sw = Math.min(img.width - sx, Math.round(it.w) - inset * 2);
      const sh = Math.min(img.height - sy, Math.round(it.h) - inset * 2);
      if (sw < 2 || sh < 2) continue;
      const data = ctx.getImageData(sx, sy, sw, sh).data;
      const step = Math.max(1, Math.floor(Math.min(sw, sh) / 16));
      const L1 = lum(it.color[0], it.color[1], it.color[2]);
      let worst = 22, bg = [0, 0, 0];
      for (let y = 0; y < sh; y += step) {
        for (let x = 0; x < sw; x += step) {
          const i = (y * sw + x) * 4;
          const L2 = lum(data[i], data[i + 1], data[i + 2]);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          if (ratio < worst) {
            worst = ratio;
            bg = [data[i], data[i + 1], data[i + 2]];
          }
        }
      }
      const large = it.size >= largeTextPx || (it.size >= largeBoldPx && it.weight >= 700);
      out.push({ ...it, large, ratio: Math.round(worst * 100) / 100, bg });
    }
    return out;
  },
  { b64, items, largeTextPx, largeBoldPx },
);

await browser.close();

const fails = measured
  .map((m) => ({ ...m, min: target ?? (m.large ? thresholds.large : thresholds.normal) }))
  .filter((m) => m.ratio < m.min)
  .sort((a, b) => a.ratio - b.ratio)
  .slice(0, maxItems);

if (fails.length) {
  mkdirSync(out, { recursive: true });
  const file = `${out}/contraste.png`;
  const browser2 = await chromium.launch();
  const p2 = await browser2.newPage({ viewport: { width, height } });
  await p2.goto(toUrl(url), { waitUntil: "load" });
  await p2.waitForTimeout(settle);
  await p2.evaluate(COLLECT);
  await p2.evaluate((ids) => {
    for (const id of ids) {
      const el = document.querySelector(`[data-cr="${id}"]`);
      if (el) {
        el.style.outline = "3px solid #ff3b30";
        el.style.outlineOffset = "2px";
      }
    }
  }, fails.map((f) => f.id));
  await p2.screenshot({ path: file, fullPage: true });
  await browser2.close();
  console.log(`\ncaptura: ${file}`);
}

console.log(`\ncontraste ${level}: ${thresholds.normal}:1 normal, ${thresholds.large}:1 grande${target ? `, objetivo ${target}:1` : ""}`);
console.log(`${measured.length} textos medidos, ${fails.length} por debajo\n`);
if (fails.length) {
  console.log(`${"ratio".padEnd(7)}${"min".padEnd(6)}${"texto".padEnd(30)}fondo`);
  console.log("-".repeat(78));
  for (const f of fails) {
    const sel = f.sel.length > 33 ? "…" + f.sel.slice(-32) : f.sel;
    console.log(
      `${String(f.ratio).padEnd(7)}${String(f.min).padEnd(6)}${sel.padEnd(34)}${hex(f.bg)}`,
    );
    console.log(`${" ".repeat(13)}"${f.text}"  ${f.size}px ${f.weight}`);
  }
  console.log(`\nfallo: ${fails.length} textos no se leen sobre su fondo real`);
  process.exit(1);
}
console.log("ok: todos los textos llegan al umbral sobre el fondo real");
