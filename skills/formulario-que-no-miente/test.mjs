import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const at = (n) => join(DIR, n);
const run = (...args) =>
  spawnSync(process.execPath, ["formulario.mjs", ...args], { cwd: DIR, encoding: "utf8" });

const CHECKS = [
  "nombre accesible",
  "envío vacío bloqueado",
  "error anunciado",
  "foco al primer error",
  "espacios no cuentan",
  "doble envío",
  "autocompletado",
];

rmSync(at("shots-test"), { recursive: true, force: true });
rmSync(at("shots-cfg"), { recursive: true, force: true });

// 1. The lying form must fail all seven checks.
const bad = run("./fixture/bad.html", "--out", "shots-test");
assert.equal(bad.status, 1, bad.stdout + bad.stderr);
for (const c of CHECKS) {
  assert.match(bad.stdout, new RegExp(`FALLO\\s+${c}`), `did not flag: ${c}`);
}
assert.ok(existsSync(at("shots-test/formulario.png")), "no evidence screenshot");

// 2. The correct form must pass all seven, and must actually submit once.
const good = run("./fixture/good.html", "--out", "shots-test");
assert.equal(good.status, 0, good.stdout + good.stderr);
assert.doesNotMatch(good.stdout, /FALLO/, "false positive on the correct form");
assert.match(
  good.stdout,
  /doble envío\s+1 peticiones/,
  "the valid double click submitted 0 times: the fill did not work",
);

// 3. Config file changes behaviour without touching code.
writeFileSync(at("tmp-config.json"), JSON.stringify({ out: "shots-cfg", wait: 400 }));
const cfg = run("./fixture/bad.html", "--config", "tmp-config.json");
assert.equal(cfg.status, 1);
assert.ok(existsSync(at("shots-cfg/formulario.png")), "config out path ignored");

// 4. Errors must be loud.
assert.notEqual(run().status, 0, "no url should fail");
assert.notEqual(run("./fixture/bad.html", "--wat", "1").status, 0, "unknown flag should fail");
assert.notEqual(run("./fixture/bad.html", "--config", "nope.json").status, 0, "missing config should fail");

rmSync(at("shots-test"), { recursive: true, force: true });
rmSync(at("shots-cfg"), { recursive: true, force: true });
rmSync(at("tmp-config.json"), { force: true });
console.log("ok: 7 checks catch the liar, 7 pass on the honest form, config respected");
