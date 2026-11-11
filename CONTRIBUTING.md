# Contributing

Thanks for improving the `lindigo-devdigest` marketplace. This file covers the PR workflow and what CI checks. Entry points:

| You want to | Read |
| :- | :- |
| add or change a plugin, skill, agent, hook or eval | [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) |
| release, tag, update or roll back a plugin | [docs/RELEASES.md](docs/RELEASES.md) |
| change the catalog site | [docs/SITE-SPEC.md](docs/SITE-SPEC.md) |
| report a vulnerability or add a hook | [docs/SECURITY.md](docs/SECURITY.md) |

## Ground rules

- **Language:** all descriptions, READMEs, changelogs, frontmatter and code comments are in English.
- **One plugin per PR** where possible. A catalog-only change (`marketplace.json`, docs, CI) can go on its own.
- **Ownership:** every path has an owner in [`.github/CODEOWNERS`](.github/CODEOWNERS); a new plugin directory gets a line there too.
- **Nothing private:** no secrets, tokens, `.env`, caches, `evals/results/`, memory or local settings files.
- **Security:** a PR that adds or changes a hook or script follows the maintainer checklist in [docs/SECURITY.md](docs/SECURITY.md). Report vulnerabilities privately as described there, never in a public issue.

## Change an existing plugin

1. Edit files under `plugins/<name>/` only, following [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md).
2. Describe the change under `## [Unreleased]` in `plugins/<name>/CHANGELOG.md`.
3. Run `node scripts/release.mjs <name> <patch|minor|major>` (which bump: [docs/RELEASES.md](docs/RELEASES.md#versioning-rules)).
4. If a skill or agent changed, run the plugin's eval suite: `claude plugin eval ./plugins/<name> --runs 1 --ablation none` (paid; see [Evals](docs/PLUGIN-GUIDELINES.md#evals)).

## Add a new plugin

Follow [docs/PLUGIN-GUIDELINES.md § Add a new plugin](docs/PLUGIN-GUIDELINES.md#add-a-new-plugin): layout, manifest, README, CHANGELOG, COMPATIBILITY, `sources.json`, an eval suite, the marketplace entry, CODEOWNERS and the dependency graph in the root README.

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
node scripts/build-index.mjs    # the catalog index CI builds: counts per kind and warnings, or every broken file
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
2. `check-versions.mjs`: catalog and directory consistency, no `version` in the catalog, a version bump for every changed plugin; `check-components.mjs` on the changed plugins (sources and licences, `skills:` lists, cross-plugin references, denylist); hook and skill-script self-tests (`*self-test.mjs`);
3. smoke install of every plugin in a temporary `HOME`, then a check that all dependencies are enabled and that each plugin's declared `Context cost` is within 10 % of `claude plugin details` (`check-context-cost.mjs`).

[`site-build.yml`](.github/workflows/site-build.yml) builds the catalog index and the catalog site and tests them on every PR (its three jobs are required checks for `main`), and deploys the site from `main`:

1. `site: unit + build tests`: unit tests (including the token and UI-string lints), **the catalog index of this repository** (`scripts/build-index.mjs`: counts and warnings, or every broken file; the `index.json` is kept as the `catalog-index` artifact), build tests on fixtures (including origin/base-path variants);
2. `site: build`: the site build, uploaded as the Pages artifact on `main`;
3. `site: browser tests (Playwright + axe)`: WCAG 2.1 AA, keyboard, 360 px, reduced motion;
4. on `main` only: deploy to GitHub Pages after all three pass, the only job with `pages: write` and `id-token: write`.

`claude plugin eval` is not part of CI because it calls the model and is paid; each plugin's `evals/` suite is run by hand when a component's behaviour changes ([Evals](docs/PLUGIN-GUIDELINES.md#evals)).

## Releases

Prepare on a branch with `node scripts/release.mjs <plugin> patch|minor|major`, tag on `main` after merge with `node scripts/tag-release.mjs --push`, roll back with `node scripts/rollback.mjs`. The full cycle with an example: [docs/RELEASES.md](docs/RELEASES.md).
