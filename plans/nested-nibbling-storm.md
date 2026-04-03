# Investor Settlement System — Implementation Plan

## Context

The investor settlement system provides transparent, auditable waterfall reports showing how investment returns are calculated. Investors fund product, account, or business-wide scopes; capital is returned first, then profit/loss is shared at configured rates. Settlements are immutable JSON snapshots. All UI in French.

**What exists:** DB tables (investors, investment_deals, settlements), types (`SettlementWaterfall`, `Investor`, `InvestmentDeal`, `Settlement`), Zod schemas, base query functions (`queryActiveInvestors`, `queryDealsByInvestor`, `querySettlementsByDeal`), nav item stub. No pages, no API routes, no settlement calculation engine.

---

## Step 1 — Settlement Calculation Engine

**New file:** `src/lib/calculations/settlement.ts`

Core function: `computeSettlement(dealId, period) → SettlementResult`

### Scope Resolution

| scope_type | Order fetching strategy |
|---|---|
| `product` | Reuse `fetchProductOrders(supabase, scope_id, period)` |
| `account` | New query: get store IDs by account → `fetchOrdersByStoreIds(supabase, storeIds, period)` |
| `business` | Reuse `fetchAllOrders(supabase, period)` |

### Waterfall Computation

1. Fetch orders in scope, group by `product_id`
2. For each product group: `aggregateProductOrders()` → `ProductOrderAggregates`
3. For each product: `fetchCampaignSpend()` → ad spend
4. For each product: `computeContributionMargin()` → margin components
5. Sum across products to fill `SettlementWaterfall` fields:
   - `gross_revenue` = Σ `margin.revenue`
   - `product_cogs` = Σ `margin.totalCogs`
   - `delivery_fees` = Σ `margin.totalDeliveryFee`
   - `return_fees` = Σ `aggregates.returnedCount × settings.navex_return_fee`
   - `wasted_packing_costs` = Σ `aggregates.returnedCount × settings.packing_cost`
   - `converty_fees_on_returns` = Σ `aggregates.convertyFeeBaseReturned × settings.converty_platform_fee_rate`
   - `converty_fees_on_failed_leads` = Σ `margin.failedLeadCostBurden`
   - `converty_fees_on_delivered` = Σ `margin.totalConvertyFeeOnDelivered`
   - `exchange_delivery_costs` = Σ `aggregates.exchangeCount × settings.navex_delivery_fee`
   - `packing_costs` = Σ `margin.totalPackingCost`
   - `ad_spend` = Σ `margin.adSpendAllocation`

**Note:** `return_fees` and `wasted_packing_costs` are split from `returnCostBurden` using raw aggregates + settings (the ContributionMargin bundles them). Similarly `exchange_delivery_costs` is split from `exchangeCostBurden`.

### Overhead Allocation

- Fetch `fetchOverheadCategories()` + compute `totalOverhead` + `totalPickupFees` (reuse `countWorkingDays`)
- If `scope_type='business'`: `allocated_overhead = totalOverhead + totalPickupFees`
- Otherwise: `allocated_overhead = (scopeOrderCount / totalOrderCount) × (totalOverhead + totalPickupFees)` where `totalOrderCount` comes from `fetchAllOrders` count

### Capital Tracking & Profit/Loss Sharing

- `capital_returned_to_date` = Σ `investor_share` from `querySettlementsByDeal()` (prior settlements only)
- If `net_profit > 0`:
  - `capital_remaining = max(0, capital_amount - capital_returned_to_date)`
  - `capital_return_this_period = min(net_profit, capital_remaining)`
  - `distributable = net_profit - capital_return_this_period`
  - `investor_share = capital_return_this_period + (distributable × profit_share_rate)`
- If `net_profit ≤ 0`:
  - `investor_share = net_profit × loss_share_rate` (negative)

### Return Type

```ts
export interface SettlementResult {
  waterfall: SettlementWaterfall;
  total_revenue: number;
  total_costs: number;
  net_profit: number;
  capital_invested: number;
  capital_returned_to_date: number;
  capital_return_this_period: number;
  capital_remaining: number;
  investor_share: number;
  scope_order_count: number;
  total_order_count: number;
}
```

### New Helper Queries

Add to `src/lib/supabase/queries.ts`:
```ts
queryStoreIdsByAccount(supabase, accountId) → string[]
queryDealById(supabase, dealId) → InvestmentDeal | null
```

Add to `src/lib/calculations/queries.ts`:
```ts
fetchOrdersByStoreIds(supabase, storeIds, period) → OrderRow[]
```

### Export

Add `computeSettlement` export to `src/lib/calculations/index.ts`.

---

## Step 2 — API Routes

### `src/app/api/investors/route.ts` — GET, POST, PATCH

- **GET**: Fetch active investors. For each, count active deals + sum capital (batch query on `investment_deals` grouped by `investor_id`). Also fetch latest settlement date per investor (join through deals → settlements).
- **POST**: Validate `InvestorCreateSchema`, insert, return row.
- **PATCH**: Validate `InvestorUpdateSchema`, update (soft delete via `is_active`).

### `src/app/api/investors/[id]/route.ts` — GET

- Fetch investor by ID + `queryDealsByInvestor()`.
- For each deal: resolve scope display name (product name / account email / "Global").
- Return `{ investor, deals }`.

### `src/app/api/deals/route.ts` — POST, PATCH

- **POST**: Validate `DealCreateSchema`, insert, return row.
- **PATCH**: Validate `DealUpdateSchema`, update.

### `src/app/api/deals/[id]/settlement-preview/route.ts` — GET

- Query params: `period_start`, `period_end` (validate with date regex).
- Call `computeSettlement(dealId, { start, end })`.
- Return `SettlementResult` as JSON (preview only, nothing saved).

### `src/app/api/settlements/route.ts` — POST

- Validate `SettlementCreateSchema`.
- Call `computeSettlement(dealId, period)`.
- INSERT into `settlements` (snapshot = waterfall JSONB, denormalized totals).
- Return created settlement row.

### `src/app/api/settlements/[dealId]/route.ts` — GET

- Call `querySettlementsByDeal(supabase, dealId)`.
- Return array of past settlements.

---

## Step 3 — Investor List Page

**File:** `src/app/(admin)/investors/page.tsx`

Pattern: follows `accounts/page.tsx` (client component, useState, useEffect, DataTable).

### DataTable Columns

| Column | Source | Format |
|---|---|---|
| Nom | `investor.name` | text |
| Email | `investor.email` | text, masked |
| Accords actifs | count of active deals | Badge number |
| Capital total | sum of `deal.capital_amount` | `fmtPrice` |
| Dernier reglement | latest settlement `created_at` | `fmtDateMedium` or "—" |

### Actions
- "Ajouter un investisseur" button → Modal (name, email, phone, notes inputs)
- Row click → navigate to `/investors/[id]`
- Badge toggle for active/inactive

---

## Step 4 — Investor Detail Page

**File:** `src/app/(admin)/investors/[id]/page.tsx`

Pattern: follows `products/[id]/page.tsx` (multi-section detail page).

### Section 1: Investor Info Card
- Display: name, email, phone, notes
- Edit button → inline editing or modal

### Section 2: Deals List
Each deal rendered as an expandable card row showing:
- Scope badge: `Produit` / `Compte` / `Global` (with target name)
- Capital: `fmtPrice(deal.capital_amount)`
- Part benefices: `fmtPercent(deal.profit_share_rate)`
- Part pertes: `fmtPercent(deal.loss_share_rate)`
- Periode: start → end (or "En cours")
- Active/inactive badge

**"Ajouter un accord" modal:**
- Perimetre: Select dropdown (Produit / Compte / Global)
- Cible: conditional Select (product list or account list, hidden for Global)
- Capital investi: Input (number)
- Part des benefices: Input (0-100, stored ÷ 100)
- Part des pertes: Input (0-100, stored ÷ 100)
- Date de debut, Date de fin (optional)
- Notes

### Section 3: Settlement Generation (per deal)

Triggered by "Generer le rapport" button on a deal row. Opens a **modal** flow:

1. **Period selection**: Two date inputs (debut, fin)
2. **"Apercu" button** → calls `GET /api/deals/[id]/settlement-preview?period_start=...&period_end=...`
3. **Waterfall table** (see component below)
4. **Capital tracking summary**:
   - Capital investi: X TND
   - Deja rembourse: X TND
   - Remboursement cette periode: X TND
   - Restant: X TND
5. **Investor share**: Part investisseur (X%): X TND
6. **"Confirmer et sauvegarder"** → POST `/api/settlements` → immutable snapshot created
7. Toast success + refresh settlement history

### Settlement History (per deal, expandable)
- Table: Periode | Revenu brut | Resultat net | Part investisseur | Date
- Click row → expand to show full waterfall snapshot from stored JSON

---

## Step 5 — Waterfall Table Component

**File:** `src/app/(admin)/investors/[id]/waterfall-table.tsx`

Renders the `SettlementWaterfall` as a line-by-line table matching the user's requested format:

| # | Ligne | Montant (TND) | % du revenu |
|---|-------|--------------|-------------|
| 1 | Revenu brut | `gross_revenue` | 100,0 % |
| 2 | Cout des marchandises (COGS) | `−product_cogs` | X % |
| 3 | Frais de livraison | `−delivery_fees` | X % |
| 4 | Frais de retour + livraisons perdues | `−(return_fees + wasted_packing_costs + converty_fees_on_returns)` | X % |
| 5 | Depenses publicitaires | `−ad_spend` | X % |
| 6 | Cout d'emballage | `−packing_costs` | X % |
| 7 | Commission Converty | `−(converty_fees_on_delivered + converty_fees_on_failed_leads)` | X % |
| 8 | Frais fixes alloues | `−allocated_overhead` | X % |
| 9 | **Resultat net du perimetre** | `net_profit` | X % |

- Positive amounts in emerald, negative in terracotta
- Result row bold with top border
- "% du revenu" = `safeDivide(amount, gross_revenue) × 100`, show "—" if revenue = 0
- All numbers with `fmtPrice`, tabular-nums

---

## File Summary (creation order)

| # | File | Action |
|---|------|--------|
| 1 | `src/lib/supabase/queries.ts` | Add `queryStoreIdsByAccount`, `queryDealById` |
| 2 | `src/lib/calculations/queries.ts` | Add `fetchOrdersByStoreIds` |
| 3 | `src/lib/calculations/settlement.ts` | **New** — core settlement engine |
| 4 | `src/lib/calculations/index.ts` | Add `computeSettlement` export |
| 5 | `src/app/api/investors/route.ts` | **New** — GET/POST/PATCH |
| 6 | `src/app/api/investors/[id]/route.ts` | **New** — GET detail |
| 7 | `src/app/api/deals/route.ts` | **New** — POST/PATCH |
| 8 | `src/app/api/deals/[id]/settlement-preview/route.ts` | **New** — GET preview |
| 9 | `src/app/api/settlements/route.ts` | **New** — POST (immutable insert) |
| 10 | `src/app/api/settlements/[dealId]/route.ts` | **New** — GET history |
| 11 | `src/app/(admin)/investors/page.tsx` | **New** — list page |
| 12 | `src/app/(admin)/investors/[id]/page.tsx` | **New** — detail page |
| 13 | `src/app/(admin)/investors/[id]/waterfall-table.tsx` | **New** — waterfall component |

---

## Verification

1. `npm run typecheck` after each file
2. `npm run lint` after all files
3. Manual test: create investor → create deal (product scope) → preview settlement → verify waterfall numbers match `getProductProfitability` for same product/period → save settlement → verify immutability (no edit/delete possible) → check capital tracking on second settlement
4. Edge case: create deal with zero-order product → preview → verify zero-revenue report renders without crash
5. Edge case: create deal where net_profit < capital → verify partial capital return
6. Edge case: create deal with negative profit → verify loss sharing applies
