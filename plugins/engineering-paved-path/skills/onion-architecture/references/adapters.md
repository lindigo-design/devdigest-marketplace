# Ports & adapters: LLM SDKs, payment and email APIs, git, search, parsers, tokenizers

Ports are interfaces **owned by the inside**; adapters are implementations **living outside**
([Cockburn via Graça: Ports & Adapters](https://herbertograca.com/2017/09/14/ports-adapters-architecture/)).

## Inventory the existing ports first

Before adding a port, list what the consuming repository already has: grep the composition root for
getters/factories and the shared contracts package for `interface .*Provider|Client|Gateway`. A
typical inventory looks like this (sample names and paths):

| Port | Defined in | Adapter(s) | Composition-root access |
|---|---|---|---|
| `LLMProvider` | shared contracts | `adapters/llm/{openai,anthropic}.ts` | `await container.llm(id)` |
| `PaymentGateway` | shared contracts | `adapters/payments/stripe.ts` (`StripePaymentGateway`) | `await container.payments()` |
| `EmailSender` | `modules/notifications/ports.ts` | `adapters/email/smtp.ts` | `container.email` |
| `GitClient` | shared contracts | `adapters/git/simple-git.ts` | `container.git` |
| `SearchIndex` | shared contracts | `adapters/search/ripgrep.ts` | `container.searchIndex` |
| `SecretsProvider`, `AuthProvider` | shared contracts | `adapters/secrets/local.ts`, `adapters/auth/local.ts` | `container.secrets`, `container.auth` |
| `Tokenizer` | `adapters/tokenizer` (port + impl together: legacy shape, split when touched) | `TiktokenTokenizer` | `container.tokenizer` |
| `Catalog` (module facade) | `modules/catalog/types.ts` | `CatalogService` | `container.catalog` |

## Adding a new integration: checklist

1. **Port**: interface in the consuming module's `ports.ts`; if several packages need it, in the
   shared contracts package (if that package is vendored or owned by someone else, ask first).
   Methods speak domain language (`listCharges(customer)`), not SDK language
   (`stripe.charges.list`). Return port-owned types.
2. **Adapter**: `adapters/<port>/<tech>.ts`, class `<Tech><Port>`, `implements <Port>`. It may import
   the SDK, `node:*`, and domain/port types. It must **not** import `modules/*` or the container
   (rule `adapters-are-outer-ring`). Configuration comes through constructor options.
3. **Secrets**: read via the project's secrets/config provider in the composition-root factory,
   never `process.env` in the adapter.
4. **Wiring**: lazy getter (sync) or async factory (needs secrets) in the composition root, plus an
   overrides field for tests; drop cached clients when keys change (for example an
   `invalidateSecretCaches()` hook) if the client is key-dependent.
5. **Test double**: `Mock<Port>` next to the other test doubles (for example `adapters/mocks.ts`);
   services are tested with it.
6. **Resilience**: retries/timeouts/backoff (a shared resilience helper) wrap the adapter call in
   the adapter or the composition-root factory, not in the domain.

## Pure helpers are not adapters

Code with no I/O (diff parsing, attribute extraction from text, pricing math) is domain/application
logic. Put it in the owning module (or a shared pure library package), not under `adapters/`, so the
core can use it without violating `application-no-adapters`.
