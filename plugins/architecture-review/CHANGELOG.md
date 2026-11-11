# Changelog — architecture-review

All notable changes to this plugin. Versions follow [SemVer](https://semver.org/); each release is tagged `architecture-review--v<version>`.

## [Unreleased]

## [1.1.0] — 2026-11-11

### Added
- Eval suite `evals/`: `architecture-reviewer` starts on a pre-merge layering review and not on an unrelated request (deterministic `tool_used` graders; run with `claude plugin eval`).

## [1.0.1] — 2026-11-09

### Changed
- Declare the always-on context cost in COMPATIBILITY.md; CI checks it against claude plugin details.

## [1.0.0] — 2026-11-09

### Added
- Agent `architecture-reviewer`: read-only review of a change set against the onion and frontend UI architecture skills and the project's own documented rules; learns the repository layout first; generalized to any repository.
- Hook `bash-guard` (`PreToolUse` on `Bash`): read-only git only while `architecture-reviewer` runs; generic script with one read-only profile, agent-to-profile map passed from `hooks.json`; self-test.
- `LICENSE` (MIT) and `sources.json` recording the origin of the agent and hook.

### Changed
- First stable release: read-only `architecture-reviewer` agent and `bash-guard` hook.
- Scope narrowed to architecture review (spec SDD-01). `security-reviewer` and `pr-self-review` with the push gate are listed under Later; the architecture skills live in `engineering-paved-path`.
- Minimum Claude Code version raised to 2.1.318.
- Dependency `engineering-paved-path` range `^0.1` → `^1.0` (engineering-paved-path 1.0.0).

### Removed
- Empty `skills/` and `evals/` directories.

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ b288d63

## [0.1.0] — 2026-11-09

### Added
- Plugin scaffold: manifest, empty component directories, README, compatibility notes.
- Dependencies: `engineering-paved-path` `^0.1`.

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ a9d6713
