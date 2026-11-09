// Builds the real site from a fixture repository into a temp directory and reads its pages.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FIXTURES = join(SITE, "test", "fixtures");

/**
 * @param {{ repoRoot: string, env?: Record<string,string> }} opts
 * @returns {{ out: string, page: (path: string) => string, pages: () => string[], cleanup: () => void, log: string }}
 */
export function buildSite({ repoRoot, env = {} }) {
  // Same drive as the site: Astro moves its output with rename(), which fails across drives (EXDEV).
  mkdirSync(join(SITE, ".test-dist"), { recursive: true });
  const out = mkdtempSync(join(SITE, ".test-dist", "build-"));
  const astro = join(SITE, "node_modules", "astro", "bin", "astro.mjs");
  const res = spawnSync(process.execPath, [astro, "build", "--outDir", out], {
    cwd: SITE,
    encoding: "utf8",
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", CATALOG_REPO_ROOT: repoRoot, ...env },
  });
  const log = `${res.stdout}\n${res.stderr}`;
  if (res.status !== 0) throw new Error(`astro build failed (${res.status}):\n${log}`);
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [relative(out, join(d, e.name)).replace(/\\/g, "/")]);
  return {
    out,
    log,
    /** Site path ("sdd-engineering/") → HTML of its index.html; "" for the home page. */
    page(path) {
      const file = path.endsWith(".html") || path.endsWith(".xml") || path.endsWith(".json") ? path : join(path, "index.html");
      const abs = join(out, file);
      if (!existsSync(abs)) throw new Error(`no page at ${path} (${file})`);
      return readFileSync(abs, "utf8");
    },
    pages: () => walk(out),
    cleanup: () => rmSync(out, { recursive: true, force: true }),
  };
}

/** Text content of HTML, tags removed and whitespace collapsed, for readable assertions. */
export const text = (html) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
