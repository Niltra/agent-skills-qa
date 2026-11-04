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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  let skipped = 0;
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
    // texto con degradado recortado a las letras: el color calculado no es el color pintado
    const clip = s.webkitBackgroundClip || s.backgroundClip;
    if (clip === "text" && s.backgroundImage && s.backgroundImage !== "none") { skipped++; continue; }
    // blend, filter y opacidad cambian el color pintado: medir el color calculado daría un número falso.
    let blocked = false;
    let opacity = 1;
    for (let n = el, d = 0; n && n !== document.body && d < 6; n = n.parentElement, d++) {
      const cs = getComputedStyle(n);
      opacity *= Number(cs.opacity);
      if (cs.mixBlendMode && cs.mixBlendMode !== "normal") blocked = true;
      if (cs.filter && cs.filter !== "none") blocked = true;
    }
    if (blocked || opacity < 0.99) { skipped++; continue; }
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
  return { items: out, skipped };
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

const collected = await page.evaluate(COLLECT);
const items = collected.items;

const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
const CAP = 16000;
const cap = Math.min(pageHeight, CAP);
const clip = { x: 0, y: 0, width, height: cap };

let shotVisible;
try {
  shotVisible = await page.screenshot({ fullPage: true, clip, animations: "disabled", timeout: 90000 });
} catch (e) {
  console.error(`no se pudo capturar la página: ${e.message.split("\n")[0]}`);
  process.exit(2);
}
// El estilo en línea con !important gana al CSS del sitio; una hoja inyectada no siempre.
await page.evaluate(() => {
  for (const el of document.querySelectorAll("[data-cr]")) {
    el.style.setProperty("color", "transparent", "important");
    el.style.setProperty("-webkit-text-fill-color", "transparent", "important");
    el.style.setProperty("text-shadow", "none", "important");
  }
});
await page.waitForTimeout(80);
const shotHidden = await page.screenshot({ fullPage: true, clip, animations: "disabled", timeout: 90000 });
if (process.env.CR_SAVE) writeFileSync("bench/shots/cr-last.png", shotHidden);

const visible64 = shotVisible.toString("base64");
const hidden64 = shotHidden.toString("base64");

const measurePage = await browser.newPage();
await measurePage.setContent("<!doctype html><html><body></body></html>");
const measuredResult = await measurePage.evaluate(
  async ({ visible64, hidden64, items, largeTextPx, largeBoldPx, cap }) => {
    if (!items.length) return { list: [], skipped: 0 };
    const load = async (src) => {
      const img = new Image();
      img.src = "data:image/png;base64," + src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return { img, ctx };
    };
    const V = await load(visible64);
    const H = await load(hidden64);
    const fl = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r, g, b) => 0.2126 * fl(r) + 0.7152 * fl(g) + 0.0722 * fl(b);
    const out = [];
    let skipped = 0;
    let offCap = 0;
    let bounds = 0;
    for (const it of items) {
      if (it.y >= cap) { offCap++; continue; }
      const inset = 1;
      const sx = Math.max(0, Math.round(it.x) + inset);
      const sy = Math.max(0, Math.round(it.y) + inset);
      const sw = Math.min(H.img.width - sx, Math.round(it.w) - inset * 2);
      const sh = Math.min(H.img.height - sy, Math.round(it.h) - inset * 2);
      if (sw < 4 || sh < 4) { bounds++; continue; }
      const dv = V.ctx.getImageData(sx, sy, sw, sh).data;
      const dh = H.ctx.getImageData(sx, sy, sw, sh).data;
      const L1 = lum(it.color[0], it.color[1], it.color[2]);
      const large = it.size >= largeTextPx || (it.size >= largeBoldPx && it.weight >= 700);
      let worst = 22, bg = [0, 0, 0], ink = 0;
      for (let i = 0; i < dv.length; i += 4) {
        const diff =
          Math.abs(dv[i] - dh[i]) + Math.abs(dv[i + 1] - dh[i + 1]) + Math.abs(dv[i + 2] - dh[i + 2]);
        // solo los píxeles que eran letra: así no se cuela un logo, un borde o un icono
        if (diff <= 24) continue;
        ink++;
        if (dh[i + 3] < 250) continue;
        const L2 = lum(dh[i], dh[i + 1], dh[i + 2]);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        if (ratio < worst) {
          worst = ratio;
          bg = [dh[i], dh[i + 1], dh[i + 2]];
        }
      }
      if (ink < 5) {
        // No hay tinta: o el texto es del mismo color que el fondo, o está tapado.
        // Solo se reporta lo primero, comparando el color del texto con el color dominante.
        const counts = new Map();
        for (let i = 0; i < dh.length; i += 4) {
          if (dh[i + 3] < 250) continue;
          const key = (dh[i] >> 4) * 256 + (dh[i + 1] >> 4) * 16 + (dh[i + 2] >> 4);
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        let bestKey = -1, bestN = 0;
        for (const [k, n] of counts) if (n > bestN) { bestN = n; bestKey = k; }
        if (bestKey >= 0) {
          const rr = ((bestKey >> 8) & 15) * 17;
          const gg = ((bestKey >> 4) & 15) * 17;
          const bb = (bestKey & 15) * 17;
          const dist =
            Math.abs(rr - it.color[0]) + Math.abs(gg - it.color[1]) + Math.abs(bb - it.color[2]);
          if (dist <= 12) {
            const L2 = lum(rr, gg, bb);
            const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
            out.push({
              ...it,
              large,
              ratio: Math.round(ratio * 100) / 100,
              bg: [rr, gg, bb],
              invisible: true,
              dbg: [sx, sy, sw, sh, H.img.width, H.img.height],
            });
            continue;
          }
        }
        skipped++;
        continue;
      }
      out.push({ ...it, large, ratio: Math.round(worst * 100) / 100, bg, dbg: [sx, sy, sw, sh, H.img.width, H.img.height] });
    }
    return { list: out, skipped, offCap, bounds };
  },
  { visible64, hidden64, items, largeTextPx, largeBoldPx, cap },
);
await measurePage.close();

await browser.close();

const measured = measuredResult.list;
const totalSkipped = collected.skipped + measuredResult.skipped;
const offCap = measuredResult.offCap;

// "Nada medido" no es "todo correcto".
if (!measured.length && items.length) {
  console.error(`no se pudo medir ningún texto de ${items.length} candidatos`);
  console.error("el sitio resiste el ocultado del texto, o todo el texto está cubierto o animado");
  process.exit(2);
}

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
  await p2.screenshot({
    path: file,
    fullPage: true,
    clip: { x: 0, y: 0, width, height: Math.min(cap, 16000) },
    timeout: 90000,
  });
  await browser2.close();
  console.log(`\ncaptura: ${file}`);
}

console.log(`\ncontraste ${level}: ${thresholds.normal}:1 normal, ${thresholds.large}:1 grande${target ? `, objetivo ${target}:1` : ""}`);
console.log(`${measured.length} textos medidos, ${fails.length} por debajo, ${totalSkipped} no medibles`);
if (offCap) console.log(`${offCap} fuera de la captura (página de ${pageHeight} px, se mide hasta ${CAP})`);
if (measuredResult.bounds) console.log(`${measuredResult.bounds} descartados por coordenadas fuera de la imagen`);
console.log("");
if (fails.length) {
  console.log(`${"ratio".padEnd(7)}${"min".padEnd(6)}${"texto".padEnd(30)}fondo`);
  console.log("-".repeat(78));
  for (const f of fails) {
    const sel = f.sel.length > 33 ? "…" + f.sel.slice(-32) : f.sel;
    console.log(
      `${String(f.ratio).padEnd(7)}${String(f.min).padEnd(6)}${sel.padEnd(34)}${hex(f.bg)}`,
    );
    console.log(`${" ".repeat(13)}"${f.text}"  ${f.size}px ${f.weight}${f.invisible ? "  (texto invisible: mismo color que el fondo)" : ""}`);
    if (process.env.CR_DEBUG) console.log(`${" ".repeat(13)}dbg x,y,w,h,img: ${f.dbg.join(",")} | item x,y: ${Math.round(f.x)},${Math.round(f.y)}`);
  }
  console.log(`\nfallo: ${fails.length} textos no se leen sobre su fondo real`);
  process.exit(1);
}
console.log("ok: todos los textos llegan al umbral sobre el fondo real");
