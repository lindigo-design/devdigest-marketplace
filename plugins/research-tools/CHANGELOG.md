# Changelog — research-tools

All notable changes to this plugin. Versions follow [SemVer](https://semver.org/); each release is tagged `research-tools--v<version>`.

## [Unreleased]

## [1.0.0] — 2026-11-09

### Changed
- First stable release: read-only `researcher` agent, no dependencies.

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ b288d63

## [0.1.1] — 2026-11-09

### Added
- Agent `researcher`: read-only research in the repository and external docs, evidence for every finding, interview mode for vague requests; generalized to any repository.
- `LICENSE` (MIT) and `sources.json` recording the agent's origin.

### Changed
- No dependencies: `researcher` uses no skill from `engineering-paved-path` (spec SDD-01 R1/AC-8). `brainstorm` is listed under Later.
- Minimum Claude Code version raised to 2.1.318.

### Removed
- Dependency on `engineering-paved-path`; empty `evals/` directory.

## [0.1.0] — 2026-11-09

### Added
- Plugin scaffold: manifest, empty component directories, README, compatibility notes.
- Dependencies: `engineering-paved-path` `^0.1`.

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ a9d6713
