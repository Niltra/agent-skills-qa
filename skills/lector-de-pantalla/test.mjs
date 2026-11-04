import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const at = (n) => join(DIR, n);
const run = (...args) =>
  spawnSync(process.execPath, ["lector.mjs", ...args], { cwd: DIR, encoding: "utf8" });

rmSync(at("shots-test"), { recursive: true, force: true });

// 1. La pagina mala: los ocho problemas conocidos.
const malo = run("./fixture/malo.html", "--out", "shots-test");
assert.equal(malo.status, 1, malo.stdout + malo.stderr);
for (const check of [
  "imagen sin alternativa",
  "alt = nombre del fichero",
  "alt genérico",
  "enlace sin nombre útil",
  "botón sin nombre útil",
  "texto repetido",
  "salto de encabezado",
]) {
  assert.match(malo.stdout, new RegExp(check), `no detectó: ${check}`);
}
assert.match(malo.stdout, /LO QUE OYE/, "no imprime la transcripción");
assert.ok(existsSync(at("shots-test/lector.txt")), "no guarda el árbol");

// 2. La pagina buena: cero ruido.
const bueno = run("./fixture/bueno.html", "--out", "shots-test");
assert.equal(bueno.status, 0, bueno.stdout + bueno.stderr);
assert.match(bueno.stdout, /nombre útil/);
assert.doesNotMatch(bueno.stdout, /RUIDO/);

// 3. Idioma declarado distinto del real.
const idioma = run("./fixture/idioma.html", "--out", "shots-test");
assert.equal(idioma.status, 1);
assert.match(idioma.stdout, /idioma declarado incorrecto/);
assert.match(idioma.stdout, /parece en/);

// 4. Errores de uso.
assert.notEqual(run().status, 0, "sin url debe fallar");
assert.notEqual(run("./fixture/bueno.html", "--wat", "1").status, 0, "flag desconocido debe fallar");

rmSync(at("shots-test"), { recursive: true, force: true });
console.log("ok: 8 ruidos detectados, pagina limpia aprobada, idioma y errores de uso");
