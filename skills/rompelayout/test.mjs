import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const at = (n) => join(DIR, n);
const run = (...args) =>
  spawnSync(process.execPath, ["rompelayout.mjs", ...args], { cwd: DIR, encoding: "utf8" });

rmSync(at("shots-test"), { recursive: true, force: true });

// 1. German breaks the layout: must fail and name the three elements.
const bad = run("./fixture/{locale}.html", "--locales", "es,en,de", "--out", "shots-test");
assert.equal(bad.status, 1, bad.stderr);
assert.match(bad.stdout, /de\s+2\s+2\s+0/);
assert.match(bad.stdout, /recortes con ellipsis/, "the ellipsis cases should be reported as review, not failure");
assert.match(bad.stdout, /es\s+0/);
assert.match(bad.stdout, /en\s+0/);
assert.match(bad.stdout, /nav\.nav-links/, "missed the nav container");
assert.match(bad.stdout, /clipped-x/, "missed the clipped heading/button");
assert.match(bad.stdout, /child-out/, "missed the child escaping its container");
assert.ok(existsSync(at("shots-test/de.png")), "no screenshot for the broken locale");
assert.ok(!existsSync(at("shots-test/es.png")), "wrote a screenshot for a clean locale");

// 2. Same set without German: must pass.
const good = run("./fixture/{locale}.html", "--locales", "es,en", "--out", "shots-test-ok");
assert.equal(good.status, 0, good.stdout + good.stderr);
assert.match(good.stdout, /ningún elemento se rompe solo por cambiar de idioma/);

// 3. Unknown flag is an error, not a silent pass.
const typo = run("./fixture/{locale}.html", "--locale", "es");
assert.notEqual(typo.status, 0, "a typo in the flags must not pass silently");

// 3b. A breakage that already exists in the base locale is not caused by translation.
const same = run("./fixture/mismo-{locale}.html", "--locales", "es,de", "--out", "shots-test");
assert.equal(same.status, 0, same.stdout + same.stderr);
assert.match(same.stdout, /ya existen en es/);
assert.match(same.stdout, /es\s+0\s+0\s+1/);

rmSync(at("shots-test"), { recursive: true, force: true });
rmSync(at("shots-test-ok"), { recursive: true, force: true });

// 4. A config file sets the defaults without touching code.
writeFileSync(at("tmp-config.json"), JSON.stringify({ locales: ["es", "en"], out: "shots-cfg" }));
const cfg = run("./fixture/{locale}.html", "--config", "tmp-config.json");
assert.equal(cfg.status, 0, cfg.stdout + cfg.stderr);
assert.match(cfg.stdout, /es\s+0/);
assert.match(cfg.stdout, /en\s+0/);
assert.doesNotMatch(cfg.stdout, /de\s+3/, "the config locales were ignored");

// 5. A missing config fails loudly.
assert.notEqual(run("./fixture/{locale}.html", "--config", "nope.json").status, 0);

// 6. A page with no text at all is not a failure, and must not crash.
const empty = run("./fixture/vacio.html", "--locales", "es,de", "--out", "shots-test");
assert.equal(empty.status, 0, empty.stdout + empty.stderr);
assert.match(empty.stdout, /es\s+0\s+0\s+0/);

rmSync(at("shots-cfg"), { recursive: true, force: true });
rmSync(at("tmp-config.json"), { force: true });

console.log("ok: 2 hard breaks + 2 ellipsis, clean locales pass, bad flags fail, config respected");
