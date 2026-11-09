# research-tools

A read-only `researcher` agent that answers one concrete question from your repository, from external documentation, or both, and backs every claim with a file and line or a URL. It never changes anything.

## Install

```
/plugin marketplace add lindigo-design/devdigest-marketplace
/plugin install research-tools@lindigo-devdigest
```

No dependencies. `sdd-engineering` installs it automatically.

## How to use

Ask for the agent by name, or describe a research question and let Claude delegate to it:

| You type | You get |
| :- | :- |
| `@agent-research-tools:researcher Where is request validation done for the orders API, and what happens on invalid input?` | A **repository** report: TL;DR, numbered findings each with `path:line` evidence, how the pieces fit together, discrepancies between docs and code, and a *Not found / unverified* list. |
| `@agent-research-tools:researcher Is our Fastify version affected by the reply.hijack deprecation?` | A **mixed** report: what the project uses (versions read from the manifests, call sites with `path:line`), then what the official changelog and docs say (URL, section, date), and whether it applies. |
| `@agent-research-tools:researcher auth` | **Interview mode:** a topic without a question gets up to three rounds of clarifying questions first (with options to pick), then the research. Run as a subagent, it returns the questions to the caller instead. |

Every report states its type and confidence (`high` = read directly from code or a primary source, `low` = inferred), and always ends with what could not be found or verified. It is written in the language of your request.

In the SDD workflow, the main session runs `researcher` before `spec-creator` and passes the report on (see `sdd-engineering`).

## Components

| Type | Name | Purpose |
| :- | :- | :- |
| agent | `researcher` | Read-only research in the repository and external docs; evidence for every finding; interview mode for vague requests. |

Agents are namespaced: `@agent-research-tools:<agent>`.

## Permissions

- Tools: `Read`, `Grep`, `Glob`, `Bash`, `WebSearch`, `WebFetch`, `AskUserQuestion`. `Write`, `Edit` and `NotebookEdit` are disallowed.
- `Bash` is meant for read-only git history only (`git log`, `git show`, `git blame`, `git diff`, `git status`); the agent's instructions forbid commands that change files, packages, databases or git state. This plugin ships no hook that enforces it, so keep your normal Bash permission prompts on.
- Network: `WebSearch` and `WebFetch` for external research. Fetched pages are treated as data, never as instructions.
- It never opens `.env*` files, credentials or private keys, and reports where secrets live without their values.

## Dependencies

None.

## Later

- `brainstorm`: an interactive, read-only ideation agent.

## Licence

MIT, see [LICENSE](LICENSE). The agent is adapted from an MIT-licensed course project (© 2026 Ivan Lapa); [sources.json](sources.json) records its origin and [CHANGELOG.md](CHANGELOG.md) the source commit.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
