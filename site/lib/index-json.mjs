// Public, versioned catalog index (spec CAT-01 R9/AC-6). The browser loads the same file for search (R2/AC-1),
// so it carries only what cards, filters and search need; page-only data (bodies, frontmatter) stays out.
// Schema: docs/catalog-index.md. A breaking change bumps SCHEMA_VERSION.
import { encodeBodies } from "../src/client/body-index.mjs";
import { absUrl, repoSlug } from "./config.mjs";

export const SCHEMA_VERSION = 1;

/** Install commands (R3/AC-4, R5/AC-3). */
export function installCommands(config, marketplaceName, plugin) {
  return {
    marketplaceAdd: `/plugin marketplace add ${repoSlug(config)}`,
    install: `/plugin install ${plugin}@${marketplaceName}`,
  };
}

const entryFields = (e) => ({
  id: e.id,
  kind: e.kind,
  name: e.name,
  plugin: e.plugin,
  description: e.description,
  tags: e.tags,
  ownTagCount: e.ownTagCount, // the first N tags are the entry's own; the rest are inherited from its plugin
  version: e.version,
  category: e.category,
  compat: e.compat,
  runs: e.runs,
  source: e.source,
  path: e.path,
});

/**
 * @param {ReturnType<import("./catalog.mjs").buildCatalog>} catalog
 * @param {ReturnType<import("./config.mjs").readConfig>} config
 * @param {{ now?: Date }} [opts]
 */
export function toIndexJson(catalog, config, { now = new Date() } = {}) {
  const mk = catalog.marketplace;
  return {
    schemaVersion: SCHEMA_VERSION,
    generated: now.toISOString(),
    site: absUrl(config, ""),
    marketplace: {
      name: mk.name,
      description: mk.description,
      owner: mk.owner,
      repository: config.repo,
      addCommand: installCommands(config, mk.name, "").marketplaceAdd,
      lastRelease: catalog.lastRelease,
    },
    synonyms: catalog.synonyms,
    plugins: catalog.plugins.map((p) => ({
      name: p.name,
      dependencies: p.page.dependencies.map(({ name, range, satisfied }) => ({ name, range, satisfied })),
      usedBy: p.page.usedBy,
      url: absUrl(config, p.path),
    })),
    entries: catalog.entries.map(entryFields),
    // Body terms of entries[i], as a vocabulary + postings (plan D7); see src/client/body-index.mjs.
    body: encodeBodies(catalog.entries.map((e) => e.bodyTerms)),
  };
}
