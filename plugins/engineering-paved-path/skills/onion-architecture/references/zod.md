# Zod: validation at the edges

Types can't guarantee data that arrives from outside, so **parse at every boundary, then trust the
types inside** ([kamae-ts: Boundary Defense](https://iwasa-kosui.github.io/kamae-ts/en/boundary-defense.html)).
The same applies to other schema libraries (Valibot, TypeBox, ArkType).

## Where Zod runs (inbound edges)

| Edge | Where | How |
|---|---|---|
| HTTP request | `routes.ts` | `schema: { params, querystring, body }` via `fastify-type-provider-zod` (or the framework's equivalent) |
| LLM output | adapter / structured-output helper | parse against the contract, degrade gracefully on failure |
| JSON columns from DB | repository mapper | `Contract.parse(row.jsonCol)` |
| Env / config | the config module (for example `platform/config.ts`) | parse once at boot |
| External API payloads (payment provider, git host, LLM gateway) | adapter | map SDK types → port types |

Inner rings (domain, application) **don't re-parse** already-typed values.

## Where types live

- **API contracts / DTOs**: the shared contracts package or folder
  (`export const X = z.object(…)` + `export type X = z.infer<…>`). Used by presentation and
  application. If that package is vendored or owned by another team, don't edit it without
  coordination.
- **Domain (`domain.ts`, `ports.ts`)**: plain TypeScript. Contracts may be referenced **only with
  `import type`**; no Zod runtime in the core (a layer-check rule such as `domain-shared-type-only`
  can enforce this). Invariants are plain guard functions that throw `AppError` subclasses.
- A domain type that is identical to a contract may simply alias it:
  `export type PaymentTerms = Contracts.PaymentTerms`. Introduce a separate domain type when the shape
  differs (camelCase, extra invariants, no transport fields).

## Errors

A `ZodError` escaping a service is typically rendered as 422 `validation_error` by the global handler.
That is fine for edge parsing in services (for example parsing an LLM result). Don't use Zod for
business invariants; throw a named `AppError` instead (`invalid_order_request`).

## References
- [kamae-ts: Boundary Defense](https://iwasa-kosui.github.io/kamae-ts/en/boundary-defense.html)
- Zod usage details beyond where parsing happens are out of scope for this skill.
