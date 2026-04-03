# Plan: Variant-Level Profitability, Exchange Tracking, and Damaged Returns

## Context

The current product detail page shows COGS, batches, and variant quantity mapping — but no
per-variant profitability breakdown. The dashboard KPI strip lacks an exchange rate metric.
And there is no UI for tracking damaged returns, despite the `damaged_returns` table already
existing in the DB schema. This plan adds all three features.

---

## Feature 1: Variant-Level Profitability Table (Product Detail Page)

### What it does
A new section on the product detail page showing a table: Variante | Prix (TND) | Quantité | COGS (TND) | Marge (TND) | Marge (%)

- Fetched from a new API endpoint `/api/products/[id]/variant-profitability?start=&end=`
- The endpoint groups delivered orders by `selected_variant_sku` + `variant_unit_count`, then computes per-variant metrics
- Proportional "other costs" (delivery, packing, Converty, burdens, ad spend) are allocated per-variant using variant revenue share: `variantRevenue / totalRevenue`

### Variant margin formula (per variant group)
```
variantRevenue      = SUM(total_price) for delivered orders of this variant
variantCogs         = unit_cogs × SUM(variant_unit_count) for delivered orders
proportionalCosts   = (variantRevenue / totalRevenue) × totalOtherCosts
  where totalOtherCosts = totalDeliveryFee + totalPackingCost + totalConvertyFee
                        + adSpend + returnBurden + failedLeadBurden + exchangeBurden
variantMargin       = variantRevenue - variantCogs - proportionalCosts
variantMarginPct    = variantMargin / variantRevenue × 100
```

### Data flow

**New API route:** `src/app/api/products/[id]/variant-profitability/route.ts`
- Reuses existing: `fetchProductOrders()`, `aggregateProductOrders()`, `computeContributionMargin()`, `fetchCampaignSpend()`, `getSettings()`
- Groups delivered orders (non-exchange, status=delivered) by `selected_variant_sku`
- Returns array of: `{ sku, variantName, price, unitCount, deliveredCount, revenue, cogs, proportionalCosts, margin, marginPct }`
- Sorted by `marginPct` descending

**New UI section:** `VariantProfitabilitySection` in `src/app/(admin)/products/[id]/page.tsx`
- Same date range picker pattern as dashboard (this month / last month presets)
- Table sorted best → worst margin
- Color: `text-emerald` if margin% ≥ 20%, `text-amber-600` if 0–20%, `text-terracotta` if < 0%
- Fetches from new API on mount and on date change

### Files to modify
- `src/app/(admin)/products/[id]/page.tsx` — add `VariantProfitabilitySection` component + render it after `VariantMapSection`
- `src/app/api/products/[id]/variant-profitability/route.ts` — **new file**

---

## Feature 2: Exchange Rate KPI on Dashboard & Product Cards

### What it does
- Add a 6th KPI card to the dashboard strip: "Taux d'échange" = `exchangeCount / deliveredCount` across all products
- Add exchange rate to each product card in the `ProductGrid`

### Data flow
The `ContributionMargin` type already stores `exchangeCount` in `ProductOrderAggregates`. The dashboard API response already passes through `profitability.productDetails`. We just need to:

1. Add `exchangeRate: number | null` to the `ProductDetail` interface in `dashboard-client.tsx` and `product-grid.tsx`
2. Add `overallExchangeRate: number | null` to `KpiData`
3. Compute these in `/api/dashboard/route.ts` — `exchangeCount` is available from `d.margin` (wait: need to confirm this is in the `ContributionMargin` return shape)

**Check:** `ContributionMargin` does NOT currently expose `exchangeCount`. It's only inside `ProductOrderAggregates`. We need to either:
- (a) Add `exchangeCount` to the `ContributionMargin` return type in `src/types/cost-model.ts` and set it in `cost-engine.ts`
- (b) Pass `aggregates.exchangeCount` alongside `margin` in the dashboard route

Option (a) is cleaner — add `exchangeCount: number` to `ContributionMargin` type and populate it in `computeContributionMargin()`.

### Trend indicator
Compare exchange rate to the previous equivalent period:
- Previous period = same duration, ending the day before the current start
- Dashboard client fetches a second call for previous period, or the API accepts a `compare=true` param
- Simple approach: dashboard API optionally computes previous period exchange rate using same duration window and returns it alongside current

**Simpler approach (avoids extra API call):** Add `exchangeRateTrend: 'up' | 'down' | 'flat' | null` by computing prev period in the same API call. The prev period uses the same date span shifted back. Reuse `getBusinessProfitability()` for both periods.

Actually, to keep the API fast, only compute trend on the KPI strip level (business-wide), not per-product. One extra `getBusinessProfitability()` call for the previous period.

**Trend indicator rendering:** small arrow badge next to exchange rate KPI value.

### Files to modify
- `src/types/cost-model.ts` — add `exchangeCount: number` to `ContributionMargin` interface
- `src/lib/calculations/cost-engine.ts` — populate `exchangeCount` in return of `computeContributionMargin()`
- `src/app/api/dashboard/route.ts` — compute `overallExchangeRate`, prev period exchange rate for trend, add `exchangeRate` per product
- `src/app/(admin)/dashboard/dashboard-client.tsx` — extend `KpiData` and `ProductDetail` interfaces
- `src/app/(admin)/dashboard/kpi-strip.tsx` — add 6th KPI card (grid becomes `lg:grid-cols-6`)
- `src/app/(admin)/dashboard/product-grid.tsx` — add exchange rate badge per product card

---

## Feature 3: Damaged Returns Counter (Product Detail Page)

### What it does
- A new section on the product detail page: "Retours endommagés"
- Shows current month count with + / − buttons and a notes field
- Saves to the `damaged_returns` table (already exists in DB)
- Display only — does NOT affect profitability calculations
- Period: current calendar month (fixed — no date picker, matches "per month" spec)

### DB table (already exists)
```sql
damaged_returns (id, product_id, period_start, period_end, count, notes, created_at)
```
One row per product per month. `period_start` = first of month, `period_end` = last of month.

### Data flow

**New API route:** `src/app/api/products/[id]/damaged-returns/route.ts`
- `GET ?year=YYYY&month=MM` — returns `{ count, notes }` for that product/month
- `POST { count, notes, year, month }` — upserts (by product_id + period_start + period_end)

**New UI section:** `DamagedReturnsSection` in `src/app/(admin)/products/[id]/page.tsx`
- Shows current month name: "Retours endommagés — Avril 2026"
- Large centered number with `−` and `+` buttons
- Notes textarea below
- "Enregistrer" button
- On load: fetch current month's count from API
- On save: POST to API

### Files to modify
- `src/app/(admin)/products/[id]/page.tsx` — add `DamagedReturnsSection` + render it (last section)
- `src/app/api/products/[id]/damaged-returns/route.ts` — **new file**

---

## Implementation Order

1. **`ContributionMargin` type** — add `exchangeCount` (small, no-risk change, unblocks Feature 2)
2. **`cost-engine.ts`** — populate `exchangeCount` in return value
3. **Dashboard API** — add exchange rate computation + trend + per-product exchange rate
4. **KPI strip** — add 6th card
5. **Product grid** — add exchange badge
6. **`dashboard-client.tsx`** — extend types
7. **Variant profitability API** — new route
8. **Variant profitability section** — UI component in product detail page
9. **Damaged returns API** — new route
10. **Damaged returns section** — UI component in product detail page

---

## Critical Files

| File | Role |
|------|------|
| `src/types/cost-model.ts` | Add `exchangeCount` to `ContributionMargin` |
| `src/lib/calculations/cost-engine.ts` | Populate `exchangeCount` in return |
| `src/app/api/dashboard/route.ts` | Exchange rate KPIs |
| `src/app/(admin)/dashboard/kpi-strip.tsx` | 6th KPI card |
| `src/app/(admin)/dashboard/product-grid.tsx` | Exchange badge per card |
| `src/app/(admin)/dashboard/dashboard-client.tsx` | Type extensions |
| `src/app/api/products/[id]/variant-profitability/route.ts` | **NEW** |
| `src/app/(admin)/products/[id]/page.tsx` | 2 new sections |
| `src/app/api/products/[id]/damaged-returns/route.ts` | **NEW** |

---

## Reused Functions

- `fetchProductOrders()` — `src/lib/calculations/queries.ts`
- `aggregateProductOrders()` — `src/lib/calculations/queries.ts`
- `computeContributionMargin()` — `src/lib/calculations/cost-engine.ts`
- `fetchCampaignSpend()` — `src/lib/calculations/queries.ts`
- `getSettings()` — `src/lib/settings`
- `getBusinessProfitability()` — `src/lib/calculations/index.ts`
- `createClient()` — `src/lib/supabase/server`
- Design primitives: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Button`, `Input`, `Badge`, `StatCard`, `EmptyState` — `src/components/ui`
- Formatters: `fmtPrice`, `fmtPercent`, `fmtNumber` — `src/lib/format`
- `cn()` — `src/lib/utils`

---

## Verification

1. `npm run typecheck` — zero errors after each file change
2. `npm run lint` — clean before done
3. Manual test: product detail page shows variant table, damaged returns counter persists across reload
4. Dashboard KPI strip shows 6 cards including Taux d'échange
5. Each product card shows exchange rate badge
6. Trend indicator appears correctly (up/down/flat arrow) next to exchange KPI
