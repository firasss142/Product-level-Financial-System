# Dashboard Implementation Plan

## Context
The nav already links to `/dashboard` but the page doesn't exist. We need the main admin dashboard showing KPIs, order funnel, product profitability, and stuck-order alerts — all powered by the existing calculation engine.

## Architecture
- **Pattern**: Client component fetches from new `/api/dashboard` route (same as orders page pattern)
- **Data source**: API route calls `getBusinessProfitability(period)` server-side + new `fetchStuckOrders` query
- **Skip "best variant margin"**: Engine doesn't compute per-variant margins — show product-level only

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/dashboard/route.ts` | API route — calls calc engine + stuck orders query |
| `src/app/(admin)/dashboard/page.tsx` | Thin server shell rendering client component |
| `src/app/(admin)/dashboard/dashboard-client.tsx` | Main client component — period state + fetch + layout |
| `src/app/(admin)/dashboard/kpi-strip.tsx` | 5 StatCards row |
| `src/app/(admin)/dashboard/order-funnel.tsx` | Horizontal funnel visualization |
| `src/app/(admin)/dashboard/product-grid.tsx` | Product profitability cards (worst margin first) |
| `src/app/(admin)/dashboard/attention-section.tsx` | Amber-bordered collapsible stuck orders |

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/supabase/queries.ts` | Add `fetchStuckOrders()` — non-terminal, >48h old |
| `src/lib/format.ts` | Add `fmtPercent(rate)` helper |
| `src/components/ui/stat-card.tsx` | Add optional `valueClassName` prop for color control |

## Section Details

### 1. Period Selector (in dashboard-client.tsx)
- Native `<input type="date">` (matches orders page)
- Default: 1st of current month → today
- Presets: "Ce mois" / "Mois dernier" buttons
- Fetch triggers on date change via `useEffect`

### 2. KPI Strip (kpi-strip.tsx)
- Grid: `grid-cols-2 lg:grid-cols-5 gap-4`
- Uses `StatCard` with `valueClassName` for color:
  1. Taux de confirmation (%) — default
  2. Taux de livraison (%) — default
  3. Taux de retour (%) — ALWAYS terracotta
  4. Marge de contribution (TND) — emerald/terracotta
  5. Bénéfice net (TND) — emerald/terracotta
- Loading: 5 × `SkeletonCard`

### 3. Order Funnel (order-funnel.tsx)
- Aggregate counts from `productDetails[].kpis` (totalLeads, confirmed, shipped, delivered, returned)
- Horizontal flex row of stage pills connected by arrows with conversion %
- Delivered = emerald, Returned = terracotta
- Mobile: stack vertically

### 4. Product Grid (product-grid.tsx)
- Sort ascending by `contributionMarginTotal` (worst first)
- Each card: product name, hero margin number (color-coded), delivered count, return rate badge
- Grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`

### 5. Attention Requise (attention-section.tsx)
- `<details>/<summary>` for collapse (no dependency)
- Amber border, `AlertTriangle` icon
- Group by status, show count + order references as links to `/orders/{id}`

### New Query: fetchStuckOrders
```ts
// In src/lib/supabase/queries.ts
// Orders NOT in TERMINAL_STATUSES where converty_created_at < 48h ago
// Excludes duplicated + test, limit 100, joins products(name)
```

### API Route: /api/dashboard
- `GET ?start=YYYY-MM-DD&end=YYYY-MM-DD`
- Calls `getBusinessProfitability(period)` + `fetchStuckOrders(supabase)`
- Returns flattened JSON: `{ kpis, netProfit, productDetails, stuckOrders }`

## Reuse Map
- `getBusinessProfitability()` → [src/lib/calculations/index.ts](src/lib/calculations/index.ts)
- `fmtPrice()`, `statusLabel()` → [src/lib/format.ts](src/lib/format.ts)
- `StatCard`, `Card`, `Badge`, `Button`, `Skeleton` → [src/components/ui/index.ts](src/components/ui/index.ts)
- `TERMINAL_STATUSES` → [src/types/orders.ts](src/types/orders.ts)
- Orders page pattern → [src/app/(admin)/orders/page.tsx](src/app/(admin)/orders/page.tsx)

## Build Order
1. `fmtPercent` in format.ts + `valueClassName` in stat-card.tsx + `fetchStuckOrders` in queries.ts
2. API route `/api/dashboard`
3. Leaf components (kpi-strip, order-funnel, product-grid, attention-section) — parallel
4. dashboard-client.tsx orchestrator
5. page.tsx shell

## Verification
1. `npm run typecheck` after each file
2. `npm run dev` → navigate to `/dashboard`
3. Verify KPIs match manual calculation for known period
4. Test presets "Ce mois" / "Mois dernier"
5. Verify stuck orders appear when non-terminal orders exist >48h
6. Check mobile responsiveness (grid collapse)
7. `npm run lint`
