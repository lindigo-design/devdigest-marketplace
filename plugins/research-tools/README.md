# research-tools

A read-only `researcher` agent that answers one concrete question from your repository, from external documentation, or both, and backs every claim with a file and line or a URL. It never changes anything.

## Install

One command adds the marketplace and installs the plugin (Claude Code 2.1.292 or later):

```
claude plugin install research-tools --marketplace lindigo-design/devdigest-marketplace
```

Inside a session, `/plugin install research-tools --marketplace lindigo-design/devdigest-marketplace` does the same and lets you pick the scope. If the marketplace is already added, `/plugin install research-tools@lindigo-devdigest` is enough.

No dependencies. `sdd-engineering` installs it automatically.

**Check it works:** run `claude plugin list` (it shows `research-tools@lindigo-devdigest` as enabled), or type `@agent-research-tools:researcher` in a session.

## Update

- Now: `claude plugin update research-tools@lindigo-devdigest`, then restart Claude Code.
- Automatically: auto-update is off for third-party marketplaces. Turn it on in `/plugin` → **Marketplaces** → `lindigo-devdigest` → **Enable auto-update**. New versions then arrive in the background a few minutes after your first message, with `Plugin updated: research-tools · Run /reload-plugins to apply`.

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

## Evals

[`evals/`](evals/README.md) checks behaviour, not only the manifest: a research question with evidence goes to `researcher`, a trivial edit does not. The graders are deterministic (`tool_used`); the agent runs call the model, so a run is paid and CI does not run it.

```bash
claude plugin eval ./plugins/research-tools --runs 1 --ablation none
```

## Later

- `brainstorm`: an interactive, read-only ideation agent.

## Licence

MIT, see [LICENSE](LICENSE). The agent is adapted from an MIT-licensed course project (© 2026 Ivan Lapa); [sources.json](sources.json) records its origin and [CHANGELOG.md](CHANGELOG.md) the source commit.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
