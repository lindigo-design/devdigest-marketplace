#!/usr/bin/env node
// Builds the public catalog index (index.json; schema: docs/catalog-index.md) from this repository, without
// building the site. Same code as the site (site/lib), so the index CI checks on every PR is the one the site
// serves. Prints counts and warnings; exits 1 naming every broken file.
//
//   npm --prefix site ci                                   # once: site/lib's dependencies
//   node scripts/build-index.mjs [--out <file>] [--root <repo>]
//
// Without --out it only builds and checks. CI: .github/workflows/site-build.yml ("Build the catalog index").
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lib = (name) => import(pathToFileURL(resolve(ROOT, "site", "lib", name)).href);

/**
 * @param {{ repoRoot?: string, env?: NodeJS.ProcessEnv, now?: Date }} [opts]
 * @returns {Promise<{ index: object, counts: Record<string, number>, warnings: { file: string, reason: string }[], name: string }>}
 */
export async function buildIndex({ repoRoot = ROOT, env = process.env, now = new Date() } = {}) {
  const { buildCatalog, countByKind } = await lib("catalog.mjs");
  const { readConfig } = await lib("config.mjs");
  const { toIndexJson } = await lib("index-json.mjs");
  const catalog = buildCatalog({ repoRoot });
  const index = toIndexJson(catalog, readConfig(env), { now });
  if (index.entries.length !== catalog.entries.length) {
    throw new Error(`index has ${index.entries.length} entries, catalog ${catalog.entries.length}`);
  }
  return { index, counts: countByKind(catalog.entries), warnings: catalog.warnings, name: catalog.marketplace.name };
}

async function main(argv) {
  const opt = (flag) => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : undefined; };
  const out = opt("--out");
  const repoRoot = opt("--root") ? resolve(opt("--root")) : ROOT;
  const { CatalogError } = await lib("errors.mjs");
  try {
    const { index, counts: c, warnings, name } = await buildIndex({ repoRoot });
    for (const w of warnings) console.warn(`warning: ${w.file}: ${w.reason}`);
    console.log(
      `${name}: ${c.plugin} plugins, ${c.skill} skills, ${c.agent} agents, ${c.command} commands, ` +
        `${c.hook} hooks, ${c.mcp} MCP servers (${index.entries.length} entries, schemaVersion ${index.schemaVersion})`,
    );
    if (out) {
      mkdirSync(dirname(resolve(out)), { recursive: true });
      writeFileSync(out, `${JSON.stringify(index)}\n`);
      console.log(`wrote ${out}`);
    }
  } catch (err) {
    if (!(err instanceof CatalogError)) throw err;
    console.error(err.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
