# Evals: sdd-engineering

Behaviour checks for `claude plugin eval`: does each component fire on a request it is for, and stay silent on one it is not for. Graders are deterministic (`tool_used`), so only the agent runs cost money. Format and rules: [docs/PLUGIN-GUIDELINES.md](../../../docs/PLUGIN-GUIDELINES.md#evals).

| Case | Checks |
| :- | :- |
| `spec-creator-delegated` | Asking for a spec before any planning starts the spec-creator agent. |
| `workflow-retro-fires` | A question about how a finished multi-agent run went loads the workflow-retro skill. |
| `fastify-best-practices-fires` | A Fastify question loads the fastify-best-practices skill. |
| `run-plan-user-only` | run-plan has disable-model-invocation: the model never starts it, even when asked to run a plan. |
| `unrelated-request-silent` | No sdd-engineering skill or agent starts on an unrelated request. |

```bash
claude plugin eval ./plugins/sdd-engineering --runs 1 --ablation none   # quick, one run per case
claude plugin eval ./plugins/sdd-engineering                              # 3 runs per case, with a no-plugin baseline
```

Results are written to `evals/results/` (git-ignored).
