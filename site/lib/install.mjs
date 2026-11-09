// Install, manage and download commands for one plugin (spec CAT-02 R2, R3, R4, R5; facts F1–F17).
// Pure data: every command is built from the marketplace name, the repository slug and catalog values
// (R7/AC-5). Pages turn the step keys into text through en.json.

export const SCOPES = ["user", "project", "local"];
export const SURFACES = ["session", "terminal"];
export const DEFAULT_SCOPE = "user";
export const DEFAULT_SURFACE = "session";

/** The one-step command: adds the marketplace when needed, then opens the plugin's details (F3; Q1). */
export const oneStep = (slug, plugin) => `/plugin install ${plugin} --marketplace ${slug}`;

const flag = (scope) => (scope === "user" ? "" : ` --scope ${scope}`);
const json = (value) => JSON.stringify(value, null, 2);

/**
 * @param {{ slug: string, repoUrl: string, marketplace: string, plugin: string, version: string,
 *   deps: string[], tagged: boolean }} input  deps: transitive dependency names, in install order
 */
export function installModel({ slug, repoUrl, marketplace, plugin, version, deps, tagged }) {
  const id = `${plugin}@${marketplace}`;
  const session = oneStep(slug, plugin);
  const addProject = `claude plugin marketplace add ${slug} --scope project`;
  const source = { source: "github", repo: slug };

  // Exactly what `marketplace add --scope project` + `install --scope project` wrote in V2 (F16).
  const projectSettings = json({
    enabledPlugins: Object.fromEntries([plugin, ...deps].map((p) => [`${p}@${marketplace}`, true])),
    extraKnownMarketplaces: { [marketplace]: { source } },
  });

  const install = {
    user: {
      session: { commands: [session], choose: "user" },
      terminal: { commands: [`claude plugin install ${plugin} --marketplace ${slug}`] },
    },
    project: {
      session: { commands: [session], choose: "project", alsoTerminal: [addProject] },
      terminal: { commands: [addProject, `claude plugin install ${id} --scope project`] },
      settings: projectSettings,
      commit: "git add .claude/settings.json",
      fallback: `claude plugin install ${id} --scope project`,
    },
    local: {
      session: { commands: [session], choose: "local" },
      terminal: { commands: [`claude plugin install ${plugin} --marketplace ${slug} --scope local`] },
    },
  };

  const tag = `${plugin}--v${version}`;
  const manage = Object.fromEntries(SCOPES.map((scope) => [scope, [
    { action: "update", session: { steps: "manage.update.session" }, terminal: { commands: [`claude plugin update ${id}${flag(scope)}`] } },
    { action: "updateAll", session: { steps: "manage.updateAll.session" }, terminal: null },
    {
      action: "autoUpdate",
      session: { steps: "manage.autoUpdate.session" },
      terminal: { json: json({ extraKnownMarketplaces: { [marketplace]: { source, autoUpdate: true } } }) },
    },
    { action: "disable", session: { commands: [`/plugin disable ${id}`] }, terminal: { commands: [`claude plugin disable ${id}${flag(scope)}`] } },
    { action: "enable", session: { commands: [`/plugin enable ${id}`] }, terminal: { commands: [`claude plugin enable ${id}${flag(scope)}`] } },
    { action: "uninstall", session: { commands: [`/plugin uninstall ${id}`] }, terminal: { commands: [`claude plugin uninstall ${id}${flag(scope)} --prune`] } },
    {
      action: "pin",
      session: null,
      terminal: { commands: [`claude plugin marketplace remove ${marketplace}`, `claude plugin marketplace add ${slug}#${tag}`, `claude plugin install ${id}${flag(scope)}`] },
    },
  ]]));

  return {
    id,
    install,
    manage,
    tag,
    download: tagged ? `${repoUrl}/archive/refs/tags/${encodeURIComponent(tag)}.zip` : null,
  };
}
