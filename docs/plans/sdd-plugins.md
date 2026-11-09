# SDD plugin set: implementation plan

| | |
| :- | :- |
| Spec | [SDD-01](../specs/sdd-plugins.md) (approved 2026-11-09) |
| Status | draft 2026-11-09, waiting for owner approval |
| Source | DevDigest (MIT, © 2026 Ivan Lapa), branch `local/all-lessons` @ `b288d63` |
| Created | 2026-11-09 |

This plan covers the HOW: release mechanics, PR order, file layout per plugin, checks. Every task lists the SDD-01 acceptance criteria it closes; section 6 is the traceability matrix. Nothing is committed or pushed without the owner's OK; the owner runs every `--push`.

## 0. Decisions

| # | Question | Decision (proposed) |
| :- | :- | :- |
| D1 | How do four plugins go 0.1.0 → 1.0.0 with one plugin per PR in dependency order? | **Content PRs ship as 0.1.x patches; one final PR releases all four as 1.0.0 with a small `release.mjs` extension for `plugin=version` pairs.** Reasons below. |
| D2 | Range form. | `^1.0`, written by the existing `caretFor()` in every mode (spec R5/AC-4, rev. 4). No change to the range form. |
| D3 | Where source and licence records live (R6). | Inside each plugin, because only `plugins/<p>/` is copied on install and MIT requires the notice to travel with the copy: `plugins/<p>/LICENSE` (MIT, both copyright lines as in the root `LICENSE`), `plugins/<p>/THIRD_PARTY_NOTICES.md` (third-party skills only: skill, URL, licence, copyright, full licence text) and `plugins/<p>/sources.json` (machine-readable record per skill and agent, read by CI). This replaces the spec's "root `THIRD_PARTY_NOTICES.md`" option, which would not ship with the plugin. |
| D4 | New CI checks (R6/AC-4, R6/AC-6, R2/AC-6, R4/AC-1). | One script, `.github/scripts/check-components.mjs`, logic in `scripts/lib/components.mjs` with unit tests (picked up by the existing `node --test "scripts/**/*.test.mjs"`). Runs in the `versions` job of `validate.yml`. |
| D5 | `next-best-practices`: our own short skill or a prerequisite? | **Prerequisite for 1.0.0.** The `sdd-engineering` README tells users how to install the upstream skill themselves once its licence allows it. Writing our own skill is new content outside this migration; it can come as 1.1.0 (R6/AC-7). |
| D6 | `react-best-practices`, `testing`, `security` are blocked (spec §7.1). | Each ships in its plugin's content PR only if source and licence are confirmed before that PR. Otherwise the PR leaves it out, the agents' `skills:` lists omit it, and it comes later as a minor release. `security` decides PR-1, the other two decide PR-4. |
| D7 | Prerequisite: the catalog site is not on `main` yet (`feat/catalog-site`; `feat/pr-brief` points at the same commit and has no commits of its own). | Content PRs start after the site is merged, so `npm --prefix site run check` exists on their base. Baseline tags (T1) and the tooling PR (PR-0) do not depend on it. |
| D8 | Branch. | Work moves to `feat/plugin-migration`, created from an up-to-date `main`; the untracked spec and plan come along. `feat/pr-brief` has no unique commits and can be deleted. One commit per task; how the commits are split into PRs (one plugin per PR) is decided when opening them. |

### Why D1

Every dependent declares `^0.1` today. `^0.1` does not accept `1.0.0`, and Claude Code then refuses to load the dependent ("Requires … ^0.1, installed 1.0.0", seen in the marketplace research). CI installs every plugin on every PR (`smoke-install` + `assert-enabled.mjs`).

| Option | What happens |
| :- | :- |
| A. One plugin per PR, each releasing its own 1.0.0 with `release.mjs <p> major` | PR-1 (paved-path 1.0.0) breaks `research-tools`, `architecture-review`, `sdd-engineering`. `release.mjs` refuses without `--update-dependents`. With it, every dependent gets a patch release whose only change is the range. Over four PRs `sdd-engineering` would pass through 0.1.1, 0.1.2, 0.1.3 before 1.0.0, each a published version with a changelog entry about nothing. |
| A'. Same, top-down (sdd first) with ranges edited by hand | No cascade, but `sdd-engineering 1.0.0` on `main` requires dependencies that do not exist yet: `main` is not installable until the last PR. Ranges are hand-edited, which is what the tool exists to prevent. |
| **B. Content as 0.1.x, one coordinated 1.0.0 release (chosen)** | Each content PR bumps only its own plugin by a patch (0.1.0 → 0.1.1). Every `^0.1` range stays satisfied, so `main` installs after every PR. The final PR runs one `release.mjs` with four pairs: each plugin is released exactly once in that run, every range inside the set is rewritten by the tool, nothing cascades. |

Under caret semantics on `0.x`, a minor bump is breaking (CONTRIBUTING: "major, or minor while 0.x"), so a compatible addition on `0.1` is a patch. The 0.1.1 entries carry the component notes; the 1.0.0 entries mark the stable release and carry the provenance line (R5/AC-3).

## 1. Order of work

```
T1  baseline tags 0.1.0 on main           (owner pushes)
PR-0  tooling: release.mjs pairs, check-components, CI     no plugin change, no bump
      — catalog site merged to main (D7) —
PR-1  engineering-paved-path   0.1.0 → 0.1.1
PR-2  research-tools           0.1.0 → 0.1.1   (drops its dependency)
PR-3  architecture-review      0.1.0 → 0.1.1
PR-4  sdd-engineering          0.1.0 → 0.1.1
PR-5  release: all four → 1.0.0, ranges → ^1.0.0, measure context cost
T-tag after every merge: node scripts/tag-release.mjs --push   (owner)
```

Branches: one per PR (`feat/sdd-tooling`, `feat/paved-path-1.0`, …, `release/sdd-1.0`), each from an up-to-date `main`.

## 2. Tasks

### T0. Probes (no commit)

In throwaway plugins under the scratchpad, on Claude Code 2.1.318, with a throwaway config:

1. A plugin agent's `skills:` list with `<dependency>:<skill>` preloads that skill (marketplace research, finding 4: "to verify").
2. A plugin `PreToolUse` hook receives `agent_type` = `<plugin>:<agent>` inside that agent (spec §5).
3. `${CLAUDE_SKILL_DIR}` resolves to the installed skill directory inside a plugin (R1/AC-4).

A failed probe stops the plan and goes back to the owner.

**Result 2026-11-09 (2.1.318, `--plugin-dir`): all three pass.** An agent in `probe-top` with `skills: [probe-base:probe-skill]` received the dependency's skill; the `PreToolUse` hook got `"agent_type": "probe-top:prober"`; `${CLAUDE_SKILL_DIR}` in `SKILL.md` was replaced by the installed skill's absolute path.

### T1. Baseline tags

On a clean checkout of `main` (`tag-release.mjs` refuses a dirty tree, and the working copy has other branches' changes): `node scripts/tag-release.mjs --dry-run` must list exactly the four `<p>--v0.1.0` tags. The owner runs `node scripts/tag-release.mjs --push`.

### PR-0. Tooling (`scripts/`, `.github/`)

1. **`release.mjs` pairs mode.** `node scripts/release.mjs <p>=<version|bump> [<p>=<version|bump> …]`. One run, in-memory, all-or-nothing, as today:
   - each named plugin is released once (version, CHANGELOG section from `[Unreleased]` or `--note`);
   - every dependency between two named plugins gets `^<new version>` (D2), with a note in the dependent's section;
   - a dependent **outside** the set that the new versions break is reported, as today (`--update-dependents` still available);
   - the existing single-plugin form is unchanged.
   Unit tests: four-plugin graph to 1.0.0; a pair that breaks an outside dependent; duplicate name; mixed `major` and `X.Y.Z`; dry run writes nothing.
2. **`scripts/lib/components.mjs` + `.github/scripts/check-components.mjs`.** For each plugin:
   - every `skills/<s>/` and `agents/<a>.md` has an entry in `sources.json`; a third-party entry has `url`, an SPDX `license` other than `unknown`/`NOASSERTION`, and a matching section in `THIRD_PARTY_NOTICES.md`; `LICENSE` exists (R6/AC-1, 2, 4, 5);
   - every agent's `skills:` item resolves to an existing skill: bare name → own plugin; `<plugin>:<skill>` → that plugin must be the agent's own or a declared dependency, and the skill must exist (R6/AC-6, R1/AC-3);
   - every `<plugin>:<name>` in component text, where `<plugin>` is a plugin of this marketplace, names the own plugin or a declared dependency, and `<name>` is a shipped skill or agent of it (R1/AC-9); reported with `file:line`;
   - every `bash-guard.mjs` copy is byte-identical (R2/AC-6);
   - **leak denylist** (R4/AC-1, AC-3) over `agents/`, `skills/`, `hooks/`, `scripts/`, `evals/` and `README.md` of every plugin, case-insensitive: `devdigest`, `dev-digest`, `devdigest-ai`, `server/src`, `client/src`, `reviewer-core`, `platform/container.ts`, `mcp__devdigest__`, `local/all-lessons`, `\bL0[1-8]\b`, `.claude/skills/`, `$CLAUDE_PROJECT_DIR/.claude`; exempt: `CHANGELOG.md` provenance lines, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `sources.json`; reported with `file:line` and the term;
   - errors name the file and the reason. Unit tests on fixture plugins for each rule.
3. **`validate.yml`:** run `check-components.mjs` in the `versions` job on the plugins a change touches (PR: against the base branch; push: against `github.event.before`; manual run: all), so each plugin PR is held to the rules while the other plugins still have scaffold READMEs; run every `plugins/*/hooks/self-test.mjs` with `node`. The full run (`check-components.mjs` with no argument) must pass from PR-4 on.
4. Docs: CONTRIBUTING (pairs mode, `sources.json`, the new checks), root README release table.

`sources.json` shape:

```json
{
  "skills": {
    "onion-architecture": { "origin": "devdigest", "license": "MIT", "source": "local/all-lessons@b288d63:.claude/skills/onion-architecture" },
    "fastify-best-practices": { "origin": "third-party", "url": "https://github.com/mcollina/skills/tree/<commit>/skills/fastify", "license": "MIT", "copyright": "<holder>" }
  },
  "agents": { "architecture-reviewer": { "origin": "devdigest", "license": "MIT", "source": "local/all-lessons@b288d63:.claude/agents/architecture-reviewer.md" } }
}
```

Closes: R6/AC-4, R6/AC-6, R2/AC-6 (check), R4/AC-1 (check), D1 tooling.

### PR-1. `engineering-paved-path` 0.1.0 → 0.1.1

- `skills/onion-architecture/`, `skills/frontend-ui-architecture/`: migrate with references, examples, evals; **generalize** (spec §3.1): roles instead of `server/src/modules/<name>/`, `client/`, `platform/container.ts`; actual paths discovered in the consuming repo or asked for; neutral sample layout in examples and evals; drop Ukrainian trigger phrases from descriptions (English-only rule).
- `skills/security/` only if D6 clears it.
- `LICENSE`, `sources.json`, no `THIRD_PARTY_NOTICES.md` (no third-party skill).
- README: components table (shipped only), "Later": `guardrails`, `engineering-insights`, `mermaid-diagram`, and `security` if blocked. Remove `workflow-retro` (moves to sdd, spec Q2).
- `plugin.json` / `marketplace.json`: description, keywords and tags to what ships ("Architecture and security rules shared by architecture-review and sdd-engineering").
- `COMPATIBILITY.md`: minimum 2.1.318 (R5/AC-8).
- CHANGELOG `[Unreleased]` → `release.mjs engineering-paved-path patch`.

Closes: R1/AC-1, 2, 5, 7 (paved-path), R4, R5/AC-1, 6, 8 (paved-path), R6/AC-5.

### PR-2. `research-tools` 0.1.0 → 0.1.1

- `agents/researcher.md`: generalize (no repository description, no DevDigest paths); `tools: Read, Grep, Glob, Bash, WebSearch, WebFetch`; `disallowedTools: Write, Edit, NotebookEdit`.
- `plugin.json`: **remove `dependencies`** (R1/AC-8).
- `LICENSE`, `sources.json`; README ("Later": `brainstorm`), `marketplace.json` description and tags, `COMPATIBILITY.md` 2.1.318, root README dependency graph (no RT → EPP edge).

Closes: R1/AC-8, R2/AC-1 (researcher), R5/AC-1, 6, 8 (research-tools).

### PR-3. `architecture-review` 0.1.0 → 0.1.1

- `agents/architecture-reviewer.md`: generalized; `skills: [engineering-paved-path:onion-architecture, engineering-paved-path:frontend-ui-architecture]` plus `engineering-paved-path:security` only if it shipped in PR-1; read-only tools.
- `hooks/hooks.json` (top-level `description`), `hooks/bash-guard.mjs`, `hooks/self-test.mjs`. The script is generic: `hooks.json` passes the agent-to-profile map as arguments, `node "${CLAUDE_PLUGIN_ROOT}/hooks/bash-guard.mjs" architecture-review:architecture-reviewer=review`; any other `agent_type`, or none, is allowed unchanged. So the script never names another plugin's agent (R1/AC-9) and both copies stay byte-identical (R2/AC-6).
- `LICENSE`, `sources.json`, README ("Later": `security-reviewer`, `pr-self-review`, push `gate`), `marketplace.json`, `COMPATIBILITY.md` 2.1.318.
- Security checklist from `docs/SECURITY.md` in the PR (new hook).

`sdd-engineering`'s `hooks.json` passes `sdd-engineering:plan-verifier=verify` to its own copy.

Closes: R2/AC-1, 2, 4, 5, R1/AC-3, R6/AC-6 (architecture-reviewer), R5/AC-1, 6, 8.

### PR-4. `sdd-engineering` 0.1.0 → 0.1.1

- Agents: `spec-creator` (writes `specs/`; DevDigest MCP tools removed), `implementation-planner` (writes `plans/`), `implementer` (merges `implementer-backend` and `implementer-frontend`; the rules it needs from `implementer-protocol` move into its body), `plan-verifier` (read-only).
- Skills: `run-plan` (from `implement-plan`: steps for `test-writer`, `doc-writer`, `security-reviewer` removed; flow per spec §4: approved-plan check, implementer → verifier, one retry, `architecture-reviewer` on Finish, offer retro, no commit/push), `workflow-retro` (shows first, writes `retros/` after OK), `fastify-best-practices` (third-party, attribution), `react-best-practices` and `testing` only if D6 clears them. Supporting scripts via `${CLAUDE_SKILL_DIR}`.
- Agents' `skills:` lists: only shipped skills (R6/AC-6); `next-best-practices` is a README prerequisite (D5).
- Hooks: `write-scope.mjs` (`sdd-engineering:spec-creator` → `specs/`, `sdd-engineering:implementation-planner` → `plans/`), `bash-guard.mjs` (identical copy), `self-test.mjs`, `hooks.json` with `description`.
- `evals/` migrated for the shipped agents and skills (R1/AC-6), without `evals/results/`.
- `LICENSE`, `THIRD_PARTY_NOTICES.md` (fastify, and react/testing if shipped), `sources.json`.
- README: the full workflow (spec §4 graph and steps), which plugin supplies each agent and skill, what the user approves, prerequisites, "Later" (`test-writer`, `doc-writer`, `implementer-protocol`, stack skills from spec Q3).
- `plugin.json` description and keywords, `marketplace.json`, `COMPATIBILITY.md` 2.1.318; dependency ranges stay `^0.1` until PR-5.
- Security checklist in the PR (new hooks).

Closes: R1/AC-1…6, R2/AC-3…6, R3, R4, R5/AC-2, R6/AC-1…6 (sdd).

### PR-5. Release 1.0.0

1. Each CHANGELOG `[Unreleased]`: "Stable release" + `Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ b288d63`. The 0.1.0 entries stay as they are.
2. `node scripts/release.mjs engineering-paved-path=major research-tools=major architecture-review=major sdd-engineering=major --dry-run`, then without `--dry-run`. Expected: four `0.1.1 → 1.0.0`; `architecture-review` → `engineering-paved-path ^1.0`; `sdd-engineering` → all three `^1.0`. Precondition: the four `<p>--v0.1.0` baseline tags exist (T1).
3. Remove "Status: 0.1.0 scaffold" notes from the READMEs; root README table and dependency graph to 1.0.0.
4. `claude plugin details` on each installed plugin (throwaway config); replace the figures in spec §3.5 (R5/AC-7). This is a docs change outside `plugins/`.
5. After merge: owner runs `node scripts/tag-release.mjs --push` (four `<p>--v1.0.0` tags).

Closes: R5/AC-3, 4, 5, 7.

### README shape (every plugin, R5/AC-1, AC-9)

Sections: what it does · **How to use** (example prompts and invocations, e.g. `@agent-research-tools:researcher Where is request validation done?`, `/sdd-engineering:run-plan plans/<id>.md`, and what comes back) · Components · Permissions · Dependencies · Later · Licence. DevDigest README text is adapted, never copied; the leak check runs on the README too.

## 3. Checks in every PR

```bash
claude plugin validate --strict .
for d in plugins/*/; do claude plugin validate --strict "$d"; done
node .github/scripts/check-versions.mjs origin/main
node .github/scripts/check-components.mjs          # from PR-0 on
node --test "scripts/**/*.test.mjs"
for f in plugins/*/hooks/self-test.mjs; do node "$f"; done
npm --prefix site run check                        # catalog builds; counts per kind
```

Throwaway install (never the real `~/.claude`), Git Bash:

```bash
export HOME="$(mktemp -d)" CLAUDE_CONFIG_DIR="$HOME/.claude"
claude plugin marketplace add ./
claude plugin install sdd-engineering@lindigo-devdigest
claude plugin list --json | node .github/scripts/assert-enabled.mjs
```

From PR-1 on, also `claude plugin details <p>` for the changed plugin, numbers in the PR description.

## 4. Commit and tag policy

- One commit per task where it helps review; nothing is committed without the owner's OK; nothing is pushed by Claude.
- After each merge the owner runs `node scripts/tag-release.mjs --push` on `main`, so every released version (0.1.0, 0.1.1, 1.0.0) has a tag.
- This plan and the spec are committed together on their own docs branch, after approval.

## 5. Risks

| Risk | Mitigation |
| :- | :- |
| A T0 probe fails (namespaced `skills:` or `agent_type` absent) | Stop; owner decides (e.g. agents load skills by instruction instead of preload). |
| Blocked skills stay blocked | 1.0.0 ships without them (D6); minor release later (R6/AC-7). |
| Generalized architecture skills lose precision | Keep the DevDigest evals' intent with a neutral sample layout; run `claude plugin eval` manually on PR-1 and PR-3 (paid, not in CI). |
| Catalog site merge slips (D7) | PR-0 and T1 go first; content PRs wait. |

## 6. Traceability

| AC | Task |
| :- | :- |
| R1/AC-1, 2, 5 | PR-1…PR-4 |
| R1/AC-3 | PR-0 (check), PR-3, PR-4 |
| R1/AC-4 | T0, PR-4 |
| R1/AC-6 | PR-4 |
| R1/AC-7 | PR-1, PR-4 |
| R1/AC-8 | PR-2 |
| R1/AC-9 | PR-0 (check), PR-3, PR-4 |
| R4/AC-3 | PR-0 (check), PR-1…PR-4 |
| R5/AC-9 | PR-1…PR-4 |
| R2/AC-1 | PR-2, PR-3, PR-4 |
| R2/AC-2, 4, 5 | PR-3, PR-4 |
| R2/AC-3 | PR-4 |
| R2/AC-6 | PR-0 (check), PR-3, PR-4 |
| R3/AC-1…5 | PR-4 |
| R4/AC-1, 2 | PR-0 (check), PR-1…PR-4 |
| R5/AC-1, 6, 8 | PR-1…PR-4 |
| R5/AC-2 | PR-4 |
| R5/AC-3, 4, 5, 7 | PR-5 |
| R6/AC-1, 2, 5 | PR-1…PR-4 |
| R6/AC-3 | D6, PR-1, PR-4 |
| R6/AC-4, 6 | PR-0 (check), PR-3, PR-4 |
| R6/AC-7 | after 1.0.0 (minor release per resolved skill) |
