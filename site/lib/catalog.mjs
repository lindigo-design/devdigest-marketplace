// Build-time catalog (spec CAT-01 R1): one entry per listed plugin and per component found under it.
// Pages, index.json and feeds are all derived from this object, so no component is hard-coded in site code (R1/AC-7).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { satisfies } from "../../scripts/lib/marketplace.mjs";
import { parseChangelog, sectionUpdateTimes, sortReleases, updatedTime } from "./changelog.mjs";
import { parseCompatibility } from "./compatibility.mjs";
import { Problems } from "./errors.mjs";
import { RepoReader } from "./fs.mjs";
import { READERS } from "./sources/components.mjs";
import { loadSynonyms } from "./synonyms.mjs";

/** site/synonyms.json, next to this package (not inside the scanned repo, so fixtures share it).
 * Inside an Astro build the bundled path is wrong; astro.config.mjs sets CATALOG_SYNONYMS instead. */
export const DEFAULT_SYNONYMS = join(dirname(fileURLToPath(import.meta.url)), "..", "synonyms.json");
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

/** Releases of one plugin from its CHANGELOG (R8), with `updated` from git history when available (§7). */
function readReleases(ctx, p, history) {
  const file = `${p.source}/CHANGELOG.md`;
  if (!ctx.reader.isFile(file)) {
    ctx.problems.warn(file, "no CHANGELOG; the plugin has no releases in What's new or the feeds");
    return [];
  }
  const times = history ? sectionUpdateTimes(ctx.reader.root, file) : new Map();
  return parseChangelog(ctx.reader.text(file), file, ctx.problems).map((r) => ({
    plugin: p.name,
    ...r,
    updated: updatedTime(r.date, times.get(r.version)),
  }));
}

/** Compatibility badges (R10/AC-2–4); warns naming the file when not declared (R10/AC-3). */
function readCompat(ctx, p) {
  const file = `${p.source}/COMPATIBILITY.md`;
  const c = parseCompatibility(ctx.reader.isFile(file) ? ctx.reader.text(file) : null);
  if (!c.declared) ctx.problems.warn(file, `compatibility not declared: ${c.reason}`);
  p.compat = { declared: c.declared, claudeCode: c.claudeCode, verifiedOn: c.verifiedOn, os: c.os };
  p.page.compatibility = { file: ctx.reader.isFile(file) ? file : null, claudeCodeRaw: c.claudeCodeRaw, osRaw: c.osRaw };
}

/**
 * @param {{ repoRoot?: string, history?: boolean, synonymsFile?: string }} [opts]
 *   history: read git log for feed `updated` times; synonymsFile: path of synonyms.json
 * @returns {{ marketplace, plugins, entries, releases, lastRelease, synonyms, warnings }}
 *   throws CatalogError listing every problem
 */
export function buildCatalog({
  repoRoot = defaultRepoRoot(),
  history = true,
  synonymsFile = process.env.CATALOG_SYNONYMS || DEFAULT_SYNONYMS,
} = {}) {
  const problems = new Problems();
  const reader = new RepoReader(repoRoot);
  const base = { reader, problems };

  const synonyms = loadSynonyms(synonymsFile, problems); // R2/AC-10
  const mk = readMarketplace(base);
  problems.throwIfAny();

  const drafts = mk.listed.map((l) => readPlugin(base, l)).filter(Boolean);
  const plugins = dependencyOrder(drafts, problems);
  const byName = new Map(plugins.map((p) => [p.name, p]));

  const entries = [];
  const releases = [];
  for (const p of plugins) {
    readCompat(base, p);
    const own = readReleases(base, p, history);
    p.page.latestRelease = own[0] ?? null; // newest as written in the CHANGELOG
    releases.push(...own);

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
      .map(({ ownTags = [], ...c }) => ({
        id: `${p.name}/${c.kind}/${c.slug}`,
        ...c,
        plugin: p.name,
        // Own tags first, then the plugin's. Only own tags rank at the tag level (spec R2/AC-3).
        tags: [...new Set([...ownTags, ...p.tags])],
        ownTagCount: new Set(ownTags).size,
        version: p.version,
        category: p.category,
        compat: p.compat, // components inherit the plugin's badges (R10/AC-2)
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
    p.ownTagCount = p.tags.length;
    p.path = `${p.name}/`;
    p.page.components = comps.map((c) => c.id);
    entries.push(p, ...comps);
  }

  problems.throwIfAny();
  const sorted = sortReleases(releases);
  return {
    marketplace: mk.marketplace,
    synonyms,
    plugins,
    entries,
    releases: sorted,
    lastRelease: sorted[0]?.date ?? null,
    warnings: problems.warnings,
  };
}

/** Counts per kind for the home page stats (spec R8/AC-1). */
export function countByKind(entries) {
  const counts = Object.fromEntries(KIND_ORDER.map((k) => [k, 0]));
  for (const e of entries) counts[e.kind] += 1;
  return counts;
}
