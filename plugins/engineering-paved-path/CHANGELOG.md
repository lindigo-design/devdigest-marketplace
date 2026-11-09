# Changelog — engineering-paved-path

All notable changes to this plugin. Versions follow [SemVer](https://semver.org/); each release is tagged `engineering-paved-path--v<version>`.

## [Unreleased]

## [0.1.1] — 2026-11-09

### Added
- Skill `onion-architecture`: backend layering rules, per-tool references and examples, generalized to any repository layout.
- Skill `frontend-ui-architecture`: UI code organization rules, generalized to any repository layout (its evals return in 1.1 with a sample application).
- `LICENSE` (MIT) and `sources.json` recording the origin of each skill.

### Changed
- Scope narrowed to architecture rules shared by `architecture-review` and `sdd-engineering` (spec SDD-01). `workflow-retro` moves to `sdd-engineering`; `security`, `guardrails`, `engineering-insights`, `mermaid-diagram` are listed under Later.
- Minimum Claude Code version raised to 2.1.318.

### Removed
- Empty `evals/` directory (evals live with each skill).

## [0.1.0] — 2026-11-09

### Added
- Plugin scaffold: manifest, empty component directories, README, compatibility notes.

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ a9d6713
