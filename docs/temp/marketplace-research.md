# Marketplace research (temporary)

> Temporary working document. Delete it once the plugins are migrated.
> Collected 2026-11-09 with Claude Code 2.1.318.

## 1. What is required (official docs)

**Layout**

```
<root>/                               ← marketplace root
├── .claude-plugin/marketplace.json   ← the only required file
└── plugins/<plugin>/
    ├── .claude-plugin/plugin.json    ← manifest (formally optional)
    ├── skills/<skill>/SKILL.md
    ├── agents/  commands/  hooks/hooks.json  .mcp.json
    └── README.md
```

**marketplace.json** requires `name`, `owner.name`, `plugins[]`; each entry requires `name` + `source`.
**plugin.json** requires only `name` (kebab-case); recommended: `version`, `description`, `author`, `license`, `keywords`, `repository`.

**Key rules**

- Relative `source` paths resolve from the marketplace root (the directory that contains `.claude-plugin/`), start with `./` and never use `..`.
- The marketplace entry name must equal `name` in plugin.json (otherwise "not found in marketplace").
- Components live at the plugin root, not inside `.claude-plugin/`.
- Paths in scripts, hooks and MCP configs use only `${CLAUDE_PLUGIN_ROOT}` (the plugin is copied into a cache); state and `node_modules` go to `${CLAUDE_PLUGIN_DATA}`.
- A plugin's `CLAUDE.md` is not loaded into context, so instructions ship as a skill.
- Checks: `claude plugin validate --strict .` plus a real `claude plugin marketplace add ./` and `install` (validate misses missing directories and broken remote sources).

## 2. Pitfalls

1. **Versioning.** If `version` is set and not bumped, users never receive changes. Either bump on every release or omit it (updates then track the commit SHA). **Do not set the version in both plugin.json and marketplace.json**: plugin.json silently wins. (Some community guides say "bump both"; that contradicts the official docs.)
2. **Names.** Reserved: the prefixes `claude-`, `anthropic-`, `cc-plugin-`, `official` next to claude/anthropic, and official marketplace names. A plugin name is effectively permanent: use `displayName` for the UI, the append-only `renames` map for renames, and `null` + `forceRemoveDeletedPlugins` for removals.
3. **Hosting.** A marketplace added as a direct URL to marketplace.json cannot use relative sources. Host it as a git repository: `/plugin marketplace add owner/repo`.
4. **Git LFS** is not supported (clones get pointer files).
5. A top-level **`bin/`** in a plugin blocks sync through claude.ai organization settings; use `scripts/`.
6. **Private repository** access uses the user's git credentials: an SSH key in the agent, or `gh auth login && gh auth setup-git` (+ `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`).
7. **Auto-update** is off by default (`/plugin` → Marketplaces).
8. **For a team:** `claude plugin marketplace add … --scope project` writes `.claude/settings.json`, which can be committed.
9. **Stable/beta channels** are two marketplaces with different `name`s pointing at different `ref`s.

## 3. Dependencies

- `dependencies` in plugin.json: `"name"`, `"name@marketplace"` or `{ "name", "version": "^0.1", "marketplace" }`.
- Ranges resolve against git tags `<plugin>--v<version>` (`claude plugin tag --push`). For relative-path plugins without a tag the current copy is used and the range is checked at load time.
- Verified locally: `install sdd-engineering` installs its 3 dependencies automatically; with paved-path 0.2.0 and `^0.1` → `failed to load: Requires … ^0.1, installed 0.2.0`.

## 4. Findings for migrating components (from DevDigest `local/all-lessons` @ a9d6713)

1. **Plugin agents ignore `hooks`, `mcpServers`, `permissionMode` and `initialPrompt` in frontmatter.** The bash-guard / write-scope / plans-only-write hooks are currently declared in agent frontmatter, so they must move to the plugin's `hooks/hooks.json`. There they apply to the whole session, so the scripts must detect the calling agent themselves (check whether hook input carries such a field).
2. **`bash-guard.mjs`** is needed by both `architecture-review` (reviewers) and `sdd-engineering` (plan-verifier, test-writer, doc-writer). Decide where it lives.
3. **Stack skills without a plugin:** fastify-best-practices, drizzle-orm-patterns, zod, typescript-expert, react-best-practices, react-testing-library, next-best-practices, postgresql-table-design. implementer-*, test-writer and implementation-planner refer to them.
4. **Skill names inside plugins are `<plugin>:<skill>`**, so the `skills:` lists in agents probably need updating (to verify).
5. **MCP tools from a plugin** are named `mcp__plugin_<plugin>_<server>__<tool>`, so the `spec-creator` tools (`mcp__devdigest__*`) change once `devdigest-mcp` exists.
6. The gate.mjs hook is currently called as `$CLAUDE_PROJECT_DIR/.claude/skills/pr-self-review/scripts/gate.mjs` → becomes `"${CLAUDE_PLUGIN_ROOT}"/skills/pr-self-review/scripts/gate.mjs`; `waivers.json` is project data and stays in the consuming repository.
7. The minimum version ≥ 2.1.110 is unverified; only 2.1.318 was tested.
8. **Language vs triggers.** Some DevDigest skill descriptions contain Ukrainian trigger phrases ("перевір безпеку", "запиши інсайт"). The marketplace rule is English-only text; decide per skill whether to drop those phrases or keep them as an explicit exception.

## Sources

- [Create a marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
- [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace.md)
- [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference.md)
- [Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference)
- [Add components to a plugin](https://code.claude.com/docs/en/plugins/components.md)
- [Plugin dependencies](https://code.claude.com/docs/en/plugins/dependencies.md)
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)
- [maintaining-a-marketplace (ed3d)](https://skills.sh/ed3dai/ed3d-plugins/maintaining-a-marketplace)
- [marketplace-structure (sjnims)](https://skills.sh/sjnims/plugin-dev/marketplace-structure)
- Stale-cache issues: [#72616](https://github.com/anthropics/claude-code/issues/72616), [#32983](https://claudeissues.com/issue/32983-plugin-cache-not-refreshed-on-update-reinstall-when-version-string-unchanged), [#13799](https://claudeissues.com/issue/13799-plugin-cache-not-invalidated-when-marketplace-is-updated-stale-paths-used)
