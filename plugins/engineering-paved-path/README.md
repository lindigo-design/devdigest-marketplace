# engineering-paved-path

Architecture rules shared by every workflow plugin in this marketplace: backend layering (onion architecture) and frontend UI structure. Knowledge only: no agents, no hooks, nothing runs.

## Install

```
/plugin marketplace add lindigo-design/devdigest-marketplace
/plugin install engineering-paved-path@lindigo-devdigest
```

You rarely install it by hand: `architecture-review` and `sdd-engineering` depend on it and pull it in.

## How to use

The skills load on their own when a task matches their description (adding a backend module, deciding where a component goes, reviewing a change for layering). You can also call them directly:

| You type | You get |
| :- | :- |
| `/engineering-paved-path:onion-architecture Where should the code that charges a card live?` | The ring the code belongs to (domain, ports, application, infrastructure, presentation), the files to create in your module, and which way each import may point. |
| `/engineering-paved-path:onion-architecture Review src/modules/orders for layering` | Violations of the inward-only dependency rule, each with the file, the rule it breaks and the fix. |
| `/engineering-paved-path:frontend-ui-architecture This page component is 600 lines, split it` | A split plan: which parts stay route-local, which become shared components, hooks or pure helpers, and where each file goes. |
| `/engineering-paved-path:frontend-ui-architecture Where does a date-formatting helper go?` | The folder for it (route-local vs shared), its name, and the import rules that keep layers clean. |

The skills do not assume a folder layout. They look for your backend and UI source roots, existing module folders and the composition root, and ask you when the layout is unclear.

Other plugins use them by name: the `architecture-reviewer` agent preloads both, and the `sdd-engineering` planner applies them when it splits work into tasks.

## Components

| Type | Name | What it covers |
| :- | :- | :- |
| skill | `onion-architecture` | Rings of a backend module, inward-only dependencies, ports and adapters, where routes, services, repositories, jobs and validation go; references for Fastify, Drizzle, Zod, adapters, jobs and server-sent events; worked examples. |
| skill | `frontend-ui-architecture` | Where components, hooks, helpers, constants, types and state live in a React / Next.js App Router UI; how to split a component; import layers; the client boundary; evals. |

Skills are namespaced: `/engineering-paved-path:<skill>`.

## Permissions

None. The plugin ships skills only: no agents, hooks, MCP servers or executables, so it adds no tool permissions.

## Dependencies

None. This is the base layer.

| Used by | How |
| :- | :- |
| `architecture-review` | `architecture-reviewer` preloads both skills |
| `sdd-engineering` | `implementation-planner` applies both when planning |

## Later

Planned for minor releases once their source and licence are confirmed or they are written:

- `security`: security rubric and checklists (licence of the original not confirmed yet).
- `guardrails`, `engineering-insights`, `mermaid-diagram`.

## Licence

MIT, see [LICENSE](LICENSE). Both skills are adapted from an MIT-licensed course project (© 2026 Ivan Lapa); [sources.json](sources.json) records the origin of each skill and [CHANGELOG.md](CHANGELOG.md) the source commit.

See [CHANGELOG.md](CHANGELOG.md) and [COMPATIBILITY.md](COMPATIBILITY.md).
