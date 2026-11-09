# sdd-engineering

Spec-driven development workflow: spec, plan, implement, test, verify and document, with scoped write hooks.

> **Status: 0.1.0 scaffold.** Components below are planned and will be migrated one plugin at a time.

## Install

```
/plugin marketplace add lindigo-design/devdigest-marketplace
/plugin install sdd-engineering@lindigo-devdigest
```

Dependencies are installed automatically:

- `engineering-paved-path@lindigo-devdigest` `^0.1`
- `research-tools@lindigo-devdigest` `^0.1`
- `architecture-review@lindigo-devdigest` `^0.1`

## Workflow

End-to-end spec-driven development.

1. **spec-creator** writes the spec (only under `specs/`).
2. **implementation-planner** writes the plan (only under `plans/`).
3. **implement-plan** drives **implementer-backend** / **implementer-frontend** (following **implementer-protocol**) and **test-writer**.
4. **plan-verifier** checks the result against the plan; **doc-writer** updates docs.
5. On *Finish*, `implement-plan` runs `architecture-reviewer` and `security-reviewer` from `architecture-review`.

## Components

| Type | Name | Purpose | Status |
| :- | :- | :- | :- |
| agent | `spec-creator` | Writes specs; optionally uses DevDigest MCP tools (see below) | planned |
| agent | `implementation-planner` | Writes plans only | planned |
| agent | `implementer-backend` | Backend implementation | planned |
| agent | `implementer-frontend` | Frontend implementation | planned |
| agent | `test-writer` | Writes tests only | planned |
| agent | `plan-verifier` | Read-only verification | planned |
| agent | `doc-writer` | Writes docs only | planned |
| skill | `implement-plan` | Orchestrates implementation; calls reviewers on Finish | planned |
| skill | `implementer-protocol` | Shared protocol for implementer agents | planned |
| hook | `write-scope.mjs` | PreToolUse on Write|Edit: restricts writes per agent (specs/tests/docs) | planned |
| hook | `plans-only-write.mjs` | PreToolUse on Write: planner writes only to plans/ | planned |
| hook | `self-test.mjs` | Self-test for the hook scripts | planned |

Skills and agents are namespaced: `/sdd-engineering:<skill>`, `@agent-sdd-engineering:<agent>`.

## Permissions

- Implementer agents and `test-writer`/`doc-writer` can `Write`, `Edit` and run `Bash`; scope is enforced by the write hooks, not by the model.
- Plugin hooks fire for the **whole session** once enabled. Plugin agents ignore `hooks` in frontmatter, so `write-scope`/`plans-only-write` must live in `hooks/hooks.json` and detect the calling agent themselves.
- Hook scripts need `node` on `PATH` and are referenced only as `${CLAUDE_PLUGIN_ROOT}/...`.

## Secret slots

- None in this plugin.
- **DevDigest MCP (not a dependency).** `spec-creator` can use the DevDigest MCP tools (`list_agents`, `get_findings`, `get_conventions`, `get_blast_radius`). They will ship later as a separate `devdigest-mcp` plugin; its API URL (`DEVDIGEST_API_URL`) will be a `userConfig` slot there. Note: tools from a plugin MCP server are named `mcp__plugin_<plugin>_<server>__<tool>`, so the agent's tool list must be updated when that plugin exists.

No secrets, caches or memory files are stored in this plugin. Persistent data, if ever needed, goes to `${CLAUDE_PLUGIN_DATA}`.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
