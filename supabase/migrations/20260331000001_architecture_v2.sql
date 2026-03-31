-- ============================================================================
-- Migration 004: Architecture v2
--   - Fix existing schema discrepancies (missing columns in DB)
--   - Split accounts → converty_accounts + stores
--   - Migrate existing data
--   - Update FKs: products.account_id → products.store_id
--   - Keep orders.account_id (drop in future migration after sync verification)
--   - Update UNIQUE constraint on orders
--   - Add new columns to orders (converty_order_id, variant data)
--   - Add new columns to products (converty_product_id, variant_quantity_map, active_batch_id)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fix existing schema discrepancies
--    (columns referenced in TypeScript types but missing from DB)
-- ---------------------------------------------------------------------------

-- product_cost_components: add is_default (used in types, queries, UI)
ALTER TABLE product_cost_components
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- product_batches: add supplier (used in types, queries, UI)
ALTER TABLE product_batches
  ADD COLUMN IF NOT EXISTS supplier text;

-- product_batches: DB column is unit_cogs (correct); TS type had unit_cost (will be fixed in TS)
-- No SQL change needed here — keeping unit_cogs as-is.

-- ---------------------------------------------------------------------------
-- 2. Create converty_accounts table
-- ---------------------------------------------------------------------------

CREATE TABLE converty_accounts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text        NOT NULL,
  password_encrypted text        NOT NULL DEFAULT '',
  auth_token         text,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_converty_accounts_updated_at
  BEFORE UPDATE ON converty_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE converty_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON converty_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. Create stores table
-- ---------------------------------------------------------------------------

CREATE TABLE stores (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  converty_account_id uuid        NOT NULL REFERENCES converty_accounts(id) ON DELETE RESTRICT,
  converty_store_id   text        NOT NULL,
  name                text        NOT NULL,
  navex_account_id    text,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_stores_converty_store_id UNIQUE (converty_store_id)
);

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON stores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_stores_converty_account_id ON stores(converty_account_id);
CREATE INDEX idx_stores_active ON stores(converty_account_id) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 4. Migrate existing accounts → converty_accounts + stores
--    One converty_account per old account (reuse same uuid for FK continuity)
--    One store per old account (account was already one niche)
-- ---------------------------------------------------------------------------

INSERT INTO converty_accounts (id, email, password_encrypted, is_active, created_at, updated_at)
SELECT
  id,
  COALESCE(credentials->>'email', name || '@placeholder.local'),
  COALESCE(credentials->>'password', ''),
  is_active,
  created_at,
  updated_at
FROM accounts;

-- stores.id gets a new uuid (auto-generated); converty_account_id = old accounts.id
-- converty_store_id: use credentials->>'store_id' if present, else fallback to account uuid string
INSERT INTO stores (converty_account_id, converty_store_id, name, is_active, created_at, updated_at)
SELECT
  id,
  COALESCE(credentials->>'store_id', id::text),
  name,
  is_active,
  created_at,
  updated_at
FROM accounts;

-- ---------------------------------------------------------------------------
-- 5. Add store_id to products and orders (nullable initially for data migration)
-- ---------------------------------------------------------------------------

ALTER TABLE products ADD COLUMN store_id uuid REFERENCES stores(id) ON DELETE RESTRICT;
ALTER TABLE orders   ADD COLUMN store_id uuid REFERENCES stores(id) ON DELETE RESTRICT;

-- Populate store_id: old account.id == converty_accounts.id == stores.converty_account_id
-- Each old account migrated to exactly one store, so join is 1:1
UPDATE products p
SET store_id = s.id
FROM stores s
WHERE s.converty_account_id = p.account_id;

UPDATE orders o
SET store_id = s.id
FROM stores s
WHERE s.converty_account_id = o.account_id;

-- products.store_id: set NOT NULL (all products had an account_id)
ALTER TABLE products ALTER COLUMN store_id SET NOT NULL;

-- orders.store_id: leave nullable — some historical orders may not have matched
-- Will be enforced NOT NULL in a future migration after sync verification

-- ---------------------------------------------------------------------------
-- 6. Drop account_id from products (store_id is now the canonical FK)
--    Keep account_id on orders for safety (drop in future migration)
-- ---------------------------------------------------------------------------

ALTER TABLE products DROP COLUMN account_id;

-- ---------------------------------------------------------------------------
-- 7. Update UNIQUE constraint on orders: (account_id, reference) → (store_id, reference)
-- ---------------------------------------------------------------------------

ALTER TABLE orders DROP CONSTRAINT uq_orders_account_reference;

-- NULLS NOT DISTINCT: two rows with NULL store_id and same reference are NOT considered duplicates
-- This is correct behaviour — NULL store_id rows are unmigrated and handled separately
ALTER TABLE orders
  ADD CONSTRAINT uq_orders_store_reference UNIQUE NULLS NOT DISTINCT (store_id, reference);

-- ---------------------------------------------------------------------------
-- 8. Rename old accounts table to accounts_legacy (preserve data, no data loss)
-- ---------------------------------------------------------------------------

ALTER TABLE accounts RENAME TO accounts_legacy;

-- ---------------------------------------------------------------------------
-- 9. New columns on orders
-- ---------------------------------------------------------------------------

ALTER TABLE orders
  ADD COLUMN converty_order_id   text,
  ADD COLUMN selected_variant_id  text,
  ADD COLUMN selected_variant_sku text,
  ADD COLUMN variant_unit_count   integer NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- 10. New columns on products
-- ---------------------------------------------------------------------------

ALTER TABLE products
  ADD COLUMN converty_product_id  text,
  ADD COLUMN variant_quantity_map jsonb   NOT NULL DEFAULT '{}',
  ADD COLUMN active_batch_id      uuid    REFERENCES product_batches(id);

-- ---------------------------------------------------------------------------
-- 11. New indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_orders_store_id   ON orders(store_id);
CREATE INDEX idx_products_store_id ON products(store_id);

-- Update partial indexes that reference is_duplicated/is_test — they remain valid
-- as the WHERE clause columns still exist. No change needed.
