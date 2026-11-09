# Catalog site: implementation plan

| | |
| :- | :- |
| Spec | [CAT-01](../specs/marketplace-catalog.md) (approved 2026-11-09) |
| Design | [concept-brief.md](../design/concept-brief.md), [design-tokens.md](../design/design-tokens.md) (both approved), [prototype](../design/prototype/) (reference only) |
| Status | approved 2026-11-09 (decisions D1–D7 resolved in section 0) |
| Branch | `feat/catalog-site` |
| Created | 2026-11-09 |

This plan covers the HOW: file layout, build pipeline, pages, client search, feeds, CI and tests. Every task lists the CAT-01 acceptance criteria it closes; section 10 is the full traceability matrix. No code is written until this plan is approved.

## 0. Decisions (resolved 2026-11-09)

These are the places where the spec, tokens and prototype disagree or leave a gap. The owner resolved each one on 2026-11-09; the plan below follows these choices.

| # | Question | Decision |
| :- | :- | :- |
| D1 | The prototype has a manual Light/Dark toggle. The spec (R7/AC-2) and the token file only follow the OS preference. | **OS preference only, no toggle** in the MVP. A toggle would need `[data-theme]` selectors in `design-tokens.md` first. |
| D2 | Spec R9/AC-6 names the public file `index.json`; §9 "Future" mentions `search-index.json`. | **`index.json`** everywhere. Fix the §9 wording in the docs task (T12). |
| D3 | Hooks have no `name` in `hooks.json`, but R5/AC-1 needs `/<plugin>/hook/<name>/`. | Name = basename of the script the command runs (`gate.sh` → `gate`), else `<event>-<matcher>` slug (`pretooluse-bash`). Duplicates get `-2`, `-3` in file order. |
| D4 | Where the PR build runs (R6/AC-2). | A `build` job in the new `pages.yml` that runs on `pull_request` too; the `deploy` job runs only on `push` to `main`. `validate.yml` stays untouched. |
| D5 | Browser end-to-end tests (keyboard, URL state, 360 px, axe-core) need Playwright with a headless Chromium download in CI (~1–2 min). | **Yes**, as a separate `e2e` job in `pages.yml`. Dev dependency only: nothing from it ships to the site. |
| D6 | The prototype shows an "Also related, outside the Skill filter" group under results. The spec does not mention it. | **Dropped from the MVP** (not in the spec). Results show only entries that pass every active filter. |
| D8 | *(Checkpoint 1.)* Components inherit their plugin's tags (R1/AC-3), so a plugin tag made every component outrank real description matches. | Inherited tags rank at the **description** tier, with a low boost (0.25) as tie-break inside it; a component's own frontmatter `tags` and a plugin's own tags rank at the **tag** tier. Spec R2/AC-3 clarified. Missing `name` stays a build error; the message suggests `name: <folder>`. |
| D7 | Body text for search vs. the 300 KB budget (R7/AC-4) at 500 entries. | Body text is reduced to **deduplicated normalized terms**, not raw markdown, and `index.json` stores them **once per corpus**: a sorted vocabulary plus, per term, the delta-encoded list of entries that contain it (complement list when a term is in over half the entries). Lossless, so full text stays searchable (spec §7). *Updated in T4 after measuring:* per-entry term lists were ≈310–440 KB gzipped on real README text at 500 entries; the postings form is ≈100 KB there and ≈240 KB on the pessimistic synthetic budget set. |

## 1. Target layout

Everything new lives under `site/`, outside `plugins/` (R6/AC-3). Nothing under `plugins/` changes, so no plugin version bump is needed.

```
site/
  package.json              astro, minisearch, yaml, unified/remark/rehype, @fontsource*; dev: playwright, axe-core
  package-lock.json
  astro.config.mjs          output: "static"; site/base from SITE_ORIGIN / SITE_BASE (R6/AC-4)
  synonyms.json             starter groups from spec Appendix A (CODEOWNERS: @lindigo-design)
  lib/                      build-time Node code, plain ESM .mjs, no Astro imports (unit-testable)
    config.mjs              origin, base, repo URL, git ref; url()/absUrl() helpers
    catalog.mjs             buildCatalog({ repoRoot }) → { marketplace, plugins, entries, releases, warnings }
    sources/
      marketplace.mjs       reads .claude-plugin/marketplace.json + plugin.json files
      components.mjs        skills/<s>/SKILL.md, agents/<a>.md, commands/[<ns>/]<c>.md, hooks/hooks.json,
                            .mcp.json (names + transport only); one reader per kind
      frontmatter.mjs       strict YAML frontmatter split + parse, errors name file + reason
    changelog.mjs           dated release sections, rollback detection, 2-line excerpt
    compatibility.mjs       Claude Code min / verified-on / OS badges from COMPATIBILITY.md
    synonyms.mjs            load + validate synonyms.json (R2/AC-10)
    markdown.mjs            markdown → sanitized HTML; relative links → GitHub URLs
    search-text.mjs         body → deduplicated normalized terms
    feeds.mjs               Atom + JSON Feed 1.1 builders (pure functions)
    index-json.mjs          public index document, schemaVersion 1
    errors.mjs              CatalogError(file, reason)
  scripts/
    check-catalog.mjs       CLI: build the catalog only, print warnings, exit 1 on errors (fast CI/local check)
  src/
    styles/
      tokens.css            verbatim copy of design-tokens.md §8, with a source + date header (R7/AC-6)
      fonts.css             @font-face for self-hosted woff2 (latin + cyrillic subsets)
      base.css              reset, typography roles, focus ring, grid, prose; tokens only
    data/catalog.mjs        memoized getCatalog() used by every page and endpoint
    layouts/Base.astro      <head>: title, feed <link rel="alternate"> (R9/AC-4), fonts, theme-color
    components/             one .astro file per component in design-tokens.md §5:
                            SiteHeader, SiteFooter, SearchLine, ResultEntry, KindLabel, CompatBadge,
                            RunsCommandsMarker, CopyCommand, FilterGroup, StatNumeral, WhatsNewItem,
                            InstallBlock, DependencyLink, EmptyState, Prose, FrontmatterTable, MetaRail
    pages/
      index.astro           home + search (one page; state lives in ?q=&kind=&plugin=&category=&tag=&os=)
      [plugin]/index.astro                  plugin page
      [plugin]/[kind]/[name]/index.astro    component page (skill | agent | command | hook | mcp)
      index.json.ts         public index (R9/AC-6), also what the browser loads for search
      feed.xml.ts           Atom
      feed.json.ts          JSON Feed 1.1
      404.astro
    client/                 browser ESM, no framework
      query.mjs             tokenize, stop words, kind words, synonym expansion (shared with Node tests)
      engine.mjs            MiniSearch setup, ranking, filters, facet counts (shared with Node tests)
      url-state.mjs         read/write query + filters in the URL (shared with Node tests)
      body-index.mjs        encode/decode the body vocabulary + postings in index.json (D7)
      search-ui.mjs         wires SearchLine, results, chips, filters, empty state, drawer
      render.mjs            fills <template> clones of ResultEntry; match highlighting
      copy.mjs              clipboard + "Copied" state + fallback selection
      shortcuts.mjs         "/" and Ctrl/Cmd+K
  test/
    fixtures/
      empty-scaffold/       like today's repo: 2 plugins (one depends on the other), .gitkeep only
      demo/                 4 plugins + the sample components from the prototype (security, pr-self-review,
                            security-reviewer, architecture-reviewer, gate hook, one command, one MCP server)
                            (broken inputs and edge cases are built per test in temp copies, since
                            .gitignore would drop planted node_modules/ and evals/results/ files)
    unit/*.test.mjs         node:test, one file per lib/ and client/ module
    e2e/*.spec.mjs          Playwright: keyboard, URL state, copy, 360 px, reduced motion, axe, no-JS
    budget.test.mjs         500 synthetic entries: gzip size + query latency
    lint-tokens.test.mjs    no raw hex / px outside tokens.css (R7/AC-6)
  README.md                 how to run, build, test; env vars
docs/catalog-index.md       public schema of index.json (R9/AC-6 "documented")
.github/workflows/pages.yml build (PR + main), e2e, deploy (main only)
```

Root changes: `.gitignore` (`site/node_modules/`, `site/dist/`, `site/.astro/`), `CODEOWNERS` (`/site/ @lindigo-design`, `/site/synonyms.json @lindigo-design`), docs (T12).

**Language choice.** `site/lib` and `site/src/client` are plain `.mjs` with JSDoc, like `scripts/lib`. That lets `node --test` run them on Node 22 with no TypeScript loader, and the same query/engine code runs in the browser and in tests.

**Reuse.** `satisfies`, `compare`, `SEMVER` and `depName`/`depRange` are imported from `scripts/lib/marketplace.mjs` rather than copied, so dependency checks on the site match the release scripts.

## 2. Index builder (`site/lib`)

### 2.1 Pipeline

`buildCatalog({ repoRoot })`, called once per build through `src/data/catalog.mjs`:

1. Read `.claude-plugin/marketplace.json`. For each listed plugin, resolve `source` to `plugins/<p>/`. Missing directory or missing `plugin.json` → `CatalogError` (R1/AC-5, §7).
2. Read only the paths in spec §5. The walker never descends into `evals/`, `node_modules/` or `.claude/`, never follows symlinks, and never reads anything outside `plugins/<p>/` and `.claude-plugin/` (R1/AC-6).
3. Build one **plugin entry** per listed plugin and one **component entry** per skill, agent, command, hook handler and MCP server (R1/AC-2). Directories holding only `.gitkeep` produce no components and no error (R1/AC-4).
4. Parse every CHANGELOG into releases; parse every COMPATIBILITY.md into badges.
5. Validate `site/synonyms.json`.
6. Return the catalog. Pages, `index.json` and feeds are all derived from it, so nothing about a component is hard-coded in site code (R1/AC-7).

Errors are collected, not thrown at the first one, then thrown together as one message listing every `file: reason`. Warnings (R10/AC-3) are printed with `console.warn` and do not fail the build.

### 2.2 Entry shape

```js
{
  id: "architecture-review/agent/security-reviewer",  // plugin/kind/name, unique (§7 same name in two plugins)
  kind: "plugin" | "skill" | "agent" | "command" | "hook" | "mcp",
  name, plugin, description,
  tags: [...pluginTags, ...keywords],                  // deduped, original order (R1/AC-3)
  version,                                             // the plugin's version
  category,                                            // from marketplace.json, inherited by components
  source: "plugins/architecture-review/agents/security-reviewer.md",
  path: "architecture-review/agent/security-reviewer/",// site-relative URL, joined with base at render time
  compat: { claudeCode: "2.1.110" | null, verifiedOn: "2.1.318" | null, os: ["Windows", "macOS"], declared: true },
  runs: null | { label: "Runs commands", detail: "Bash, PowerShell" },
  bodyTerms: "deduplicated normalized words",          // searchable body text (R1/AC-3); in index.json as `body` postings (D7)
  // page-only fields (not in index.json): frontmatter, bodyHtml, hook { event, matcher, type, command, script }
}
```

### 2.3 Per-kind rules

| Kind | Source | Name | Notes |
| :- | :- | :- | :- |
| plugin | marketplace.json + plugin.json | plugin name | description from marketplace.json, falling back to plugin.json |
| skill | `skills/<s>/SKILL.md` | frontmatter `name` | missing/unparseable frontmatter or missing `name`/`description` → build fails (R1/AC-5) |
| agent | `agents/<a>.md` | frontmatter `name` | same failure rule; `runs` set when `tools` includes `Bash`/`PowerShell`, or when `tools` is absent ("inherits all tools") (R3/AC-3) |
| command | `commands/<c>.md` | file name | frontmatter optional; `description`, `argument-hint` when present |
| hook | `hooks/hooks.json` | D3 rule | one entry per handler under `hooks.<Event>[].hooks[]`; `runs` set for `type: "command"`; script path extracted from `${CLAUDE_PLUGIN_ROOT}/…`; any `env` dropped (R1/AC-6) |
| mcp | `.mcp.json` | server key | transport = `type`, or `stdio` when `command` is set, `http` when `url` is set. `env`, `headers`, `args` values are never read into the catalog (R1/AC-6) |

### 2.4 CHANGELOG (`changelog.mjs`)

- Sections match `## [X.Y.Z] — YYYY-MM-DD` (em dash or hyphen accepted). `[Unreleased]` is skipped (R8/AC-4).
- A version section with no date or an invalid calendar date fails the build naming file and version (R8/AC-7).
- Each release: `{ plugin, version, date, notesMarkdown, excerpt: first 2 bullet/text lines without markdown, rollback: has "### Reverted" }` (§7 rollback label).
- `updated` for feeds (§7 corrected items): the commit time of the last commit that changed that section's text, from `git log` on the CHANGELOG. Falls back to the release date when history is unavailable (shallow clone). CI checks out with `fetch-depth: 0`.
- Sort: date desc, then plugin name asc (§7 same-date rule).

### 2.5 COMPATIBILITY (`compatibility.mjs`)

- Reads the first table. `Claude Code` row: `≥ X.Y.Z` → min version; `verified on X.Y.Z` → verifiedOn (R10/AC-2, AC-4).
- `OS` row: split on commas; each item is mapped to a known badge name (`Windows`, `macOS`, `Linux`) by its first word, otherwise kept verbatim. "Windows 10/11, macOS" → `Windows`, `macOS` (spec acceptance demo 6). The raw row is still shown as-is on the plugin page (spec §5).
- Missing file or no `≥` version → `declared: false`, badge "Compatibility not declared", warning naming the file (R10/AC-3).
- Components inherit the plugin's `compat` (R10/AC-2).

### 2.6 Markdown (`markdown.mjs`)

- `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-sanitize` (GitHub schema, tightened) + `rehype-stringify`.
- Sanitizer drops raw `<script>`, `on*` attributes, `style`, `iframe`, and any URL whose protocol is not `http`, `https`, `mailto` or a relative path (R5/AC-6).
- Relative links and images are rewritten to `https://github.com/<repo>/blob/<ref>/<dir>/<target>` (images: `raw.githubusercontent.com`), so README links to `skills/x/SKILL.md` keep working.
- No syntax highlighting in the MVP: highlighter themes carry their own colors, which R7/AC-6 forbids. Code blocks use `surface/sunken`.

### 2.7 Synonyms (`synonyms.mjs`)

- Array of arrays of strings. A group with fewer than 2 terms, or a term (case-folded, apostrophes normalized) present in two groups → build fails naming the term (R2/AC-10).
- Shipped to the browser inside `index.json` as `synonyms`, so the client needs no second request.

## 3. Search (client)

### 3.1 Query pipeline (`client/query.mjs`)

1. Lowercase, normalize apostrophes (`'`, `’`, `ʼ` → `'`), strip punctuation except `'` and `-`.
2. Drop UA/EN stop words and filler phrases ("мені треба", "i need", "for", "для", "що", "щоб", "the", …) (R2/AC-5). The search line already prints "I need a", so a query that repeats it still works.
3. Kind words (skill/skills/скіл/скіла/навичк…, agent/агент…, hook/хук…, command/команд…, plugin/плагін…, mcp) are matched as prefixes, removed from terms, and returned as `autoKind` (R2/AC-6). A query of only stop and kind words returns `{ terms: [], autoKind }` (§7: list all skills).
4. Each remaining term expands to its synonym group. UA entries are stems, matched as prefixes (`безпек` matches безпеки) (R2/AC-7). Mixed UA/EN terms are handled one by one and merged by score (§7).

### 3.2 Engine (`client/engine.mjs`)

- MiniSearch over `index.json` entries, built in the browser on first load (≤ 500 docs, a few ms). No request per keystroke (R2/AC-1).
- Fields and boosts: `name` 16, `tags` 6, `description` 3, `bodyTerms` 1 (R2/AC-3). A unit test asserts the strict order name > tags > description > body on crafted fixtures; boosts are tuned until it passes.
- `prefix: true`; `fuzzy`: 0 for terms < 4 chars, 1 edit for 4–5, 2 edits for ≥ 6 (so `reveiw` → review, a transposition = 2 edits) (R2/AC-4).
- Each original term is an OR over its expanded group; terms combine with OR, ranked by score, so partial matches still appear.
- Filters (kind, plugin, category, tag, OS) are applied after scoring; values in one group OR together, groups AND together (R4/AC-1, R10/AC-5). Facet counts are computed per group excluding that group's own filter, as in the prototype.
- Empty query: all plugins in dependency order, then their components grouped by plugin (R2/AC-8).
- Highlighting: the client marks, in name and description, every word that starts with a matched term or one of its expansions (R3/AC-2).

### 3.3 URL state and shortcuts

- `url-state.mjs` serializes `q`, `kind`, `plugin`, `category`, `tag`, `os` (repeatable params), using `history.replaceState` while typing and `pushState` on filter changes. Loading a URL restores the query, filters and results (R4/AC-2).
- An auto-applied kind is written to the URL like any other filter, so the URL alone restores the same results.
- `/` (outside text fields) and `Ctrl+K`/`Cmd+K` focus the search line; on plugin/component pages they navigate to the home page with focus (R4/AC-3).

### 3.4 No JavaScript

Home, plugin and component pages are static HTML. Home renders the plugin list server-side. The search line shows a `<noscript>` notice that search needs JavaScript and links to the full list (§7).

## 4. Pages and components

Visual source of truth: `design-tokens.md`. The prototype is only a layout reference; its inline styles are not copied. All CSS uses `var(--…)` from `tokens.css`; grid, breakpoints and component states follow tokens §4–§5. Self-hosted fonts come from `@fontsource` woff2 files with latin + cyrillic subsets, bundled at build time (R7/AC-5).

| Route | Content | ACs |
| :- | :- | :- |
| `/` | SearchLine first, then rail with StatNumerals (plugins, skills, agents, commands, hooks, MCP servers; each links to `?kind=…`; zero state with "No components yet — plugins are being migrated"), last release date, feed links; main column: "What's new" (10 latest releases, plugin, version, date, 2 lines, Rollback label), then plugin ResultEntries with "depends on" / "used by" links. When a query or filter is active, the main column switches to results, filters, chips and the empty state. | R8/AC-1–6, R2/AC-8–9, R3, R4, R9/AC-4 |
| `/<plugin>/` | Title, description, MetaRail (version, category, license, released), tags, CompatBadges with "verified on", InstallBlock (marketplace add + install + "Also installs" with transitive deps), Depends on (DependencyLink with range, caution warning when the repo version does not satisfy it), Used by, Components list or "No components yet", latest CHANGELOG entry, rendered README, raw compatibility row. | R5/AC-1–3, R1/AC-4, R10/AC-1, AC-4, §7 unsatisfied range |
| `/<plugin>/<kind>/<name>/` | KindLabel, title, owning plugin link + version, CompatBadges, FrontmatterTable (agents: `tools`, `model`, `skills` first), RunsCommandsMarker, rendered body, InstallBlock of the owning plugin, "View source on GitHub". Hook variant: event, matcher, handler type, command, script path link. MCP variant: server name, transport. | R5/AC-1, AC-4–6, R3/AC-3, R10/AC-1 |
| `/404.html` | Short message, link home. GitHub Pages serves it for unknown paths. | — |

ResultEntry details (R3): kind label, name (link to page; the whole row is clickable outside the copy button via a stretched-link pattern, R3/AC-5), plugin + version caption, highlighted description, up to 5 tags, CompatBadges, RunsCommandsMarker, CopyCommand with `/plugin install <plugin>@lindigo-devdigest` (R3/AC-4). The same markup is server-rendered for home and cloned from a `<template>` by the client, so there is one source of truth for the entry.

Accessibility (R7/AC-1): the search line is a labelled `<textarea>` (it must wrap at display size; Enter is suppressed); filters are real `<input type="checkbox">` in `<fieldset>`s; results are a list with an `aria-live="polite"` count; the copy button announces "Copied"; when the clipboard is blocked, the command text is selected instead (tokens §5 CopyCommand error state); the mobile filter drawer is a `<dialog>` with focus trap and Escape. Focus ring from `--focus-ring`.

Motion (tokens §6): search-line word wipe on load, staggered entry reveal, hairline redraw on hover/focus, copy swap. All durations come from tokens, which reduced motion sets to 0 ms (R7/AC-7). Leaving entries collapse instead of jumping (Web Animations API, skipped under reduced motion).

Theme: tokens' `prefers-color-scheme` only (R7/AC-2, D1).

## 5. Feeds and public index

- `feed.xml`: Atom 1.0. `feed.json`: JSON Feed 1.1. Both are built by `lib/feeds.mjs` from the same sorted release list as "What's new", capped at 50 items (R9/AC-1).
- Item: id `<plugin>--v<version>` (Atom: `tag:` URI wrapping that id, plus the plain id in JSON Feed), title `<plugin> <version>`, `published` = release date, `updated` per §2.4, content = CHANGELOG notes rendered to sanitized HTML, link = absolute plugin page URL (R9/AC-2–3).
- Zero releases → valid feeds with no items (R9/AC-5). A unit test validates both against their required fields.
- `index.json` (R9/AC-6): `{ schemaVersion: 1, generated, marketplace: { name, owner, description, install }, synonyms, plugins: [...], entries: [...] }`, with page-only fields stripped. Documented in `docs/catalog-index.md`; a breaking change bumps `schemaVersion`.
- Every page `<head>` carries `<link rel="alternate" type="application/atom+xml">` and `type="application/feed+json"` (R9/AC-4).

## 6. Origin and base path

- `astro.config.mjs`: `site = SITE_ORIGIN ?? "https://lindigo-design.github.io"`, `base = SITE_BASE ?? "/devdigest-marketplace/"`, `trailingSlash: "always"`, `build.format: "directory"`.
- `lib/config.mjs` exposes `url(path)` (base-relative) and `absUrl(path)` (origin + base). Every link, asset, feed URL and the client's `index.json` fetch goes through them; the client reads the base from a `<meta name="catalog-base">` tag (R6/AC-4).
- A test builds the demo fixture twice (base `/devdigest-marketplace/` and base `/` with another origin) and scans the output: every root-relative `href`/`src` must start with the base and every absolute URL with the origin (R6/AC-4–5).
- Repo URL and git ref for "View source" links come from `SITE_REPO` (default from `plugin.json` `repository`) and `SITE_REF` (default `main`).

## 7. CI: `.github/workflows/pages.yml`

```yaml
on:
  push: { branches: [main] }
  pull_request:
    paths: [plugins/**, .claude-plugin/**, site/**, scripts/lib/**, .github/workflows/pages.yml]
  workflow_dispatch:
permissions: { contents: read }          # job-level overrides below; no secrets used
concurrency: { group: pages-${{ github.ref }}, cancel-in-progress: true }
jobs:
  build:      checkout (fetch-depth 0, persist-credentials false) → setup-node 22 (npm cache)
              → npm ci (site) → npm test (unit + budget + token lint) → check-catalog
              → configure-pages (main only; its base_url sets SITE_ORIGIN/SITE_BASE unless repo vars override)
              → astro build → base-path matrix test → upload-pages-artifact (main only)
  e2e:        needs build; Playwright Chromium against `astro preview` of the built site
  deploy:     if push to main; needs [build, e2e]; permissions { pages: write, id-token: write };
              environment github-pages; actions/deploy-pages; concurrency group "pages", no cancel
```

- R1/AC-1: every push to `main` rebuilds and deploys. R6/AC-1: only `contents: read`, `pages: write`, `id-token: write`, no secrets. R6/AC-2: PRs build and test, never deploy.
- Third-party actions pinned to commit SHAs (docs/SECURITY.md least privilege).
- `validate.yml` is not modified. T10 confirms that `claude plugin validate --strict .` and `check-versions.mjs` ignore `site/` (R6/AC-3).
- One-time manual step for the owner: **Settings → Pages → Source: GitHub Actions**. The plan does not change repository settings.
- Note: a `paths` filter on `pull_request` makes a required check stay pending on PRs that don't touch those paths. Recommend not marking `build` as required, or dropping the filter if it is.

## 8. Tests

| Layer | Tool | What |
| :- | :- | :- |
| Unit: builder | `node:test` on fixtures | entry per component; fields per R1/AC-3; empty plugin; each failure rule names file + reason; env/headers never present in output (deep scan of the serialized catalog for fixture secret markers); excluded paths never read (fixtures plant files in `evals/results/`, `node_modules/`, `.claude/settings.local.json`); same skill name in two plugins; rename/add/remove a fixture component changes output with no site change |
| Unit: changelog / compat | `node:test` | dated sections, Unreleased skipped, bad date fails, rollback flag, 2-line excerpt, sort order; ≥ / verified-on / OS parsing; not-declared warning |
| Unit: synonyms | `node:test` | group < 2 terms fails, duplicate term fails, each with the term in the message |
| Unit: query + engine | `node:test` (same `.mjs` as the browser) | stop words, kind words UA/EN, stem prefixes, mixed UA/EN, `secur`, `reveiw`, ranking order, filters + counts, empty query order, spec acceptance demo query `мені треба скіл для рев'ю безпеки` on the `demo` fixture returns skill filter + `security` + review skills |
| Unit: url-state, feeds, index-json, markdown | `node:test` | round-trip URLs; feed ids, absolute links, zero-item validity; schemaVersion; XSS payloads (`<script>`, `onerror=`, `javascript:`, `data:` links, SVG) stripped |
| Budget | `node:test` | 500 synthetic entries, bodies of 200–1000 words with Zipf-distributed syllable-built vocabulary: `index.json` gzip < 300 KB (R7/AC-4); engine build < 1 s; p95 query < 20 ms in Node as a proxy for R2/AC-2 |
| Token lint | `node:test` | no `#hex`, `rgb(`, or `\d+px` literals in `site/src/**` outside `tokens.css` (R7/AC-6) |
| Base path | `node:test` over two builds | §6 scan (R6/AC-4–5) |
| E2E | Playwright + `@axe-core/playwright` | type → results < 100 ms after last key; `/` and Ctrl/Cmd+K; URL restore; copy shows "Copied" and the clipboard holds the command; card click opens page, copy click doesn't; empty state echo + clear + show all; filter drawer at 360 px; no horizontal scroll at 360 px on every route; axe: zero WCAG 2.1 AA violations in light and dark; reduced motion: no running animations; no request to any host other than the site origin; JS disabled: pages render, notice shown |

Local commands (added to CLAUDE.md "Checks before done"):

```bash
npm --prefix site ci
npm --prefix site test            # unit + budget + token lint
npm --prefix site run test:build  # builds the demo and empty-scaffold fixtures, checks the pages
npm --prefix site run check       # build the catalog only
npm --prefix site run build
npm --prefix site run e2e         # needs a Playwright browser
```

## 9. Ordered tasks

Each task ends green on its tests and on the existing checks (`claude plugin validate --strict`, `check-versions.mjs`, `node --test "scripts/**/*.test.mjs"`). I stop for your review after T4 (data + search logic done, before UI) and after T11.

| # | Task | Output | ACs |
| :- | :- | :- | :- |
| T0 | **Scaffold.** `site/` with Astro, pinned deps, `astro.config.mjs` reading origin/base, `lib/config.mjs`, `tokens.css` copied verbatim from tokens §8 with header, `fonts.css` + `@fontsource` subsets (Cyrillic coverage checked), `synonyms.json` from Appendix A, `.gitignore`, CODEOWNERS lines. Placeholder `index.astro` builds. | builds an empty page | R6/AC-3, R6/AC-4 (config), R7/AC-5, R7/AC-6 (token file), spec §3 synonyms ownership |
| T1 | **Index builder.** `lib/sources/*`, `frontmatter.mjs`, `catalog.mjs`, `errors.mjs`, `search-text.mjs`, `scripts/check-catalog.mjs`; `lib/fs.mjs` (read-only, no symlinks); fixtures `empty-scaffold`, `demo`. | `npm run check` passes on the real repo (4 plugins, 0 components) | R1/AC-2–7, spec §7 rows 1–4 |
| T2 | **CHANGELOG and compatibility.** `changelog.mjs`, `compatibility.mjs`, release list with `updated` from git. | releases + badges in the catalog | R8/AC-4, AC-7, R10/AC-2–4, §7 same date, rollback, corrected item |
| T3 | **Synonyms and query parser.** `synonyms.mjs`, `client/query.mjs`. | parser unit tests incl. the demo query | R2/AC-5–7, AC-10, §7 stop-words-only, mixed UA/EN |
| T4 | **Search engine + budget.** `client/engine.mjs`, `client/url-state.mjs`, `index-json.mjs`, `budget.test.mjs`. | ranking, fuzzy, filters, facets, URL round-trip, size + latency budget | R2/AC-1–4, AC-8, R4/AC-1–2 (logic), R7/AC-4, R9/AC-6 (shape), R10/AC-5 (logic) |
| — | **Checkpoint 1:** you review data model, `index.json` shape and search behaviour on the demo fixture before any UI. | | |
| T5 | **Layout and primitives.** `Base.astro`, header, footer, base.css grid and type roles, KindLabel, CompatBadge, RunsCommandsMarker, CopyCommand (+ `copy.mjs`), InstallBlock, DependencyLink, EmptyState, Prose, `markdown.mjs`, token lint test. | primitives rendered on `/_primitives/`, a page that exists only under `astro dev` (never in a build) | R7/AC-1–2, AC-6–7, R9/AC-4, R5/AC-6, R3/AC-4 |
| T6 | **Plugin and component pages.** *Added after checkpoint 1:* hook entries use the top-level `description` of `hooks.json` as their description text (generated text as fallback); CONTRIBUTING "Component rules" requires that `description`, committed with T6. `[plugin]/index.astro`, `[plugin]/[kind]/[name]/index.astro`, FrontmatterTable, MetaRail, hook and MCP variants, GitHub source links, 404. | every entry in the demo fixture has a page that works on reload | R5/AC-1–5, R1/AC-4 ("No components yet"), R3/AC-3, R10/AC-1, AC-4, §7 unsatisfied dependency |
| T7 | **Home (static part).** SearchLine markup, StatNumerals with zero state, "What's new", plugin ResultEntries with depends-on/used-by, feed links. | home renders fully without JS | R8/AC-1–6, R3/AC-1, R9/AC-4 |
| T8 | **Client search UI.** *As built:* a plain visit keeps the approved home (What's new + plugins); `?view=all` (the empty state's "Show everything") and any filter with an empty query list everything in R2/AC-8 order. Card component styles are global so client-rendered rows match. Playwright setup moved here from T11 to test the UI in a browser. *Added after checkpoint 1:* when filters cause zero results but the query alone matches, the empty state's button reads "Clear filters (N results in other kinds)": a count only, no list (D6 stays). `search-ui.mjs`, `render.mjs`, `shortcuts.mjs`; live results, highlights, filters + chips + counts, auto kind chip, OS filter, empty state, mobile drawer, motion, `<noscript>`. | search works end to end on `astro preview` | R2/AC-1–2, AC-8–9, R3/AC-1–2, AC-4–5, R4/AC-1–3, R10/AC-5, R7/AC-3, AC-7, §7 no-JS |
| T9 | **Feeds and public index.** *Done before T8, because the search UI fetches `index.json`.* `feeds.mjs`, `feed.xml.ts`, `feed.json.ts`, `index.json.ts`, `docs/catalog-index.md`. | valid feeds (also with 0 items), documented index | R9/AC-1–6 |
| T10 | **CI.** `pages.yml` (build, e2e, deploy), base-path matrix test, SHA-pinned actions; verify `validate.yml` jobs are unaffected. | PR run green, no deploy from PR | R1/AC-1, R6/AC-1–5 |
| T11 | **E2E and quality pass.** *As built:* axe runs on 12 routes × light/dark; 360 px check also flags elements that stick out; detectors proven by injecting failures. Manual screen-reader (NVDA) check is still open for checkpoint 2. Playwright + axe suite from §8, fixes for anything it finds, contrast spot-check in both themes. | e2e job green | R7/AC-1–5, AC-7, R2/AC-2, R3/AC-5, R4/AC-3 |
| — | **Checkpoint 2:** you review the built site (`astro preview`) against the prototype and tokens. | | |
| T12 | **Docs and acceptance.** README (site link, how it is built), CONTRIBUTING (site tests, synonyms PRs), CLAUDE.md (status table → "implemented", new checks), `site/README.md`, (spec §9 `index.json` wording, D2, was fixed at plan approval). Run the spec §10 acceptance demo: steps 3, 6, 7 on the real repo; steps 1, 2 on the `demo` fixture build (the real plugins have no components yet); steps 4, 5 after merge, on the deployed site. | demo checklist with results in the PR description | spec §10 |

Commits: one per task on `feat/catalog-site`, each only after your OK (CLAUDE.md hard rule). No release script run is needed, because nothing under `plugins/` changes.

## 10. Traceability matrix

| AC | Task | Verified by |
| :- | :- | :- |
| R1/AC-1 | T10 | `pages.yml` push trigger; first deploy after merge |
| R1/AC-2 | T1 | builder unit test: entry count per fixture |
| R1/AC-3 | T1 | builder unit test: required fields on every entry |
| R1/AC-4 | T1, T6 | `empty-scaffold` fixture; plugin page "No components yet" |
| R1/AC-5 | T1 | broken-input cases in temp copies: message names file + reason |
| R1/AC-6 | T1 | secret-marker scan; planted excluded files never appear |
| R1/AC-7 | T1 | add/rename/remove fixture component test; spec demo step 4 |
| R2/AC-1 | T4, T11 | engine runs on local index; e2e asserts no request while typing |
| R2/AC-2 | T4, T11 | Node latency budget; e2e timing |
| R2/AC-3 | T4 | ranking-order unit test |
| R2/AC-4 | T4 | `secur`, `reveiw` unit tests |
| R2/AC-5 | T3 | stop-word unit tests |
| R2/AC-6 | T3, T8 | kind-word unit tests; e2e auto chip |
| R2/AC-7 | T3 | `рев'ю безпеки` → security review |
| R2/AC-8 | T4, T8 | empty-query order unit test; e2e |
| R2/AC-9 | T8, T11 | e2e empty state |
| R2/AC-10 | T3 | synonyms validation unit tests |
| R3/AC-1 | T7, T8 | e2e card content |
| R3/AC-2 | T8 | highlight unit test (render.mjs) + e2e |
| R3/AC-3 | T1, T6, T8 | `runs` unit test; e2e marker |
| R3/AC-4 | T5, T8 | e2e clipboard + "Copied" |
| R3/AC-5 | T8, T11 | e2e card vs copy click |
| R4/AC-1 | T4, T8 | engine filter tests; e2e |
| R4/AC-2 | T4, T8 | URL round-trip unit test; e2e reload |
| R4/AC-3 | T8, T11 | e2e shortcuts |
| R5/AC-1 | T6 | e2e direct load + reload on every route |
| R5/AC-2 | T6 | page snapshot test on `demo` |
| R5/AC-3 | T5, T6 | InstallBlock test: transitive deps for sdd-engineering |
| R5/AC-4 | T6 | component page test |
| R5/AC-5 | T6 | hook page test |
| R5/AC-6 | T5 | XSS unit tests |
| R6/AC-1 | T10 | workflow review: permissions, no `secrets.` use |
| R6/AC-2 | T10 | PR run builds, `deploy` skipped |
| R6/AC-3 | T0, T10 | `validate.yml` green on the PR |
| R6/AC-4 | T0, T10 | base-path scan |
| R6/AC-5 | T10 | second build with base `/` and another origin |
| R7/AC-1 | T5, T11 | axe + keyboard e2e |
| R7/AC-2 | T5, T11 | axe in both color schemes |
| R7/AC-3 | T8, T11 | e2e 360 px scroll width check |
| R7/AC-4 | T4 | gzip budget test |
| R7/AC-5 | T0, T11 | e2e request-host assertion; no third-party URLs in `dist/` |
| R7/AC-6 | T0, T5 | token lint test |
| R7/AC-7 | T5, T11 | e2e with `reducedMotion: "reduce"` |
| R8/AC-1–3, 5, 6 | T7 | home page tests on `demo` and `empty-scaffold` |
| R8/AC-4, 7 | T2 | changelog unit tests |
| R9/AC-1–3, 5 | T9 | feed unit tests |
| R9/AC-4 | T5, T7 | head-link test on every page; home visible links |
| R9/AC-6 | T4, T9 | schemaVersion test; `docs/catalog-index.md` |
| R10/AC-1 | T6, T7 | badges on card, plugin page, component page |
| R10/AC-2–4 | T2 | compatibility unit tests |
| R10/AC-5 | T4, T8 | OS filter test + e2e |

## 11. Risks

| Risk | Mitigation |
| :- | :- |
| Boost-based ranking can't guarantee a strict field order for every query | Order test on crafted fixtures; if boosts alone fail, sort results by (best matched field, score). |
| Body text pushes `index.json` over 300 KB as components grow | Postings encoding (D7). Budget holds at 500 entries for bodies up to ≈1000 words; at 300–2000 words on every entry it is ≈325 KB. Next steps if real data gets there: drop digit/hash tokens from body terms, or cap terms per entry. The budget test fails CI before it ships. |
| Fontsource subsets miss a glyph | **Confirmed in T0:** Cyrillic (incl. ґ є і ї), `ʼ`, `’`, `—`, `·`, `№` are covered in all three faces; `≥`, `→`, `←` are in none of the fontsource subsets (Google drops them), so they render in the system fallback face. **Accepted by the owner (2026-11-09)** for the MVP: no plain-text substitutes, no custom subsetting. Revisit if the fallback looks wrong in review. |
| Display-size `<textarea>` vs. screen readers | Explicit label "I need a", Enter suppressed, axe + manual NVDA check in T11. |
| Real plugins have no components until migration, so the demo can't fully run on prod data | `demo` fixture build for steps 1–2; real data covers the empty state (step 7). |
| Astro/MiniSearch major updates | Exact versions in `package-lock.json`; Dependabot is out of scope for now. |
