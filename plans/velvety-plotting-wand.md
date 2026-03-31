# Plan: Type System & Query Cleanup

## Context

The previous commit (aaf1401) introduced strict domain types, Zod schemas, and typed query helpers. However, several route files still define local Zod schemas instead of importing from the central `schemas.ts`, two detail routes (`products/[id]`, `orders/[id]`) still reference the old `account_id`/`accounts` schema instead of the migrated `store_id`/`stores`, and the batch route uses the old `unit_cost` column name instead of `unit_cogs`. This plan addresses all remaining type-safety gaps.

## Changes

### 1. Fix stale API route: `src/app/api/products/[id]/route.ts`
- Replace the entire inline query with a call to `queryProductWithCosts()` from `src/lib/supabase/queries.ts` — it already returns the correct `ProductWithCosts` type with `store_id`, `stores` join, `unit_cogs`, and all new fields
- Remove the three parallel Supabase queries and manual mapping
- Return the `ProductWithCosts` object directly (or 404 if null)

### 2. Fix stale API route: `src/app/api/orders/[id]/route.ts`
- Replace `account_id` → `store_id` in the select query
- Replace `accounts(id, name)` join → `stores(name)` join
- Replace `account_id`/`account_name` in JSON response → `store_id`/`store_name`
- Add missing fields to the select + response: `converty_order_id`, `selected_variant_id`, `selected_variant_sku`, `variant_unit_count`

### 3. Fix batch route: `src/app/api/products/[id]/batches/route.ts`
- **GET**: `unit_cost` → `unit_cogs` in the select string
- **POST**: rename `unit_cost` variable → `unit_cogs`; fix insert field + select to `unit_cogs`
- **POST**: when `set_as_active = true`, also set `active_batch_id` on the product (currently only sets `unit_cogs`)
- Replace local `CreateBatchSchema`/`CostComponentSnapshot` with imports: `BatchCreateSchema`, `CostBreakdownSnapshotSchema` from `@/lib/supabase/schemas`
- Remove `import { z } from "zod"`

### 4. Deduplicate Zod schemas in route files

| Route file | Local schema(s) to remove | Import from `@/lib/supabase/schemas` |
|---|---|---|
| `api/settings/route.ts` | `SettingsSchema` | `SettingsWriteSchema` |
| `api/products/route.ts` | `CreateSchema`, `UpdateSchema` | `ProductCreateSchema`, `ProductUpdateSchema` |
| `api/products/[id]/components/route.ts` | `ComponentSchema`, `SaveSchema` | `CostComponentInputSchema`, `ComponentsSaveSchema` |
| `api/products/[id]/batches/route.ts` | `CreateBatchSchema`, `CostComponentSnapshot` | `BatchCreateSchema`, `CostBreakdownSnapshotSchema` |
| `api/overhead/route.ts` | `CreateSchema`, `UpdateSchema` | `OverheadCreateSchema`, `OverheadUpdateSchema` |

Each route: remove `import { z } from "zod"`, add import from `@/lib/supabase/schemas`.

**Validation fix**: Local `SettingsSchema` uses `.positive()` for `packing_cost` (wrong — packing cost can be 0). Central `SettingsWriteSchema` uses `.nonnegative()` (correct). Switching to the central schema fixes this bug.

### 5. Remove deprecated `SettingKey` alias in `src/lib/settings/index.ts`
- Remove `export type SettingKey = SettingsKey;` (line 19)
- Update `getSetting(key: SettingKey)` on line 40 → `getSetting(key: SettingsKey)`
- No external files import `SettingKey` (verified via grep)

### 6. Replace `select("*")` in overhead GET
- In `src/app/api/overhead/route.ts` line 23: replace `.select("*")` with explicit columns: `"id, label, monthly_amount, sort_order, is_active, created_at, updated_at"`
- Prevents returning unexpected columns if schema changes

## Files to modify

1. `src/app/api/products/[id]/route.ts` — rewrite to use `queryProductWithCosts()`
2. `src/app/api/orders/[id]/route.ts` — update to store_id/stores, add new fields
3. `src/app/api/products/[id]/batches/route.ts` — unit_cost → unit_cogs, import schemas, set active_batch_id
4. `src/app/api/settings/route.ts` — import SettingsWriteSchema, remove local schema
5. `src/app/api/products/route.ts` — import schemas, remove local schemas
6. `src/app/api/products/[id]/components/route.ts` — import schemas, remove local schemas
7. `src/app/api/overhead/route.ts` — import schemas, explicit select columns
8. `src/lib/settings/index.ts` — remove deprecated alias, update getSetting signature

## Verification

1. `npm run typecheck` — must pass with zero errors
2. `npm run lint` — must pass
3. Grep for local `z.object()` in modified route files — should find zero matches
4. Grep for `unit_cost` in `src/` — should find zero matches
5. Grep for `account_id` in `src/app/api/` — should only appear in migration files and `accounts/route.ts` (the `converty_account_id` FK, which is correct)
6. Grep for `SettingKey` in `src/` — should find zero matches
7. Grep for `select("*")` in `src/app/api/` — should find zero matches
