# Compatibility — engineering-paved-path

| | |
| :- | :- |
| Claude Code | ≥ 2.1.318 (declared minimum; verified on 2.1.318, the CI pin) |
| OS | Windows 10/11, macOS |
| Runtime | None beyond Claude Code |
| Surfaces | Claude Code CLI / IDE extensions. Not tested in claude.ai or Cowork |

## Notes

- Paths inside the plugin use `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` only; no `..`, no absolute paths.
- Shell-form hook commands quote `"${CLAUDE_PLUGIN_ROOT}"` so paths with spaces (common on Windows) stay one argument.
- No top-level `bin/` directory, so the plugin stays eligible for claude.ai organization sync.
