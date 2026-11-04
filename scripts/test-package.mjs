#!/usr/bin/env node
/**
 * Prueba de instalación: copia cada skill sola a una carpeta temporal y la ejecuta.
 * Si depende de algo que está fuera de su carpeta, falla aquí.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "skills");
const TMP = join(ROOT, "conformance", ".package");

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const skills = [
  "rompelayout",
  "contraste-real",
  "formulario-que-no-miente",
  "lector-de-pantalla",
  "dice-vs-hace",
  "declaracion-eaa",
];

let ok = 0;
const failed = [];

for (const name of skills) {
  const dst = join(TMP, name);
  cpSync(join(SRC, name), dst, { recursive: true });

  const problems = [];
  if (!existsSync(join(dst, "SKILL.md"))) problems.push("falta SKILL.md");

  const hasTest = existsSync(join(dst, "test.mjs"));
  if (hasTest) {
    const r = spawnSync(process.execPath, ["test.mjs"], { cwd: dst, encoding: "utf8", timeout: 180000 });
    if (r.status !== 0) problems.push(`test falla copiada sola: ${(r.stdout + r.stderr).split("\n")[0]}`);
  }

  if (problems.length) {
    failed.push({ name, problems });
    console.log(`FALLO  ${name.padEnd(26)} ${problems.join("; ")}`);
  } else {
    ok++;
    console.log(`ok     ${name.padEnd(26)} ${hasTest ? "motor funciona en copia limpia" : "procedimiento, sin motor"}`);
  }
}

rmSync(TMP, { recursive: true, force: true });

console.log(`\n${ok}/${skills.length} skills funcionan instaladas solas`);
if (failed.length) process.exit(1);
