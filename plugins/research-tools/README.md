# research-tools

Read-only researcher and brainstorm agents for codebase and external research before a change.

> **Status: 0.1.0 scaffold.** Components below are planned and will be migrated one plugin at a time.

## Install

```
/plugin marketplace add lindigo-design/devdigest-marketplace
/plugin install research-tools@lindigo-devdigest
```

Dependencies are installed automatically:

- `engineering-paved-path@lindigo-devdigest` `^0.1`

## Workflow

Answer a concrete question before changing anything.

1. **brainstorm** explores options with the user (interactive, no shell, no writes).
2. **researcher** answers a concrete question from this repository or external docs and returns a structured report with evidence and an explicit *not found* list.

## Components

| Type | Name | Purpose | Status |
| :- | :- | :- | :- |
| agent | `researcher` | Read-only research; tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, AskUserQuestion | planned |
| agent | `brainstorm` | Read-only ideation; tools: Read, Grep, Glob, AskUserQuestion | planned |

Skills and agents are namespaced: `/research-tools:<skill>`, `@agent-research-tools:<agent>`.

## Permissions

- Both agents are read-only: `Write`, `Edit`, `NotebookEdit` are disallowed.
- `researcher` makes network requests (`WebSearch`, `WebFetch`) and may run read-only `Bash` commands.

## Secret slots

- None.

No secrets, caches or memory files are stored in this plugin. Persistent data, if ever needed, goes to `${CLAUDE_PLUGIN_DATA}`.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
