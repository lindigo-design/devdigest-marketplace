// Plugin dependency graph helpers for install blocks (spec CAT-01 R5/AC-3).

/**
 * Plugins installed automatically with `name`: every transitive dependency, deepest first, once each.
 * @param {{ name: string, page: { dependencies: { name: string, range: string|null }[] } }[]} plugins
 * @returns {{ name: string, range: string|null, inCatalog: boolean }[]}
 */
export function transitiveDependencies(plugins, name) {
  const byName = new Map(plugins.map((p) => [p.name, p]));
  const out = [];
  const seen = new Set([name]);
  const visit = (p) => {
    for (const d of p.page.dependencies) {
      if (seen.has(d.name)) continue;
      seen.add(d.name);
      const dep = byName.get(d.name);
      if (dep) visit(dep);
      out.push({ name: d.name, range: d.range, inCatalog: !!dep });
    }
  };
  const root = byName.get(name);
  if (root) visit(root);
  return out;
}
