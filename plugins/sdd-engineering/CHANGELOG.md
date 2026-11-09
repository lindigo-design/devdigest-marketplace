# Changelog — sdd-engineering

All notable changes to this plugin. Versions follow [SemVer](https://semver.org/); each release is tagged `sdd-engineering--v<version>`.

## [Unreleased]

## [0.1.1] — 2026-11-09

### Added
- Agents `spec-creator`, `implementation-planner`, `implementer` (one agent for backend and frontend) and `plan-verifier`, generalized to any repository; no MCP tools.
- Skills `run-plan` (runs an approved plan task by task: implementer, plan-verifier, one retry, architecture review at the end; started by the user only) and `workflow-retro` (saved only after the user confirms).
- Skill `fastify-best-practices`, unmodified from mcollina/skills @ 58b3eeb (MIT, © 2026 Matteo Collina), with `THIRD_PARTY_NOTICES.md`.
- Hooks: `write-scope` (spec-creator → `specs/`, implementation-planner → `plans/`, Markdown only) and `bash-guard` (identical copy; `plan-verifier` → `verify` profile), each with a self-test.
- `LICENSE` (MIT) and `sources.json` recording the origin of each component.

### Changed
- Scope per spec SDD-01: `test-writer`, `doc-writer`, `implementer-protocol` and the React, Next.js and testing skills are listed under Later; the optional MCP integration is dropped.
- Minimum Claude Code version raised to 2.1.318.

## [0.1.0] — 2026-11-09

### Added
- Plugin scaffold: manifest, empty component directories, README, compatibility notes.
- Dependencies: `engineering-paved-path` `^0.1`, `research-tools` `^0.1`, `architecture-review` `^0.1`.

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ a9d6713
