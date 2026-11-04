import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const at = (n) => join(DIR, n);
const run = (...args) =>
  spawnSync(process.execPath, ["contraste.mjs", ...args], { cwd: DIR, encoding: "utf8" });

rmSync(at("shots-test"), { recursive: true, force: true });

// 1. AA: the hero over a gradient fails, the dark paragraph passes.
const aa = run("./fixture/index.html", "--out", "shots-test");
assert.equal(aa.status, 1, aa.stderr + aa.stdout);
assert.match(aa.stdout, /hero > h1/, "missed the low-contrast headline");
assert.match(aa.stdout, /hero > p/, "missed the low-contrast paragraph");
assert.doesNotMatch(aa.stdout, /tinta sobre blanco/, "flagged the passing paragraph");
assert.doesNotMatch(aa.stdout, /titular grande/, "flagged the borderline heading under AA");
assert.ok(existsSync(at("shots-test/contraste.png")), "no evidence screenshot");

// 2. AAA is stricter: the borderline large heading must now fail too.
const aaa = run("./fixture/index.html", "--level", "AAA", "--out", "shots-test");
assert.equal(aaa.status, 1);
assert.match(aaa.stdout, /titular grande/, "AAA did not catch the borderline heading");

// 3. A custom target overrides the level entirely.
const loose = run("./fixture/index.html", "--target", "1", "--out", "shots-test");
assert.equal(loose.status, 0, loose.stdout + loose.stderr);
assert.match(loose.stdout, /ok:/);

// 4. Unknown flag must not pass silently.
assert.notEqual(run("./fixture/index.html", "--levl", "AAA").status, 0);

// 5. A config file can raise the bar without touching code.
writeFileSync(at("tmp-config.json"), JSON.stringify({ level: "AAA", out: "shots-cfg" }));
const cfg = run("./fixture/index.html", "--config", "tmp-config.json");
assert.equal(cfg.status, 1, cfg.stdout + cfg.stderr);
assert.match(cfg.stdout, /titular grande/, "the config level was ignored");

// 6. A missing config fails loudly.
assert.notEqual(run("./fixture/index.html", "--config", "nope.json").status, 0);

rmSync(at("shots-test"), { recursive: true, force: true });
rmSync(at("shots-cfg"), { recursive: true, force: true });
rmSync(at("tmp-config.json"), { force: true });
console.log("ok: AA gradient, AAA borderline, target override, config respected, bad flags fail");
