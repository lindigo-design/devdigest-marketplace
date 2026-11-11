# Changelog — research-tools

All notable changes to this plugin. Versions follow [SemVer](https://semver.org/); each release is tagged `research-tools--v<version>`.

## [Unreleased]

## [1.1.0] — 2026-11-11

### Added
- Eval suite `evals/`: `researcher` starts on a research question that needs evidence and not on a trivial edit (deterministic `tool_used` graders; run with `claude plugin eval`).

## [1.0.2] — 2026-11-09

### Changed
- Declare the always-on context cost in COMPATIBILITY.md; CI checks it against claude plugin details.

## [1.0.1] — 2026-11-09

### Changed
- README: one-command install (`claude plugin install research-tools --marketplace …`), how to check the install, and how to update or turn on auto-update.

## [1.0.0] — 2026-11-09

### Added
- Agent `researcher`: read-only research in the repository and external docs, evidence for every finding, interview mode for vague requests; generalized to any repository.
- `LICENSE` (MIT) and `sources.json` recording the agent's origin.

### Changed
- First stable release: read-only `researcher` agent, no dependencies.
- No dependencies: `researcher` uses no skill from `engineering-paved-path` (spec SDD-01 R1/AC-8). `brainstorm` is listed under Later.
- Minimum Claude Code version raised to 2.1.318.

### Removed
- Dependency on `engineering-paved-path`; empty `evals/` directory.

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ b288d63

## [0.1.0] — 2026-11-09

### Added
- Plugin scaffold: manifest, empty component directories, README, compatibility notes.
- Dependencies: `engineering-paved-path` `^0.1`.

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ a9d6713
