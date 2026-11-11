---
name: architecture-reviewer-delegated
description: "A pre-merge layering review goes to the architecture-reviewer agent."
tags: [positive, architecture-reviewer]
allowed_tools: [Read, Glob, Grep, Agent]
max_turns: 10
---

Before I merge, have an architecture reviewer check the changes in this working tree for boundary violations: layering, import direction and cross-package imports. I want a PASS or FAIL verdict with findings.
