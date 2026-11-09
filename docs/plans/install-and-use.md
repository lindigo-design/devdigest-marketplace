# Plan: install and use on the plugin page (CAT-02)

| | |
| :- | :- |
| Spec | [CAT-02](../specs/install-and-use.md), approved 2026-11-09 |
| Status | in progress |
| Branch | `docs/cat-02-install-spec` (worktree `.claude/worktrees/cat-02`), from `main` @ `ac57a2a` |
| Commits | one per task, after `npm test`, `npm run test:build`, `npm run check`, `npm run build` and `npm run e2e` pass (from `site/`); never pushed |

## 1. Verification first (V1–V4)

Ran on 2026-11-09 with Claude Code 2.1.318, in throwaway `CLAUDE_CONFIG_DIR`s and a throwaway git repository under the session scratch folder. The real `~/.claude` was not touched. Results are recorded in spec §3 (F16–F18) and §9:

| # | Result | Effect on the spec |
| :- | :- | :- |
| V1 | Not verifiable here: the `/plugin` panel needs a signed-in interactive session | R2/AC-6 always shows `claude plugin marketplace add M --scope project` on the session tab |
| V2 | `enabledPlugins` gets the plugin and all 3 dependencies, then `extraKnownMarketplaces`; user settings untouched | R2/AC-5 renders exactly that shape |
| V3 | Not verifiable here: project marketplaces register only at session start, and the config had no login | Hand check in acceptance step 5; fallback line in R2/AC-5 |
| V4 | Pinning an already-added marketplace fails; remove → add `#tag` → reinstall works and writes `"ref"` | R4 pin row and R4/AC-5 rewritten |

`claude plugin details` measured ~346 / ~155 / ~160 / ~1,492 tokens always-on (F18), which are the values for the `Context cost` rows.

## 2. Design

### 2.1 Data, all at build time (`site/lib/`)

| Module | Exports | Covers |
| :- | :- | :- |
| `usage.mjs` (new) | `firstSentence(text)`; `invocation(entry, plugin)` → `{ kind, text, auto }`; `howToUse(readme)` → `[{ prompt, result }]` (first `You type \| You get` table under `## How to use`, cells unwrapped from backticks) | R1/AC-4, AC-5, AC-10; R6/AC-2, AC-4 |
| `relations.mjs` (new) | `resolveRelations(plugins, entries, problems)`: sets `page.preloads` on agents and `page.preloadedBy` on skills, each `{ id, name, plugin, path }` or `{ name, missing: true }`; warns on a missing skill | R1/AC-6–9 |
| `install.mjs` (new) | `installModel({ config, marketplace, plugin, deps, version, tagged })` → scopes × surfaces with steps and commands, the project settings JSON (`JSON.stringify(…, null, 2)` in F16 order), the manage rows per scope, the download URL; `oneStep(…)` for cards | R2/AC-4–7, R3/AC-3, R4, R5/AC-1, R2/AC-11 |
| `tags.mjs` (new) | `releaseTags(repoRoot, env)`: `CATALOG_RELEASE_TAGS` (comma list) when set, else `git tag -l "*--v*"` when `repoRoot` is the git top level, else none | R5/AC-1, AC-3 |
| `compatibility.mjs` | + `contextCost` (number or null) and `contextCostRaw` from the `Context cost` row | R2/AC-8 |
| `catalog.mjs` | calls the above; plugin gets `page.howToUse`, `page.tagged`, `compat.contextCost`; components get `page.invocation`, relations; warnings for a missing README table and a missing tag | — |
| `index-json.mjs` | `marketplace.source` (`owner/repo`), additive; `installCommands` returns the one-step form; `docs/catalog-index.md` updated | Q1, D5 |

Commands are built from `marketplace.json` `name`, `SITE_REPO` (`repoSlug`) and catalog data only (R7/AC-5).

### 2.2 Pages and components (`site/src/`)

| Component | Notes |
| :- | :- |
| `ComponentGroups.astro` (new) | groups by `KIND_ORDER`, heading "Skills · 2"; rows: name link, first sentence clamped (`-webkit-line-clamp: 2`), full description in a visually hidden span, invocation in mono, "you start it" / "Claude also loads it when relevant", relations line |
| `Relations.astro` (new) | "Preloads:" / "Preloaded by:" links; reused on component pages |
| `InstallPanel.astro` (new) | scope radios (fieldset/legend) above a tablist; one `tabpanel` per surface, inside it one `[data-scope]` block per scope. Without JS every block is visible under a heading (R2/AC-10). JSON in `SettingsSnippet` |
| `ManageBlock.astro` (new) | `<details>`; rows per action; the scope-dependent commands render one variant per scope with `[data-scope]` |
| `TryIt.astro` (new) | check commands, call lines per kind, README examples with `CopyCommand` |
| `DownloadLink.astro` (new) | link + caption; omitted when `tagged` is false |
| `src/client/install-panel.mjs` (new) | scope/tab state, URL `?scope=&in=` (defaults omitted; bogus values ignored), ARIA tabs keyboard, toggles `hidden` on `[data-scope]` / panels across the page |
| `InstallBlock.astro` | becomes the compact block: one-step command + "Other scopes and terminal →" link to `/<plugin>/#install` |
| `ResultEntry.astro`, `render.mjs`, `search-ui.mjs` | one-step command (Q1); `render.mjs` keeps the same markup |
| `[plugin]/index.astro` | order per D3; replaces the old components list |
| `[plugin]/[kind]/[name]/index.astro` | relations (R1/AC-8) |
| `en.json` | every new string (D6); the UI-strings lint covers it |

Tokens: no new values. `design-tokens.md` §5 gets the 8 rows of spec §8 in T0.

### 2.3 CI

- `pages.yml`: `on.push.tags: ["*--v*"]`; deploy also runs for tag pushes (the `if` gains `startsWith(github.ref, 'refs/tags/')`); `build` checkout already uses `fetch-depth: 0` (tags included). The Pages environment must allow tag deployments: noted for the owner.
- `scripts/lib/context-cost.mjs` (+ test): `parseDetails(text)` → number; `parseDeclared(compatText)` → number | error; `compare(declared, measured, tolerance = 0.1)`.
- `.github/scripts/check-context-cost.mjs`: for each plugin, runs `claude plugin details <p>`, compares, prints `::error::<p>: declared ~X tokens, measured ~Y tokens (more than 10 % apart)`.
- `validate.yml` `smoke-install`: one step after `assert-enabled.mjs`, same `HOME`.
- The four `COMPATIBILITY.md` files get the row; that changes `plugins/`, so each plugin is patch-released with `scripts/release.mjs` (1.0.0 → 1.0.1, note "Declare the always-on context cost in COMPATIBILITY.md"). Tags are pushed after merge by `tag-release.mjs`.

## 3. Tasks

| Task | Content | Covers | Verify |
| :- | :- | :- | :- |
| T0 | Spec approved + V results + R8; this plan; `design-tokens.md` §5 rows | spec, §8 | `npm test` (tokens test) |
| T1 | `usage.mjs`, `relations.mjs`, `install.mjs`, `tags.mjs`, compat `Context cost`, catalog wiring; demo fixture: How-to-use tables, `Context cost` rows, an `argument-hint`, a `disable-model-invocation` skill, a missing skill reference; unit tests | R1/AC-4–7, 9, 10; R2/AC-4–8 (model); R4 (model); R5/AC-1, 3; R6/AC-2, 4 | `npm test`, `npm run check` |
| T2 | Q1: one-step command on cards (server + live) and component pages; `marketplace.source` in `index.json`; schema doc | R2/AC-11, D5 | unit + build + e2e |
| T3 | Components section and relations on plugin and component pages | R1 | build tests |
| T4 | Install panel: scope, tabs, settings JSON, notes, context cost, URL state, no-JS | R2, R3 | build + e2e |
| T5 | Manage block, Try it, Download link; page order D3 | R4, R5/AC-1–3, R6 | build + e2e |
| T6 | Browser quality: keyboard (tabs, radios, details), axe light/dark, 360 px, reduced motion; `pages.yml` tag trigger | R7, R5/AC-4 | e2e |
| T7 | Context-cost CI: lib + test, CI script, `validate.yml`; `Context cost` rows; patch releases 1.0.1 | R8 | `node --test "scripts/**/*.test.mjs"`, the CI script locally in a throwaway config, `check-versions.mjs origin/main`, `claude plugin validate --strict` |
| T8 | Docs (README, CONTRIBUTING, CLAUDE.md, site/README); acceptance run; plan §4 | R8/AC-6, §10 | all checks |

## 4. Acceptance run

Filled in at T8.
