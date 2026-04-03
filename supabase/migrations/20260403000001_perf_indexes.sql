-- Performance indexes identified in audit 2026-04-03
-- Covers account_id FK lookups and the boolean filters used on nearly every
-- profitability query, plus settlements capital-return column.

-- 1. Orders filtered by account + is_duplicated/is_test (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_orders_account_id_active
  ON orders(account_id)
  WHERE is_duplicated = false AND is_test = false;

-- 2. Sparse index for quickly finding flagged/duplicate orders
CREATE INDEX IF NOT EXISTS idx_orders_is_duplicated
  ON orders(is_duplicated)
  WHERE is_duplicated = true;

-- 3. Composite index covering the store_id + date range used by fetchOrdersByStoreIds
CREATE INDEX IF NOT EXISTS idx_orders_store_id_date
  ON orders(store_id, converty_created_at)
  WHERE is_duplicated = false AND is_test = false;

-- 4. Settlements: capital_return_this_period per deal (waterfall queries)
CREATE INDEX IF NOT EXISTS idx_settlements_capital_return
  ON settlements(deal_id, capital_return_this_period)
  WHERE capital_return_this_period > 0;
