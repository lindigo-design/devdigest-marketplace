# Catalog site: install and use (plugin page)

| | |
| :- | :- |
| Spec ID | `CAT-02` |
| Status | approved 2026-11-09 (Q1–Q4 as recommended; + R8 context-cost CI check; V1–V4 results in §3 and §9) |
| Owner | @lindigo-design |
| Created | 2026-11-09 |
| Scope | the plugin page of the catalog site (`site/`), the build inputs it reads, and a CI check of the declared context cost; amends CAT-01 R3/AC-4 and R5/AC-3 |
| Depends on | [CAT-01](marketplace-catalog.md) (approved, implemented), [SDD-01](sdd-plugins.md) (plugins at 1.0.0) |

This spec covers WHAT the plugin page adds and WHY. The HOW goes in a plan, written once this spec is approved.

## 1. Why

The plugins are real now: 4 plugins at 1.0.0 ship 5 skills, 6 agents and 3 hook entries. The plugin page has two weak spots:

- **Install.** It shows two `/plugin` commands and says nothing about scope. Teams that want a plugin for everyone in a repository have to work out the commands and the `.claude/settings.json` entries from the Claude Code docs.
- **Use.** After the install, the page does not say how to start a skill or an agent, or how one plugin's agent uses another plugin's skills. The plugin READMEs have this information, but it is buried in the rendered README.

This spec makes the plugin page answer three questions without leaving it: what is in the plugin and how its parts connect, how to install it for me or for my team, and what to type once it is installed.

## 2. Goals and non-goals

**Goals**

1. Show the plugin's components grouped by kind. Each component shows how to invoke it and its links to components in other plugins ("preloads" / "preloaded by").
2. Install in one step at the scope the user chooses (user, project or local), in a Claude Code session or in a terminal. For project scope, show what gets committed.
3. Manage after install: update, turn on auto-update, disable, uninstall, pin a release.
4. "Try it after install": how to call each component, plus 1–2 example prompts from the plugin README.
5. Download the plugin's released source as a zip.

**Non-goals (this spec)**

- Multi-plugin install builder (CAT-01 §8 v1.1, next in the queue).
- Downloading a single skill as a zip (next in the queue).
- One-click install from the browser. No such mechanism exists; claude.com/marketplace also only copies the shell command (fact F11).
- Live data: the page stays static, and every value is derived from the repository at build time (CAT-01 §5).
- A new search feature. The new relation data is not added to `index.json` (decision D5).

## 3. Verified facts

Checked on 2026-11-09 against Claude Code 2.1.318 (`claude plugin <cmd> --help`) and these pages on code.claude.com:

- [plugins/install](https://code.claude.com/docs/en/plugins/install)
- [plugins/host-marketplace](https://code.claude.com/docs/en/plugins/host-marketplace)
- [plugin-marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [plugins/cli-reference](https://code.claude.com/docs/en/plugins/cli-reference)
- [plugins/loading](https://code.claude.com/docs/en/plugins/loading)
- [plugins/org](https://code.claude.com/docs/en/plugins/org)
- [settings-reference](https://code.claude.com/docs/en/settings-reference)
- [sub-agents](https://code.claude.com/docs/en/sub-agents)

All plugins declare Claude Code ≥ 2.1.318 as their minimum (SDD-01 R5/AC-8), so every command below is available to every supported user.

| # | Fact | Source |
| :- | :- | :- |
| F1 | In a session, `/plugin install <p>@<marketplace>` does not install right away. It opens the `/plugin` panel on the plugin's details, where the user picks a scope: "Install for you (user scope)", "Install for all collaborators on this repository (project scope)" or "Install for you, in this repo only (local scope)". | install § Install a plugin |
| F2 | In a terminal, `claude plugin install <p>@<marketplace> [--scope user\|project\|local]` installs at once, at user scope by default. The plugin loads at the next start, or after `/reload-plugins` in an open session. | install § Install from your shell; cli-reference § plugin install |
| F3 | One step, adding the marketplace and installing: `/plugin install <p> --marketplace <owner/repo>` in a session (v2.1.275+; asks before adding, then opens the details), and `claude plugin install <p> --marketplace <owner/repo>` in a terminal (v2.1.292+; no confirmation). From the terminal, the marketplace is declared in **user** settings, whatever `--scope` the plugin gets. | install § Add a marketplace and install in one command |
| F4 | Each scope writes `enabledPlugins` (`"<p>@<marketplace>": true`) to its own file: user → `~/.claude/settings.json`; project → `.claude/settings.json` (committed); local → `.claude/settings.local.json`. Local overrides project, and project overrides user. | install § Choose an install scope; settings-reference § enabledPlugins |
| F5 | `claude plugin marketplace add <source> --scope project` declares the marketplace in `.claude/settings.json` as `extraKnownMarketplaces: { "<name>": { "source": { "source": "github", "repo": "<owner/repo>" } } }`, with an optional `"autoUpdate": true` next to `source`. Entries in a repository's settings apply only after the user accepts the workspace trust dialog for that folder. | cli-reference § plugin marketplace add; settings-reference § extraKnownMarketplaces |
| F6 | **Project scope and collaborators.** The general rule: a committed `enabledPlugins` entry enables the plugin but does not download it, so each collaborator runs `claude plugin install <p>@<marketplace> --scope project` once. The exception, which applies to this marketplace: a plugin that the marketplace lists by a **relative path** "needs no install record because it loads from the marketplace itself", once the repository's `extraKnownMarketplaces` entry applies. All four of our plugins use `./plugins/<p>` sources. | install § Choose an install scope; loading § Enabled in project settings but not installed; org § Require plugins per repository |
| F7 | Installing also installs and enables the declared dependencies at the same scope. Uninstalling leaves auto-installed dependencies in place until `claude plugin prune`, or `claude plugin uninstall <p> --prune`. Disabling is refused while another enabled plugin needs this one, and the message gives the chained command. | install § Plugins with dependencies; cli-reference § plugin uninstall, plugin prune |
| F8 | Update: in a terminal, `claude plugin update <p>@<marketplace>` (restart required); there is no session form. In a session: `/plugin` → Installed → plugin → **Update now**. To update every plugin from one marketplace: `/plugin` → Marketplaces → marketplace → **Update marketplace**. `claude plugin marketplace update` without a name refreshes the listings only. | install § Keep plugins updated; cli-reference § session forms |
| F9 | Auto-update is **off** by default for third-party marketplaces. Turn it on in `/plugin` → Marketplaces → `lindigo-devdigest` → **Enable auto-update**, or with `"autoUpdate": true` in the `extraKnownMarketplaces` entry. | install § Turn auto-update on or off; settings-reference § extraKnownMarketplaces |
| F10 | Disable, enable and uninstall: `claude plugin disable\|enable\|uninstall <p>@<marketplace> [--scope …]`, or in a session `/plugin disable\|enable\|uninstall <p>@<marketplace>`. In the terminal, `install` and `uninstall` act on user scope unless `--scope` is given. Uninstalling a plugin that the project enables asks whether to "Disable for me" or "Uninstall for everyone". | install § Manage plugins from your shell, § Uninstall a plugin the project enables |
| F11 | Pinning: `/plugin marketplace add <owner/repo>#<ref>` pins the **whole catalog** to a branch or tag, for example a `<plugin>--v<version>` tag. No browser one-click install exists. | install § Add a marketplace; host-marketplace § versioning |
| F12 | After install: type `/` to see `/<plugin>:<skill>`; run `claude plugin list` (version, scope, status); run `claude plugin details <p>` (the `Always-on` token cost and the cost of each component). | install § See what an installed plugin adds; plugin-marketplaces step 5 |
| F13 | **Agents.** You can name a plugin agent explicitly with `@agent-<plugin>:<agent>` (or pick it from the `@` typeahead, shown as `@"<agent> (agent)"`), or by name in plain language ("use the researcher agent …"). `claude --agent <plugin>:<agent>` runs a whole session as that agent. Without a mention, Claude delegates on its own, based on the agent's `description`. | sub-agents § Invoke subagents explicitly, § Understand automatic delegation |
| F14 | **Skills.** A plugin skill is invoked as `/<plugin>:<skill>`, and Claude also loads it on its own when the task matches its description, unless its frontmatter sets `disable-model-invocation: true`. An agent's `skills:` frontmatter injects the full content of each listed skill into the agent's context at startup. | plugin-marketplaces step 5; sub-agents § Preload skills into subagents |
| F16 | **Measured (V2).** In a throwaway config and repository, `claude plugin marketplace add lindigo-design/devdigest-marketplace --scope project` followed by `claude plugin install sdd-engineering@lindigo-devdigest --scope project` wrote this `.claude/settings.json` and nothing to user settings: `enabledPlugins` lists the plugin **and its three dependencies**, then `extraKnownMarketplaces` (exact text in R2/AC-5). `claude plugin list` showed all four enabled at project scope. | run 2026-11-09, Claude Code 2.1.318 |
| F17 | **Measured (V4).** `claude plugin marketplace add M#<tag>` fails while `lindigo-devdigest` is already added ("its source doesn't match its extraKnownMarketplaces entry"). Pinning works as: `claude plugin marketplace remove lindigo-devdigest` (this uninstalls every plugin installed from it and deletes their saved data), then `claude plugin marketplace add M#<tag>` (the entry gains `"ref": "<tag>"`), then reinstall. | run 2026-11-09, Claude Code 2.1.318 |
| F18 | `claude plugin details <p>` prints `Always-on:   ~1,492 tok   added to every session`; it has no JSON output. Measured on 1.0.0: engineering-paved-path ~346, research-tools ~155, architecture-review ~160, sdd-engineering ~1,492 (equal to SDD-01 §3.5). | run 2026-11-09, Claude Code 2.1.318 |
| F15 | The GitHub archive URL `https://github.com/<owner>/<repo>/archive/refs/tags/<tag>.zip` returns the **whole repository** at that tag, not one directory. The tags `<plugin>--v1.0.0` exist on the remote for all four plugins. | GitHub archive behaviour; `git ls-remote --tags origin` on 2026-11-09 |

**F6 corrects the task brief.** The brief said every collaborator must still install at project scope. For a relative-path plugin, that step is needed only when the repository's `extraKnownMarketplaces` entry is missing. The panel therefore commits both entries (R2/AC-5). V3 (a second user gets the plugins with no install) needs a signed-in interactive session, because project marketplaces register only at session start; it is checked by hand in acceptance step 5, and the panel keeps a one-line fallback for collaborators.

## 4. Decisions proposed

| # | Topic | Proposal |
| :- | :- | :- |
| D1 | Lead command | Both tabs lead with the one-step `--marketplace` form (F3), so a new user needs one command, not two. For project scope in the terminal, the panel uses two commands instead (R2/AC-4), because `--marketplace` would declare the marketplace in user settings only. |
| D2 | Layout | Everything stays in the approved Editorial/Swiss direction: ruled index rows, hairline rules, `surface/raised` panels, mono for anything typed. No tile grid, no icons, and no new colors or sizes: tokens only (§8). |
| D3 | Page order | Header → facts and badges → **Install panel** → **Components** → **Try it after install** → **Manage** → Latest release → README → Compatibility notes. Install and use come before the long README. |
| D4 | Relations | "Preloads" / "Preloaded by" come only from an agent's `skills:` frontmatter (F14). Mentions of other components in body text are not parsed: they are prose, not a contract. |
| D5 | `index.json` | `schemaVersion` stays 1. Relations and invocations are rendered at build time and are not added. One additive field, `marketplace.source` (`owner/repo`), lets live search results build the one-step command (Q1). |
| D6 | Strings | Every new UI string goes in `site/src/i18n/en.json` (added in PR #3). Commands and file names are generated from data, never written into the strings file. |
| D7 | Download | The zip is the whole repository at the plugin's release tag (F15), and the label says so. Installing still goes through Claude Code. |

## 5. Inputs (added to CAT-01 §5)

| Source | Fields used |
| :- | :- |
| `plugins/<p>/agents/<a>.md` | frontmatter `skills` (list; `<plugin>:<skill>`, or a bare name meaning a skill of the same plugin) |
| `plugins/<p>/skills/<s>/SKILL.md` | frontmatter `argument-hint`, `disable-model-invocation` |
| `plugins/<p>/commands/<c>.md` | frontmatter `argument-hint` (already read) |
| `plugins/<p>/README.md` | the first table under the `## How to use` heading whose header row is `You type \| You get` |
| `plugins/<p>/COMPATIBILITY.md` | new table row `Context cost` (Q2, required by R8), for example `~1,492 tokens always-on (measured with claude plugin details on 2.1.318)` |
| git tags in the build checkout | whether `<plugin>--v<version>` exists (R5); tests set the list with `CATALOG_RELEASE_TAGS` instead |

## 6. Requirements (EARS)

### CAT-02/R1: Components section

- **AC-1:** The plugin page SHALL list the plugin's components grouped by kind, in the order Skills, Agents, Commands, Hooks, MCP servers. Each group SHALL have a heading with the kind and its count (for example "Skills · 2"). Kinds with no components are omitted.
- **AC-2:** IF the plugin has no components, THEN the section SHALL show the CAT-01 "No components yet" empty state and no group headings.
- **AC-3:** Each component SHALL be one ruled index row with:
  - its name, linking to the component page;
  - the first sentence of its description, clamped to 2 lines at every width from 360 px up;
  - its invocation in mono (AC-4).
  The full description SHALL stay in the HTML, available to screen readers and through the link.
- **AC-4:** The invocation SHALL be:

  | Kind | Invocation |
  | :- | :- |
  | skill | `/<plugin>:<skill>`, followed by the `argument-hint` when one is set |
  | agent | `@agent-<plugin>:<agent>` |
  | command | `/<plugin>:<command>`, followed by the `argument-hint` when one is set |
  | hook | the event and matcher (`PreToolUse · Bash`), with "runs automatically" |
  | MCP server | the server name and transport |

- **AC-5:** WHEN a skill sets `disable-model-invocation: true`, its row SHALL say that only the user starts it ("you start it"). Otherwise it SHALL say that Claude also loads it when relevant.
- **AC-6:** WHEN an agent lists skills in `skills:`, its row SHALL show "Preloads:" followed by each skill as a link to that skill's component page, with the owning plugin named when it differs from this plugin.
- **AC-7:** WHEN any agent in the catalog, in this plugin or another, preloads a skill, that skill's row SHALL show "Preloaded by:" followed by each agent as a link, with its plugin named when it differs.
- **AC-8:** The relations in AC-6 and AC-7 SHALL also appear on the agent's and the skill's component pages (Q3).
- **AC-9:** IF an agent's `skills:` entry names a skill that is not in the catalog, THEN the build SHALL print a warning naming the agent file and the entry, and the row SHALL show the entry as plain text with no link. The build does not fail, because SDD-01 R6/AC-6 already fails plugin CI in that case.
- **AC-10:** The first sentence SHALL be the description text up to and including the first `.`, `?` or `!` that is followed by whitespace or ends the text. Abbreviations such as "e.g." do not end a sentence. IF that sentence is longer than 200 characters, THEN it SHALL be cut at a word boundary and end with "…".

### CAT-02/R2: Install panel with scope

- **AC-1:** The plugin page SHALL replace the CAT-01 install block (R5/AC-3) with an install panel. The panel has a scope choice (User, Project, Local; default User), two tabs (R3) and the list of dependencies that will be installed at the same scope (F7).
- **AC-2:** Each scope option SHALL say in one line who gets the plugin and where it is recorded:
  - User: "you, in every project", `~/.claude/settings.json`;
  - Project: "everyone in this repository", `.claude/settings.json`, committed;
  - Local: "you, in this repository only", `.claude/settings.local.json`, not committed.
- **AC-3:** WHEN the user changes the scope or the tab, the panel SHALL update the commands and notes immediately, with no page load.
- **AC-4:** The commands for each scope and tab SHALL be as follows (`M` = `lindigo-design/devdigest-marketplace`, `<p>` = the plugin):

  | Scope | In a Claude Code session | In your terminal |
  | :- | :- | :- |
  | User | `/plugin install <p> --marketplace M`, then choose **Install for you (user scope)** | `claude plugin install <p> --marketplace M` |
  | Project | `/plugin install <p> --marketplace M`, then choose **Install for all collaborators on this repository (project scope)** | `claude plugin marketplace add M --scope project`, then `claude plugin install <p>@lindigo-devdigest --scope project` |
  | Local | `/plugin install <p> --marketplace M`, then choose **Install for you, in this repo only (local scope)** | `claude plugin install <p> --marketplace M --scope local` |

  Every command SHALL have its own copy action (CAT-01 CopyCommand). The panel choice in the session column is a step in text, not a command. The terminal column SHALL end with "Restart Claude Code or run `/reload-plugins`" (F2).
- **AC-5:** WHEN the scope is Project, the panel SHALL show:
  - the `.claude/settings.json` content the commands write, as a copyable JSON block, in the exact shape the CLI writes (F16): `enabledPlugins` with `"<p>@lindigo-devdigest": true` and one line per transitive dependency, then `extraKnownMarketplaces` with `"lindigo-devdigest": { "source": { "source": "github", "repo": "M" } }`, two-space indentation;
  - `git add .claude/settings.json` with a copy action;
  - a note: "Commit this file. Collaborators who trust the folder get the marketplace and the plugin. These plugins come from the marketplace repository itself, so they load without a separate install (F6). Each collaborator needs Claude Code ≥ <min> and Node.js for hooks." and a fallback: "If Claude Code reports the plugin as enabled but not installed, run `claude plugin install <p>@lindigo-devdigest --scope project` once."
- **AC-6:** WHEN the scope is Project and the tab is "In a Claude Code session", the panel SHALL also show the terminal command `claude plugin marketplace add M --scope project`, saying it records the marketplace for collaborators. (V1, whether the session panel writes that entry itself, needs a signed-in session and is not verified; running the command again is harmless.)
- **AC-7:** WHEN the scope is Local, the panel SHALL note that `.claude/settings.local.json` is personal and not committed.
- **AC-8:** IF `COMPATIBILITY.md` has a `Context cost` row (Q2), THEN the panel SHALL show it, for example "Adds ~1,492 tokens to every session". It SHALL also show the total with all transitive dependencies, which is the sum of their rows, only when every one of those plugins has the row.
- **AC-9:** The selected scope and tab SHALL be kept in the URL (`?scope=project&in=terminal`), so the link restores them. Defaults are left out of the URL.
- **AC-10:** WHEN JavaScript is off, the page SHALL show every scope × tab combination as static sections with headings, all readable and copyable by selecting the text.
- **AC-11:** Component pages and result cards (server-rendered and live) SHALL keep a compact install block whose copy command is the one-step form `/plugin install <p> --marketplace M` (Q1). This amends CAT-01 R3/AC-4 and R5/AC-3. The component page block links to the plugin page's install panel for other scopes.

### CAT-02/R3: Session and terminal tabs

- **AC-1:** The install panel SHALL have two tabs, "In a Claude Code session" (default) and "In your terminal", following the WAI-ARIA tabs pattern:
  - roles `tablist`, `tab` and `tabpanel`;
  - arrow keys move between tabs, and Home/End jump to the first and last;
  - the selected tab is announced.
- **AC-2:** The scope choice SHALL sit above the tabs and apply to both tabs.
- **AC-3:** The session tab SHALL note that the plugin's details open first and the install happens after the scope is chosen (F1).

### CAT-02/R4: Manage block

- **AC-1:** The plugin page SHALL have a "Manage" block, collapsed by default, with the actions below. Each action is shown for the session and the terminal, where a form exists:

  | Action | Session | Terminal |
  | :- | :- | :- |
  | Update this plugin | `/plugin` → Installed → `<p>` → **Update now** | `claude plugin update <p>@lindigo-devdigest`, then restart |
  | Update every plugin from this marketplace | `/plugin` → Marketplaces → `lindigo-devdigest` → **Update marketplace** | none |
  | Turn on auto-update (off by default) | `/plugin` → Marketplaces → `lindigo-devdigest` → **Enable auto-update** | `"autoUpdate": true` in the `extraKnownMarketplaces` entry (shown as JSON) |
  | Disable / enable | `/plugin disable <p>@lindigo-devdigest` / `/plugin enable <p>@lindigo-devdigest` | `claude plugin disable <p>@lindigo-devdigest` / `claude plugin enable <p>@lindigo-devdigest` |
  | Uninstall | `/plugin uninstall <p>@lindigo-devdigest` | `claude plugin uninstall <p>@lindigo-devdigest --prune` |
  | Pin this release | none (use the terminal) | `claude plugin marketplace remove lindigo-devdigest`, then `claude plugin marketplace add M#<p>--v<version>`, then `claude plugin install <p>@lindigo-devdigest` (F17) |

- **AC-2:** WHEN the selected scope is Project or Local, the terminal `update`, `disable`, `enable` and `uninstall` commands SHALL carry `--scope <scope>` (F10).
- **AC-3:** The block SHALL state that `claude plugin marketplace update` without a name refreshes the listings only and installs no new versions (F8).
- **AC-4:** The uninstall row SHALL explain that `--prune` also removes auto-installed dependencies that no other plugin needs (F7). For Project scope, it SHALL explain the "Disable for me / Uninstall for everyone" choice (F10).
- **AC-5:** The pin row SHALL warn that a pin applies to the whole catalog, not to this plugin alone, and that removing the marketplace uninstalls every plugin from it and deletes their saved data, so other plugins from `lindigo-devdigest` must be reinstalled too (F17). To unpin, the same three commands run with `M` and no `#<tag>`.
- **AC-6:** WHEN the plugin is depended on by other plugins (it has a "Used by" list), the disable row SHALL say that Claude Code refuses to disable it while a dependent is enabled and prints the chained command (F7).

### CAT-02/R5: Download source

- **AC-1:** WHEN the tag `<plugin>--v<version>` exists in the build's git checkout, the plugin page SHALL show a "Download source (.zip)" link to `https://github.com/lindigo-design/devdigest-marketplace/archive/refs/tags/<plugin>--v<version>.zip`. The repository part comes from `SITE_REPO` (CAT-01 R6/AC-4).
- **AC-2:** The link label or the text next to it SHALL say that the zip holds the whole repository at that release, and that installing goes through Claude Code (D7).
- **AC-3:** IF the tag does not exist, THEN the link SHALL be omitted and the build SHALL print a warning naming the plugin and the missing tag.
- **AC-4:** `site-build.yml` SHALL fetch tags in its checkout. It SHALL also rebuild and deploy when a tag matching `*--v*` is pushed, so the link appears once `scripts/tag-release.mjs --push` has run after a merge.

### CAT-02/R6: Try it after install

- **AC-1:** The plugin page SHALL have a "Try it after install" section with:
  - **check it loaded:** type `/` and look for `/<plugin>:`, run `claude plugin list`, and run `claude plugin details <plugin>` for its context cost (F12);
  - **call it:** one line per kind that the plugin ships, using the AC-4 invocations of R1;
  - **examples:** up to 2 example prompts (AC-2).
- **AC-2:** The examples SHALL be the first 2 rows of the `You type | You get` table under the README's `## How to use` heading. Each example shows the "You type" cell in mono with a copy action and the "You get" cell as text. Copying copies the prompt without its surrounding code formatting.
- **AC-3:** For agents, the section SHALL also say that naming the agent in plain words works, and that Claude delegates on its own when a request matches the agent's description (F13).
- **AC-4:** IF the README has no `## How to use` table, THEN the section SHALL show the check and call parts only, and the build SHALL print a warning naming the README.
- **AC-5:** IF a hook is the plugin's only component kind, THEN the call part SHALL say that the hooks run automatically and there is nothing to call.

### CAT-02/R7: Quality bar (CAT-01 R7 applies in full)

- **AC-1:** Scope choice, tabs, copy actions and the Manage disclosure SHALL be keyboard-operable with visible focus. The page SHALL pass the axe WCAG 2.1 AA checks in light and dark themes.
- **AC-2:** At 360 px width, the page SHALL have no horizontal scroll. Long commands and JSON SHALL wrap or scroll inside their own block.
- **AC-3:** New components SHALL use only tokens from `tokens.css`. Any new component or state SHALL be recorded in `design-tokens.md` §5 before it is built (§8).
- **AC-4:** WHEN the OS requests reduced motion, switching scope or tab SHALL change content with no animation.
- **AC-5:** Every command rendered in the panel, Manage block and Try-it section SHALL be generated from data: the marketplace name from `marketplace.json`, the repository from `SITE_REPO`, plugin, version and component names from the catalog. A build test SHALL compare the rendered commands for one fixture plugin with the AC-4 table of R2 and the R4 table.

### CAT-02/R8: Declared context cost, checked in CI

- **AC-1:** Each plugin's `COMPATIBILITY.md` SHALL have a `Context cost` row in its first table, giving the always-on tokens as `~<n> tokens always-on` and naming the Claude Code version it was measured on.
- **AC-2:** The `smoke-install` job of `validate.yml`, with the pinned Claude Code CLI and every plugin installed, SHALL run `claude plugin details <p>` for every plugin in `marketplace.json` and read its `Always-on` value.
- **AC-3:** IF the declared value differs from the measured value by more than 10 % of the measured value, THEN the job SHALL fail with an error naming the plugin, the declared and the measured number.
- **AC-4:** IF a plugin's `COMPATIBILITY.md` has no `Context cost` row, or its value has no number, or `claude plugin details` prints no `Always-on` line, THEN the job SHALL fail naming the plugin and the reason.
- **AC-5:** The comparison and parsing SHALL be unit-tested in `scripts/lib` (run by the existing `node --test "scripts/**/*.test.mjs"` step).
- **AC-6:** CONTRIBUTING SHALL tell maintainers to update the row when a release changes a skill or agent description (SDD-01 R5/AC-7).

## 7. Edge cases

| Case | Expected behaviour |
| :- | :- |
| Plugin with no dependencies | Install panel shows no "Also installs" line; the context-cost total equals the plugin's own value. |
| Agent preloads a skill of its own plugin by bare name (`fastify-best-practices`) | Resolved to the same plugin; the link shows no plugin prefix. |
| Same skill preloaded by agents in two plugins | "Preloaded by" lists both, ordered by plugin then agent name. |
| Hook entries named by plan D3 (`bash-guard`, `write-scope`) | Rows use those names; the invocation shows event and matcher. |
| Skill with `argument-hint` containing `<` `>` | Shown escaped, in mono, as typed. |
| Plugin released but the tag not pushed yet | Download link omitted, build warning (R5/AC-3); the tag push rebuilds the site (R5/AC-4). |
| README "How to use" rows longer than the 2-line clamp | The example is shown in full; the clamp applies only to component descriptions. |
| `SITE_REPO` points at a fork | Download URL and `--marketplace` source use the fork; the marketplace name (`lindigo-devdigest`) still comes from `marketplace.json`. |
| User opens `?scope=bogus` | Falls back to User, URL is not rewritten with the bogus value. |

## 8. Design changes (`design-tokens.md` §5)

No new tokens. These rows are added to §5 before implementation:

| Component | States |
| :- | :- |
| **InstallPanel**: scope choice, session/terminal tabs, commands, project settings JSON, dependencies, context cost; replaces InstallBlock on the plugin page | user · project · local × session · terminal · copied · no-JS (all combinations stacked under headings) |
| **ScopeChoice**: three radio options in a row (stacked under 480 px), label in `type/body`, one-line hint in `type/caption` `ink/secondary` | unchecked · checked (`accent/indigo-soft` fill, `accent/indigo` text, like a checked filter) · focus-visible |
| **SurfaceTabs**: two text tabs in `type/body`, on a `rule/hairline` baseline | default · selected (`rule/strong` underline in `accent/indigo`) · hover · focus-visible |
| **SettingsSnippet**: JSON in `type/mono` on `surface/sunken`, with a copy action | default · copied |
| **ComponentGroup**: group heading in `type/label` ("SKILLS · 2"); rows are ruled index rows (`rule/hairline`): name in `type/heading-2`, description in `type/body` `ink/secondary` clamped to 2 lines, invocation in `type/mono`, relations line in `type/body` | default · hover (hairline draws in indigo, as ResultEntry) · focus-visible |
| **TryItItem**: prompt in `type/mono` with copy action, result in `type/body` `ink/secondary` | default · copied |
| **ManageBlock**: a disclosure; rows of action, session form and terminal form | closed · open · focus-visible |
| **DownloadLink**: text link with a note in `type/caption` | default · hover |

## 9. Open questions

Resolved 2026-11-09: Q1–Q4 accepted as recommended. Q2 is extended by R8 (CI check, 10 % tolerance).

| # | Question | Recommendation |
| :- | :- | :- |
| Q1 | Should result cards and component pages also switch their copy command to the one-step form (`/plugin install <p> --marketplace M`)? Today they copy `/plugin install <p>@lindigo-devdigest`, which fails until the marketplace has been added. This amends CAT-01 R3/AC-4 and R5/AC-3. | Yes. |
| Q2 | Should each plugin's `COMPATIBILITY.md` get a `Context cost` row with the 1.0.0 values measured in SDD-01 §3.5 (~346 / ~155 / ~160 / ~1,492 tok), so the panel can show them? The site never runs `claude`, so a measured value must live in the repository. | Yes, and SDD-01 R5/AC-7 keeps it current at each release. |
| Q3 | Should the relations also appear on component pages (R1/AC-8), or on the plugin page only? | Yes, on both; the data is the same. |
| Q4 | Should the site rebuild on tag pushes (R5/AC-4)? The alternative is linking to the archive of the build commit. | Rebuild on tag push. |

**Checks in a throwaway config (2026-11-09, Claude Code 2.1.318, `CLAUDE_CONFIG_DIR` in a scratch folder):**

| # | Check | Result |
| :- | :- | :- |
| V1 | Does project scope chosen in the session panel write `extraKnownMarketplaces`? | Not verified: `/plugin` needs a signed-in interactive session. R2/AC-6 always shows the terminal command. |
| V2 | Exact `.claude/settings.json` after the project commands | Verified (F16): dependencies are listed in `enabledPlugins`. R2/AC-5 updated. |
| V3 | A second user gets the plugins with no install | Not verified: project marketplaces register at session start, and the throwaway config had no login (`Not logged in`). Docs say yes (F6). Checked by hand in acceptance step 5; fallback line in R2/AC-5. |
| V4 | `marketplace add M#<tag>` when already added | Verified (F17): it fails; remove, add pinned, reinstall. R4 updated. |

## 10. Acceptance demo

1. Open `/sdd-engineering/`. The Components section shows "Skills · 3", "Agents · 4" and "Hooks · 2". `implementation-planner` shows `@agent-sdd-engineering:implementation-planner` and "Preloads: onion-architecture (engineering-paved-path), frontend-ui-architecture (engineering-paved-path), fastify-best-practices". `run-plan` shows `/sdd-engineering:run-plan <path to plans/<feature-id>.md> [--task T<n>]` and "you start it".
2. Open `/engineering-paved-path/`. `onion-architecture` shows "Preloaded by: architecture-reviewer (architecture-review), implementation-planner (sdd-engineering)".
3. On `/sdd-engineering/`, choose Project and "In your terminal". The panel shows the two commands, the `.claude/settings.json` JSON and the commit note. `?scope=project&in=terminal` is in the URL, and reloading keeps both choices.
4. In a throwaway repository and a throwaway `CLAUDE_CONFIG_DIR` (never the real `~/.claude`), run the copied commands. The written `.claude/settings.json` matches the JSON on the page. `claude plugin list` shows all four plugins enabled at project scope.
5. By hand, signed in: open the throwaway repository with a second throwaway config, accept the trust dialog, start a session, then run `claude plugin list`. The four plugins are enabled without any install command (F6, V3).
6. Copy the session-tab user command into a session: the marketplace confirmation appears, then the plugin details with the scope choice (F1, F3).
7. Open "Manage" with Project selected. `uninstall` and `disable` carry `--scope project`, and the pin row shows remove, add `#sdd-engineering--v<version>` and reinstall, with the whole-catalog warning.
8. "Download source (.zip)" downloads `devdigest-marketplace-sdd-engineering--v1.0.0.zip`.
9. "Try it after install" shows the check commands and the first two README examples, and the copied text has no backticks.
10. At 360 px in both themes, keyboard only: reach and switch scope and tabs, copy a command, open Manage. axe reports no violations, and the page has no horizontal scroll.
11. Change one plugin's `Context cost` row by more than 10 % in a PR: the `smoke-install` job fails, naming the plugin and both numbers.
