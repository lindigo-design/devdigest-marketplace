# Evals: research-tools

Behaviour checks for `claude plugin eval`: does each component fire on a request it is for, and stay silent on one it is not for. Graders are deterministic (`tool_used`), so only the agent runs cost money. Format and rules: [docs/PLUGIN-GUIDELINES.md](../../../docs/PLUGIN-GUIDELINES.md#evals).

| Case | Checks |
| :- | :- |
| `researcher-delegated` | A research question with evidence goes to the researcher agent. |
| `small-edit-not-delegated` | A trivial text edit is done directly, without the researcher. |

```bash
claude plugin eval ./plugins/research-tools --runs 1 --ablation none   # quick, one run per case
claude plugin eval ./plugins/research-tools                              # 3 runs per case, with a no-plugin baseline
```

Results are written to `evals/results/` (git-ignored).
