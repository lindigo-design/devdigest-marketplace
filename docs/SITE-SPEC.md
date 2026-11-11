# Catalog site

The entry point for the catalog site of `lindigo-devdigest`: what it does, how it is built, and where its specs, design and code live. Live at **https://lindigo-design.github.io/devdigest-marketplace/**.

This page is a map, not the spec: the binding requirements (EARS acceptance criteria) are in the two specs below. When this page and a spec disagree, the spec wins.

## What it does

A reader describes a need in plain words, in English or Ukrainian ("I need a skill for security review"), and gets every matching plugin, skill, agent, hook, command or MCP server as a card with the command that installs its plugin. Each plugin and component has its own page with install and usage instructions.

| Spec | Scope | Status |
| :- | :- | :- |
| [CAT-01 Marketplace catalog](specs/marketplace-catalog.md) | index, search, cards, filters, pages, deploy, quality bar, home page, feeds, compatibility | approved |
| [CAT-02 Install and use](specs/install-and-use.md) | the plugin page: components, install panel with scope, session/terminal tabs, manage, download, try it, context cost | approved |

| Requirement | In short |
| :- | :- |
| CAT-01/R1 Build-time index | the catalog is read from this repository at build time; a broken file fails the build and is named |
| CAT-01/R2 Search | live, in the browser, English and Ukrainian with synonyms; kind words ("skill", "агент") become filters |
| CAT-01/R3 Result cards | kind, name, plugin and version, description, tags, compatibility, a copyable install command |
| CAT-01/R4 Filters | kind, plugin, category, tag, OS; everything lives in the URL, so a search can be shared |
| CAT-01/R5 Artifact pages | one page per plugin and per component, with frontmatter and body |
| CAT-01/R6 Deploy and CI | static build on GitHub Pages; origin and base path from configuration |
| CAT-01/R7 Quality bar | WCAG 2.1 AA, light and dark themes (OS by default, a header switch overrides it), 360 px, no third-party scripts, tokens only |
| CAT-01/R8 Home page | stats per kind and "What's new" from the CHANGELOGs |
| CAT-01/R9 Feeds | Atom and JSON Feed of releases, linked from every page's head and the footer; the public `index.json` |
| CAT-01/R10 Compatibility | Claude Code minimum version and OS badges from `COMPATIBILITY.md` |
| CAT-02/R1–R6 | plugin page: components, install panel (user / project / local scope, session / terminal), manage commands, download source by release tag, "Try it after install" |
| CAT-02/R8 Context cost | each plugin declares its always-on token cost; CI compares it with `claude plugin details` |

## How it is built

```
plugins/*, marketplace.json, CHANGELOGs ──► site/lib (catalog.mjs, sources/) ──► catalog (entries, releases, relations)
                                                          │
                       scripts/build-index.mjs ◄──────────┤──────────► Astro pages (site/src/pages) ──► static HTML
                       (index.json, checked on every PR)  │
                                                          └──► index.json + feeds ──► MiniSearch in the browser (site/src/client)
```

- **No backend.** Everything is generated at build time from this repository; the browser loads `index.json` once and searches it locally.
- **The index** (`index.json`, [schema](catalog-index.md)) is the site's search data and a public API for other sites. `node scripts/build-index.mjs` builds it outside the site; CI runs it on every PR.
- **Stack:** Astro (static output), MiniSearch, unified/remark/rehype with sanitising, self-hosted fonts, vanilla ES modules on the client.

## Design

| What | Where |
| :- | :- |
| Concept (Editorial / Swiss direction) | [design/concept-brief.md](design/concept-brief.md) |
| Design tokens and component states, the only source of colors, type, spacing and motion | [design/design-tokens.md](design/design-tokens.md) |
| Prototype (reference only, not the source of truth) | [design/prototype/](design/prototype/) |

Rule: one structure everywhere. Analogous sections look the same on every page (tags above compatibility, `type/label` sub-section labels, "+ / −" disclosures), and related elements share one width. A visual change goes into `design-tokens.md` §5 first, then the code.

## Code map

| Path | What |
| :- | :- |
| `site/lib/` | the catalog builder: sources, frontmatter, changelog, compatibility, relations, install commands, feeds, `index.json` |
| `site/src/pages/` | home, plugin page `[plugin]/`, component page `[plugin]/[kind]/[name]/`, `index.json`, feeds, 404 |
| `site/src/components/` | Astro components (cards, install panel, manage block, frontmatter, …) |
| `site/src/client/` | browser code: search engine and UI, URL state, copy buttons, install panel, theme switch |
| `site/src/i18n/en.json` | every UI string (components call `t()`; a test rejects hard-coded text) |
| `site/src/styles/tokens.css` | a verbatim copy of `design-tokens.md` §8 (a test compares them) |
| `site/synonyms.json` | English/Ukrainian search synonyms |
| `site/test/` | unit, build (fixtures, base-path matrix) and browser tests (Playwright + axe) |

Commands and configuration: [site/README.md](../site/README.md).

## CI and deploy

[`.github/workflows/site-build.yml`](../.github/workflows/site-build.yml), on every PR and on `main`:

1. `site: unit + build tests`: unit tests and lints, **the catalog index** (`scripts/build-index.mjs`, kept as the `catalog-index` artifact), build tests on fixtures;
2. `site: build`: the static site, with a check that every released plugin links its tag's archive;
3. `site: browser tests (Playwright + axe)`: accessibility in both themes, keyboard, 360 px, reduced motion;
4. on `main` and on a release tag: deploy to GitHub Pages.

The three test jobs are required checks for `main`.

## Changing the site

1. A new behaviour gets an acceptance criterion in CAT-01 or CAT-02 first (or a new spec for a new feature); a visual change gets its row in `design-tokens.md` §5.
2. Implement in `site/`, with tests next to the change.
3. From `site/`: `npm test`, `npm run test:build`, `npm run e2e`; from the root: `node scripts/build-index.mjs`.
