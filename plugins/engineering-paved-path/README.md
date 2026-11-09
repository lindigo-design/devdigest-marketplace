# engineering-paved-path

Base layer of the DevDigest marketplace: shared team guardrails (as a skill), security rubric, engineering insights, workflow retros and Mermaid diagrams.

> **Status: 0.1.0 scaffold.** Components below are planned and will be migrated one plugin at a time.

## Install

```
/plugin marketplace add lindigo-design/devdigest-marketplace
/plugin install engineering-paved-path@lindigo-devdigest
```

Dependencies are installed automatically:

None — this is the base plugin.

## Workflow

Base layer that every other plugin in `lindigo-devdigest` depends on. It carries the team-wide rules and reusable knowledge skills, so the workflow plugins can reference them instead of copying them.

1. **Guardrails** load as a skill (not `CLAUDE.md` — a plugin's `CLAUDE.md` is never loaded into context).
2. **security** is the shared security rubric used by reviewers and implementers.
3. **engineering-insights** and **workflow-retro** capture lessons after a task; **mermaid-diagram** renders diagrams for docs.

## Components

| Type | Name | Purpose | Status |
| :- | :- | :- | :- |
| skill | `guardrails` | L01 team guardrails, converted from CLAUDE.md into a skill | planned |
| skill | `security` | Security rubric, checklists, examples | planned |
| skill | `engineering-insights` | Insight capture template | planned |
| skill | `workflow-retro` | Retro after a completed workflow | planned |
| skill | `mermaid-diagram` | Mermaid diagram conventions + examples | planned |

Skills and agents are namespaced: `/engineering-paved-path:<skill>`, `@agent-engineering-paved-path:<agent>`.

## Permissions

- No agents, hooks, MCP servers or executables. Skills only, so the plugin itself adds no tool permissions.

## Secret slots

- None.

No secrets, caches or memory files are stored in this plugin. Persistent data, if ever needed, goes to `${CLAUDE_PLUGIN_DATA}`.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
