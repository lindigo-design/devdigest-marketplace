# Releases

How a plugin in `lindigo-devdigest` gets a new version, a tag, an update on users' machines and, if needed, a rollback. Rules for what goes into a plugin are in [PLUGIN-GUIDELINES.md](PLUGIN-GUIDELINES.md).

## Versioning rules

- `version` lives **only** in `plugins/<name>/.claude-plugin/plugin.json`, never in `marketplace.json`. Users get a new copy only when this string changes.
- Any change under `plugins/<name>/` must bump that plugin's version (SemVer). CI fails a PR that changes a plugin without raising its version above `main` (`check-versions.mjs`).
- Choose the bump per SemVer:
  - **patch:** fixes and wording in existing components;
  - **minor:** a new skill, agent, command, hook, helper script or eval suite; new optional behaviour;
  - **major** (or minor while `0.x`): a removed or renamed component, changed hook behaviour, a tightened dependency range.
- Dependencies use caret ranges on the major (`^1.0` = `>=1.0.0 <2.0.0`). A breaking change in a base plugin bumps its major and requires dependents to widen their range in the same PR (`release.mjs <plugin>=major …` releases them together).
- Release notes go under `## [Unreleased]` in the plugin's `CHANGELOG.md` in the same PR.

## Commands

| Step | Command | Where |
| :- | :- | :- |
| Prepare a release | `node scripts/release.mjs <plugin> patch\|minor\|major` | feature branch |
| Release several plugins together | `node scripts/release.mjs <plugin>=minor <plugin>=minor …` | feature branch |
| Tag released versions | `node scripts/tag-release.mjs --push` | `main`, after merge |
| Roll back | `node scripts/rollback.mjs <plugin> <good-version> --reason "<why>"` | feature branch, then tag after merge |

Every script supports `--dry-run` and `--help`. They need only Node ≥ 22 and git; validation uses the `claude` CLI when it is on `PATH`. Unit tests: `node --test "scripts/**/*.test.mjs"`.

## The full cycle

Example: `sdd-engineering` 1.0.1 → 1.1.0 (a helper script for `workflow-retro` and an eval suite).

1. **Change** files under `plugins/sdd-engineering/` on a feature branch, and describe the change under `## [Unreleased]` in its `CHANGELOG.md`.
2. **Prepare the release** on the same branch:

   ```bash
   node scripts/release.mjs sdd-engineering minor --dry-run   # shows 1.0.1 → 1.1.0 and the tag name
   node scripts/release.mjs sdd-engineering minor
   ```

   The script bumps `version` in `plugin.json`, moves the `[Unreleased]` notes into a dated `## [1.1.0]` section and runs `claude plugin validate --strict`. If the new version breaks a dependent's range, it stops; `--update-dependents` widens those ranges and patch-releases the dependents in the same change.
3. **Open a PR.** CI checks the bump against `main`, the components, the smoke install and the context cost; the catalog site builds the new version.
4. **Merge**, then **tag** on `main`:

   ```bash
   git switch main && git pull
   node scripts/tag-release.mjs --dry-run
   node scripts/tag-release.mjs --push            # creates and pushes sdd-engineering--v1.1.0
   ```

   It wraps `claude plugin tag`, which also checks that `plugin.json` and the marketplace entry agree. Dependency ranges resolve against these tags, so a missing tag means dependents get whatever is on the default branch.
5. **The site follows.** The tag push rebuilds the catalog site: the plugin page shows 1.1.0, its "Download source" link points at `sdd-engineering--v1.1.0.zip`, and "What's new" and the feeds gain the release.
6. **Users update** (below). With auto-update on, they get it at the next start.

## Release tags

A tag is `<plugin>--v<version>`, for example `sdd-engineering--v1.1.0`. Tags are never moved or deleted: a published tag is what users and dependents resolved.

## Update on users' machines

In a session:

```
/plugin marketplace update lindigo-devdigest
/reload-plugins
```

From a shell: `claude plugin update <plugin>@lindigo-devdigest` (restart Claude Code afterwards). Auto-update is off by default for third-party marketplaces; each plugin page on the catalog site shows how to turn it on.

## Rollback = roll forward + bump

Never move or delete a published tag and never lower a version: clients compare versions and would keep the cached copy.

```bash
node scripts/rollback.mjs <plugin> <good-version> --reason "<why>" [--dry-run]
```

The script restores `plugins/<plugin>/` from the tag `<plugin>--v<good-version>`, sets the version to the next patch **above** the bad one (bad `0.2.1` → `0.2.2` with the content of `0.2.0`), keeps the CHANGELOG history and adds a `### Reverted` entry naming the withdrawn versions. It refuses when the good version's dependency ranges no longer match the current dependencies. Then open a PR, merge, and run `node scripts/tag-release.mjs --push`.

To undo one commit instead of a whole version, `git revert <sha>` and release a patch with `scripts/release.mjs`.

Users who must stay on a known-good catalog meanwhile can add the marketplace pinned to a ref: `/plugin marketplace add lindigo-design/devdigest-marketplace#<tag-or-branch>`.

## Renaming or removing a plugin

Never change `name` in place. Use `displayName` for a new label; for a real rename or removal add an entry to the append-only `renames` map in `marketplace.json`.
