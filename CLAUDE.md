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
```

Test installs in a throwaway config, never in the user's real `~/.claude`.

## Catalog site (in progress)

Workflow: spec → plan → user approval → implement by task → verify against the acceptance criteria → commit after OK.

| What | Where | Status |
| :- | :- | :- |
| Spec CAT-01 (what and why, EARS acceptance criteria) | [docs/specs/marketplace-catalog.md](docs/specs/marketplace-catalog.md) | approved |
| Concept brief (Lindigo, Editorial/Swiss) | [docs/design/concept-brief.md](docs/design/concept-brief.md) | approved |
| Design tokens: the only source of colors, type, spacing, motion | [docs/design/design-tokens.md](docs/design/design-tokens.md) | approved |
| Prototype (reference, not source of truth) | [docs/design/prototype/](docs/design/prototype/) | exported |
| Implementation plan | `docs/plans/catalog-site.md` | next |

Site constraints:
- Astro + MiniSearch, no backend.
- Site source outside `plugins/`.
- Fonts self-hosted, no third-party scripts.
- Origin and base path come from config.
- Token change → `design-tokens.md` first, then code.

## Layout

- `.claude-plugin/marketplace.json`: the catalog.
- `plugins/<p>/`: one plugin.
- `scripts/`: release tooling + `lib/` with unit tests.
- `.github/`: CI (`validate.yml`), CI scripts, CODEOWNERS, PR template.
- `docs/`: specs, design, security policy.
- `docs/temp/`: notes to delete after migration.
