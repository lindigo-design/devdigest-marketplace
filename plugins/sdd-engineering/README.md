# sdd-engineering

Spec-driven development in Claude Code: write a spec, plan it, implement it task by task, verify every task against the spec, review the architecture, then learn from the run. You approve the spec and the plan; nothing is committed for you.

## Install

```
/plugin marketplace add lindigo-design/devdigest-marketplace
/plugin install sdd-engineering@lindigo-devdigest
```

Installing it also installs and enables its three dependencies (see [Dependencies](#dependencies)).

## How the plugins work together

```mermaid
graph LR
    U["Your request"] --> R["researcher<br/>(research-tools)"]
    R --> S["spec-creator"]
    S -->|"you approve the spec"| P["implementation-planner"]
    P -->|"you approve the plan"| RP["/run-plan"]
    RP --> I["implementer<br/>(one task)"]
    I --> V["plan-verifier"]
    V -->|"fails: one retry"| I
    V -->|"all tasks pass"| A["architecture-reviewer<br/>(architecture-review)"]
    A --> RT["/workflow-retro"]
```

Subagents cannot start other subagents, so your main session does the orchestration: it passes research reports on, and `run-plan` (a skill that runs in the main session) dispatches each agent in turn.

| Step | Who | Writes | You do |
| :- | :- | :- | :- |
| 1. Research (optional) | `research-tools:researcher` | nothing | ask a concrete question |
| 2. Spec | `spec-creator` | `specs/<feature-id>.md`, `Status: draft` | answer blocking questions, then set `Status: approved` |
| 3. Plan | `implementation-planner` | `plans/<feature-id>.md`, `Status: draft` | answer "how" questions, then set `Status: approved` |
| 4. Run | `/sdd-engineering:run-plan` → `implementer` → `plan-verifier` per task | project code and tests; task statuses in the plan | watch; decide when a task is blocked |
| 5. Finish | `architecture-review:architecture-reviewer` on the full diff | nothing | fix or accept blocking findings |
| 6. Retro | `/sdd-engineering:workflow-retro` | `retros/…` only after you say yes | pick action items |

`specs/`, `plans/` and `retros/` may sit anywhere in the repository (`docs/specs/` works too).

## How to use

| You type | You get |
| :- | :- |
| `@agent-research-tools:researcher How are invoices numbered today, and where?` | A research report with `path:line` evidence, to feed into the spec. |
| `@agent-sdd-engineering:spec-creator Customers need to download invoices as PDF. Research: <report>` | `specs/invoice-pdf.md` with a Spec ID, EARS acceptance criteria (`AC-1` …), edge cases and open points; or up to three rounds of blocking questions first. |
| `@agent-sdd-engineering:implementation-planner specs/invoice-pdf.md` | `plans/invoice-pdf.md`: contracts first, ordered tasks with files, steps, verify commands discovered from your repository, file ownership, and a map from every acceptance criterion to its tasks. Refuses with `CANNOT PLAN` if the spec is not approved or has open points. |
| `/sdd-engineering:run-plan plans/invoice-pdf.md` | Task-by-task progress; per task the implementer's report and the verifier's verdict; at the end a traceability matrix (criterion → task → test) and the architecture verdict. Stops at the first task that fails twice and tells you what changed. |
| `/sdd-engineering:run-plan plans/invoice-pdf.md --task T3` | Re-runs one task after you fixed something. |
| `/sdd-engineering:workflow-retro plans/invoice-pdf.md` | A retro of the run: agent sequence, tokens, cost, round-trips, failed steps, and at most five action items, each naming a file. Saved only if you confirm. |

`run-plan` refuses a plan whose status is not `approved`. Nothing in this plugin runs `git commit` or `git push`; you review the diff and commit yourself.

## Components

| Type | Name | Purpose |
| :- | :- | :- |
| agent | `spec-creator` | Writes the spec: why, goals, non-goals, EARS acceptance criteria, edge cases, open points. |
| agent | `implementation-planner` | Turns an approved spec into an ordered plan with verify commands and an AC → task map. |
| agent | `implementer` | Implements exactly one plan task (backend or frontend), runs its verify commands, reports. |
| agent | `plan-verifier` | Read-only: checks one task or the whole plan against the plan and the spec's criteria, with evidence. |
| skill | `run-plan` | Runs an approved plan in the main session (you start it; Claude does not start it on its own). |
| skill | `workflow-retro` | Retrospective of a finished run. |
| skill | `fastify-best-practices` | Fastify routes, plugins, validation, errors, performance (third-party, MIT). |
| hook | `write-scope` | `spec-creator` writes only Markdown under `specs/`, `implementation-planner` only under `plans/`. |
| hook | `bash-guard` | `plan-verifier`'s Bash: read-only git only. |

Agents and skills are namespaced: `@agent-sdd-engineering:<agent>`, `/sdd-engineering:<skill>`.

The planner preloads `engineering-paved-path:onion-architecture`, `engineering-paved-path:frontend-ui-architecture` and `fastify-best-practices`; the implementer loads them when a task needs them.

## Permissions

- `implementer` can `Write`, `Edit`, run `Bash` and load skills; it is told to touch only the files its task owns and never to install packages or change git state. This is an instruction, not a hook: keep your normal permission prompts on.
- `spec-creator` and `implementation-planner` can write, but the `write-scope` hook blocks anything outside their folder.
- `plan-verifier` is strictly read-only: no `Write`/`Edit`, and the `bash-guard` hook allows only read-only git. It runs no tests, type checks or builds, since they execute project code; it lists every verify command under `NOT CHECKED` and `run-plan` runs them in your session, under your normal permissions.
- **Hooks are session-wide.** Both hooks run on every matching tool call once the plugin is enabled, read the caller's `agent_type`, and do nothing unless it is one of the agents above. Your own edits and commands are not affected.
- Hooks need `node` on `PATH` and run from `${CLAUDE_PLUGIN_ROOT}/hooks/`. Self-tests: `node hooks/self-test.mjs` and `node hooks/write-scope.self-test.mjs`.
- `spec-creator` may use `WebFetch` for design sources you give it. `workflow-retro` reads session transcripts and may fetch current model prices; it caches nothing.

## Dependencies

| Plugin | Range | Why |
| :- | :- | :- |
| `engineering-paved-path` | `^1.0` | architecture skills for the planner and implementer |
| `research-tools` | `^1.0` | `researcher` before the spec |
| `architecture-review` | `^1.0` | `architecture-reviewer` when the run finishes |

## Prerequisites (optional)

Stack skills that this plugin does not ship yet. The agents work without them and follow your repository's own conventions; install them yourself if you want them:

- Next.js App Router practices: not bundled because its upstream has no licence file yet.
- React and React Testing Library practices: not bundled until their source and licence are confirmed.

## Later

- `react-best-practices`, `next-best-practices`, `testing` skills (as minor releases once licensed).
- `test-writer` and `doc-writer` agents.
- Evals for the agents and skills (1.1).

## Licence

MIT, see [LICENSE](LICENSE). Agents, `run-plan`, `workflow-retro` and the hooks are adapted from an MIT-licensed course project (© 2026 Ivan Lapa); `fastify-best-practices` is © 2026 Matteo Collina, MIT, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). [sources.json](sources.json) records the origin of each component.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
