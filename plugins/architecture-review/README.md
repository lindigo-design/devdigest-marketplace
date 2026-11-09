# architecture-review

A read-only `architecture-reviewer` agent that checks whether a change keeps your architectural boundaries: backend layering, frontend structure, cross-package imports and the rules your project documents. Findings come with a rule, a changed `file:line`, evidence and a fix pointer. A hook keeps its shell access to read-only git.

## Install

```
/plugin marketplace add lindigo-design/devdigest-marketplace
/plugin install architecture-review@lindigo-devdigest
```

Installs `engineering-paved-path` with it. `sdd-engineering` installs both.

## How to use

| You type | You get |
| :- | :- |
| `@agent-architecture-review:architecture-reviewer Review my working tree against origin/main` | A report with `VERDICT: PASS` or `FAIL`, the scope (files by area), the layout it found, findings, pre-existing violations, unverified claims and what it could not check. |
| `@agent-architecture-review:architecture-reviewer base: main head: feature/invoices scope: src/modules/invoices` | The same report for one branch range, limited to the given paths. |
| `@agent-architecture-review:architecture-reviewer Review the diff. Layer checker output: <paste>` | Checker violations become findings with confidence 100; the agent cannot run the checker itself. |

Each finding looks like this:

```text
- [high] onion/rule-2 · src/modules/orders/domain/order.ts:14 · confidence 95
  evidence: import { db } from "../../../db/client";
  rule: onion-architecture → Hard rules
  fix: move the query behind a repository port (onion-architecture examples § Repository)
```

`VERDICT: FAIL` means at least one `critical` or `high` finding. Only changed lines can carry findings; older violations are listed under `PRE-EXISTING` and never block.

In the SDD workflow, `sdd-engineering`'s `run-plan` runs this agent on the full diff when every task has passed.

## Components

| Type | Name | Purpose |
| :- | :- | :- |
| agent | `architecture-reviewer` | Read-only architecture review; preloads `engineering-paved-path:onion-architecture` and `engineering-paved-path:frontend-ui-architecture`. |
| hook | `bash-guard` | `PreToolUse` on `Bash`: while `architecture-reviewer` runs, allows only `cd` inside the repository and read-only git; everything else is blocked with a reason. |

Agents are namespaced: `@agent-architecture-review:<agent>`.

## Permissions

- The agent has `Read`, `Grep`, `Glob`, `Bash`; `Write`, `Edit`, `NotebookEdit`, `Agent` and `Skill` are disallowed.
- **The hook is session-wide.** Plugin hooks run for every `Bash` call once the plugin is enabled. `bash-guard` checks the `agent_type` of the caller and does nothing unless it is `architecture-review:architecture-reviewer`, so your own commands and other agents are not affected.
- The hook needs `node` on `PATH` and runs `${CLAUDE_PLUGIN_ROOT}/hooks/bash-guard.mjs`. Its self-test: `node hooks/self-test.mjs`.
- It cannot run your layer checker (that is not read-only git). It tells you the command to run and uses the output if you pass it in.

## Dependencies

| Plugin | Range | Why |
| :- | :- | :- |
| `engineering-paved-path` | `^1.0` | the two architecture skills the agent preloads |

## Later

- `security-reviewer`: waits for the `security` skill, whose licence is not confirmed yet.
- `pr-self-review` with a push gate.
- Evals for `architecture-reviewer` (1.1).

## Licence

MIT, see [LICENSE](LICENSE). The agent and hook are adapted from an MIT-licensed course project (© 2026 Ivan Lapa); [sources.json](sources.json) records their origin and [CHANGELOG.md](CHANGELOG.md) the source commit.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
