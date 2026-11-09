# Onion Architecture: examples

The snippets use a **neutral sample domain** (an online shop with `orders`, `invoices`, `catalog`
and `customers` modules) and a **neutral sample layout** (`src/modules/<name>/`,
`src/adapters/<port>/<tech>.ts`, composition root `src/bootstrap/container.ts`). Map them to the
consuming repository's real paths (see `SKILL.md` § 0). Bad snippets show patterns typically found
in legacy code (abridged); good snippets show the target shape. Rule numbers refer to `SKILL.md`
§ Hard rules.

## 1. Route doing data access (rules 1, 2)

**Bad**: `modules/orders/routes.ts`. The route owns SQL, payment-provider sync and status logic.

```ts
app.get('/customers/:id/orders', { schema: { params: IdParams } }, async (req): Promise<OrderMeta[]> => {
  const { workspaceId } = await getContext(container, req);
  const [customer] = await container.db
    .select().from(t.customers)
    .where(and(eq(t.customers.workspaceId, workspaceId), eq(t.customers.id, req.params.id)));
  if (!customer) throw new NotFoundError('Customer not found');
  const payments = await container.payments();
  for (const charge of await payments.listCharges({ customerRef: customer.externalRef })) {
    await container.db.insert(t.orders).values({ /* … */ }).onConflictDoUpdate({ /* … */ });
  }
  // … more selects, mapping, deriveFulfilmentStatus …
});
```

**Good**: route → service → repository port.

```ts
// modules/orders/routes.ts  (presentation)
export default async function ordersRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new OrdersService(app.container);

  app.get('/customers/:id/orders', { schema: { params: IdParams } }, async (req): Promise<OrderMeta[]> => {
    const { workspaceId } = await getContext(app.container, req);
    return service.listForCustomer(workspaceId, req.params.id);
  });
}

// modules/orders/ports.ts  (core)
import type { OrderMeta } from '@acme/contracts';
import type { CustomerRef, OrderSnapshot, OrderSummary } from './domain.js';

export interface OrdersStore {
  findCustomer(workspaceId: string, customerId: string): Promise<CustomerRef | undefined>;
  upsertMany(workspaceId: string, customerId: string, orders: OrderSnapshot[]): Promise<void>;
  listSummaries(workspaceId: string, customerId: string): Promise<OrderSummary[]>;
}

// modules/orders/service.ts  (application)
type Deps = Pick<Container, 'ordersRepo' | 'payments'>;

export class OrdersService {
  constructor(private deps: Deps) {}

  async listForCustomer(workspaceId: string, customerId: string): Promise<OrderMeta[]> {
    const customer = await this.deps.ordersRepo.findCustomer(workspaceId, customerId);
    if (!customer) throw new NotFoundError('Customer not found');
    await this.syncBestEffort(workspaceId, customer);     // a failed sync never fails the read
    const rows = await this.deps.ordersRepo.listSummaries(workspaceId, customer.id);
    const now = Date.now();
    return rows.map((r) => toOrderMeta(r, deriveFulfilmentStatus({ ...r, now })));  // pure domain rule
  }
}

// modules/orders/repository.ts  (infrastructure): the ONLY file importing drizzle + db/schema
export class OrdersRepository implements OrdersStore { /* select/insert with eq(t.x.workspaceId, …) */ }
```

A file such as `modules/orders/status.ts` with `deriveFulfilmentStatus` and `rollupLineTotals` that is
pure, does no I/O and takes `now` as an argument is already a good **domain** file. Move such code to
`domain.ts` (or keep the role name) and test it without Docker (`test/orders-status.test.ts`).

## 2. Service constructing its own repository (rule 3)

**Bad**: `modules/invoices/service.ts`:

```ts
constructor(private container: Container) {
  this.repo = new InvoicesRepository(container.db);   // not swappable, service knows about db
}
```

**Good**: the repository comes from the composition root, the service gets only what it needs:

```ts
type Deps = Pick<Container, 'invoicesRepo' | 'pdf'>;
export class InvoicesService {
  constructor(private deps: Deps) {}
}
// The composition root exposes `get invoicesRepo()` with an override hook for tests.
// Call site: new InvoicesService(app.container) still type-checks, because Container satisfies Pick<…>.
```

## 3. Application code importing concrete adapters (rule 4)

**Bad**: `modules/catalog/service.ts`:

```ts
import { extractAttributes } from '../../adapters/search/extract.js';
import { parseCsvRows, detectDialect } from '../../adapters/csv/index.js';
```

**Good**: a port in the core, the implementation in adapters, wiring in the composition root:

```ts
// modules/catalog/ports.ts
export interface ProductFeedParser {
  detectDialect(sample: string): Dialect | undefined;
  parseRows(dialect: Dialect, source: string): ParsedProduct[];
}
// adapters/csv/index.ts
export class CsvProductFeedParser implements ProductFeedParser { /* library calls */ }
// bootstrap/container.ts (composition root)
get feedParser(): ProductFeedParser { return (this._feedParser ??= this.overrides.feedParser ?? new CsvProductFeedParser()); }
// test doubles (for example adapters/mocks.ts)
export class MockProductFeedParser implements ProductFeedParser { /* fixtures */ }
```

Pure helpers that happen to live in `adapters/` (for example a price-string parser with no I/O used
by `catalog/import.ts`) belong in the core of the module that owns the concept (or in a shared pure
library package), not in `adapters/`.

## 4. Persistence rows in application code (rules 2, 5)

**Bad**: `modules/invoices/service.ts` and `invoice-runner.ts` do
`import type { CustomerRow } from '../../db/rows.js'` and `import * as schema from '../../db/schema.js'`.

**Good**: the repository maps `CustomerRow` → a domain type (`BillableCustomer`) declared in
`domain.ts`, or reuses the `Customer` DTO from the shared contracts; the runner never sees `schema.*`.

```ts
// modules/invoices/domain.ts
export interface BillableCustomer { id: string; currency: Currency; taxRate: number; billingEmail: string; terms: PaymentTerms }
// modules/invoices/repository/billing.repo.ts
async listBillableCustomers(workspaceId: string): Promise<BillableCustomer[]> {
  const rows = await this.db.select().from(t.customers).where(and(eq(t.customers.workspaceId, workspaceId), eq(t.customers.active, true)));
  return rows.map(toBillableCustomer);       // mapping stays in infrastructure
}
```

## 5. Cross-module and adapter → module imports (rule 8)

**Bad**: `modules/orders/service.ts` imports `../catalog/constants.js`; `adapters/search/index.ts`
and `adapters/csv/index.ts` import `modules/catalog/constants.js` (an outer ring depending on a module).

**Good**: values the adapter needs are passed in (constructor options from the composition root), and
other modules reach `catalog` only through its facade (`container.catalog.*`). If a constant is truly
shared, expose it on the facade (a `Catalog` interface) rather than importing the module's folder.

## 6. Pure domain rule (rule 5): target shape

A common smell: `products/helpers.ts → isPricingChange(existing: Pick<ProductRow, …>, …)` types the
rule over a persistence row imported from `repository.ts`, which makes `helpers.ts ⇄ repository.ts`
circular. Typing the rule over a domain/contract type removes both the cycle and the DB dependency:

```ts
// modules/products/domain.ts: no imports except `import type`
import type { ProductPricing } from '@acme/contracts';

/** A pricing change creates a new price version; cosmetic edits (name/description/visible) don't. */
export function isPricingChange(prev: ProductPricing, next: Partial<ProductPricing>): boolean {
  return (Object.keys(next) as (keyof ProductPricing)[]).some((k) => next[k] !== undefined && next[k] !== prev[k]);
}
```

## Recording known violations

When the project adopts a layer check on an existing codebase, freeze the current violations in a
baseline file (the source of truth) and keep a short table that explains them, here or in the
project's architecture docs. Don't add to it. After fixing an entry, shrink the baseline and update
the table. A sample table, using the rule names from `references/layer-check.md`:

| Rule | From → To |
|---|---|
| routes-no-data-access | `orders/routes.ts`, `settings/routes.ts` → `drizzle-orm`, `db/schema` |
| application-no-orm | `invoices/invoice-runner.ts`, `catalog/helpers.ts` → `db/schema` |
| application-no-adapters | `catalog/service.ts` → `adapters/{csv,search/extract}` |
| no-cross-module-imports | `orders/service.ts` → `catalog/constants.ts` |
| adapters-are-outer-ring | `adapters/search/index.ts`, `adapters/csv/index.ts` → `modules/catalog/constants.ts` |
| application-no-db-rows (warn) | `invoices/service.ts`, `invoices/invoice-runner.ts` → `db/rows.ts` |
| no-circular (warn) | `products/helpers.ts` ⇄ `products/repository.ts` (helpers import row types from the repository) |
