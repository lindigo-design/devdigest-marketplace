# devdigest-marketplace: agent guide

Public Claude Code plugin marketplace **`lindigo-devdigest`** (repo `lindigo-design/devdigest-marketplace`). It holds 4 plugins migrated from DevDigest, plus a planned catalog site on GitHub Pages. Canonical description: [README.md](README.md). Contribution rules: [CONTRIBUTING.md](CONTRIBUTING.md).

## Hard rules

- **English only** in every file: descriptions, READMEs, CHANGELOGs, frontmatter, comments. Cyrillic is allowed only as search data (synonyms, sample queries in the catalog spec). CI rejects Cyrillic in `marketplace.json` and `plugin.json`.
- **`version` lives only in `plugins/<p>/.claude-plugin/plugin.json`**, never in `marketplace.json`. Any change under `plugins/<p>/` needs a higher version (CI checks against `main`).
- **Release only through the scripts:**
  - `node scripts/release.mjs <p> patch|minor|major`;
  - then, on `main` after merge, `node scripts/tag-release.mjs --push`;
  - rollback = `node scripts/rollback.mjs <p> <good-version>` (roll forward, never lower a version or move a tag).
- **Plugin paths only via `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}`.** No `..`, no absolute paths, no top-level `bin/` in a plugin, no secrets, caches or memory files. Hooks go in `hooks/hooks.json` (plugin agents ignore `hooks` in frontmatter). Security rules: [docs/SECURITY.md](docs/SECURITY.md).
- **Never commit or push without the user's explicit OK.** Work on a feature branch; `main` is protected by CI.
- **Do not hand-edit `docs/design/prototype/`.** It is an export from Claude Design; replace it with a new export.

## Checks before saying "done"

```bash
claude plugin validate --strict .
for d in plugins/*/; do claude plugin validate --strict "$d"; done
node .github/scripts/check-versions.mjs origin/main
node --test "scripts/**/*.test.mjs"
npm --prefix site run check
```

When `site/` changes, also run (from `site/`): `npm test`, `npm run test:build`, `npm run e2e`.
Build tests write to `site/.test-dist/` (same drive as the repo: Astro renames its output, which fails across drives).
E2E uses port 4398 and always builds fresh; `node site/test/e2e/serve.mjs` serves the demo on 4399 for manual review.

Test installs in a throwaway config, never in the user's real `~/.claude`.

## Catalog site

Workflow: spec → plan → user approval → implement by task → verify against the acceptance criteria → commit after OK.

| What | Where | Status |
| :- | :- | :- |
| Spec CAT-01 (what and why, EARS acceptance criteria) | [docs/specs/marketplace-catalog.md](docs/specs/marketplace-catalog.md) | approved |
| Concept brief (Lindigo, Editorial/Swiss) | [docs/design/concept-brief.md](docs/design/concept-brief.md) | approved |
| Design tokens: the only source of colors, type, spacing, motion | [docs/design/design-tokens.md](docs/design/design-tokens.md) | approved |
| Prototype (reference, not source of truth) | [docs/design/prototype/](docs/design/prototype/) | exported |
| Implementation plan (decisions D1–D8, acceptance run in §12) | [docs/plans/catalog-site.md](docs/plans/catalog-site.md) | implemented (T0–T12) |
| Site source, commands, configuration | [site/README.md](site/README.md) | implemented; first deploy after merge |
| Public index schema | [docs/catalog-index.md](docs/catalog-index.md) | schemaVersion 1 |

Site constraints:
- Astro + MiniSearch, no backend.
- Site source outside `plugins/`.
- Fonts self-hosted, no third-party scripts.
- Origin and base path come from config.
- Token change → `design-tokens.md` first, then code (`site/src/styles/tokens.css` is a verbatim copy; a test compares them).
- `ResultEntry.astro` and `site/src/client/render.mjs` render the same card; change both.
- UI text lives only in `site/src/i18n/en.json`; components use `t()` (a unit test rejects hard-coded text and unused keys).

## Layout

- `.claude-plugin/marketplace.json`: the catalog.
- `plugins/<p>/`: one plugin.
- `scripts/`: release tooling + `lib/` with unit tests.
- `site/`: catalog site (Astro + MiniSearch), its tests and fixtures.
- `.github/`: CI (`validate.yml`, `pages.yml`), CI scripts, CODEOWNERS, PR template.
- `docs/`: specs, plans, design, security policy, `catalog-index.md`.
