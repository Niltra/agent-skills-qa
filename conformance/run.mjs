#!/usr/bin/env node
/**
 * Banco de conformidad. Cada caso tiene un defecto conocido y un resultado
 * esperado escrito de antemano. No toca ninguna web externa.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CASES } from "./cases.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(DIR, "..");
const TMP = join(DIR, ".tmp");

const TOOLS = {
  "contraste-real": join(ROOT, "skills", "contraste-real", "contraste.mjs"),
  rompelayout: join(ROOT, "skills", "rompelayout", "rompelayout.mjs"),
  "formulario-que-no-miente": join(ROOT, "skills", "formulario-que-no-miente", "formulario.mjs"),
};

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let passed = 0;
const failed = [];

for (const c of CASES) {
  const dir = join(TMP, c.name);
  mkdirSync(dir, { recursive: true });
  if (c.files) {
    for (const [name, html] of Object.entries(c.files)) writeFileSync(join(dir, name), html, "utf8");
  } else {
    writeFileSync(join(dir, "index.html"), c.html, "utf8");
  }

  const target = c.tool === "rompelayout" ? `${c.name}/{locale}.html` : `${c.name}/index.html`;
  const r = spawnSync(process.execPath, [TOOLS[c.tool], target, ...c.args, "--out", `out-${c.name}`], {
    cwd: TMP,
    encoding: "utf8",
    timeout: 120000,
  });
  const out = (r.stdout || "") + (r.stderr || "");

  const errors = [];
  if (r.status !== c.expect.exit) errors.push(`exit ${r.status}, se esperaba ${c.expect.exit}`);
  for (const p of c.expect.has || []) if (!new RegExp(p).test(out)) errors.push(`falta /${p}/`);
  for (const p of c.expect.hasNot || []) if (new RegExp(p).test(out)) errors.push(`sobra /${p}/`);

  if (errors.length) {
    failed.push({ name: c.name, errors, out });
    console.log(`FALLO  ${c.name.padEnd(28)} ${errors.join("; ")}`);
  } else {
    passed++;
    console.log(`ok     ${c.name}`);
  }
}

console.log(`\n${passed}/${CASES.length} casos correctos`);

if (failed.length) {
  for (const f of failed) {
    console.log(`\n===== ${f.name} =====`);
    console.log(f.out.trim().split("\n").slice(0, 25).join("\n"));
  }
  process.exit(1);
}
