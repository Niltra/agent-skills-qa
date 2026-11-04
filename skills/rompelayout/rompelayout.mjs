#!/usr/bin/env node
/**
 * rompelayout â€” find where your UI breaks in other languages.
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

const DEFAULTS = { locales: ["es", "en", "de"], width: 1280, out: "shots", base: null, maxItems: 40, settle: 120 };

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
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
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
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const bad = [];
    const clips = s.overflowX === "hidden" || s.overflowX === "clip" || s.textOverflow === "ellipsis";
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
    if (own) {
      if (clips && el.scrollWidth > el.clientWidth + 1) bad.push("clipped-x");
      if ((s.overflowY === "hidden" || s.overflowY === "clip") && el.scrollHeight > el.clientHeight + 1) {
        bad.push("clipped-y");
      }
      if (r.right > doc.clientWidth + 1 || r.left < -1) bad.push("viewport");
    }
    if (bad.length) {
      el.setAttribute("data-rl", String(out.length));
      out.push({ id: out.length, sel: label(el), text, bad, w: Math.round(r.width) });
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
  if (!url) throw new Error("uso: rompelayout <url-o-ruta-con-{locale}> --locales es,en,de");
  return {
    url,
    ...opts,
    locales: Array.isArray(opts.locales) ? opts.locales : String(opts.locales).split(",").map((s) => s.trim()).filter(Boolean),
    width: Number(opts.width),
    maxItems: Number(opts.maxItems),
    settle: Number(opts.settle),
  };
}

function urlFor(template, locale) {
  const filled = template.replace("{locale}", locale);
  if (/^https?:\/\//.test(filled)) return filled;
  return pathToFileURL(resolve(filled)).href;
}

const { url, locales, width, out, base, maxItems, settle } = parse(process.argv.slice(2));
const baseLocale = base || locales[0];
const CHECK_CODE = CHECK.replace("__MAX__", String(maxItems));

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });

const report = [];
for (const locale of locales) {
  await page.goto(urlFor(url, locale), { waitUntil: "load" });
  await page.waitForTimeout(settle);
  let shot = null;
  let result;
  try {
    result = await page.evaluate(CHECK_CODE);
  } catch {
    result = { items: [], pageScroll: false, error: true };
  }
  if (result.items.length || result.pageScroll) {
    shot = `${out}/${locale}.png`;
    await page.evaluate((items) => {
      for (const it of items) {
        const el = document.querySelector(`[data-rl="${it.id}"]`);
        if (el) {
          el.style.outline = "3px solid #ff3b30";
          el.style.outlineOffset = "2px";
        }
      }
    }, result.items).catch(() => {});
    await page.screenshot({ path: shot, fullPage: true });
  }
  report.push({ locale, ...result, shot });
}

await browser.close();

const problems = (r) => r.items.length + (r.pageScroll ? 1 : 0);
let failed = false;
console.log(`\n${"locale".padEnd(8)}${"problemas".padEnd(12)}notas`);
console.log("-".repeat(58));
for (const r of report) {
  const n = problems(r);
  const extra = r.error ? "no se pudo medir" : r.pageScroll ? "scroll horizontal" : "";
  if (n > 0 && r.locale !== baseLocale) failed = true;
  console.log(`${r.locale.padEnd(8)}${String(n).padEnd(12)}${extra}`);
}
for (const r of report) {
  if (!r.items.length) continue;
  console.log(`\n${r.locale}${r.shot ? `  â†’ ${r.shot}` : ""}`);
  for (const it of r.items) {
    console.log(`  [${it.bad.join(",").padEnd(15)}] ${it.sel}`);
    console.log(`  ${" ".repeat(17)}"${it.text}"`);
  }
}
console.log("");
if (failed) {
  const broken = report.filter((r) => problems(r) > 0 && r.locale !== baseLocale).map((r) => r.locale);
  console.log(`fallo: ${broken.join(", ")} rompe el layout`);
  process.exit(1);
}
console.log("ok: mismo layout en todos los idiomas");
