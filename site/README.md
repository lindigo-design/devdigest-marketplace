# Catalog site

Static catalog of the `lindigo-devdigest` marketplace: search, plugin and component pages, feeds. Spec:
[CAT-01](../docs/specs/marketplace-catalog.md). Plan and decisions: [catalog-site.md](../docs/plans/catalog-site.md).
Design: [design-tokens.md](../docs/design/design-tokens.md) is the only source of colors, type, spacing and motion.

Astro (static output) + MiniSearch in the browser. No backend, no third-party requests, fonts bundled.

## Commands

Node.js ≥ 22.23.4. Run from `site/`.

| Command | What it does |
| :- | :- |
| `npm ci` | install exact dependencies |
| `npm run check` | build the catalog of the repository only: counts, warnings, or every broken file with the reason |
| `npm run dev` | live site at `http://localhost:4321/devdigest-marketplace/` (also `/_primitives/`, every component state) |
| `npm run build` | static site in `dist/` |
| `npm test` | unit tests: index builder, search, feeds, markdown sanitizer, token lint, size and speed budgets |
| `npm run test:build` | builds the `demo` and `empty-scaffold` fixtures and checks pages, feeds and origin/base variants |
| `npm run e2e` | Playwright + axe against the built demo fixture (first time: `npx playwright install chromium`) |
| `npm run fonts` | regenerate `src/styles/fonts.css` after updating an `@fontsource` package |
| `node test/e2e/serve.mjs` | build the demo fixture and serve it at `http://localhost:4399/devdigest-marketplace/` for manual review |

## Configuration

| Variable | Default | Meaning |
| :- | :- | :- |
| `SITE_ORIGIN` | `https://lindigo-design.github.io` | origin of absolute URLs (feeds, canonical links) |
| `SITE_BASE` | `/devdigest-marketplace/` | base path of every link and asset |
| `SITE_REPO` | `https://github.com/lindigo-design/devdigest-marketplace` | "View source" links, install commands |
| `SITE_REF` | `main` | git ref of "View source" links |
| `CATALOG_REPO_ROOT` | the repository root | which repository to build the catalog from (tests use fixtures) |

In CI, `SITE_ORIGIN` and `SITE_BASE` come from repository variables, so moving to a custom domain needs no code change.

## Layout

```
lib/                build-time Node code: catalog builder, CHANGELOG/COMPATIBILITY parsers, markdown, feeds, index.json
src/client/         browser code, shared with Node tests: query parser, search engine, URL state, search UI
src/components/     one Astro component per design-tokens.md §5 entry
src/pages/          home, /<plugin>/, /<plugin>/<kind>/<name>/, feed.xml, feed.json, index.json, 404
src/styles/         tokens.css (verbatim copy of design-tokens.md §8), fonts.css (generated), base.css
synonyms.json       search synonym groups (owner: @lindigo-design)
test/fixtures/      demo (components, releases, warnings) and empty-scaffold repositories
test/unit|build|e2e unit tests, fixture builds, browser tests
```

## Rules

- Every color, size, spacing, radius and duration is a token from `tokens.css`; `test/unit/lint-tokens.test.mjs` rejects raw values. A design change goes into `design-tokens.md` first, then `tokens.css` is re-copied (the tokens test compares them).
- `src/components/ResultEntry.astro` and `src/client/render.mjs` produce the same markup (server and live results); change both.
- Rendered markdown always goes through `lib/markdown.mjs` (sanitized). Live results are built without `innerHTML`.
- The site is a static multi-page site: every navigation is a full page load, so `initSearch()` and `initCopy()` run once per page and their listeners, timers and the `index.json` fetch end with the page. If Astro client-side routing (`ClientRouter` / View Transitions) is ever enabled, make both init functions idempotent and return a cleanup, and abort the index fetch on navigation (catalog-site PR review).
- Focus never goes to a disabled filter checkbox: `focus()` on one is silently ignored and focus falls out of the drawer. Use `focusables()` in `src/client/search-ui.mjs` (drawer's first focus, Tab trap, focus restore after re-rendering: an option unchecked with 0 results turns disabled).
