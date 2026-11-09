# Contributing

Thanks for improving the `lindigo-devdigest` marketplace. This file covers how to add or change a plugin and what CI checks. The root [README](README.md) covers installing, versioning and release tags.

## Ground rules

- **Language:** all descriptions, READMEs, changelogs, frontmatter and code comments are in English.
- **One plugin per PR** where possible. A catalog-only change (`marketplace.json`, docs, CI) can go on its own.
- **Ownership:** every path has an owner in [`.github/CODEOWNERS`](.github/CODEOWNERS); a new plugin directory gets a line there too.
- **Nothing private:** no secrets, tokens, `.env`, caches, `evals/results/`, memory or local settings files.
- **Security:** a PR that adds or changes a hook or script follows the maintainer checklist in [docs/SECURITY.md](docs/SECURITY.md). Report vulnerabilities privately as described there, never in a public issue.

## Change an existing plugin

1. Edit files under `plugins/<name>/` only.
2. Describe the change under `## [Unreleased]` in `plugins/<name>/CHANGELOG.md`.
3. Run `node scripts/release.mjs <name> <patch|minor|major>`. It bumps `version` in `plugin.json` and dates the CHANGELOG section. Choose the bump per SemVer:
   - patch: fixes and wording in existing components;
   - minor: new skill, agent, command or hook; new optional behaviour;
   - major (or minor while `0.x`): removed or renamed component, changed hook behaviour, a tightened dependency range.
4. Do not add `version` to the plugin's entry in `marketplace.json`: it lives only in `plugin.json`.

## Add a new plugin

1. Create `plugins/<name>/` (kebab-case, no `claude-`, `anthropic-` or `cc-plugin-` prefix). The name is effectively permanent; use `displayName` for a nicer label.
2. Add `.claude-plugin/plugin.json` with `name`, `version` (`0.1.0`), `description`, `author`, `license`, `keywords` and `dependencies`.
3. Put components at the plugin root (`skills/`, `agents/`, `commands/`, `hooks/hooks.json`, `.mcp.json`), never inside `.claude-plugin/`.
4. Add `README.md` (workflow, components, permissions, secret slots), `CHANGELOG.md` and `COMPATIBILITY.md`.
5. Add the entry to `.claude-plugin/marketplace.json` with `name`, `source` (`./plugins/<name>`), `description`, `category` and `tags`.
6. Add the plugin to the dependency graph in the root README.

## Component rules

- Paths in hooks, scripts and MCP configs use `${CLAUDE_PLUGIN_ROOT}` (read-only plugin files) or `${CLAUDE_PLUGIN_DATA}` (state, `node_modules`). No absolute paths and no `..`: the plugin is copied into a cache.
- Quote `"${CLAUDE_PLUGIN_ROOT}"` in shell-form hook commands, because paths with spaces are common on Windows.
- Executables live in `scripts/`, not a top-level `bin/`.
- Plugin agents ignore `hooks`, `mcpServers` and `permissionMode` in frontmatter; declare hooks in `hooks/hooks.json`.
- Every `hooks/hooks.json` has a top-level `description` saying what the hooks do (it is the hook's text in the catalog search).
- Every `SKILL.md` and agent file starts with YAML frontmatter that has `name` and `description`. The catalog site build fails without them and names the file. Names use only letters, digits, `.`, `_` and `-` (they become page URLs).
- Optional frontmatter `tags` on a skill, agent or command rank above the plugin's tags in catalog search.
- An agent's `skills:` list (`<plugin>:<skill>`, or a bare name for its own plugin) is what the catalog shows as "Preloads" / "Preloaded by".
- The plugin README's `## How to use` section has a `| You type | You get |` table; the catalog's "Try it after install" shows its first two rows, so put the most useful prompts first.
- `COMPATIBILITY.md` has a `Context cost` row in its first table: `~<n> tokens always-on`, the value `claude plugin details <plugin>` prints. Update it in every release that changes a skill or agent description; CI fails when it is more than 10 % off.
- A `CLAUDE.md` inside a plugin is not loaded; put instructions in a skill.
- Reference another plugin's skill as `<plugin>:<skill>` and declare that plugin in `dependencies` with a range such as `^1.0`.
- Code taken from DevDigest keeps its MIT notice and a provenance line in `CHANGELOG.md`.

## Sources, licences and public text

The repository is public, so every component must be licensed for redistribution and must not depend on one project. `check-components.mjs` enforces this (spec [SDD-01](docs/specs/sdd-plugins.md), R1/R4/R6):

- A plugin with skills or agents ships `LICENSE` and `sources.json`, which records each skill and agent:

  ```json
  {
    "skills": { "fastify-best-practices": { "origin": "third-party", "url": "https://github.com/…", "license": "MIT", "copyright": "…" } },
    "agents": { "researcher": { "origin": "devdigest", "license": "MIT" } }
  }
  ```

  `origin` is `devdigest`, `own` or `third-party`. A third-party entry needs an `https` URL, an SPDX licence and a `## <name>` section in the plugin's `THIRD_PARTY_NOTICES.md` with source, licence, copyright and the licence text. A component whose licence is unknown is not committed at all.
- An agent's `skills:` list names only skills shipped in the same release: a bare name for its own plugin, `<plugin>:<skill>` for a declared dependency.
- Any `<plugin>:<skill>` or `<plugin>:<agent>` written in component text names the own plugin or a declared dependency.
- Copies of `hooks/bash-guard.mjs` in different plugins are byte-identical; each plugin's `hooks.json` maps only its own agents.
- Agents, skills, hooks, scripts, evals and plugin READMEs contain no project-specific paths or names (`server/src`, `client/src`, `.claude/skills/`, `$CLAUDE_PROJECT_DIR/.claude`, course-lesson codes, the source project's name). This marketplace's own identifiers in install commands are fine. Errors print as `file:line`.

## Check locally before opening a PR

```bash
claude plugin validate --strict .
claude plugin validate --strict ./plugins/<name>
node .github/scripts/check-versions.mjs origin/main
node .github/scripts/check-components.mjs          # every plugin; pass origin/main to check only changed ones

# Smoke install in a throwaway config, so your own ~/.claude stays untouched
claude plugin marketplace add ./
claude plugin install <name>@lindigo-devdigest
claude plugin list
```

`validate` does not catch missing directories or broken remote sources, so the install step matters.

Check that the catalog site still builds from your change (Node.js ≥ 22.23.4):

```bash
npm --prefix site ci
npm --prefix site run check     # counts per kind and warnings, or every broken file with the reason
```

Changes to the site itself run the full suite; see [site/README.md](site/README.md).

## Search synonyms

[`site/synonyms.json`](site/synonyms.json) groups words the catalog search treats as equal, across English and Ukrainian (for example `review` and its Ukrainian forms). Anyone may propose a group in a PR; @lindigo-design owns the file (CODEOWNERS).

- One group per concept, at least 2 terms; a term may appear in only one group. The build fails otherwise and names the term.
- Ukrainian entries are **stems**, matched as prefixes, so one stem covers every case ending.
- Kind words (skill, agent, hook, command, plugin) are not synonyms; the search turns them into filters.

## What CI runs

[`validate.yml`](.github/workflows/validate.yml) runs on every PR, with `contents: read` and no secrets:

1. `claude plugin validate --strict` for the root and every plugin;
2. `check-versions.mjs`: catalog and directory consistency, no `version` in the catalog, a version bump for every changed plugin; `check-components.mjs` on the changed plugins (sources and licences, `skills:` lists, cross-plugin references, denylist); hook self-tests;
3. smoke install of every plugin in a temporary `HOME`, then a check that all dependencies are enabled and that each plugin's declared `Context cost` is within 10 % of `claude plugin details` (`check-context-cost.mjs`).

[`pages.yml`](.github/workflows/pages.yml) builds and tests the catalog site on PRs that touch plugins, the catalog, the site or the design tokens, and deploys it from `main`:

1. `site: unit + build tests`: unit tests (including the token and UI-string lints), the catalog check of this repository, build tests on fixtures (including origin/base-path variants);
2. `site: build`: the site build, uploaded as the Pages artifact on `main`;
3. `site: browser tests (Playwright + axe)`: WCAG 2.1 AA, keyboard, 360 px, reduced motion;
4. on `main` only: deploy to GitHub Pages after all three pass, the only job with `pages: write` and `id-token: write`.

`claude plugin eval` is not part of CI because it is paid; run it manually when a component's behaviour changes.

## Releases

| Step | Command | Where |
| :- | :- | :- |
| Prepare | `node scripts/release.mjs <plugin> patch\|minor\|major` | feature branch |
| Prepare several at once | `node scripts/release.mjs <plugin>=major <plugin>=major …` (each released once; ranges between them rewritten, no cascade) | feature branch |
| Tag | `node scripts/tag-release.mjs --push` | `main`, after merge |
| Roll back | `node scripts/rollback.mjs <plugin> <good-version> --reason "<why>"` | feature branch, then tag after merge |

Every script supports `--dry-run` and `--help`. Details are in the root [README](README.md#versioning-and-releases). Unit tests: `node --test "scripts/**/*.test.mjs"`.
