# Background work: job runner (for example p-queue), fire-and-forget runs, event bus (SSE)

Scheduling and streaming are delivery mechanisms (outer rings); what a job *does* is a use case.
Find the project's equivalents first: a job runner (p-queue, BullMQ, pg-boss…), an in-process event
bus that feeds SSE/WebSocket routes, and where long-running runs are started.

## Rules

- **Job handler = thin driving adapter.** `container.jobs.register(KIND, handler)` lives in the owning
  service; the handler parses the job payload (Zod) and calls a service method. No ORM in handlers.
- **Job kinds**: `<NAME>_JOB_KIND = 'kebab-string'` in the module's `constants.ts`.
- **Enqueue through the port.** Services call `deps.jobs.enqueue(...)`; take `jobs` via
  `Pick<Container, 'jobs' | …>` so tests can pass a fake runner.
- **Long-running fire-and-forget runs** (for example `void executor.executeRuns(...)` for report
  generation or a batch import), when the project deliberately runs them outside the job runner:
  keep that documented decision, and keep the executor in the application ring. It orchestrates ports
  (LLM, repositories, event bus) and must not import `db/schema`.
- **The event bus is an outbound port.** Application code publishes run events via
  `deps.events.publish(runId, kind, msg, data)` (`kind` is a contract enum) and calls `complete(runId)`;
  the SSE route only `subscribe`s / replays `buffer(runId)` and forwards. Event shapes come from the
  shared contracts.
- **Enqueue signature** (sample): `deps.jobs.enqueue(workspaceId, KIND, payload)`; handlers are
  registered with `jobs.register(KIND, (payload, { jobId }) => service.handle(...))`.
- **Idempotency & reaping** (for example stale `running` runs on boot) are infrastructure concerns:
  keep them in repositories (`reapStaleRunningRuns`) called from the app bootstrap, not in domain code.
- **Clock & IDs**: pass `now` (number) into domain functions (`deriveFulfilmentStatus({ …, now })`)
  rather than calling `Date.now()` inside the core.
