# Security policy

Plugins from this marketplace run inside Claude Code with **your** permissions. Hooks execute shell commands, agents can be granted tools such as `Bash`, and MCP servers start local processes. This policy explains what we guarantee, what you should check, and how to report a problem.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub: **Security → Report a vulnerability** on [lindigo-design/devdigest-marketplace](https://github.com/lindigo-design/devdigest-marketplace/security). Include:

- the plugin and version (`claude plugin list`), Claude Code version and OS;
- the component (skill, agent, hook, command, MCP server) and file path;
- steps to reproduce and the impact (what an attacker gains).

This is a single-maintainer project. Expect an acknowledgement within 7 days. A fix ships as a new patch version (or a rollback, see the root README), followed by a GitHub security advisory that names the affected versions.

## Supported versions

Only the **latest version of each plugin** receives fixes. Versions never go down and published tags never move, so the fix always arrives as a higher version. Update with:

```
/plugin marketplace update lindigo-devdigest
```

## In scope

- A hook, script or MCP config that runs commands the README does not disclose, or reaches outside `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` / the user's project.
- Command or path injection: untrusted input (tool arguments, file names, PR or repository text) reaching a shell, `eval` or a file path without validation.
- A guard hook (for example `bash-guard`, `write-scope`, the push `gate`) that can be bypassed, so an agent writes or runs what it is meant to be blocked from.
- Prompt injection that makes an agent from this marketplace leak data or take actions outside its declared tools.
- Secrets, tokens or personal data committed to the repository or written to logs.
- CI weaknesses in this repository (for example a workflow that can be abused to gain write access).

## Out of scope

- Vulnerabilities in Claude Code itself: report them to Anthropic.
- Behaviour that requires the user to approve a clearly described dangerous action.
- Third-party skills or tools that the plugins only mention and do not ship.

## What every plugin guarantees

These rules are enforced by review (CODEOWNERS) and, where noted, by CI:

1. **No secrets** in the repository: no tokens, `.env` files, caches, memory or local settings. User-specific values go through `userConfig` with `sensitive: true`.
2. **Paths only via `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`.** No `..`, no absolute paths, no writes into the plugin directory at runtime.
3. **Every hook is disclosed** in the plugin README's *Permissions* section: event, matcher, the command it runs and what it can block or change.
4. **Hooks fail closed where they guard.** A guard hook that cannot parse its input blocks rather than allows.
5. **No network access** from hooks or scripts unless the README states the endpoint and why.
6. **No binaries or Git LFS.** Executables are readable scripts in `scripts/`; there is no top-level `bin/`.
7. **Pinned sources.** External plugin sources, if ever added, pin `ref` and full `sha`.
8. **Least privilege in CI:** workflows run with `contents: read` and no repository secrets (CI: `validate.yml`). Deploying the catalog site additionally needs `pages: write` and `id-token: write`.
9. **Manifest checks in CI:** `claude plugin validate --strict` and a smoke install on every PR.

## Before you install

- Read the plugin's README, especially *Permissions*, and its `hooks/hooks.json`.
- Install at project scope (`--scope project`) when a plugin is only needed in one repository.
- Keep auto-update off if you want to review each new version first. Every change is listed in the plugin's `CHANGELOG.md`.

## Maintainer checklist for a PR that adds or changes a hook or script

- [ ] Input from stdin or tool arguments is parsed as JSON and validated; no string concatenation into a shell.
- [ ] Shell-form commands quote `"${CLAUDE_PLUGIN_ROOT}"`.
- [ ] The hook is listed in the README *Permissions* table with its event and matcher.
- [ ] Failure mode is explicit: guards block on error, helpers allow on error.
- [ ] No new network calls, or the endpoint is disclosed.
