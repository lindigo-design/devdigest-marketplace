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
- A `CLAUDE.md` inside a plugin is not loaded; put instructions in a skill.
- Reference another plugin's skill as `<plugin>:<skill>` and declare that plugin in `dependencies` with a range such as `^0.1`.
- Code taken from DevDigest keeps its MIT notice and a provenance line in `CHANGELOG.md`.

## Check locally before opening a PR

```bash
claude plugin validate --strict .
claude plugin validate --strict ./plugins/<name>
node .github/scripts/check-versions.mjs origin/main

# Smoke install in a throwaway config, so your own ~/.claude stays untouched
claude plugin marketplace add ./
claude plugin install <name>@lindigo-devdigest
claude plugin list
```

`validate` does not catch missing directories or broken remote sources, so the install step matters.

## What CI runs

[`validate.yml`](.github/workflows/validate.yml) runs on every PR, with `contents: read` and no secrets:

1. `claude plugin validate --strict` for the root and every plugin;
2. `check-versions.mjs`: catalog and directory consistency, no `version` in the catalog, a version bump for every changed plugin;
3. smoke install of every plugin in a temporary `HOME`, then a check that all dependencies are enabled.

`claude plugin eval` is not part of CI because it is paid; run it manually when a component's behaviour changes.

## Releases

| Step | Command | Where |
| :- | :- | :- |
| Prepare | `node scripts/release.mjs <plugin> patch\|minor\|major` | feature branch |
| Tag | `node scripts/tag-release.mjs --push` | `main`, after merge |
| Roll back | `node scripts/rollback.mjs <plugin> <good-version> --reason "<why>"` | feature branch, then tag after merge |

Every script supports `--dry-run` and `--help`. Details are in the root [README](README.md#versioning-and-releases). Unit tests: `node --test "scripts/**/*.test.mjs"`.
