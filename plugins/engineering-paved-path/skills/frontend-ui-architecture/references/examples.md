# Examples

Paths and names use a **neutral sample app** (an order-management UI) and the sample layout from
`SKILL.md` § 0: routes in `src/app/`, shared UI in `src/components/`, hooks in `src/lib/hooks/`.
Map them to the consuming repository's real paths.

## Contents

1. Worked example: adding a feature to the order detail page
2. Logic out of the page
3. Constants
4. Server data
5. Promotion
6. Imports

---

## 1. Worked example: adding a feature to the order detail page

Task: *"Show a per-warehouse shipment summary on the order detail page."*

1. **Owner?** Only `/orders/[orderId]` uses it, so it is route-local:
   `orders/[orderId]/_components/ShipmentSummary/`.
2. **Server data?** Shipments already come from an existing hook. Reuse it. If a new endpoint were
   needed, that is a "stop and ask" (SKILL.md §11); once agreed, add `useOrderShipments` to
   `src/lib/hooks/orders.ts` (plus the endpoint on the backend).
3. **Rules?** "Group shipments by warehouse and sort warehouses by most delayed" is pure, so it goes
   in `ShipmentSummary/helpers.ts` as `groupByWarehouse()` / `sortByMostDelayed()`, with
   `helpers.test.ts`.
4. **Fixed values?** The max warehouses shown goes in `constants.ts` as `MAX_WAREHOUSES = 10`. The
   shipment status order already exists in `ShipmentsPanel/constants.ts`, so see §5 before copying it.
5. **Text?** Add `orderDetail.shipmentSummary.*` keys to `messages/en/orderDetail.json`.
6. **Split?** A list of rows means a `_components/WarehouseRow/` child.
7. **Wire up:** `ShipmentsTab` renders `<ShipmentSummary shipments={…} />`; `page.tsx` is unchanged.

```
orders/[orderId]/_components/ShipmentSummary/
  ShipmentSummary.tsx   index.ts   styles.ts   constants.ts
  helpers.ts   helpers.test.ts   ShipmentSummary.test.tsx
  _components/WarehouseRow/{WarehouseRow.tsx,index.ts,styles.ts}
```

## 2. Logic out of the page

```tsx
// ❌ page.tsx holds the domain rules
export default function OrdersPage() {
  const { data: orders } = useOrders(accountId);
  const filtered = (orders ?? [])
    .filter((o) => status === "all" || o.status === status)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  …
}

// ✅ page composes; the rule is a named, tested pure function
// orders/helpers.ts
export function visibleOrders<O extends { status: string; updated_at?: string | null }>(
  orders: O[], status: string, sort: "newest" | "oldest",
): O[] { … }

// orders/page.tsx
const shown = visibleOrders(orders ?? [], status, sort);
```

## 3. Constants

```tsx
// ❌ new object on every render, magic number, literal text
function StockPanel() {
  const order = { OUT_OF_STOCK: 0, LOW: 1, IN_STOCK: 2 };
  const low = items.filter((i) => i.quantity < 5);
  return <p>Low stock items hidden</p>;
}

// ✅ StockPanel/constants.ts
export const STOCK_LEVEL_ORDER: Record<string, number> = { OUT_OF_STOCK: 0, LOW: 1, IN_STOCK: 2 };
export const LOW_STOCK_THRESHOLD = 5;
// text → messages/en/inventory.json, read with useTranslations("inventory")
```

## 4. Server data

```tsx
// ❌ fetch in a component, then copying server data into local state
const [payments, setPayments] = useState<PaymentSummary[]>([]);
useEffect(() => { fetch(`${API}/orders/${orderId}/payments`).then(r => r.json()).then(setPayments); }, [orderId]);

// ✅ src/lib/hooks/orders.ts
export function useOrderPayments(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ["order-payments", orderId],
    queryFn: () => api.get<PaymentSummary[]>(`/orders/${orderId}/payments`),
    enabled: !!orderId,
  });
}
// component: read + derive, never copy
const { data: payments = [] } = useOrderPayments(orderId);
const latest = latestPayment(payments); // helper
```

## 5. Promotion

`SHIPMENT_STATUS_ORDER` lives in `ShipmentsPanel/constants.ts`. A new component under the **same**
route needs it:

- one consumer → it stays where it is;
- second consumer in the same route → move it to the route level (`orders/[orderId]/constants.ts`)
  or the common parent;
- a different route needs it too → move it to `src/lib/shipment-status.ts` and update all imports.

Don't import `../ShipmentsPanel/constants` from a sibling. That reaches into another component's
internals.

## 6. Imports

```ts
// ❌
import { s } from "../ShipmentsPanel/styles";                    // another component's internals
import { Button } from "@acme/ui/primitives/Button";             // deep import into the design system
import { OrderRow } from "@/app/orders/_components/OrderRow";    // from src/components → app

// ✅
import { ShipmentsPanel } from "../ShipmentsPanel";              // its index.ts
import { Button } from "@acme/ui";
import { OrderStatusBadge } from "@/components/order-status-badge";
```
