# Plugin guidelines

What a plugin in `lindigo-devdigest` contains and the rules its files follow. CI enforces most of them (`claude plugin validate --strict`, `check-versions.mjs`, `check-components.mjs`, smoke install, context cost). How to version, tag and roll back: [RELEASES.md](RELEASES.md). How to open a PR: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Plugin layout

```
plugins/<name>/
  .claude-plugin/plugin.json   name, version (only here), description, author, license, keywords, dependencies
  skills/<skill>/SKILL.md      plus the skill's own helper files (scripts/, references/, templates/)
  agents/<agent>.md
  commands/<command>.md
  hooks/hooks.json             plus the hook scripts and their self-tests
  evals/<case>/                behaviour checks for claude plugin eval (see Evals)
  README.md  CHANGELOG.md  COMPATIBILITY.md  LICENSE  sources.json  THIRD_PARTY_NOTICES.md (if third-party)
```

Only what the plugin uses; no empty component directories, nothing inside `.claude-plugin/` except the manifest.

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

## Helper files in a skill: `${CLAUDE_SKILL_DIR}`

A skill that needs a script, template or reference file keeps it next to its `SKILL.md` and names it through `${CLAUDE_SKILL_DIR}`, never through a relative or absolute path. Claude Code substitutes the variable in the skill body (and in `allowed-tools` Bash rules) with the skill's own directory, wherever the plugin is installed: the user's plugin cache, a project, or a local checkout.

```markdown
Run `node "${CLAUDE_SKILL_DIR}/scripts/transcript-metrics.mjs" <session.jsonl>` and use its JSON.
```

- Quote the path: checkouts and caches often contain spaces.
- Use `${CLAUDE_PLUGIN_ROOT}` for files shared by several skills of the plugin, and in hooks (`${CLAUDE_SKILL_DIR}` is not substituted in `hooks.json`).
- Scripts read only what they are given and write nothing unless the skill says so; they need only Node ≥ 22 (no `npm install` at run time).
- A script with logic gets a `<name>.self-test.mjs` next to it; CI runs every `plugins/*/skills/*/scripts/*self-test.mjs`.
- Example: `sdd-engineering/skills/workflow-retro/scripts/transcript-metrics.mjs` and its self-test.

## Evals

Every plugin ships an eval suite in `plugins/<name>/evals/` that checks **behaviour**, not just the manifest: does the right skill or agent fire on a request it is for, and stay silent on one it is not for. Format ([Claude Code docs](https://code.claude.com/docs/en/plugin-evals)):

```
evals/<case>/prompt.md          frontmatter (name, tags, runs, allowed_tools, max_turns); body = the user's prompt
evals/<case>/graders/<name>.md  frontmatter: type (tool_used, regex, tool_order, file_exists, llm) and options
```

- Each skill and each agent the model may pick on its own has at least one **positive** case (it fires) and one **negative** case (an unrelated request; it does not fire, `min: 0`, `max: 0`, `arm: both`).
- Prefer the free deterministic graders (`tool_used`, `regex`); add an `llm` grader only where the quality of the answer is the point.
- Prompts are generic: no project-specific paths or names (the denylist in `check-components.mjs` scans `evals/` too).
- Results go to `evals/results/`, which is git-ignored; never commit them.
- A skill with `disable-model-invocation: true` (for example `run-plan`) is started only by the user, so it gets no "fires" case; instead a negative case checks that the model does not start it even when asked to.

Run a suite (it calls the model with your credentials, so it is paid; CI does not run it):

```bash
claude plugin eval ./plugins/<name> --runs 1 --ablation none     # quick check, one run per case
claude plugin eval ./plugins/<name>                                # default: 3 runs, with a no-plugin baseline
for d in plugins/*/; do claude plugin eval "$d" --runs 1 --ablation none; done
```

To check that every case file loads (frontmatter, graders) **without any model call**, run with a zero cost ceiling. It loads and validates the whole suite, then stops before the first run: exit `2` with `partialReason: cost_ceiling` and `costUsd: 0` means the files are fine; exit `1` names the case that failed to load.

```bash
claude plugin eval ./plugins/<name> --trust-plugin --no-publish --max-cost-usd 0 --json /tmp/eval-load.json
```

Quote frontmatter values that contain `: ` (for example a `description`), or the YAML does not parse.

Run the suite of every plugin you change before a minor or major release, and say in the PR what scored below 1.0.

## Sources, licences and public text

The repository is public, so every component must be licensed for redistribution and must not depend on one project. `check-components.mjs` enforces this (spec [SDD-01](specs/sdd-plugins.md), R1/R4/R6):

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
