# Testing per ring (for example Vitest + testcontainers + `app.inject`)

The payoff of Onion: the core is tested without infrastructure; infrastructure is tested against the
real thing; the edges are tested end-to-end through the HTTP framework. Use the project's own test
runner, folder and naming conventions; the table shows a sample layout.

| Ring | Test type | File | Tools |
|---|---|---|---|
| Domain | pure unit | `test/<area>-<topic>.test.ts` | the test runner only; no mocks needed (for example `test/orders-status.test.ts`) |
| Application (service) | unit with fakes | `test/<area>-service.test.ts` | in-memory port fakes, `Mock<Port>` test doubles; pass a `Pick<Container,…>` object |
| Infrastructure (repository) | integration | `test/<area>-<topic>.it.test.ts` | a Postgres test helper (testcontainers, runs migrations); skip when Docker is unavailable |
| Adapter | contract / unit | `test/adapters.test.ts`, `test/<tech>.test.ts` | the real library on fixtures; no network |
| Presentation (routes) | HTTP via inject | `test/routes-smoke.test.ts` (no DB) or `*.it.test.ts` (DB) | `buildApp({ config, overrides })` + `app.inject(...)` |

## Rules

- Any test that touches a real database **must** be marked as an integration test (for example
  `*.it.test.ts`) so CI can split unit and integration runs.
- Swap dependencies through the composition root's overrides, never by `vi.mock`-ing module paths.
  If you can't override something, it isn't behind a port yet (fix that first).
- A service test that needs Docker is a smell: the service reaches infrastructure directly.
- Unit-only run (sample, works on Windows without package scripts):
  `node node_modules/vitest/vitest.mjs run --exclude '**/*.it.test.ts'`.

```ts
// service test with narrow deps: no Container, no DB
const svc = new InvoicesService({
  invoicesRepo: new InMemoryInvoicesStore([invoiceFixture]),
  pdf: async () => new MockPdfRenderer(),
} as Pick<Container, 'invoicesRepo' | 'pdf'>);
```

## References
- [Fastify: Testing guide](https://fastify.dev/docs/latest/Guides/Testing)
- The consuming repository's testing guide and test helpers folder, if it has them.
- Test-writing best practices beyond per-ring placement are out of scope for this skill.
