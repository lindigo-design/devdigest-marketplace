---
name: workflow-retro
description: >-
  Produces a retrospective of a finished multi-agent session, such as a run-plan run, with the agent
  sequence, tokens, cache hit rate, parallelism and cost taken from the session transcripts. Use when
  a spec-driven run has finished or when the user asks for a "workflow retro", "agent retro", "session
  retrospective", "how did the workflow go" or "what agents ran", or types
  /sdd-engineering:workflow-retro [plan path]. It finds duplicated context, round-trips, scope drift,
  failed steps and missing workflow steps, and ends with at most five concrete action items, each
  naming a file.
  The retro is shown in chat first; it is saved under a retros/ folder only after the user confirms.
  It never edits agents, skills or plans. Not for checking code against a plan (use
  sdd-engineering:plan-verifier).
argument-hint: "[plan path or run name]"
---

# Workflow retro

A post-mortem for any session where two or more subagents ran, typically one
`/sdd-engineering:run-plan` run. Three phases: collect → analyse → recommend. Output: a compact
dashboard in chat; then, only with the user's OK, the same dashboard saved to a file and one row
appended to a ledger, both under a `retros/` folder.

If fewer than 2 `Agent` tool calls are found in the session → output
"Session too small for retro (< 2 agents). Skipping." and stop.

## Rules

- **Write nothing before the user confirms.** No cache files, no ledger row, no retro file. The only
  writes this skill ever makes are the two files in "Save", after an explicit yes.
- **Never edit agent, skill or plan files.** Write recommendations only; never apply them.
- **Never copy raw transcript text** into the output or a file: transcripts can contain tokens or
  `.env` values. Numbers, paths and one-line summaries only.
- **Never skip Phase 2.** Duplication and gap analysis are the core value.
- **The transcript is the source of truth** for token metrics; when it is missing, say so and mark the
  columns `N/A`. Never invent numbers.
- **No vague recommendations.** Every recommendation names a specific file or owner and specific text.
- **Always end with the Action items checklist:** at most 5 items, each assignable to a file or owner.
- Bash is for read-only commands only: the bundled `${CLAUDE_SKILL_DIR}/scripts/transcript-metrics.mjs`,
  listing transcripts, `git status`, `git diff`.

## Phase 1: Collect

### 1a. Reconstruct the agent sequence from the conversation

Walk the conversation and collect every `Agent` tool call. Note for each:

- agent type (`subagent_type`, for example `sdd-engineering:implementer`);
- the task it worked on (plan task ID, if any) and a prompt summary (≤ 15 words);
- whether it ran in parallel with another agent;
- status: success / partial / failed (for plan-verifier: its verdict);
- attempt: first run or retry (run-plan retries a task once after a failed verification).

Subagents cannot start other subagents, so every agent has depth 1 (started by the main session).

### 1b. Load prices

Before any cost calculation, WebFetch Anthropic's pricing page and read the rates for every model that
appears in the transcript (`message.model` of assistant entries): `input`, `output`, `cache_read`,
`cache_creation`, in USD per million tokens. If the fetch or the parse fails, set the cost columns to
`N/A` and note `prices unavailable`; never guess rates. Prices are not cached to disk.

### 1c. Measure the transcripts with the bundled script

Do not add up tokens by hand. Run the script that ships with this skill (read-only, Node ≥ 22, prints
JSON with numbers, model names, agent types, timestamps and file paths only, never transcript text):

```bash
node "${CLAUDE_SKILL_DIR}/scripts/transcript-metrics.mjs" --latest
# or name the session's transcript(s): a session continued after context compaction spans several files
node "${CLAUDE_SKILL_DIR}/scripts/transcript-metrics.mjs" <session.jsonl> [<more.jsonl> ...]
```

With the prices from 1b, add them inline (no file: this skill writes nothing before the user confirms):
`--prices '{"<model>": {"input": n, "output": n, "cacheRead": n, "cacheCreation": n}}'`, in USD per
million tokens. The script then fills `costUsd` and `savingsUsd`; a model missing from the prices leaves
them `null`.

What it returns, and how the dashboard uses it:

- `agents[]`: one row per subagent (`<session-id>/subagents/agent-<id>.jsonl` + `.meta.json`):
  `agent` (first 8 characters of the ID), `agentType`, `toolUseId` (links to the main session's Agent
  call), `tokens` (`in`, `out`, `cacheRead`, `cacheCreation`), `hitPercent`, `toolCalls`, `tools`,
  `spanSeconds`, `web`, `filesRead`, `costUsd`, `interrupted`.
- Usage is counted **once per `message.id`**: one model response is written as several lines carrying
  the same `usage`, so summing lines would double- or triple-count. Each response is priced at its own
  model.
- `totals`: `agents`, `interrupted`, `wallSeconds`, `parallelism`, `criticalPath`.
- `duplications`: files read by two or more agents (the input to 2a).
- `session.agentCalls`: the main session's Agent calls with their `subagent_type`, in order (the input
  to 1a).

If the script prints `transcript not found` → output `transcript not found: token columns N/A, span
and tools estimated from the conversation` and fill those columns with `N/A`. An agent with
`interrupted: true` → its token columns are `N/A (interrupted)`; add
`Partial data: N agent(s) interrupted.`

The formulas the script applies (for reference; do not recompute):

```
cost        = (in × input + out × output + cache_read × cache_read_rate + cache_creation × cache_creation_rate) / 1_000_000
hit%        = cache_read / (cache_read + cache_creation + in) × 100
parallelism = sum(all agent spans) / wall-clock span of the whole session
savings     = cache_read × (input − cache_read_rate) / 1_000_000
```

## Phase 2: Analyse

### 2a. Context duplication

For each file that appears in two or more agents' Read/Glob/Grep calls:

```
DUPLICATION: docs/architecture.md
  Read by: spec-creator (#1), implementation-planner (#2)
  Est. wasted tokens: ~3,000
  Fix: put the architecture summary into the spec's Interactions section so the planner can skip it
```

### 2b. Round-trips

Count per agent: how many times it returned a clarification request (a QUESTIONS block, a BLOCKED
report asking for context) OR retried the same tool call with the same arguments. Extra Read/Grep
calls for thorough research do NOT count. Also count run-plan retries per task.

```
round-trips: spec-creator=0, implementation-planner=1, implementer/T3=2 ← HIGH
```

Any agent with round-trips ≥ 2 → flag as "under-briefed prompt".

### 2c. Scope drift

Check each agent invocation:

- Did the agent do work outside its documented scope?
- Did the files each implementer changed match its task in the plan's File ownership map?

```
SCOPE DRIFT: implementer/T4 re-read the spec and the whole plan (3 Glob + 5 Read)
  Expected: read Global constraints, Contracts, ownership map and its own task only
  Fix: in run-plan step 2, nothing to change; in the implementer agent §2, stress "read only"
```

### 2d. Failed steps

Any of:

- a tool error that was not retried successfully;
- an agent that stopped because it needed the user (BLOCKED, QUESTIONS);
- the same tool call repeated 3+ times with the same arguments;
- a task that failed verification (first or second time).

```
FAILED: implementer/T2 ran the typecheck 3× before fixing an import error
  Root cause: output not re-read after the first fix attempt
  Fix: implementer agent §4.2: "re-read the full error output before the second run"
```

### 2e. Gap detection

Check for missing workflow steps (read-only checks only):

- [ ] Did every task get a plan-verifier run after its implementer?
- [ ] Did the Finish step run `architecture-review:architecture-reviewer` on the full diff?
- [ ] Were the implementers' insight candidates shown to the user (and recorded in the project's
      insights or conventions file, if the user agreed)?
- [ ] If the project keeps copies of shared contracts in several packages, are the copies in sync?
- [ ] Any `NOT MET`, `NOT CHECKED` or GAPS row from plan-verifier left without a follow-up action?
- [ ] Are the plan's task statuses and the plan and spec `Status:` lines consistent with the outcome?

Each gap:

```
GAP: insight candidates from T2 and T5 were not shown to the user
  Risk: discoveries are lost for the next run
  Owner: main session (run-plan Finish, step 1)
  Fix: <specific change>
```

## Phase 3: Recommend

Each recommendation names a **specific agent, skill or file** and contains **specific text**.

**Tier 1: agent prompt improvements** (highest return):

```
AGENT: implementation-planner
CHANGE: In Step 1, add: "If the spec lists Interactions, use them as the map of touched parts; do not
  re-read the documents the spec already summarises."
WHY: the planner re-read docs/architecture.md independently (~3k wasted tokens)
```

**Tier 2: workflow structure** (medium return):

```
WORKFLOW: run-plan step 2
CHANGE: pass the task's Files list in the implementer prompt as well as the plan path
WHY: 3 of 5 implementers searched the plan for their task's files
```

**Tier 3: process** (quick wins):

```
PROCESS: parallelism under-used (factor 0.82)
CHANGE: the two Finish reviewers already run in one message; research and design review could too
```

Recommendations about agents or skills of this plugin are for the user to bring to the plugin
maintainers or to apply in their own copies; never edit them yourself.

## Output format

A **compact dashboard**: no long narrative.

### Header (2 lines)

```
Workflow Retro: {short workflow name}
Run: {plan path or description} · {N} agents · mode: {sequential | parallel | mixed} · prices: {fetched HH:MM | unavailable}
```

### Metrics table

```
| agent    | role                   | task | in     | out    | cache-read | hit% | tools | span  | cost  |
|----------|------------------------|------|--------|--------|------------|------|-------|-------|-------|
| a00eb81a | spec-creator           | —    | 32,828 | 51,112 | 2,053,240  | 72%  | 20    | 1373s | $7.15 |
| a14e0e4d | implementer            | T1   | 51     | 8,027  | 1,913,785  | 93%  | 40    | 149s  | $1.24 |
| a9873876 | plan-verifier          | T1   | 41     | 4,988  |   750,216  | 81%  | 24    | 96s   | $0.95 |
```

Column rules:

- `agent`: first 8 characters of the subagent conversation ID;
- `role`: agent name without the plugin prefix;
- `task`: plan task ID, with `r` for a retry (`T3r`), or `—`;
- `hit%` below 60% → show as `49% (low)`;
- transcript unavailable → `in`, `out`, `cache-read`, `hit%`, `cost` are `N/A`; `span` and `tools`
  from task notifications if available.

### Totals line

```
Totals: in: X · out: X · cache-read: XM · hit%: X% · tools: X · wall: Xs · parallelism: Xx · cost: $X · savings: ~$X · web: N search · N fetch
```

`web` comes from `server_tool_use.web_search_requests` + `web_fetch_requests`; omit the segment if both
are 0.

### Critical path line

```
Critical path: {role} / {agentId} ({X}% of wall) · {optional caveat}
```

### Analysis block (only categories with findings)

```
Duplications (N): {file} read by {agentA}, {agentB} · est. waste: ~Xk tokens
Round-trips: {role}/{agentId}=N · under-briefed
Scope drift: {one line}
Failed: {one line}
Gaps (N): {one line each}
```

### Action items (always last)

```
Action items:
- [ ] {specific file}: {specific change}  ← Tier 1
- [ ] {specific file}: {specific change}  ← Tier 2
- [ ] {specific action}                   ← Tier 3
```

At most 5 items. Each names a specific file or owner.

## Save (only after the user confirms)

After the dashboard, ask: "Save this retro?" and name the two target paths. The folder is an existing
folder named `retros/` in the repository (any parent, for example `docs/retros/`); if there is none,
propose `retros/` at the repository root, or ask the user where. Write nothing unless the user says yes.

On yes:

1. Write the dashboard to `retros/<YYYY-MM-DD>-<plan id or run name>.md`. If the file exists, add a
   `-2`, `-3` suffix; never overwrite.
2. Append one row to `retros/ledger.md`; if it does not exist, create it with this header first:

```
| date | workflow | plan / spec | agents | cost | hit% | parallelism | bottleneck | duplications | gaps | result |
|------|----------|-------------|--------|------|------|-------------|------------|--------------|------|--------|
| {YYYY-MM-DD HH:MM} | {workflow name} | {plan or spec id, or "—"} | {N} | ~${cost} | {hit%} | {parallelism} | {role/agentId} | {N} | {N} | {ok / partial / failed} |
```

Append, never rewrite earlier rows. Never commit the files; tell the user where they are.
