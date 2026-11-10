# Marketplace catalog site (GitHub Pages)

| | |
| :- | :- |
| Spec ID | `CAT-01` |
| Status | approved 2026-11-09 |
| Owner | @lindigo-design |
| Created | 2026-11-09 |
| Scope | `devdigest-marketplace` repository: build-time index + static site on GitHub Pages |

This spec covers WHAT the catalog does and WHY. The HOW (file layout, components, build scripts) belongs in a separate plan, written once the spec is approved.

## 1. Why

The marketplace `lindigo-devdigest` ships 4 plugins (`engineering-paved-path`, `research-tools`, `architecture-review`, `sdd-engineering`), which will soon hold dozens of skills, agents and hooks. Today a user can only find one by reading `marketplace.json` and each plugin README, and the `/plugin` UI in Claude Code shows plugin-level descriptions only. The catalog site lets a user describe a need in plain words (for example "I need a skill for security review") and get back every matching artifact as a card, with the exact command to install the plugin that contains it.

## 2. Goals and non-goals

**Goals (MVP)**

1. Find any artifact (plugin, skill, agent, hook, command, MCP server) by free-text query in English or Ukrainian.
2. Understand an artifact before installing it: what it does, which plugin ships it, what it depends on, what it is allowed to run.
3. Install it in one step: copy the correct `/plugin install` command.
4. Keep the site in sync with the repository automatically, with no manual edits to the site.
5. See at a glance what the marketplace holds and what changed recently, on the home page and through feeds (RSS/Atom, JSON) that people and tools can subscribe to.
6. Know whether an artifact works with your setup before installing it: compatibility badges for Claude Code version and OS.

**Non-goals**

- No backend, database, user accounts, server-side search or analytics endpoint.
- No in-page AI chat or LLM calls: these would expose an API key or require the user to paste one.
- No install counters or ratings: there is no install telemetry to source them from.
- Not a replacement for `/plugin` inside Claude Code. The site only produces commands; it never installs anything.

## 3. Decisions already made

| Topic | Decision |
| :- | :- |
| Visibility | The repository becomes **public**. The site is public and shows **full content** (README, SKILL.md, agent frontmatter + body, hooks.json). The root README and `marketplace.json` describe it as public. |
| Stack | Astro (static output) + MiniSearch (client-side search), built and deployed by GitHub Actions. |
| Design | Lindigo design system, **Editorial / Swiss** direction. Its tokens are vendored as one CSS file of custom properties (`--color-*`, `--space-*`, `--font-*`, `--radius-*`, `--motion-*`) with a header naming the source and date. No npm package, no runtime fetch. A Lindigo concept brief is approved before visual work starts. |
| UI language | English. Search accepts Ukrainian and English queries. |
| MVP boundary | Index, search, cards, artifact pages, copy-install, home page with stats and "What's new", RSS/Atom + JSON feeds, compatibility badges, deploy. Section 8 lists later phases. |
| Hosting | Default `https://lindigo-design.github.io/devdigest-marketplace/`. A custom domain can be added later without code changes (R6/AC-4, AC-5). |
| Synonyms | `site/synonyms.json` is owned by @lindigo-design through CODEOWNERS. Anyone may propose additions in a PR. The starter groups are listed in Appendix A. |

## 4. Users

- **Plugin consumer:** a developer on the team or a course participant who wants a skill or agent for a task and does not know which plugin has it.
- **Maintainer** (@lindigo-design): adds or changes artifacts and expects the site to update with no extra steps, and expects a broken artifact to fail the build rather than ship a broken page.

## 5. Inputs (provenance)

The catalog is built only from files committed to the default branch:

| Source | Fields used |
| :- | :- |
| `.claude-plugin/marketplace.json` | marketplace `name`, `owner`, `description`; per plugin `name`, `source`, `description`, `category`, `tags` |
| `plugins/<p>/.claude-plugin/plugin.json` | `version`, `description`, `keywords`, `license`, `dependencies[]` (name + range), `homepage` |
| `plugins/<p>/README.md` | rendered body of the plugin page |
| `plugins/<p>/CHANGELOG.md` | latest version entry, plus its date when present |
| `plugins/<p>/COMPATIBILITY.md` | minimum Claude Code version and supported OS, shown as-is |
| `plugins/<p>/skills/<s>/SKILL.md` | frontmatter `name`, `description`, other frontmatter keys; body |
| `plugins/<p>/agents/<a>.md` | frontmatter `name`, `description`, `tools`, `model`, `skills`; body |
| `plugins/<p>/commands/<c>.md` | frontmatter `description`, `argument-hint`; body |
| `plugins/<p>/hooks/hooks.json` | event (`PreToolUse`, …), matcher, command type, script path |
| `plugins/<p>/.mcp.json` | server names and transport (no `env` values) |
| `site/synonyms.json` (maintained by hand) | UA↔EN and domain synonym groups for search |

Never read: `evals/results/`, `node_modules/`, `.claude/settings.local.json`, anything outside `plugins/` and `.claude-plugin/`, except the site's own config.

## 6. Requirements (EARS)

### CAT-01/R1: Build-time index

- **AC-1:** WHEN a commit lands on the default branch, the system SHALL rebuild the index and redeploy the site with no manual step.
- **AC-2:** The system SHALL create exactly one index entry for each plugin listed in `marketplace.json` and for each skill, agent, command, hook entry and MCP server found under that plugin's directory.
- **AC-3:** Each entry SHALL carry: `kind`, `name`, `plugin`, `description`, `tags` (plugin tags + keywords), `version` (of the plugin), a source path relative to the repo root, and searchable body text.
- **AC-4:** IF a plugin directory has no components (only `.gitkeep`), THEN the system SHALL still index the plugin itself and show "No components yet" on its page instead of failing.
- **AC-5:** IF a SKILL.md or agent file has missing or unparseable frontmatter, or a plugin listed in `marketplace.json` has no `plugin.json`, THEN the build SHALL fail and name the file and the reason.
- **AC-6:** The system SHALL NOT include the values of `env` blocks from `.mcp.json` or `hooks.json`, nor any file from the excluded paths in section 5.
- **AC-7:** WHEN a component is added, renamed or removed in the repository, the next deploy SHALL reflect it without changes to site code.

### CAT-01/R2: Search

- **AC-1:** The system SHALL run search entirely in the browser over the prebuilt index, with no network request per keystroke.
- **AC-2:** WHEN the user types a query, the system SHALL update results within 100 ms of the last keystroke on a mid-range laptop for an index of up to 500 entries.
- **AC-3:** The system SHALL rank matches in `name` above `tags`, `tags` above `description`, and `description` above body text. Tags a component inherits from its plugin (R1/AC-3) rank at the `description` level; tags the component declares itself, and a plugin entry's own tags, rank at the `tags` level.
- **AC-4:** The system SHALL support prefix and typo-tolerant matching (for example `secur` → security, `reveiw` → review).
- **AC-5:** The system SHALL ignore common UA and EN stop words and filler phrases ("мені треба", "I need", "for", "для", …).
- **AC-6:** WHEN the query contains a kind word in UA or EN (skill/скіл/скіла, agent/агент, hook/хук, command/команда, plugin/плагін), the system SHALL apply that kind as a filter and remove the word from the search terms.
- **AC-7:** The system SHALL expand query terms with the synonym groups from `site/synonyms.json`, so that a Ukrainian query such as "рев'ю безпеки" matches English content about security review. Ukrainian entries are stems matched as prefixes (`безпек` matches безпека, безпеки, безпеку).
- **AC-10:** IF `site/synonyms.json` has a group with fewer than 2 terms, or one term appears in two groups, THEN the build SHALL fail and name the term.
- **AC-8:** WHEN the query is empty, the system SHALL list all plugins and then their components, grouped by plugin.
- **AC-9:** WHEN no results match, the system SHALL show an empty state that echoes the query, offers to clear filters, and links to the full list.

### CAT-01/R3: Result cards

- **AC-1:** Each card SHALL show the kind badge, name, owning plugin, plugin version, description, and up to 5 tags.
- **AC-2:** The card SHALL highlight the matched terms in the name and description.
- **AC-3:** WHEN the artifact is an agent or a hook that runs shell commands, the card SHALL show a visible marker ("runs commands" / tool list).
- **AC-4:** Each card SHALL have a "Copy install command" action that copies `/plugin install <plugin>@lindigo-devdigest` and confirms the copy visibly.
- **AC-5:** Clicking the card (outside the copy action) SHALL open the artifact page.

### CAT-01/R4: Filters and shareable state

- **AC-1:** The system SHALL offer filters by kind, plugin, category and tag, combinable with the query.
- **AC-2:** The system SHALL keep query and filters in the URL (`?q=…&kind=…&plugin=…&tag=…`), so that opening that URL restores the same results.
- **AC-3:** WHEN the user presses `/` or `Ctrl+K` / `Cmd+K` outside a text field, the system SHALL focus the search box.

### CAT-01/R5: Artifact pages

- **AC-1:** Every plugin and every component SHALL have its own stable URL (`/<plugin>/` and `/<plugin>/<kind>/<name>/`) that works on direct load and reload.
- **AC-2:** A **plugin page** SHALL show: description, version, category, tags, license, rendered README, dependency list (each linking to its plugin page, with its range), plugins that depend on it, a component list, the latest CHANGELOG entry, compatibility notes, and the install block.
- **AC-3:** The install block SHALL show the marketplace add command (`/plugin marketplace add lindigo-design/devdigest-marketplace`), the plugin install command, and the list of dependencies that will install automatically.
- **AC-4:** A **component page** SHALL show its frontmatter as a key/value table (for agents: `tools`, `model`, `skills`), the rendered body, the owning plugin with its install block, and a link to the source file on GitHub.
- **AC-5:** A **hook page** SHALL show the event, matcher, the command it runs, and the script source path.
- **AC-6:** Rendered markdown SHALL be sanitized: no raw `<script>`, inline event handlers or `javascript:` URLs reach the page.

### CAT-01/R6: Deploy and CI

- **AC-1:** The site SHALL deploy through GitHub Actions to GitHub Pages using the minimal permissions Pages requires (`contents: read`, `pages: write`, `id-token: write`) and no repository secrets.
- **AC-2:** WHEN a pull request changes plugins or site code, CI SHALL build the index and the site without deploying, and fail the PR if the build fails.
- **AC-3:** The site source SHALL live outside `plugins/` and SHALL NOT break the existing `validate.yml` jobs (`claude plugin validate --strict`, version-bump check, smoke install).
- **AC-4:** The site SHALL take its origin and base path from build configuration (default origin `https://lindigo-design.github.io`, base `/devdigest-marketplace/`). Every internal link, asset and the index URL SHALL derive from that configuration, with no hard-coded host or path.
- **AC-5:** WHEN only the origin or base path changes (a custom domain on the user site, a subdomain via `CNAME`, or a sub-path of another site), the site SHALL work after a rebuild with no source change.

### CAT-01/R7: Quality bar

- **AC-1:** The site SHALL meet WCAG 2.1 AA: keyboard-reachable search, filters, cards and copy actions; visible focus; contrast per the Lindigo tokens.
- **AC-2:** The site SHALL support light and dark themes, following the OS preference by default. A Light/Dark switch in the site header SHALL show the theme in effect: until the reader uses it, the OS preference (and it SHALL follow OS changes). WHEN the reader flips the switch, the choice SHALL persist in that browser, override the OS preference and apply before the first paint, so the page does not flash the other theme. (Amended 2026-11-10 by the owner: a reader may use a light OS and want a dark site, or the reverse; a two-state switch, no separate Auto option.)
- **AC-3:** The site SHALL be usable at 360 px width with no horizontal page scroll.
- **AC-4:** The search index transferred to the browser SHALL stay under 300 KB gzipped at 500 entries.
- **AC-5:** The site SHALL load no third-party scripts or trackers in the MVP.
- **AC-6:** All colors, spacing, type, radius and motion values SHALL come from the vendored Lindigo token file. Components SHALL contain no raw hex colors or pixel spacing outside it.
- **AC-7:** WHEN the OS requests reduced motion, the site SHALL disable non-essential animation.

### CAT-01/R8: Home page — stats and "What's new"

- **AC-1:** The home page SHALL show the search box first, followed by marketplace stats: number of plugins, skills, agents, commands, hooks and MCP servers, and the date of the most recent release.
- **AC-2:** Each stat SHALL link to the search results filtered by that kind (for example "12 skills" opens `?kind=skill`).
- **AC-3:** The home page SHALL show a "What's new" list of the 10 most recent released versions across all plugins, newest first. Each item shows the plugin, version, date, the first 2 lines of its CHANGELOG notes, and links to the plugin page.
- **AC-4:** "What's new" SHALL include only dated version sections (`## [X.Y.Z] — YYYY-MM-DD`) and SHALL NOT show `[Unreleased]` notes.
- **AC-5:** IF the marketplace has plugins but no components, THEN the stats SHALL show zero counts with a "No components yet — plugins are being migrated" message instead of hiding the section.
- **AC-6:** The home page SHALL list the plugins as cards (R3) with their dependency relations ("depends on", "used by") as text links.
- **AC-7:** IF a CHANGELOG version section has no date or an unparseable date, THEN the build SHALL fail and name the file and version.

### CAT-01/R9: Feeds

- **AC-1:** The system SHALL publish an Atom feed at `feed.xml` and a JSON Feed 1.1 at `feed.json`, both built from the same release entries as R8/AC-3, with up to 50 items.
- **AC-2:** Each feed item SHALL represent one plugin release, with a stable id `<plugin>--v<version>`, title `<plugin> <version>`, the release date, the CHANGELOG notes as content, and an absolute link to the plugin page.
- **AC-3:** Feed URLs and item links SHALL be absolute and derived from the origin and base path configuration (R6/AC-4).
- **AC-4:** Every page SHALL advertise both feeds with `<link rel="alternate">` tags, and the home page SHALL show visible links to them.
- **AC-5:** WHEN no plugin has a dated release, the feeds SHALL still be valid documents with zero items.
- **AC-6:** The system SHALL also publish the search index as a documented, versioned JSON file (`index.json` with a `schemaVersion` field) so other sites and tools can reuse the catalog data.

### CAT-01/R10: Compatibility badges

- **AC-1:** Plugin cards, plugin pages and component pages SHALL show compatibility badges: minimum Claude Code version (for example "Claude Code ≥ 2.1.110") and supported OS (for example "Windows", "macOS").
- **AC-2:** Badges SHALL be taken from the `Claude Code` and `OS` rows of the table at the top of the plugin's `COMPATIBILITY.md`. A component inherits the badges of its plugin.
- **AC-3:** IF `COMPATIBILITY.md` is missing or its `Claude Code` row has no `≥ X.Y.Z` version, THEN the badge SHALL read "Compatibility not declared" and the build SHALL print a warning naming the file.
- **AC-4:** The plugin page SHALL also show the "verified on" version when the row states one (for example "verified on 2.1.318").
- **AC-5:** The search page SHALL offer a filter by OS.

## 7. Edge cases

| Case | Expected behaviour |
| :- | :- |
| Same skill name in two plugins | Two cards. Plugin name is part of the identity and the URL. |
| Plugin listed in `marketplace.json` but directory missing | Build fails (R1/AC-5). |
| Directory under `plugins/` not listed in `marketplace.json` | Not indexed. `check-versions.mjs` already flags it in CI. |
| Very long SKILL.md body | Full text indexed for search. Card shows description only. |
| Query of only stop words ("мені треба скіл") | Treated as a kind filter with an empty query: all skills listed. |
| Query in mixed UA/EN | Each term handled independently, results merged by score. |
| JavaScript disabled | Plugin and component pages still render (static HTML); search shows a notice. |
| Dependency range not satisfied by the current version in the repo | Plugin page shows a warning next to that dependency. |
| Two plugins released on the same date | "What's new" and feeds order them by date, then by release time (the commit that first added the version's CHANGELOG section; newest first), then by plugin name. A later correction of the notes changes the item's `updated` time, not its place. Without git history: date, then plugin name. |
| A rollback release (`### Reverted` notes) | Shown in "What's new" and the feeds like any release, with a "Rollback" label. |
| Feed reader caches an item that was later corrected | Item id stays `<plugin>--v<version>`; the `updated` time changes, so readers refresh it. |

## 8. Later phases (out of MVP, recorded for planning)

**v1.1**

- Install builder: select several plugins, get deduplicated commands and a `.claude/settings.json` snippet for `--scope project`, with dependencies resolved.
- Hooks and permissions overview: one page listing every hook (event, matcher, command) and every agent's tool list across plugins.
- Interactive dependency graph: built from the index, each node links to the plugin page.
- "Didn't find it? Request a skill": a link to a prefilled GitHub issue form carrying the query text.

**v2**

- Semantic search: embeddings computed at build time, query encoded in the browser with a small model, no API key.
- Recipes: workflow pages in `docs/` (for example spec → plan → implement → verify) that are indexed and linked to the components they use.
- Per-plugin discussions via Giscus.
- Quality badges ("validated --strict", "evals passing") taken from CI status at build time. (Compatibility badges are already in the MVP, R10.)

## 9. Open questions

None. All four earlier questions are resolved in section 3: visibility, synonyms ownership, Lindigo delivery, hosting.

### Future: attaching to a personal site

Because of R6/AC-4–5, the catalog can later join a personal site in any of three ways:

1. **Custom domain on the user site.** If `lindigo-design.github.io` gets a custom domain (for example `lindigo.design`), GitHub serves project sites under it automatically, so the catalog appears at `lindigo.design/devdigest-marketplace/`. Only the origin config changes.
2. **Own subdomain.** Add a `CNAME` (for example `plugins.lindigo.design`) to this repository and set base `/`.
3. **Link from the site.** The personal site links to the catalog, or reuses its public `index.json` (R9/AC-6) to show plugin cards on its own pages.

## Appendix A: starter synonym groups

Each group contains equivalent terms. The groups are derived from the current `tags` and `keywords` and the planned components; Ukrainian entries are stems.

```json
[
  ["review", "reviewer", "рев'ю", "ревю", "перевір", "огляд"],
  ["security", "secure", "vulnerability", "owasp", "безпек", "вразлив"],
  ["architecture", "layering", "onion", "архітектур", "шар"],
  ["spec", "specification", "requirements", "специфікац", "вимог"],
  ["plan", "planning", "план"],
  ["implement", "implementation", "code", "реаліз", "імплемент", "код"],
  ["test", "testing", "tests", "тест"],
  ["research", "researcher", "investigate", "дослідж", "пошук інформац"],
  ["brainstorm", "options", "ideas", "ідеї", "варіант", "брейншторм"],
  ["docs", "documentation", "document", "документац"],
  ["diagram", "mermaid", "chart", "діаграм", "схем"],
  ["guardrails", "rules", "conventions", "правил", "обмежен"],
  ["retro", "retrospective", "ретро", "ретроспектив"],
  ["insights", "lessons", "learnings", "інсайт", "урок"],
  ["pr", "pull request", "push", "gate", "пул реквест", "пуш"],
  ["frontend", "ui", "react", "next", "інтерфейс", "фронтенд"],
  ["backend", "server", "api", "бекенд", "сервер"],
  ["workflow", "pipeline", "process", "процес", "флоу"]
]
```

Kind words (skill/скіл, agent/агент, hook/хук, command/команда, plugin/плагін) are not synonyms. R2/AC-6 handles them as filters.

## 10. Acceptance demo

1. Open the site and type `мені треба скіл для рев'ю безпеки`. The skill filter turns on, and the `security` skill from `engineering-paved-path` plus the review skills from `architecture-review` appear as cards.
2. Copy the install command from a card and paste it into Claude Code. It installs the plugin together with its dependencies.
3. Open the `sdd-engineering` page. It lists 3 dependencies with links and ranges `^0.1`.
4. Add a new skill in a PR. CI builds the site. After merge, the skill is searchable on the deployed site with no site code change.
5. Release a plugin with `scripts/release.mjs` and merge. The home page stats and "What's new" show the new version, and `feed.xml` / `feed.json` gain an item with id `<plugin>--v<version>`.
6. Every plugin card shows "Claude Code ≥ 2.1.110" and "Windows", "macOS" badges taken from its `COMPATIBILITY.md`.
7. With today's scaffold (no components), the home page shows zero counts with the "No components yet" message, and the build succeeds.
