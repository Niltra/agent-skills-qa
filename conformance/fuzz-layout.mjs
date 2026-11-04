#!/usr/bin/env node
/**
 * Fuzz de layout con verdad por construccion.
 * Cada caja tiene un texto que o cabe o no cabe por diseno, no por medicion.
 * Se compara lo esperado con lo que reporta el motor.
 *
 *   node conformance/fuzz-layout.mjs --seed 3 --pages 12
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(DIR, "..");
const TMP = join(DIR, ".fuzz-layout");
const TOOL = join(ROOT, "skills", "rompelayout", "rompelayout.mjs");

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
};
const SEED = Number(opt("seed", 1));
const PAGES = Number(opt("pages", 10));
const BOXES = Number(opt("boxes", 5));

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

// 3 letras "i" caben de sobra en 140 px; 16 "W" no caben ni de lejos.
const CORTO = "iii";
const LARGO = "WWWWWWWWWWWWWWWW";

const page = (boxes) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 20px; font: 20px/1.5 "Segoe UI", system-ui, sans-serif; }
  .caja { width: 140px; overflow: hidden; white-space: nowrap; border: 1px solid #ccc; margin-bottom: 8px; }
</style></head><body>
${boxes.map((b, i) => `<div class="caja" id="c${i}"><span>${b}</span></div>`).join("\n")}
</body></html>`;

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let tp = 0, fp = 0, fn = 0, tn = 0;
const problems = [];

for (let p = 0; p < PAGES; p++) {
  const expected = [];
  const es = [];
  const de = [];
  for (let i = 0; i < BOXES; i++) {
    const esOver = rand() < 0.5;
    const deOver = rand() < 0.5;
    es.push(esOver ? LARGO : CORTO);
    de.push(deOver ? LARGO : CORTO);
    // Solo es fallo lo que rompe en aleman y no en el idioma base.
    expected.push(deOver && !esOver);
  }

  const dir = join(TMP, `p${p}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "es.html"), page(es), "utf8");
  writeFileSync(join(dir, "de.html"), page(de), "utf8");

  const res = spawnSync(
    process.execPath,
    [TOOL, `p${p}/{locale}.html`, "--locales", "es,de", "--out", `o${p}`],
    { cwd: TMP, encoding: "utf8", timeout: 120000 },
  );
  const out = (res.stdout || "") + (res.stderr || "");
  if (!/locale/.test(out) || (res.status !== 0 && res.status !== 1)) {
    console.error(`la pagina ${p} no midio (exit ${res.status}):\n${out.split("\n").slice(0, 6).join("\n")}`);
    process.exit(2);
  }

  // El motor lista los ids de las cajas nuevas que rompen.
  for (let i = 0; i < BOXES; i++) {
    const reported = new RegExp(`id="?c${i}"?`).test(out) || new RegExp(`#c${i}\\b`).test(out);
    if (expected[i] && reported) tp++;
    else if (expected[i] && !reported) { fn++; problems.push(`FALSO NEGATIVO: caja ${i} de la pagina ${p}`); }
    else if (!expected[i] && reported) { fp++; problems.push(`FALSO POSITIVO: caja ${i} de la pagina ${p}`); }
    else tn++;
  }
}

rmSync(TMP, { recursive: true, force: true });

const total = tp + fp + fn + tn;
const precision = tp + fp ? tp / (tp + fp) : 1;
const recall = tp + fn ? tp / (tp + fn) : 1;

console.log(`fuzz layout · seed ${SEED} · ${PAGES} paginas · ${total} cajas`);
console.log(`  aciertos: ${tp} roturas + ${tn} sanas`);
console.log(`  falsos positivos: ${fp}`);
console.log(`  falsos negativos: ${fn}`);
console.log(`  precision ${(precision * 100).toFixed(1)}%  recall ${(recall * 100).toFixed(1)}%`);

if (problems.length) {
  console.log("");
  for (const pr of problems.slice(0, 15)) console.log("  " + pr);
  process.exit(1);
}
console.log("\nok: la construccion coincide con el motor");
