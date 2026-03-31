# Calculation Engine — Implementation Plan

## Context
The COD profitability system has DB schema, settings management, and UI shell in place, but zero calculation logic. This plan implements the complete two-layer financial engine: per-product contribution margins (Layer 1) and business-wide net profit (Layer 2), plus a KPI module. All code is server-side only, pure-function where possible, with settings read from DB at runtime.

## Files to Create (7 files)

### Phase 1: Types (`src/types/`)

**`src/types/orders.ts`** — ALREADY CREATED
- Status constants, type guards, `OrderRow`, `CartItem`

**`src/types/cost-model.ts`** — NEW
- `Period { start: Date; end: Date }`
- `ProductOrderAggregates` — bucketed order counts + financial sums per product
- `CampaignSpendAggregate` — total spend + leads per product
- `ContributionMargin` — Layer 1 result with all 8 cost components + per-order breakdown
- `NetProfit` — Layer 2 result with overhead + pickup fees
- `CostWaterfallStep` / `CostWaterfall` — for visualization

**`src/types/kpi.ts`** — NEW
- `ProductKPIs` — confirmation/delivery/return/exchange rates, CPL, cost per delivered order
- `BusinessKPIs` — aggregate rates + financial totals
- `DailySettlementKPI` — expected vs actual reconciliation

### Phase 2: Pure Computation (`src/lib/calculations/`)

**`src/lib/calculations/cost-engine.ts`** — NEW (core of the system)
- `extractCartQuantity(cart)` → number (min 1)
- `countWorkingDays(start, end)` → number (Mon–Sat, Sunday off)
- `safeDivide(n, d)` → number | null
- `computeContributionMargin(aggregates, campaignSpend, settings, period)` → ContributionMargin
  - 8 cost components:
    1. COGS = unitCogs × totalCartQuantity (delivered only)
    2. Delivery fee = deliveredCount × navex_delivery_fee
    3. Packing = deliveredCount × packing_cost
    4. Converty fee = convertyFeeBaseDelivered × converty_platform_fee_rate
    5. Ad spend = campaignSpend.totalSpend (full amount)
    6. Return burden = returnedCount × (navex_return_fee + packing_cost) + convertyFeeBaseReturned × rate
       (wasted delivery fee excluded — negligible, absorbed by business-level daily pickup lump sum)
    7. Failed lead burden = convertyFeeBaseFailedLeads × rate (rejected/abandoned/pending ONLY — no returned)
    8. Exchange burden = exchangeCount × navex_delivery_fee + convertyFeeBaseExchange × rate
  - perOrder breakdown = each component ÷ deliveredCount (null if 0)
- `computeNetProfit(productMargins, overheadCategories, settings, period)` → NetProfit
  - totalContributionMargin − totalOverhead − (workingDays × daily_pickup_fee)
- `buildCostWaterfall(margin)` → CostWaterfall (product-level steps)
- `buildBusinessWaterfall(netProfit)` → CostWaterfall (business-level steps)

**`src/lib/calculations/kpi.ts`** — NEW
- `computeProductKPIs(aggregates, campaignSpend, margin)` → ProductKPIs
- `computeBusinessKPIs(allAggregates, netProfit)` → BusinessKPIs
- `computeDailySettlementKPIs(settlements)` → DailySettlementKPI[]

### Phase 3: Data Layer

**`src/lib/calculations/queries.ts`** — NEW
- `fetchProductOrders(supabase, productId, period)` → OrderRow[]
  - WHERE product_id = X AND NOT is_duplicated AND NOT is_test AND converty_created_at in range
- `aggregateProductOrders(orders, product)` → ProductOrderAggregates
  - Pure TS aggregation over fetched rows (single pass, bucket by status)
  - delivered = status 'delivered' AND NOT is_exchange
  - returned = status in RETURN_STATUSES AND NOT is_exchange
  - exchange = is_exchange true (any status)
  - shipped = status in NAVEX_ZONE_STATUSES
  - failedLeads = status in FAILED_LEAD_STATUSES
- `fetchCampaignSpend(supabase, productId, period)` → CampaignSpendAggregate
- `fetchActiveProducts(supabase)` → product rows
- `fetchOverheadCategories(supabase)` → overhead rows
- `fetchAllOrders(supabase, period)` → OrderRow[]
- `fetchDailySettlements(supabase, period)` → settlement rows

### Phase 4: Orchestration

**`src/lib/calculations/index.ts`** — NEW (public API)
- `getProductProfitability(productId, period)` → { margin, kpis, waterfall }
- `getBusinessProfitability(period)` → { netProfit, kpis, waterfall, productDetails[] }
- `getDailySettlement(date)` → DailySettlementKPI

Orchestration flow: create supabase client → getSettings() → fetch data → compute → return.

## Key Design Decisions
- **Period filtering**: `converty_created_at` (order creation date), matching the partial index
- **Working days**: Mon–Sat (Tunisia), Sunday off, no holiday calendar in v1
- **Campaign overlap**: campaigns contribute if their period overlaps the query period at all (no pro-rating in v1)
- **Packing on returned orders**: included in return burden (material consumed, zero revenue)
- **Zero delivered**: all per-order metrics return `null`, not divide-by-zero

## Existing Code Reused
- `src/lib/settings/index.ts` — `getSettings()`, `Settings` type
- `src/lib/supabase/server.ts` — `createClient()`

## Verification
1. `npm run typecheck` — all 7 files compile with strict TS
2. `npm run lint` — no lint errors
3. Manual: call `getProductProfitability` with seed data product, verify 8 cost components
4. Edge: call with product that has zero delivered orders → expect null margins, no crash
