# Catalog index: `index.json` (schema version 1)

The catalog site publishes its data as `index.json` at the site root, for example
`https://lindigo-design.github.io/devdigest-marketplace/index.json` (spec [CAT-01](specs/marketplace-catalog.md) R9/AC-6).
The site's own search loads the same file. It is rebuilt on every push to `main`.

**Versioning.** `schemaVersion` is an integer. Adding a field does not change it; removing or renaming a field, or
changing a field's meaning or type, raises it. Read the version first and ignore fields you do not know.

## Top level

| Field | Type | Meaning |
| :- | :- | :- |
| `schemaVersion` | integer | `1` |
| `generated` | string | Build time, ISO 8601 UTC |
| `site` | string | Absolute URL of the catalog home page (follows the site's origin and base path) |
| `marketplace` | object | See below |
| `synonyms` | string[][] | Search synonym groups from `site/synonyms.json`, normalized (lowercase, `'` apostrophes). Ukrainian entries are stems |
| `plugins` | object[] | Dependency graph, one item per plugin, in dependency order |
| `entries` | object[] | One item per plugin and per component (skill, agent, command, hook handler, MCP server) |
| `body` | object | Searchable body words of every entry, see [Body terms](#body-terms) |

### `marketplace`

| Field | Type | Meaning |
| :- | :- | :- |
| `name` | string | Marketplace name, used in install commands (`/plugin install <plugin>@<name>`) |
| `description` | string \| null | |
| `owner` | `{ name, url }` \| null | |
| `repository` | string | GitHub URL of the repository |
| `addCommand` | string | `/plugin marketplace add <owner>/<repo>` |
| `lastRelease` | string \| null | Date (`YYYY-MM-DD`) of the newest dated CHANGELOG section of any plugin |

### `plugins[]`

| Field | Type | Meaning |
| :- | :- | :- |
| `name` | string | Plugin name |
| `dependencies` | `{ name, range, satisfied }[]` | `range` as declared (`^0.1`) or null; `satisfied` is whether the version in this repository matches, null if the dependency is not in this marketplace |
| `usedBy` | string[] | Plugins that depend on this one |
| `url` | string | Absolute URL of the plugin page |

### `entries[]`

| Field | Type | Meaning |
| :- | :- | :- |
| `id` | string | `<plugin>` for plugins, `<plugin>/<kind>/<name>` for components; unique |
| `kind` | string | `plugin`, `skill`, `agent`, `command`, `hook` or `mcp` |
| `name` | string | Display name. Commands in a namespace folder use `ns:name` |
| `plugin` | string | Owning plugin (itself for plugins) |
| `description` | string | One-line description. Hooks use the top-level `description` of `hooks.json` |
| `tags` | string[] | The entry's own tags first, then the tags it inherits from its plugin |
| `ownTagCount` | integer | How many leading `tags` are the entry's own (all of them for plugins) |
| `version` | string | The plugin's version (SemVer) |
| `category` | string \| null | The plugin's category |
| `compat` | object | `{ declared, claudeCode, verifiedOn, os[] }` from the plugin's `COMPATIBILITY.md` |
| `runs` | `{ label, detail }` \| null | Set for agents with a shell tool (or no tool list) and for command hooks |
| `source` | string | Repository-relative path of the source file or directory |
| `path` | string | Site-relative path of the entry's page; join it with the site URL |

Entries come in catalog order: each plugin, then its components by kind (skill, agent, command, hook, MCP) and name;
plugins in dependency order.

## Body terms

Body text (README, SKILL.md, agent and command bodies) is reduced to unique lowercase words and stored once for the
whole catalog, which keeps the file small (plan D7):

```json
"body": { "terms": ["agent", "review", "security"], "postings": ["0,2", "!1", "3"] }
```

- `terms` is sorted; `postings[k]` lists the positions in `entries` whose body contains `terms[k]`.
- A posting is comma-separated, base-36, delta-encoded: `"0,3,a"` means entries 0, 3 and 13.
- A posting that starts with `!` lists the entries that do **not** contain the term (used when a term is in more than
  half of the entries).

The reference decoder is `decodeBodies` in [`site/src/client/body-index.mjs`](../site/src/client/body-index.mjs).

## Not included

Page-only data (rendered READMEs and bodies, frontmatter tables, hook commands) is on the HTML pages, not here.
Values of `env` and `headers` from `.mcp.json`, `hooks.json` or agent frontmatter are never read into the catalog.
