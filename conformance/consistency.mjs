#!/usr/bin/env node
/**
 * Los cinco motores comparten un parser duplicado a propósito (cada skill se
 * instala sola). Esta prueba comprueba que las cinco copias se comportan igual
 * en los casos que antes fallaban en silencio.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const TOOLS = [
  { name: "rompelayout", dir: "skills/rompelayout", file: "rompelayout.mjs", arg: "./fixture/{locale}.html", extra: ["--locales", "es"], num: "--width" },
  { name: "contraste-real", dir: "skills/contraste-real", file: "contraste.mjs", arg: "./fixture/index.html", extra: [], num: "--maxItems" },
  { name: "formulario", dir: "skills/formulario-que-no-miente", file: "formulario.mjs", arg: "./fixture/bad.html", extra: [], num: "--wait" },
  { name: "lector", dir: "skills/lector-de-pantalla", file: "lector.mjs", arg: "./fixture/bueno.html", extra: [], num: "--maxNodes" },
  { name: "cercanias", dir: "../cercanias", file: "cercanias.mjs", arg: "./fixture/snapshots", extra: [], num: "--late" },
];

const run = (t, args) =>
  spawnSync(process.execPath, [t.file, t.arg, ...t.extra, ...args], {
    cwd: join(ROOT, t.dir),
    encoding: "utf8",
  });

const check = (t, args, needle) => {
  const r = run(t, args);
  const out = (r.stdout || "") + (r.stderr || "");
  assert.equal(r.status, 2, `${t.name} ${args.join(" ")}: exit ${r.status}, se esperaba 2\n${out.slice(0, 300)}`);
  assert.match(out, new RegExp(needle), `${t.name} ${args.join(" ")}: falta "${needle}"`);
  assert.doesNotMatch(out, /\n\s+at /, `${t.name} ${args.join(" ")}: imprime stack trace`);
};

for (const t of TOOLS) {
  check(t, ["--out"], "necesita un valor");
  check(t, [t.num, "abc"], "inválido");
  check(t, ["--no-existe", "1"], "flag desconocido");
  console.log(`ok     ${t.name}`);
}

console.log(`\n${TOOLS.length}/${TOOLS.length} parsers se comportan igual`);
