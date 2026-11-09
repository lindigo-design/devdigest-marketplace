#!/usr/bin/env node
// Builds the site from a fixture and serves it under its base path, like GitHub Pages does, for Playwright.
//   node test/e2e/serve.mjs [--fixture demo] [--port 4399] [--no-build]
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { buildSite, FIXTURES } from "../build/harness.mjs";
import { readConfig } from "../../lib/config.mjs";

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : d; };
const fixture = arg("fixture", "demo");
const port = Number(arg("port", "4399"));
const base = readConfig({}).base; // the harness builds with the default origin and base

// One tagged release, so the plugin page shows its Download source link (spec CAT-02 R5).
const built = buildSite({ repoRoot: join(FIXTURES, fixture), env: { CATALOG_RELEASE_TAGS: "sdd-engineering--v0.1.0" } });
const root = resolve(built.out);
process.on("exit", () => built.cleanup());
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".xml": "application/atom+xml; charset=utf-8", ".woff2": "font/woff2",
  ".svg": "image/svg+xml", ".png": "image/png",
};

function send(res, status, file) {
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/" || !path.startsWith(base)) { res.writeHead(302, { Location: base }); res.end(); return; }
  let file = resolve(root, normalize(path.slice(base.length)));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (existsSync(file)) send(res, 200, file);
  else send(res, 404, join(root, "404.html"));
}).listen(port, () => console.log(`serving ${fixture} at http://localhost:${port}${base}`));
