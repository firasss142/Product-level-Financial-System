# Plan: Navex Cash Reconciliation Page

## Context

The business receives daily cash settlements from Navex (COD delivery partner). Navex collects money from customers, deducts fees, and wire-transfers the net. Currently there is no way to verify these transfers — discrepancies go undetected. This page lets the operator compare what Navex *should* have sent each day vs. what actually arrived in the bank, flagging any gaps.

The `daily_settlements` table already exists with the right schema. The nav item `Rapprochement` already points to `/reconciliation`. The `DailySettlementUpsertSchema` is already defined in `schemas.ts`. What's missing: the API routes, the calculation logic, and the page UI.

---

## Formula (from spec §3.1 + §3.2, enforced by CLAUDE.md)

```
Expected(day) =
  Σ total_price  (orders whose "delivered" status changed_at falls on that day, excl. duplicated/test)
- Σ delivery_fee (orders whose deposit-or-later status first appeared on that day — i.e., picked up)
- Σ return_fee   (orders whose "returned"/"to_be_returned" status changed_at falls on that day)
- daily_pickup_fee  (flat deduction, 1× per day regardless of order count, from settings)
```

**Key nuance:** Delivery fee applies to ALL orders that were physically picked up by Navex (`deposit`+), not just delivered ones. We determine "which day" by the `changed_at` field in `order_status_history`, not `converty_created_at`.

**Exclusions:** `is_duplicated=true` and `is_test=true` always excluded.

---

## Files to Create

### 1. `src/app/api/reconciliation/route.ts` — GET endpoint
Returns daily reconciliation rows for a month (YYYY-MM query param). For each calendar day in the month:
- Queries `order_status_history` joined with `orders` to find:
  - Orders delivered on that day (status = `delivered`, `changed_at` date matches)
  - Orders deposited on that day (first history entry with a Navex-zone status, `changed_at` date matches) → delivery fee applies here
  - Orders returned on that day (status ∈ `returned`/`to_be_returned`, `changed_at` date matches)
- Reads `daily_settlements` for that month's saved `actual_amount` values
- Reads `navex_delivery_fee`, `navex_return_fee`, `navex_daily_pickup_fee` from settings
- Computes `expected_amount`, merges with saved `actual_amount`, computes `écart`
- Also returns the contributing order references per day (for expandable detail)

**Response shape:**
```ts
interface ReconciliationDay {
  date: string;           // YYYY-MM-DD
  delivered_count: number;
  returned_count: number;
  expected_amount: number;
  actual_amount: number | null;  // null = not yet entered
  difference: number | null;     // actual - expected, null if no actual
  orders: {
    reference: string;
    total_price: number;
    contribution: "delivered" | "deposited" | "returned";
  }[];
}
```

**Implementation approach:**
- Single query: fetch all `order_status_history` rows for the month with `orders` joined (`total_price, is_duplicated, is_test`)
- Group by date in TypeScript (single pass)
- For deposit detection: use the earliest history entry for each order that has a Navex-zone status — `deposit|in transit|unverified|delivered|to_be_returned|returned`

### 2. `src/app/api/reconciliation/route.ts` — POST endpoint (same file)
Upserts `actual_amount` + optional `notes` for a single day. Reuses `DailySettlementUpsertSchema` from `src/lib/supabase/schemas.ts`. Also updates the `expected_amount` and `difference` columns in `daily_settlements`.

### 3. `src/app/(admin)/reconciliation/page.tsx` — UI page
Client component. Pattern mirrors `src/app/(admin)/orders/page.tsx`.

**Layout:**
```
h1: Rapprochement Navex
[month selector: ← MARS 2026 →]
[summary badge: "Aucun écart significatif" OR "X jours avec écart (> 10 TND)"]

DataTable: one row per day with expandable detail
  Columns: Date | Livrées | Retournées | Attendu | Reçu (editable) | Écart
  Footer row: totals
```

**Écart color coding:**
- Green (< 1 TND absolute difference)
- Amber (1–10 TND)
- Red (> 10 TND) — uses existing Badge variants or inline Tailwind

**Inline editing pattern:** `<input type="number">` in the "Reçu" cell, saves on `blur` or `Enter` via `PATCH`-like POST to `/api/reconciliation`. No DataTable row click needed for this page.

**Expandable rows:** Each row has a toggle button. When expanded, shows a mini-table of the contributing orders (reference, status contribution type, amount). This is a local React state toggle (no extra API call — data already loaded).

**Monthly summary row:** Pinned below the table as a styled `<tfoot>` or `<div>` row showing column totals.

---

## Files to Modify

### 4. `src/lib/calculations/queries.ts`
Add a new query function:
```ts
export async function fetchOrderStatusHistoryForMonth(
  supabase: SupabaseClient,
  year: number,
  month: number   // 1-based
): Promise<StatusHistoryWithOrder[]>
```
Joins `order_status_history` with `orders` (filtering `is_duplicated=false, is_test=false`), returns rows needed for reconciliation computation.

---

## Critical Implementation Details

1. **"Deposit day" detection:** For delivery fee allocation, we need the first history entry per order where status ∈ NAVEX_ZONE_STATUSES (`deposit`, `in transit`, `unverified`, `delivered`, `to_be_returned`, `returned`). That `changed_at` date is when the delivery fee clock starts.

2. **No double-counting:** An order that goes from `deposit` → `delivered` should contribute:
   - Delivery fee on its deposit date
   - Revenue on its delivered date
   Both are independent events and appear in separate rows.

3. **Return fee:** Charged on the date the order enters `returned` or `to_be_returned` status.

4. **Pickup fee:** Always subtracted once per day, even if zero orders moved that day (as long as the day is a working day, Mon–Sat). Use `countWorkingDays` from `src/lib/calculations/cost-engine.ts` for reference, but apply it per-day inline.

5. **Days with no orders:** Still show in the table for the month with expected = −pickup_fee (if working day) or 0 (if Sunday).

6. **Saving actual_amount:** POST to `/api/reconciliation` with `{ date, actual_amount }`. On success, update local state. Zod validation via `DailySettlementUpsertSchema`. The `difference` column in DB is stored as `actual_amount - expected_amount`.

7. **Month navigation:** Default to current month. Use `←` / `→` buttons to move months. URL param or local state (local state is fine, no deep-linking needed).

8. **No hardcoded fees** — read from DB settings via `/api/settings` or inline in the reconciliation API.

---

## Reusable Existing Code

| What | Where |
|---|---|
| `DailySettlementUpsertSchema` | `src/lib/supabase/schemas.ts:274` |
| `NAVEX_ZONE_STATUSES` type guard `isNavexZoneStatus()` | `src/types/orders.ts` |
| `isReturnStatus()` | `src/types/orders.ts` |
| `fetchDailySettlements()` | `src/lib/calculations/queries.ts:264` |
| `querySettings()` | `src/lib/supabase/queries.ts:116` |
| `fmtPrice`, `fmtDateShort` | `src/lib/format.ts` |
| `DataTableColumn`, `DataTable` | `src/components/ui/data-table.tsx` |
| `Card`, `CardContent`, `Badge`, `Button`, `useToast` | `src/components/ui` |
| Supabase server client | `src/lib/supabase/server.ts` → `createClient()` |
| Nav item already defined | `src/components/layout/nav-items.ts:28` |

---

## Files Summary

| File | Action |
|---|---|
| `src/app/api/reconciliation/route.ts` | **Create** — GET (monthly data) + POST (upsert actual_amount) |
| `src/app/(admin)/reconciliation/page.tsx` | **Create** — full reconciliation UI |
| `src/lib/calculations/queries.ts` | **Modify** — add `fetchOrderStatusHistoryForMonth()` |
| `src/lib/supabase/schemas.ts` | No change needed (schema already exists) |

---

## Verification

1. `npm run typecheck` — must pass with zero errors
2. `npm run lint` — must pass
3. Manual test: navigate to `/reconciliation`, verify month selector works, verify table shows days, enter an `actual_amount` value, blur — verify it saves (network tab shows POST 200), verify `Écart` column updates and color-codes correctly
4. Expand a row — verify order list appears
5. Month with no data — verify empty rows still render for each calendar day
6. Verify settings fees are read from DB (change `navex_delivery_fee` in settings, reload reconciliation — numbers should update)
