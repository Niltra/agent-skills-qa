#!/usr/bin/env node
/**
 * Bateria real: lanza los motores contra webs publicas de solo lectura.
 * No escribe nada en esos sitios. Guarda salida cruda y un resumen.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(DIR, "..");
const OUT = join(DIR, "results");
mkdirSync(OUT, { recursive: true });

const CASES = [
  { slug: "mozilla", tool: "rompelayout", url: "https://www.mozilla.org/{locale}/", args: ["--locales", "en-US,de"] },
  { slug: "mdn", tool: "rompelayout", url: "https://developer.mozilla.org/{locale}/", args: ["--locales", "en-US,de"] },
  { slug: "wikipedia-de", tool: "rompelayout", url: "https://{locale}.wikipedia.org/wiki/Madrid", args: ["--locales", "es,de"] },
  { slug: "wikipedia-3", tool: "rompelayout", url: "https://{locale}.wikipedia.org/wiki/Madrid", args: ["--locales", "es,en,fr"] },
  { slug: "wordpress", tool: "rompelayout", url: "https://{locale}.wordpress.org/", args: ["--locales", "en,de"] },
  { slug: "php-manual", tool: "rompelayout", url: "https://www.php.net/manual/{locale}/", args: ["--locales", "en,de"] },
  { slug: "mozilla-contraste", tool: "contraste-real", url: "https://www.mozilla.org/en-US/", args: ["--level", "AA"] },
  { slug: "mdn-contraste", tool: "contraste-real", url: "https://developer.mozilla.org/en-US/", args: ["--level", "AA"] },
  { slug: "stripe-contraste", tool: "contraste-real", url: "https://stripe.com/", args: ["--level", "AA"] },
  { slug: "github-contraste", tool: "contraste-real", url: "https://github.com/", args: ["--level", "AA"] },
  { slug: "wikipedia-contraste", tool: "contraste-real", url: "https://es.wikipedia.org/wiki/Madrid", args: ["--level", "AA"] },
];

const toolPath = {
  rompelayout: join(ROOT, "skills", "rompelayout", "rompelayout.mjs"),
  "contraste-real": join(ROOT, "skills", "contraste-real", "contraste.mjs"),
};

const summary = [];
for (const c of CASES) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [toolPath[c.tool], c.url, ...c.args, "--out", `bench/shots`], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 180000,
  });
  const out = (r.stdout || "") + (r.stderr || "");
  writeFileSync(join(OUT, `${c.slug}.txt`), out, "utf8");

  const ran = /^(ok|fallo):/m.test(out);
  const fails = Number((out.match(/^fallo: (\d+) de/m) || [])[1] ?? NaN);
  const below = Number((out.match(/(\d+) por debajo/) || [])[1] ?? NaN);
  const hard = Number((out.match(/\n(\w[\w-]*)\s+(\d+)\s+\d+\s+\d+/g) || []).length);

  summary.push({
    slug: c.slug,
    tool: c.tool,
    exit: r.status,
    ran,
    seconds: Math.round((Date.now() - started) / 1000),
    fails: Number.isNaN(fails) ? null : fails,
    below: Number.isNaN(below) ? null : below,
    hard: c.tool === "rompelayout" ? hard : null,
    note: ran ? "" : out.split("\n").find((l) => /Error|error/.test(l)) || "sin salida reconocible",
  });
  console.log(`${c.slug.padEnd(22)} ${ran ? "ok " : "CRASH"} exit=${r.status} ${summary.at(-1).seconds}s`);
}

writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log("\n" + JSON.stringify(summary, null, 2));
