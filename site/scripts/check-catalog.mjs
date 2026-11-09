#!/usr/bin/env node
// Builds the catalog only (no site), prints counts and warnings, exits 1 naming every broken file.
//   node scripts/check-catalog.mjs [--root <repo>]
import { buildCatalog, countByKind, defaultRepoRoot } from "../lib/catalog.mjs";
import { CatalogError } from "../lib/errors.mjs";

const i = process.argv.indexOf("--root");
const repoRoot = i > -1 ? process.argv[i + 1] : defaultRepoRoot();

try {
  const { marketplace, entries, warnings } = buildCatalog({ repoRoot });
  for (const w of warnings) console.warn(`warning: ${w.file}: ${w.reason}`);
  const c = countByKind(entries);
  console.log(
    `${marketplace.name}: ${c.plugin} plugins, ${c.skill} skills, ${c.agent} agents, ` +
      `${c.command} commands, ${c.hook} hooks, ${c.mcp} MCP servers (${entries.length} entries)`,
  );
} catch (err) {
  if (!(err instanceof CatalogError)) throw err;
  console.error(err.message);
  process.exitCode = 1;
}
