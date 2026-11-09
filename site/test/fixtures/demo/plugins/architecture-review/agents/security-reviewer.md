---
name: security-reviewer
description: Read-only agent that reviews a diff for security issues against the team rubric.
tools: Read, Grep, Glob, Bash(git diff:*)
model: sonnet
skills:
  - engineering-paved-path:security
  - pr-self-review
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: echo ignored
          env:
            TOKEN: FIXTURE_SECRET_AGENT_ENV
---

You review a change for security issues. Read the diff and the files it touches; never edit them.
