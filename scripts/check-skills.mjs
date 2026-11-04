/**
 * Contrato de las skills: si esto falla, el cliente rechaza la skill en silencio
 * o el agente no sabe cuándo usarla.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../skills", import.meta.url));
const dirs = readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory());
assert.ok(dirs.length >= 5, `esperaba al menos 5 skills, hay ${dirs.length}`);

const seen = new Set();
for (const dir of dirs) {
  const file = join(ROOT, dir, "SKILL.md");
  assert.ok(existsSync(file), `${dir}: falta SKILL.md`);

  const text = readFileSync(file, "utf8");
  const fm = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  assert.ok(fm, `${dir}: sin frontmatter, el cliente no la registra`);

  const name = fm[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const desc = fm[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();

  assert.equal(name, dir, `${dir}: name debe coincidir con la carpeta`);
  assert.ok(!seen.has(name), `${dir}: nombre duplicado`);
  seen.add(name);

  assert.ok(desc, `${dir}: falta description`);
  assert.ok(desc.length >= 60, `${dir}: description demasiado corta para dispararse`);
  assert.ok(desc.length <= 1024, `${dir}: description pasa de 1024 caracteres y se rechaza`);
  assert.match(desc, /[ÚU]sala/, `${dir}: la description no dice cuándo usarla`);

  assert.match(text, /^## Límites honestos/m, `${dir}: falta "## Límites honestos"`);

  console.log(`  ${name.padEnd(26)} ${String(desc.length).padStart(4)} chars`);
}

console.log(`ok: ${dirs.length} skills cumplen el contrato`);
