# Evals: engineering-paved-path

Behaviour checks for `claude plugin eval`: does each component fire on a request it is for, and stay silent on one it is not for. Graders are deterministic (`tool_used`), so only the agent runs cost money. Format and rules: [docs/PLUGIN-GUIDELINES.md](../../../docs/PLUGIN-GUIDELINES.md#evals).

| Case | Checks |
| :- | :- |
| `onion-architecture-fires` | The onion-architecture skill fires on a backend layering question. |
| `frontend-ui-architecture-fires` | The frontend-ui-architecture skill fires on a component-structure question. |
| `unrelated-request-silent` | Neither skill fires on a request that has nothing to do with code structure. |

```bash
claude plugin eval ./plugins/engineering-paved-path --runs 1 --ablation none   # quick, one run per case
claude plugin eval ./plugins/engineering-paved-path                              # 3 runs per case, with a no-plugin baseline
```

Results are written to `evals/results/` (git-ignored).
