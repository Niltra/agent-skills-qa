#!/usr/bin/env node
/**
 * lector-de-pantalla — escribe lo que oye un lector de pantalla y mide el ruido.
 *
 *   node lector.mjs https://tuweb.com
 *   node lector.mjs ./fixture/index.html --out shots
 *
 * No comprueba reglas: reconstruye el árbol de accesibilidad en orden y lo lee.
 * Sale con 1 si el texto que se anuncia es inutil.
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

const DEFAULTS = {
  url: null,
  out: "shots",
  width: 1280,
  height: 900,
  settle: 400,
  scroll: true,
  maxNodes: 60,
  repeatLimit: 3,
  genericAlt: ["imagen", "image", "foto", "photo", "picture", "logo", "icon", "icono", "grafico", "gráfico", "banner", "img", "imagen de", "foto de"],
  genericLink: ["leer más", "leer mas", "más", "mas", "aquí", "aqui", "click aquí", "click aqui", "ver más", "ver mas", "ver", "ir", "more", "read more", "click here", "here", "link", "enlace"],
};

const STOP = {
  es: "el la de que y en un una los las del se por con para es su al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros".split(" "),
  en: "the of and to in a is that for it on with as are be this was or from at by an not have has had but they you we he she his her its their our your can will would should could there here what which who when where how all any some more most other into than then them these those".split(" "),
  fr: "le la les de des du et en un une est que pour dans par sur au avec ce il elle nous vous ils sont pas plus ou son sa ses leur cette ces qui que quoi dont mais comme tout tous".split(" "),
  de: "der die das und in den von zu mit sich des auf für ist im dem nicht ein eine als auch es an werden aus er hat dass sie nach wird bei einer um am sind noch wie einem über einen so zum war haben nur oder aber vor zur bis mehr durch man sein wurde sei".split(" "),
  pt: "de a o que e do da em um para é com não uma os no se na por mais as dos como mas foi ao ele das tem à seu sua ou ser quando muito há nos já está eu também só pelo pela até isso ela entre era depois sem mesmo aos ter seus quem nas me esse eles estão você tinha foram essa num nem suas meu às minha têm numa pelos elas havia seja qual será nós tenho lhe deles essas esses pelas este fosse dele tu te vocês".split(" "),
  it: "di che e la il un a per in non una è da con si le del al come più anche questo questa sono gli lo ma se ha hanno era essere stato dei delle nel nella sul sulla tra fra quando molto tutti tutte può essere".split(" "),
};

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
  if (!url) throw new Error("uso: lector <url-o-ruta> [--out shots]");
  const out = {
    ...opts,
    url,
    width: Number(opts.width),
    height: Number(opts.height),
    settle: Number(opts.settle),
    maxNodes: Number(opts.maxNodes),
    repeatLimit: Number(opts.repeatLimit),
  };
  for (const k of ["width", "height", "settle", "maxNodes", "repeatLimit"]) {
    if (!Number.isFinite(out[k]) || out[k] < 0) throw new Error(`--${k} inválido: ${out[k]}`);
  }
  if (typeof out.out !== "string" || !out.out) throw new Error("--out necesita un nombre de carpeta");
  return out;
}

const toUrl = (u) => (/^https?:\/\//.test(u) ? u : pathToFileURL(resolve(u)).href);

const PAGE_TEXT = `(() => {
  const el = document.querySelector("main") || document.body;
  return (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 20000);
})()`;

function detectLang(text) {
  const words = text.toLowerCase().match(/[a-záéíóúüñçàèìòùâêîôûäöüß]+/gi) || [];
  if (words.length < 100) return { lang: null, reason: "texto insuficiente" };
  const counts = {};
  for (const [lang, list] of Object.entries(STOP)) {
    const set = new Set(list);
    counts[lang] = words.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0);
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [top, second] = sorted;
  if (top[1] < 5) return { lang: null, reason: "sin señal suficiente" };
  if (top[1] < second[1] * 1.25) return { lang: null, reason: "mezcla de idiomas" };
  return { lang: top[0], score: top[1], words: words.length };
}

const GENERIC = (name, list) => {
  const n = name.toLowerCase().trim().replace(/[.:!]+$/, "");
  return list.includes(n);
};

const { url, out, width, height, settle, scroll, maxNodes, repeatLimit, genericAlt, genericLink } =
  parse(process.argv.slice(2));

const wantsScroll = !(scroll === false || scroll === "false" || scroll === 0 || scroll === "0");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(toUrl(url), { waitUntil: "load" });
if (wantsScroll) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  for (let y = 0; y < Math.min(h, 16000); y += vh) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
await page.waitForTimeout(settle);

let snapshot;
try {
  snapshot = await page.locator("body").ariaSnapshot();
} catch (e) {
  console.error(`no se pudo leer el árbol de accesibilidad: ${e.message.split("\n")[0]}`);
  process.exit(2);
}

const declared = await page.evaluate(() => document.documentElement.lang || "");
const text = await page.evaluate(PAGE_TEXT);
await browser.close();

// ---------- parsear el arbol ----------

const nodes = [];
for (const line of snapshot.split("\n")) {
  const m = line.match(/^(\s*)- (\w+)(?: "((?:[^"\\]|\\.)*)")?(?: \[level=(\d)\])?/);
  if (!m) continue;
  nodes.push({
    depth: Math.floor(m[1].length / 2),
    role: m[2],
    name: (m[3] || "").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim(),
    level: m[4] ? Number(m[4]) : null,
  });
}

const items = [];
const add = (i, check, detail) => items.push({ i, check, detail });

// 1. imagenes sin texto alternativo
nodes.forEach((n, i) => {
  if (n.role === "img" && !n.name) add(i, "imagen sin alternativa", "el lector no dice nada");
});

// 2. alt que es el nombre del fichero
nodes.forEach((n, i) => {
  if (n.role === "img" && /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(n.name)) {
    add(i, "alt = nombre del fichero", n.name);
  }
});

// 3. alt generico
nodes.forEach((n, i) => {
  if (n.role === "img" && n.name && GENERIC(n.name, genericAlt)) {
    add(i, "alt genérico", n.name);
  }
});

// 3b. alt demasiado largo: algunos lectores lo cortan
nodes.forEach((n, i) => {
  if (n.role === "img" && n.name.length > 125) {
    add(i, "alt demasiado largo", `${n.name.length} caracteres`);
  }
});

// 4. enlaces y botones sin nombre util
nodes.forEach((n, i) => {
  if ((n.role === "link" || n.role === "button") && (!n.name || GENERIC(n.name, genericLink))) {
    add(i, n.role === "link" ? "enlace sin nombre útil" : "botón sin nombre útil", n.name || "(vacío)");
  }
});

// 5. el mismo texto repetido
const byName = new Map();
nodes.forEach((n, i) => {
  if (!n.name || !["img", "link", "button"].includes(n.role)) return;
  const key = n.name.toLowerCase();
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push({ i, role: n.role });
});
for (const [name, list] of byName) {
  if (list.length >= repeatLimit) {
    for (const x of list) add(x.i, "texto repetido", `"${name}" se anuncia ${list.length} veces`);
  }
}

// 6. saltos de encabezado
let lastLevel = 0;
nodes.forEach((n, i) => {
  if (n.role !== "heading" || !n.level) return;
  if (lastLevel && n.level > lastLevel + 1) add(i, "salto de encabezado", `h${lastLevel} -> h${n.level}`);
  lastLevel = n.level;
});

// 7. idioma declarado distinto del real
const detected = detectLang(text);
if (detected.lang && declared && !declared.toLowerCase().startsWith(detected.lang)) {
  add(-1, "idioma declarado incorrecto", `dice "${declared}", parece ${detected.lang}`);
}

// ---------- salida ----------

const grouped = new Map();
for (const it of items) {
  const key = `${it.check}|${it.detail}`;
  const prev = grouped.get(key);
  if (prev) prev.n++;
  else grouped.set(key, { ...it, n: 1 });
}
const unique = [...grouped.values()];

const imgs = nodes.filter((n) => n.role === "img").length;
const links = nodes.filter((n) => n.role === "link").length;

console.log(`\nlector: ${url}`);
console.log(`${nodes.length} nodos, ${imgs} imágenes, ${links} enlaces, idioma declarado "${declared || "ninguno"}"`);
if (detected.lang) console.log(`idioma detectado: ${detected.lang} (${detected.score}/${detected.words} palabras)`);

console.log("\nLO QUE OYE");
for (const n of nodes.slice(0, maxNodes)) {
  const label = n.name ? `${n.role} "${n.name}"` : n.role;
  console.log(`  ${"  ".repeat(n.depth)}${label}`);
}
if (nodes.length > maxNodes) console.log(`  … y ${nodes.length - maxNodes} nodos más`);

if (items.length) {
  console.log(`\nRUIDO: ${items.length} problemas en ${unique.length} tipos\n`);
  for (const it of unique) {
    console.log(`  ${it.check.padEnd(26)} ${it.detail}${it.n > 1 ? `  (x${it.n})` : ""}`);
  }
  mkdirSync(out, { recursive: true });
  const file = `${out}/lector.txt`;
  const { writeFileSync } = await import("node:fs");
  writeFileSync(file, snapshot, "utf8");
  console.log(`\nárbol completo: ${file}`);
  console.log(`\nfallo: ${items.length} anuncios inútiles`);
  process.exit(1);
}
console.log("\nok: todo lo que se anuncia tiene nombre útil");
