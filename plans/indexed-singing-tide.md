# Migration Plan: Architecture Revision — accounts→stores split + new order/product columns

## Context

The COD profitability system was built with a single `accounts` table (Converty credentials + niche config).
Discovery: Converty uses a REST API where one login owns multiple stores. One login → 6 stores (niches).
This requires splitting `accounts` into `converty_accounts` (credentials) + `stores` (one per niche).

Additionally, Converty API returns variant data that was not being captured. Cart quantity is always 1;
real unit count depends on the selected variant and must be stored for correct COGS calculation.

COGS tracking is also expanded: product_cost_components now needs `is_default` + `name` alias,
and products need `converty_product_id` and `variant_quantity_map`.

## Key observations from reading the codebase

### Existing schema discrepancies to carry forward carefully
- `product_cost_components` table: uses column `label` (not `name`) — TypeScript type also uses `label`
- `product_batches` table: DB column is `unit_cogs`, but `ProductBatch` TS type says `unit_cost` (mismatch)
- `product_cost_components` table: missing `is_default` column in DB schema (it's in the types + queries)
- `product_batches` table: missing `supplier` column in DB schema (present in types + queries)
- The new migration must ADD these missing columns too as part of the fix

### Files to NOT modify
- `supabase/migrations/20260330000001_schema.sql` — never touch existing migrations
- `supabase/migrations/20260330000002_rls.sql` — never touch existing migrations
- `supabase/migrations/20260330000003_seed.sql` — never touch existing migrations

---

## Step 1 — Database migration SQL

**File to create:** `supabase/migrations/20260331000001_architecture_v2.sql`

### 1a. Fix existing schema discrepancies (columns that types expect but DB is missing)

```sql
-- Fix product_cost_components: add is_default (types reference it, DB missing it)
ALTER TABLE product_cost_components ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Fix product_batches: add supplier (types reference it, DB missing it)
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS supplier text;

-- Note: product_batches.unit_cogs exists in DB; TypeScript type calls it unit_cost
-- We keep DB column as unit_cogs; the TS type will be corrected to match DB
```

### 1b. Create `converty_accounts` table

```sql
CREATE TABLE converty_accounts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text        NOT NULL,
  password_encrypted text        NOT NULL,
  auth_token         text,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_converty_accounts_updated_at
  BEFORE UPDATE ON converty_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE converty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON converty_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 1c. Create `stores` table

```sql
CREATE TABLE stores (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  converty_account_id  uuid        NOT NULL REFERENCES converty_accounts(id) ON DELETE RESTRICT,
  converty_store_id    text        NOT NULL,
  name                 text        NOT NULL,
  navex_account_id     text,
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stores_converty_store_id UNIQUE (converty_store_id)
);
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON stores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_stores_converty_account_id ON stores(converty_account_id);
```

### 1d. Migrate existing `accounts` data → converty_accounts + stores

```sql
-- Migrate: one converty_account per existing account (same uuid for FK continuity)
INSERT INTO converty_accounts (id, email, password_encrypted, is_active, created_at, updated_at)
SELECT
  id,
  COALESCE(credentials->>'email', name || '@placeholder.local'),
  COALESCE(credentials->>'password', ''),
  is_active,
  created_at,
  updated_at
FROM accounts;

-- Migrate: one store per existing account (account was already one niche)
-- Decision: use account UUID as fallback for converty_store_id when missing from credentials
INSERT INTO stores (converty_account_id, converty_store_id, name, is_active, created_at, updated_at)
SELECT
  id,
  COALESCE(credentials->>'store_id', id::text),  -- account UUID as placeholder if store_id missing
  name,
  is_active,
  created_at,
  updated_at
FROM accounts;
```

### 1e. Add `store_id` to products and orders, populate from account_id

```sql
-- Add store_id columns (nullable initially for migration)
ALTER TABLE products ADD COLUMN store_id uuid REFERENCES stores(id) ON DELETE RESTRICT;
ALTER TABLE orders   ADD COLUMN store_id uuid REFERENCES stores(id) ON DELETE RESTRICT;

-- Populate store_id: each old account.id == store.converty_account_id == stores.id (same uuid)
-- stores were inserted with converty_account_id = accounts.id, so we join through converty_accounts
UPDATE products p
SET store_id = s.id
FROM stores s
WHERE s.converty_account_id = p.account_id;

UPDATE orders o
SET store_id = s.id
FROM stores s
WHERE s.converty_account_id = o.account_id;

-- Make products.store_id NOT NULL now that it's populated
ALTER TABLE products ALTER COLUMN store_id SET NOT NULL;
-- orders.store_id: keep nullable (decision: keep account_id too for safety)

-- Drop account_id from products only (store_id is the new canonical FK)
ALTER TABLE products DROP COLUMN account_id;
-- orders.account_id: KEPT — will be dropped in a future migration after sync verification
```

### 1f. Update UNIQUE constraint on orders

```sql
-- Drop old unique constraint (account_id, reference)
ALTER TABLE orders DROP CONSTRAINT uq_orders_account_reference;
-- Add new unique constraint using store_id (store_id can be NULL for unmigrated rows, so partial)
ALTER TABLE orders ADD CONSTRAINT uq_orders_store_reference
  UNIQUE NULLS NOT DISTINCT (store_id, reference);
```

### 1g. Keep `accounts` table as `accounts_legacy` (safe rename, no data loss)

```sql
ALTER TABLE accounts RENAME TO accounts_legacy;
```

### 1h. Add new columns to orders

```sql
ALTER TABLE orders ADD COLUMN converty_order_id      text;
ALTER TABLE orders ADD COLUMN selected_variant_id    text;
ALTER TABLE orders ADD COLUMN selected_variant_sku   text;
ALTER TABLE orders ADD COLUMN variant_unit_count     integer NOT NULL DEFAULT 1;
```

### 1i. Add new columns to products

```sql
ALTER TABLE products ADD COLUMN converty_product_id    text;
ALTER TABLE products ADD COLUMN variant_quantity_map   jsonb NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN active_batch_id        uuid REFERENCES product_batches(id);
```

### 1j. New indexes

```sql
CREATE INDEX idx_orders_store_id   ON orders(store_id);
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_stores_is_active  ON stores(converty_account_id) WHERE is_active = true;
```

---

## Step 2 — TypeScript types

### Files to modify:

**`src/types/product.ts`** — Add:
- `VariantQuantityMap = Record<string, number>`
- Update `ProductWithCosts`: replace `account_id` → `store_id`, add `converty_product_id`, `variant_quantity_map`, `active_batch_id`
- Update `ProductSummary`: replace `account_id`/`account_name` → `store_id`/`store_name`
- Fix `ProductBatch`: rename `unit_cost` → `unit_cogs` to match DB column

**`src/types/orders.ts`** — Update `OrderRow`:
- Replace `account_id` → `store_id`
- Add `converty_order_id`, `selected_variant_id`, `selected_variant_sku`, `variant_unit_count`

**New file: `src/types/sync.ts`** — Add Converty API types:
```typescript
export interface ConvertyAccount { id, email, is_active, created_at, updated_at }
export interface Store { id, converty_account_id, converty_store_id, name, navex_account_id, is_active, ... }
export interface ConvertySyncOrder { _id, reference, status, totalPrice, cart: CartItem[], ... }
export interface ConvertySyncCartItem { quantity, selectedVariantsId, ... }
export interface ConvertySyncAuthResponse { token: string }
```

**`src/types/investor.ts`** — Update `InvestmentDeal`: scope_type `"account"` → keep for now (scope points to store)

---

## Step 3 — Supabase query helpers

**`src/lib/supabase/queries.ts`** — Update:
- `queryActiveProducts()`: join `stores(name)` instead of `accounts(name)`, return `store_id`/`store_name`
- `queryProductWithCosts()`: select `store_id` instead of `account_id`; fix `unit_cost` → `unit_cogs` in batch mapping
- `queryOrdersForPeriod()`: select `store_id` instead of `account_id`; add optional `storeId` filter param; add new columns

---

## Step 4 — Zod schemas

**`src/lib/supabase/schemas.ts`** — Update:
- Remove `AccountCreateSchema` / `AccountUpdateSchema`
- Add `ConvertyAccountCreateSchema`: `{ email, password_encrypted, auth_token? }`
- Add `ConvertyAccountUpdateSchema`: `{ id, auth_token?, is_active? }`
- Add `StoreCreateSchema`: `{ converty_account_id, converty_store_id, name, navex_account_id? }`
- Add `StoreUpdateSchema`: `{ id, name?, navex_account_id?, is_active? }`
- Update `ProductCreateSchema`: `account_id` → `store_id`
- Update `ProductUpdateSchema`: `account_id?` → `store_id?`
- Update `OrdersQuerySchema`: `account_id?` → `store_id?`

---

## Step 5 — Calculation engine

**`src/lib/calculations/queries.ts`** — Update:
- `fetchProductOrders` / `fetchAllOrders`: select `store_id` instead of `account_id`; add `variant_unit_count`
- `aggregateProductOrders()`: replace `extractCartQuantity(order.cart)` with `order.variant_unit_count ?? 1`
  - This is Change 5: `totalDeliveredCartQuantity` now sums `variant_unit_count` not cart data
  - `extractCartQuantity` still exists in cost-engine.ts but no longer called from aggregation
  - Update `OrderRow` reference in aggregation to use `variant_unit_count`

**`src/lib/calculations/cost-engine.ts`** — `extractCartQuantity` kept for backwards compat but no longer used in main path

---

## Step 6 — API routes

**`src/app/api/accounts/route.ts`** — Replace entirely:
- Rename to serve `/api/accounts` → returns `converty_accounts` joined with `stores`
  - GET: returns `{ id, email, is_active, stores: [{id, name, converty_store_id, is_active, ...}] }`
  - POST: creates a `converty_accounts` row
  - PATCH: updates a `converty_accounts` row (auth_token, is_active)

**New: `src/app/api/stores/route.ts`**
  - GET: list stores (optionally filtered by converty_account_id)
  - POST: create store under a converty_account
  - PATCH: update store (name, navex_account_id, is_active)

**`src/app/api/products/route.ts`** — Update:
- `account_id` → `store_id` throughout
- Join `stores(name)` instead of `accounts(name)`
- Return `store_id`, `store_name`

**`src/app/api/orders/route.ts`** — Update:
- `account_id` filter → `store_id`
- Join `stores(name)` instead of `accounts(name)`
- Return `store_id`, `store_name` (keep `account_name` as `store_name` in response for backwards compat with UI)

---

## Step 7 — UI pages

**`src/app/(admin)/accounts/page.tsx`** — Full rewrite:
- Two-level hierarchy:
  - Top level: Comptes Converty (email, masked password, Tester la connexion, is_active)
  - Nested: Boutiques (name, converty_store_id, is_active, Dernière synchronisation: —)
- French labels: "Comptes Converty", "Boutiques", "Dernière synchronisation", "Tester la connexion"
- Modal to add converty account (email + password)
- Modal to add/edit store under an account

**`src/app/(admin)/products/[id]/page.tsx`** — Update:
- `InfoSection`: "Boutique" instead of "Compte"; `store_id` instead of `account_id`
- Add `VariantMapSection` at the bottom (new section):
  - "Correspondance variantes" heading
  - Editable table: Variante ID | Quantité d'unités
  - Add/remove rows
  - Save → PATCH `/api/products` with `variant_quantity_map`
- Fix `Batch.unit_cost` → `Batch.unit_cogs` in local types

**`src/app/(admin)/products/new/page.tsx`** — Update:
- Load stores from `/api/stores` instead of accounts
- Label "Boutique" instead of "Compte"
- Post `store_id` instead of `account_id`

**`src/app/(admin)/products/page.tsx`** — Update:
- Column label "Boutique" instead of "Compte"
- `account_name` → `store_name` in data

**`src/app/(admin)/orders/page.tsx`** — Update:
- Filter dropdown label "Boutique" instead of "Compte"
- Load stores from `/api/stores` instead of `/api/accounts`
- Pass `store_id` filter instead of `account_id`

---

## Step 8 — Typecheck

Run `npm run typecheck` after all files are edited. Fix all errors.

---

## Critical rules preserved throughout

- Calculation engine STILL reads `products.unit_cogs` only — never components/batches
- Revenue = `total_price` only
- Navex costs begin at deposit
- `variant_unit_count` replaces `extractCartQuantity()` in the aggregation pass
- All UI strings in French
- Soft deletes: `is_active` on `converty_accounts`, `stores`
- `accounts_legacy` table preserved (not dropped) for safety

---

## Files affected (summary)

| File | Action |
|------|--------|
| `supabase/migrations/20260331000001_architecture_v2.sql` | CREATE (new migration) |
| `src/types/product.ts` | MODIFY |
| `src/types/orders.ts` | MODIFY |
| `src/types/sync.ts` | CREATE |
| `src/lib/supabase/queries.ts` | MODIFY |
| `src/lib/supabase/schemas.ts` | MODIFY |
| `src/lib/calculations/queries.ts` | MODIFY |
| `src/app/api/accounts/route.ts` | MODIFY (serve converty_accounts) |
| `src/app/api/stores/route.ts` | CREATE |
| `src/app/api/products/route.ts` | MODIFY |
| `src/app/api/orders/route.ts` | MODIFY |
| `src/app/(admin)/accounts/page.tsx` | MODIFY (2-level hierarchy) |
| `src/app/(admin)/products/[id]/page.tsx` | MODIFY (store_id + VariantMapSection) |
| `src/app/(admin)/products/new/page.tsx` | MODIFY (store_id) |
| `src/app/(admin)/products/page.tsx` | MODIFY (store_name) |
| `src/app/(admin)/orders/page.tsx` | MODIFY (store filter) |

---

## Verification

1. `npm run typecheck` — must pass with 0 errors
2. `npm run lint` — must pass
3. Manually check: `/accounts` page renders two-level hierarchy
4. Manually check: `/products/new` shows "Boutique" selector from `/api/stores`
5. Manually check: `/products/[id]` shows variant map section
6. Confirm COGS formula path: `aggregateProductOrders` uses `variant_unit_count`, fed into `computeContributionMargin` → `totalCogs = unitCogs × totalDeliveredCartQuantity` (where quantity now = sum of variant_unit_count)
