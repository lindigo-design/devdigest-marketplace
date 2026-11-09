// Build-time catalog (spec CAT-01 R1): one entry per listed plugin and per component found under it.
// Pages, index.json and feeds are all derived from this object, so no component is hard-coded in site code (R1/AC-7).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { satisfies } from "../../scripts/lib/marketplace.mjs";
import { Problems } from "./errors.mjs";
import { RepoReader } from "./fs.mjs";
import { READERS } from "./sources/components.mjs";
import { readMarketplace, readPlugin } from "./sources/marketplace.mjs";

/** Order of kinds within a plugin and in the empty-query listing (spec R2/AC-8). */
export const KIND_ORDER = ["plugin", "skill", "agent", "command", "hook", "mcp"];

/** Default repository root: two levels above site/lib/. Override with CATALOG_REPO_ROOT. */
export function defaultRepoRoot(env = process.env) {
  return env.CATALOG_REPO_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/** Deps-first order; ties keep marketplace order. Reports cycles. */
function dependencyOrder(plugins, problems) {
  const byName = new Map(plugins.map((p) => [p.name, p]));
  const out = [];
  const state = new Map(); // name → "visiting" | "done"
  const visit = (p, path) => {
    const s = state.get(p.name);
    if (s === "done") return;
    if (s === "visiting") {
      problems.error(`${p.source}/.claude-plugin/plugin.json`, `dependency cycle: ${[...path, p.name].join(" → ")}`);
      return;
    }
    state.set(p.name, "visiting");
    for (const d of p.page.dependencies) {
      const dep = byName.get(d.name);
      if (dep) visit(dep, [...path, p.name]);
    }
    state.set(p.name, "done");
    out.push(p);
  };
  plugins.forEach((p) => visit(p, []));
  return out;
}

/**
 * @param {{ repoRoot?: string }} [opts]
 * @returns {{ marketplace, plugins, entries, warnings }} throws CatalogError listing every problem
 */
export function buildCatalog({ repoRoot = defaultRepoRoot() } = {}) {
  const problems = new Problems();
  const reader = new RepoReader(repoRoot);
  const base = { reader, problems };

  const mk = readMarketplace(base);
  problems.throwIfAny();

  const drafts = mk.listed.map((l) => readPlugin(base, l)).filter(Boolean);
  const plugins = dependencyOrder(drafts, problems);
  const byName = new Map(plugins.map((p) => [p.name, p]));

  const entries = [];
  for (const p of plugins) {
    // Resolve dependencies against the catalog (spec §7: unsatisfied range → warning on the page).
    p.page.dependencies = p.page.dependencies.map((d) => {
      const target = byName.get(d.name);
      return { ...d, inCatalog: !!target, satisfied: target ? satisfies(target.version, d.range) : null };
    });
    p.page.usedBy = plugins
      .filter((o) => o.page.dependencies.some((d) => d.name === p.name))
      .map((o) => o.name);

    const ctx = { ...base, dir: p.source };
    const comps = READERS.flatMap((read) => read(ctx))
      .map((c) => ({
        id: `${p.name}/${c.kind}/${c.slug}`,
        ...c,
        plugin: p.name,
        tags: p.tags,
        version: p.version,
        category: p.category,
        path: `${p.name}/${c.kind}/${c.slug}/`,
      }))
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    // Two components of one kind in one plugin must not share a URL (the plugin name already separates plugins).
    const ids = new Map();
    for (const c of comps) {
      if (ids.has(c.id)) problems.error(c.source, `duplicate ${c.kind} "${c.slug}" in plugin ${p.name} (also ${ids.get(c.id)})`);
      else ids.set(c.id, c.source);
    }

    p.id = p.name;
    p.path = `${p.name}/`;
    p.page.components = comps.map((c) => c.id);
    entries.push(p, ...comps);
  }

  problems.throwIfAny();
  return { marketplace: mk.marketplace, plugins, entries, warnings: problems.warnings };
}

/** Counts per kind for the home page stats (spec R8/AC-1). */
export function countByKind(entries) {
  const counts = Object.fromEntries(KIND_ORDER.map((k) => [k, 0]));
  for (const e of entries) counts[e.kind] += 1;
  return counts;
}
