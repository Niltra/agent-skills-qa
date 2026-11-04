#!/usr/bin/env node
/**
 * Fuzz de contraste con verdad analitica.
 * Genera paginas aleatorias, calcula el ratio WCAG de cada bloque por su cuenta
 * y compara con lo que reporta el motor. Mide falsos positivos y falsos negativos.
 *
 *   node conformance/fuzz.mjs --seed 1 --pages 10
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(DIR, "..");
const TMP = join(DIR, ".fuzz");
const TOOL = join(ROOT, "skills", "contraste-real", "contraste.mjs");

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
};
const SEED = Number(opt("seed", 1));
const PAGES = Number(opt("pages", 10));
const BLOCKS = Number(opt("blocks", 12));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const FG = ["#000000", "#111111", "#333333", "#555555", "#767676", "#777777", "#888888", "#949494", "#aaaaaa", "#c9411b", "#5a8f2a", "#2a5f5a"];
const BG = ["#ffffff", "#f4f1ea", "#eeeeee", "#111111", "#1b1b25", "#cddeff"];
const SIZE = [16, 30];

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const la = lum(hex2rgb(a));
  const lb = lum(hex2rgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let tp = 0, fp = 0, fn = 0, tn = 0, skipped = 0;
const problems = [];

for (let page = 0; page < PAGES; page++) {
  const blocks = [];
  for (let i = 0; i < BLOCKS; i++) {
    const fg = pick(FG);
    const bg = pick(BG);
    const size = pick(SIZE);
    const r = ratio(fg, bg);
    const min = size >= 24 ? 3 : 4.5;
    // los empates al filo del umbral no cuentan: el redondeo decidiria el test
    const borderline = Math.abs(r - min) < 0.1;
    blocks.push({ i, fg, bg, size, r, min, expectFail: !borderline && r < min, borderline });
  }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    body { margin:0; font-family: "Segoe UI", system-ui, sans-serif; }
    p { margin:0; padding:8px 16px; }
  </style></head><body>
  ${blocks.map((b) => `<p style="color:${b.fg};background:${b.bg};font-size:${b.size}px">B${b.i} ${b.fg} sobre ${b.bg} ${b.size}px</p>`).join("\n  ")}
  </body></html>`;

  const dir = join(TMP, `p${page}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");

  const res = spawnSync(process.execPath, [TOOL, `p${page}/index.html`, "--out", `o${page}`], {
    cwd: TMP,
    encoding: "utf8",
    timeout: 120000,
  });
  const out = (res.stdout || "") + (res.stderr || "");
  if (!/textos medidos/.test(out)) {
    console.error(`la pagina ${page} no produjo una medicion valida:\n${out.split("\n").slice(0, 6).join("\n")}`);
    process.exit(2);
  }

  for (const b of blocks) {
    if (b.borderline) { skipped++; continue; }
    const text = `B${b.i} ${b.fg} sobre ${b.bg} ${b.size}px`;
    const reported = out.includes(text);
    if (b.expectFail && reported) tp++;
    else if (b.expectFail && !reported) {
      fn++;
      problems.push(`FALSO NEGATIVO: "${text}" ratio ${b.r.toFixed(2)} < ${b.min}`);
    } else if (!b.expectFail && reported) {
      fp++;
      problems.push(`FALSO POSITIVO: "${text}" ratio ${b.r.toFixed(2)} >= ${b.min}`);
    } else tn++;
  }
}

rmSync(TMP, { recursive: true, force: true });

const total = tp + fp + fn + tn;
const precision = tp + fp ? tp / (tp + fp) : 1;
const recall = tp + fn ? tp / (tp + fn) : 1;

console.log(`fuzz contraste · seed ${SEED} · ${PAGES} paginas · ${total} bloques`);
console.log(`  aciertos: ${tp} fallos + ${tn} aprobados`);
console.log(`  falsos positivos: ${fp}`);
console.log(`  falsos negativos: ${fn}`);
console.log(`  al filo del umbral (ignorados): ${skipped}`);
console.log(`  precision ${(precision * 100).toFixed(1)}%  recall ${(recall * 100).toFixed(1)}%`);

if (problems.length) {
  console.log("");
  for (const p of problems.slice(0, 15)) console.log("  " + p);
  process.exit(1);
}
console.log("\nok: la verdad analitica coincide con el motor");
