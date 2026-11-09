## What changes

<!-- One line: new plugin / change to an existing plugin / catalog or docs change. Name the plugin(s). -->

## Checklist

- [ ] `claude plugin validate --strict .` and `claude plugin validate --strict ./plugins/<name>` pass locally
- [ ] `node .github/scripts/check-versions.mjs origin/main` passes
- [ ] Changed plugin: `version` in its `plugin.json` is bumped per SemVer (never in `marketplace.json`)
- [ ] Changed plugin: `CHANGELOG.md` has an entry for the new version
- [ ] No secrets, tokens, caches or memory files; no absolute paths or `..`; paths use `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}`
- [ ] No top-level `bin/` in a plugin (scripts live in `scripts/`)
- [ ] New plugin: entry added to `.claude-plugin/marketplace.json` (name matches `plugin.json`), README / CHANGELOG / COMPATIBILITY present
- [ ] References to components of other plugins are namespaced (`<plugin>:<skill>`) and the plugin is listed in `dependencies`
- [ ] Component copied from DevDigest: provenance line kept in `CHANGELOG.md`

## Notes for review

<!-- New permissions or tools, hooks that run shell commands, external services, breaking changes, dependency range changes. -->
