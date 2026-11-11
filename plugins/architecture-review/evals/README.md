# Evals: architecture-review

Behaviour checks for `claude plugin eval`: does each component fire on a request it is for, and stay silent on one it is not for. Graders are deterministic (`tool_used`), so only the agent runs cost money. Format and rules: [docs/PLUGIN-GUIDELINES.md](../../../docs/PLUGIN-GUIDELINES.md#evals).

| Case | Checks |
| :- | :- |
| `architecture-reviewer-delegated` | A pre-merge layering review goes to the architecture-reviewer agent. |
| `unrelated-request-not-delegated` | A question unrelated to architecture does not start the reviewer. |

```bash
claude plugin eval ./plugins/architecture-review --runs 1 --ablation none   # quick, one run per case
claude plugin eval ./plugins/architecture-review                              # 3 runs per case, with a no-plugin baseline
```

Results are written to `evals/results/` (git-ignored).
