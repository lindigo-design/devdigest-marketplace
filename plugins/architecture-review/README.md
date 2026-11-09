# architecture-review

Architecture and security reviewer agents, PR self-review skill with a pre-push gate, onion and frontend UI architecture rules.

> **Status: 0.1.0 scaffold.** Components below are planned and will be migrated one plugin at a time.

## Install

```
/plugin marketplace add lindigo-design/devdigest-marketplace
/plugin install architecture-review@lindigo-devdigest
```

Dependencies are installed automatically:

- `engineering-paved-path@lindigo-devdigest` `^0.1`

## Workflow

Review a change before it leaves the machine.

1. **pr-self-review** collects the diff, routes files to the matching rules and produces findings with severities and waivers.
2. **architecture-reviewer** checks onion-architecture and frontend-ui-architecture rules; **security-reviewer** applies the `security` rubric from `engineering-paved-path`.
3. The **gate** `PreToolUse` hook blocks `git push`/PR commands while blocking findings remain.

## Components

| Type | Name | Purpose | Status |
| :- | :- | :- | :- |
| agent | `architecture-reviewer` | Read-only reviewer; skills onion-architecture, frontend-ui-architecture | planned |
| agent | `security-reviewer` | Read-only reviewer; skill security (from engineering-paved-path) | planned |
| skill | `pr-self-review` | + scripts/, references/, evals/ | planned |
| skill | `onion-architecture` | Backend layering rules + references | planned |
| skill | `frontend-ui-architecture` | Next.js/React UI structure rules + evals | planned |
| hook | `bash-guard.mjs` | PreToolUse on Bash: read-only command guard for reviewers | planned |
| hook | `gate.mjs` | PreToolUse on Bash|PowerShell: blocks push while blocking findings remain | planned |

Skills and agents are namespaced: `/architecture-review:<skill>`, `@agent-architecture-review:<agent>`.

## Permissions

- Reviewer agents are read-only (`Write`, `Edit`, `NotebookEdit`, `Agent`, `Skill` disallowed) and run `Bash` through `bash-guard`.
- Plugin hooks fire for the **whole session** once the plugin is enabled, not only inside its agents. Plugin agents ignore `hooks` in their frontmatter, so agent-scoped guards must live in `hooks/hooks.json` and detect the calling agent themselves.
- Hook scripts need `node` on `PATH` and are referenced only as `${CLAUDE_PLUGIN_ROOT}/...`.

## Secret slots

- None. `pr-self-review` waivers are project data and stay in the consuming repository, not in the plugin.

No secrets, caches or memory files are stored in this plugin. Persistent data, if ever needed, goes to `${CLAUDE_PLUGIN_DATA}`.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
