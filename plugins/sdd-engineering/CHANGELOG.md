# Changelog — sdd-engineering

All notable changes to this plugin. Versions follow [SemVer](https://semver.org/); each release is tagged `sdd-engineering--v<version>`.

## [Unreleased]

## [1.1.0] — 2026-11-11

### Added
- `workflow-retro` ships `scripts/transcript-metrics.mjs`, called through `${CLAUDE_SKILL_DIR}` so it works wherever the plugin is installed. It reads the session and subagent transcripts and returns tokens (counted once per `message.id`), cache hit rate, tool calls, spans, parallelism, the critical path, files read by several agents and, with `--prices`, cost. It never prints transcript text. Self-test: `scripts/transcript-metrics.self-test.mjs`.
- Eval suite `evals/`: `spec-creator` starts on a spec request, `workflow-retro` and `fastify-best-practices` load on their requests, `run-plan` never starts on its own (it has `disable-model-invocation`), and an unrelated request starts no skill or agent of this plugin.

### Changed
- `workflow-retro` step 1c uses the bundled script instead of adding up transcript usage by hand; prices are passed inline, so the skill still writes nothing before the user confirms.

## [1.0.1] — 2026-11-09

### Changed
- Declare the always-on context cost in COMPATIBILITY.md; CI checks it against claude plugin details.

## [1.0.0] — 2026-11-09

### Added
- Agents `spec-creator`, `implementation-planner`, `implementer` (one agent for backend and frontend) and `plan-verifier`, generalized to any repository; no MCP tools.
- Skills `run-plan` (runs an approved plan task by task: implementer, plan-verifier, one retry, architecture review at the end; started by the user only) and `workflow-retro` (saved only after the user confirms).
- Skill `fastify-best-practices`, unmodified from mcollina/skills @ 58b3eeb (MIT, © 2026 Matteo Collina), with `THIRD_PARTY_NOTICES.md`.
- Hooks: `write-scope` (spec-creator → `specs/`, implementation-planner → `plans/`, Markdown only) and `bash-guard` (identical copy; `plan-verifier` strictly read-only: read-only git only, every verify command is run by `run-plan` in the user's session), each with a self-test.
- `LICENSE` (MIT) and `sources.json` recording the origin of each component.

### Changed
- First stable release: spec-driven workflow (`spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`, `run-plan`, `workflow-retro`), `fastify-best-practices`, scope hooks.
- Scope per spec SDD-01: `test-writer`, `doc-writer`, `implementer-protocol` and the React, Next.js and testing skills are listed under Later; the optional MCP integration is dropped.
- Minimum Claude Code version raised to 2.1.318.
- Dependency `architecture-review` range `^0.1` → `^1.0` (architecture-review 1.0.0).
- Dependency `research-tools` range `^0.1` → `^1.0` (research-tools 1.0.0).
- Dependency `engineering-paved-path` range `^0.1` → `^1.0` (engineering-paved-path 1.0.0).

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ b288d63

## [0.1.0] — 2026-11-09

### Added
- Plugin scaffold: manifest, empty component directories, README, compatibility notes.
- Dependencies: `engineering-paved-path` `^0.1`, `research-tools` `^0.1`, `architecture-review` `^0.1`.

Source: DevDigest (MIT, © 2026 Ivan Lapa), branch local/all-lessons @ a9d6713
