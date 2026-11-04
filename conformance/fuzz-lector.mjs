#!/usr/bin/env node
/**
 * Fuzz del lector con verdad por construccion.
 * Cada elemento de la pagina se genera con un defecto conocido o limpio,
 * y se comprueba si el motor lo anuncia o lo calla.
 *
 *   node conformance/fuzz-lector.mjs --seed 1 --pages 12
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(DIR, "..");
const TMP = join(DIR, ".fuzz-lector");
const TOOL = join(ROOT, "skills", "lector-de-pantalla", "lector.mjs");

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
};
const SEED = Number(opt("seed", 1));
const PAGES = Number(opt("pages", 12));
const ITEMS = Number(opt("items", 8));

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

const KINDS = [
  { kind: "img-good", defect: null },
  { kind: "img-file", defect: "alt = nombre del fichero" },
  { kind: "img-generic", defect: "alt genérico" },
  { kind: "img-none", defect: "imagen sin alternativa" },
  { kind: "img-long", defect: "alt demasiado largo" },
  { kind: "link-good", defect: null },
  { kind: "link-generic", defect: "enlace sin nombre útil" },
  { kind: "button-empty", defect: "botón sin nombre útil" },
  { kind: "repeat", defect: "texto repetido" },
];

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let tp = 0, fp = 0, fn = 0, tn = 0;
const problems = [];

for (let p = 0; p < PAGES; p++) {
  const blocks = [];
  const expected = [];
  const cleanNames = [];

  for (let i = 0; i < ITEMS; i++) {
    const { kind, defect } = KINDS[Math.floor(rand() * KINDS.length)];
    const unique = `Elemento${p}_${i}`;
    if (kind === "img-good") {
      blocks.push(`<img src="i${i}.png" alt="Descripción ${unique}">`);
      cleanNames.push(`Descripción ${unique}`);
    } else if (kind === "img-file") {
      blocks.push(`<img src="i${i}.png" alt="foto-${unique}.jpg">`);
      expected.push("alt = nombre del fichero");
    } else if (kind === "img-generic") {
      blocks.push(`<img src="i${i}.png" alt="imagen">`);
      expected.push("alt genérico");
    } else if (kind === "img-none") {
      blocks.push(`<img src="i${i}.png">`);
      expected.push("imagen sin alternativa");
    } else if (kind === "img-long") {
      blocks.push(`<img src="i${i}.png" alt="${"Descripción muy larga ".repeat(8)}${unique}">`);
      expected.push("alt demasiado largo");
    } else if (kind === "link-good") {
      blocks.push(`<a href="/${unique}">Ver ${unique}</a>`);
      cleanNames.push(`Ver ${unique}`);
    } else if (kind === "link-generic") {
      blocks.push(`<a href="/${unique}">leer más</a>`);
      expected.push("enlace sin nombre útil");
    } else if (kind === "button-empty") {
      blocks.push(`<button></button>`);
      expected.push("botón sin nombre útil");
    } else {
      blocks.push(
        `<img src="r${i}a.png" alt="Producto repetido">`,
        `<img src="r${i}b.png" alt="Producto repetido">`,
        `<img src="r${i}c.png" alt="Producto repetido">`,
      );
      expected.push("texto repetido");
    }
  }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>
<h1>Prueba ${p}</h1>
${blocks.join("\n")}
</body></html>`;

  const dir = join(TMP, `p${p}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");

  const res = spawnSync(process.execPath, [TOOL, `p${p}/index.html`, "--out", `o${p}`], {
    cwd: TMP,
    encoding: "utf8",
    timeout: 120000,
  });
  const out = (res.stdout || "") + (res.stderr || "");
  if (!/LO QUE OYE/.test(out) || (res.status !== 0 && res.status !== 1)) {
    console.error(`la pagina ${p} no produjo transcripcion (exit ${res.status}):\n${out.split("\n").slice(0, 6).join("\n")}`);
    process.exit(2);
  }

  // Solo cuenta lo que aparece en la seccion de ruido.
  const noise = out.split("RUIDO:")[1] || "";

  for (const d of expected) {
    if (noise.includes(d)) tp++;
    else { fn++; problems.push(`FALSO NEGATIVO: esperaba "${d}" en la pagina ${p}`); }
  }
  for (const name of cleanNames) {
    if (noise.includes(name)) { fp++; problems.push(`FALSO POSITIVO: "${name}" en la pagina ${p}`); }
    else tn++;
  }
}

rmSync(TMP, { recursive: true, force: true });

const total = tp + fp + fn + tn;
const precision = tp + fp ? tp / (tp + fp) : 1;
const recall = tp + fn ? tp / (tp + fn) : 1;

console.log(`fuzz lector · seed ${SEED} · ${PAGES} paginas · ${total} comprobaciones`);
console.log(`  aciertos: ${tp} defectos + ${tn} limpios`);
console.log(`  falsos positivos: ${fp}`);
console.log(`  falsos negativos: ${fn}`);
console.log(`  precision ${(precision * 100).toFixed(1)}%  recall ${(recall * 100).toFixed(1)}%`);

if (problems.length) {
  console.log("");
  for (const pr of problems.slice(0, 15)) console.log("  " + pr);
  process.exit(1);
}
console.log("\nok: la construccion coincide con el motor");
