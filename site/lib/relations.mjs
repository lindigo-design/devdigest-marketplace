// "Preloads" / "Preloaded by" between agents and skills, across plugins (spec CAT-02 R1/AC-6–9).
// The only source is an agent's `skills:` frontmatter (plan D4): "<plugin>:<skill>", or a bare name for a
// skill of the agent's own plugin.

const ref = (e) => ({ id: e.id, name: e.name, plugin: e.plugin, path: e.path });
const byPluginThenName = (a, b) => (a.plugin < b.plugin ? -1 : a.plugin > b.plugin ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * Sets `page.preloads` on every agent and `page.preloadedBy` on every skill.
 * A reference to a skill that is not in the catalog stays as `{ name, missing: true }` and is reported as a
 * warning naming the agent file (the plugin's own CI fails on it, SDD-01 R6/AC-6).
 * @param {object[]} entries catalog entries (plugins and components)
 * @param {{ warn: (file: string, reason: string) => void }} problems
 */
export function resolveRelations(entries, problems) {
  const skills = new Map(entries.filter((e) => e.kind === "skill").map((e) => [e.id, e]));
  for (const s of skills.values()) s.page.preloadedBy = [];

  for (const a of entries.filter((e) => e.kind === "agent")) {
    const listed = a.page.agent?.skills ?? [];
    a.page.preloads = [];
    for (const raw of listed) {
      const name = String(raw).trim();
      const [plugin, skill] = name.includes(":") ? name.split(":", 2) : [a.plugin, name];
      const target = skills.get(`${plugin}/skill/${skill}`);
      if (!target) {
        problems.warn(a.source, `skills: "${name}" is not a skill in the catalog; shown without a link`);
        a.page.preloads.push({ name, missing: true });
        continue;
      }
      a.page.preloads.push(ref(target));
      if (!target.page.preloadedBy.some((r) => r.id === a.id)) target.page.preloadedBy.push(ref(a));
    }
  }
  for (const s of skills.values()) s.page.preloadedBy.sort(byPluginThenName);
}
