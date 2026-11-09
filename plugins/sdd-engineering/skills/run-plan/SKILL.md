---
name: run-plan
description: >-
  Runs an approved implementation plan (plans/<feature-id>.md) task by task in the main session,
  sending each task to the implementer agent and then to plan-verifier, with one retry on failure. Use
  when the user asks to "run the plan", "execute plans/<feature-id>.md", "implement the approved plan"
  or "start the implementers", or types /sdd-engineering:run-plan <plan> [--task T<n>]. It refuses a
  plan whose Status is not approved, stops after a second failed verification, ends with an
  architecture review of the full diff, keeps task statuses in the plan up to date, offers a retro and
  never commits or pushes. Not for writing the plan (use sdd-engineering:implementation-planner) or
  checking work by hand (use sdd-engineering:plan-verifier).
argument-hint: "<path to plans/<feature-id>.md> [--task T<n>]"
disable-model-invocation: true
---

# Run plan

You (the main session) are the orchestrator. Subagents cannot start other subagents, so all of the
workflow's orchestration happens here: you launch `sdd-engineering:implementer` for one task, then
`sdd-engineering:plan-verifier` for that task, decide what runs next, keep the plan's task statuses true,
and stop when something is wrong. You don't write feature code yourself, except trivial glue between two
tasks' files that you name in the summary.

Arguments: the plan path (required) · `--task T<n>` (run or re-run only that task).

**Never run `git commit`, `git push`, or any command that discards work** (`git reset`, `git checkout --`,
`git stash`, `git clean`), even if a step seems to need it. Commits are the user's call.

## 0. Preflight

1. Read the plan in full. Its `Status:` line must be exactly `approved`. Anything else (`draft`,
   `done`, missing) → stop and tell the user why: a draft plan needs their review and approval
   (they change `Status: draft` to `Status: approved`); a done plan has nothing to run.
2. Non-empty "Open questions" → stop and ask the user.
3. Validate the plan: every task has `Status`, a type, `Files`, `Covers` and `Verify`; the File
   ownership map lists no file twice; every `Depends on` points to an earlier task. Read the spec named
   in `Spec:`: its `Status:` must be `approved` (or `implemented`) and it must contain no
   `[NEEDS CLARIFICATION`. Broken → stop and report what is wrong.
4. `git status --porcelain` → save as the **baseline** (pre-existing changes are not the run's).
   Uncommitted changes in files the plan owns → ask the user before starting.
   `git rev-parse --short HEAD` → save as the **plan base**: the `base:` for every agent call.
5. Note the plan's Verify commands table: you may run those commands yourself in step 3, subject to the
   user's normal permissions.

## 1. Pick the next task

The first task in plan order whose `Status:` is `todo` (or the one given by `--task`). Every task in its
`Depends on` must be `done`; otherwise stop and report which dependency is missing. Tasks run one at a
time, in order: they share one checkout.

## 2. Implement

One `Agent` call, `subagent_type: sdd-engineering:implementer`. The prompt is only this (the plan is the
context):

```
plan: <plan path>
task: T<n>
base: <plan base>
```

Read the report: `STATUS`, `FILES`, `TESTS`, `DEVIATIONS`, `FOREIGN ERRORS`, `BLOCKER`,
`INSIGHT CANDIDATES`. A report without the required fields counts as `DONE_WITH_CONCERNS`.

- `BLOCKED` → mark the task `Status: blocked: <reason>` and stop (step 5). A retry cannot fix a plan
  problem.
- `DONE` / `DONE_WITH_CONCERNS` → step 3.

## 3. Verify

One `Agent` call, `subagent_type: sdd-engineering:plan-verifier`:

```
plan: <plan path>
task: T<n>
base: <plan base>
```

plan-verifier is read-only and its Bash allows only read-only git and a few typecheck/test command
shapes. It lists every Verify command it could not run under `NOT CHECKED`, with the exact command and
cwd. Run those commands yourself and record command → result.

The task **passes** when the verdict is `COMPLIANT`, or `INCOMPLETE EVIDENCE` where every `NOT CHECKED`
command you ran succeeded and no other row is `UNVERIFIABLE` for a reason you can't resolve (if one is,
show it to the user and ask before counting the task as passed). Anything else **fails**: a
`NOT COMPLIANT` verdict, or a `NOT CHECKED` command that failed when you ran it.

## 4. Pass, retry once, or stop

- **Pass** → set the task's `Status:` line to `done` (edit only that line). Show a short summary:
  task, files, verdict, commands you ran. Go back to step 1, unless `--task` was given.
- **First failure** → launch `sdd-engineering:implementer` again for the same task, with the failing
  rows appended:

  ```
  plan: <plan path>
  task: T<n>
  base: <plan base>
  verifier findings:
  <every non-MET row, OWNERSHIP problems and failing command output, verbatim>
  ```

  Then run step 3 again.
- **Second failure** → mark the task `Status: blocked: <one-line reason>` and stop (step 5).

## 5. Stop and report

Report to the user: the task that stopped the run, the verifier's findings (every non-MET row, the
OWNERSHIP line, failing commands with their output), and the files changed so far
(`git status --porcelain` minus the baseline). Suggest the smallest next step: fix the plan
(re-run `sdd-engineering:implementation-planner`, then the user re-approves), fix by hand, or re-run
with `--task T<n>` after a change. Do not run later tasks. Do not revert anything without the user's OK.

## 6. Finish

When every task is `done`, launch in ONE message two read-only `Agent` calls:

```
subagent_type: sdd-engineering:plan-verifier                →  plan: <plan path> · base: <plan base>
subagent_type: architecture-review:architecture-reviewer    →  base: <plan base> · plan: <plan path>
```

The plan-verifier call has no `task:`: it checks the whole plan and returns the traceability matrix
`SPEC-NN/AC-n → task → test → commit` with its GAPS list. The architecture-reviewer checks the full diff
from the plan base (committed, staged, unstaged and untracked work). Run any `NOT CHECKED` commands
yourself, as in step 3.

Show the user both header blocks (`VERDICT`, `COVERAGE`, `SCOPE`, `CHECKS RUN`), every non-MET row,
every architecture finding and the GAPS list. Then:

- **architecture-reviewer `FAIL`** (a `critical` or `high` finding blocks) → stop. Keep the plan's
  `Status: approved`, list the findings with the task that owns each file, and let the user decide: fix
  (re-run `--task T<n>` with the finding appended as `verifier findings:`) or accept the finding.
- **plan-verifier `NOT COMPLIANT`** → same: stop, list the rows with their task, the user decides.
- **`INCOMPLETE EVIDENCE`** with an architecture `PASS` → show the `NOT CHECKED` / `UNVERIFIABLE` rows
  and ask the user to confirm the manual checks; finish only after they confirm.
- **`COMPLIANT` + `PASS`** (or confirmed) → set the plan's `Status:` line to `done` and the spec's
  `Status:` line from `approved` to `implemented` (edit only those words). If the plans folder has a
  README index, update the plan's line.

Then:

1. Show the implementers' `INSIGHT CANDIDATES`, de-duplicated, and ask the user whether to record them
   in the project's insights or conventions file, if it has one. Write them only if they agree.
2. If a security review is available in this environment, suggest the user runs it on the same diff.
3. Offer the retro: `/sdd-engineering:workflow-retro` analyses this run (agents, cost, rework,
   lessons) and saves nothing without the user's OK.
4. Remind the user that nothing was committed; the changes are in the working tree for them to review
   and commit.
