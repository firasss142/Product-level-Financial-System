-- ============================================================================
-- Migration 001: Schema — tables, constraints, indexes, updated_at triggers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Utility: auto-update updated_at on row modification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. settings — configurable cost variables (fees, rates)
-- ---------------------------------------------------------------------------
CREATE TABLE settings (
  id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text            NOT NULL UNIQUE,
  value       numeric(12,3)   NOT NULL,
  description text,
  updated_at  timestamptz     NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. overhead_categories — monthly fixed costs
-- ---------------------------------------------------------------------------
CREATE TABLE overhead_categories (
  id             uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  label          text            NOT NULL,
  monthly_amount numeric(12,3)   NOT NULL DEFAULT 0,
  sort_order     integer         NOT NULL DEFAULT 0,
  created_at     timestamptz     NOT NULL DEFAULT now(),
  updated_at     timestamptz     NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_overhead_categories_updated_at
  BEFORE UPDATE ON overhead_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 3. investors — investor profiles
-- ---------------------------------------------------------------------------
CREATE TABLE investors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  email      text,
  phone      text,
  notes      text,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_investors_updated_at
  BEFORE UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. daily_settlements — Navex cash reconciliation
-- ---------------------------------------------------------------------------
CREATE TABLE daily_settlements (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date            NOT NULL UNIQUE,
  expected_amount numeric(12,3),
  actual_amount   numeric(12,3),
  difference      numeric(12,3),
  notes           text,
  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_daily_settlements_updated_at
  BEFORE UPDATE ON daily_settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 5. accounts — Converty account credentials and config
-- ---------------------------------------------------------------------------
CREATE TABLE accounts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  platform    text        NOT NULL DEFAULT 'converty',
  credentials jsonb,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 6. products — product catalog with COGS
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id         uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid            REFERENCES accounts(id) ON DELETE RESTRICT,
  name       text            NOT NULL,
  unit_cogs  numeric(12,3)   NOT NULL DEFAULT 0,
  is_active  boolean         NOT NULL DEFAULT true,
  created_at timestamptz     NOT NULL DEFAULT now(),
  updated_at timestamptz     NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 7. product_cost_components — current cost breakdown per product
-- ---------------------------------------------------------------------------
CREATE TABLE product_cost_components (
  id         uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid            NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label      text            NOT NULL,
  amount     numeric(12,3)   NOT NULL DEFAULT 0,
  sort_order integer         NOT NULL DEFAULT 0,
  created_at timestamptz     NOT NULL DEFAULT now(),
  updated_at timestamptz     NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_product_cost_components_updated_at
  BEFORE UPDATE ON product_cost_components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 8. product_batches — historical cost snapshots per batch (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE product_batches (
  id             uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid            NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number   text            NOT NULL,
  quantity       integer         NOT NULL CHECK (quantity > 0),
  unit_cogs      numeric(12,3)   NOT NULL,
  cost_breakdown jsonb           NOT NULL,
  notes          text,
  created_at     timestamptz     NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 9. orders — all synced orders (source of truth for financials)
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id                 uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         uuid            NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  product_id         uuid            REFERENCES products(id) ON DELETE RESTRICT,
  reference          text            NOT NULL,
  customer_name      text,
  customer_phone     text,
  customer_address   text,
  customer_city      text,
  governorate        text,
  total_price        numeric(12,3),
  delivery_price     numeric(12,3),
  delivery_cost      numeric(12,3),
  status             text            NOT NULL DEFAULT 'pending',
  barcode            text,
  delivery_company   text,
  is_duplicated      boolean         NOT NULL DEFAULT false,
  is_exchange        boolean         NOT NULL DEFAULT false,
  is_test            boolean         NOT NULL DEFAULT false,
  cart               jsonb,
  notes              text,
  converty_created_at timestamptz,
  converty_updated_at timestamptz,
  created_at         timestamptz     NOT NULL DEFAULT now(),
  updated_at         timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT uq_orders_account_reference UNIQUE (account_id, reference)
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 10. order_status_history — complete status timeline per order (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE order_status_history (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     text        NOT NULL,
  changed_at timestamptz NOT NULL,
  raw_data   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 11. investment_deals — deal configurations per investor
-- ---------------------------------------------------------------------------
CREATE TABLE investment_deals (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id      uuid            NOT NULL REFERENCES investors(id) ON DELETE RESTRICT,
  scope_type       text            NOT NULL,
  scope_id         uuid,
  capital_amount   numeric(12,3)   NOT NULL DEFAULT 0,
  profit_share_rate numeric(5,4)   NOT NULL,
  loss_share_rate  numeric(5,4)    NOT NULL,
  start_date       date            NOT NULL,
  end_date         date,
  is_active        boolean         NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT chk_deals_scope_type
    CHECK (scope_type IN ('product', 'account', 'business')),
  CONSTRAINT chk_deals_scope_id
    CHECK (
      (scope_type = 'business' AND scope_id IS NULL)
      OR (scope_type IN ('product', 'account') AND scope_id IS NOT NULL)
    ),
  CONSTRAINT chk_deals_profit_share CHECK (profit_share_rate >= 0 AND profit_share_rate <= 1),
  CONSTRAINT chk_deals_loss_share CHECK (loss_share_rate >= 0 AND loss_share_rate <= 1),
  CONSTRAINT chk_deals_capital_positive CHECK (capital_amount >= 0)
);

CREATE TRIGGER trg_investment_deals_updated_at
  BEFORE UPDATE ON investment_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 12. settlements — immutable settlement snapshots (no updated_at)
-- ---------------------------------------------------------------------------
CREATE TABLE settlements (
  id             uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        uuid            NOT NULL REFERENCES investment_deals(id) ON DELETE RESTRICT,
  period_start   date            NOT NULL,
  period_end     date            NOT NULL,
  snapshot       jsonb           NOT NULL,
  total_revenue  numeric(12,3),
  total_costs    numeric(12,3),
  net_profit     numeric(12,3),
  investor_share numeric(12,3),
  created_at     timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT chk_settlements_period CHECK (period_end >= period_start)
);

-- ---------------------------------------------------------------------------
-- 13. campaigns — ad campaign → product mappings
-- ---------------------------------------------------------------------------
CREATE TABLE campaigns (
  id            uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid            NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  platform      text            NOT NULL,
  campaign_name text,
  campaign_id   text,
  spend         numeric(12,3)   NOT NULL DEFAULT 0,
  leads         integer         NOT NULL DEFAULT 0,
  impressions   integer         NOT NULL DEFAULT 0,
  clicks        integer         NOT NULL DEFAULT 0,
  period_start  date            NOT NULL,
  period_end    date            NOT NULL,
  created_at    timestamptz     NOT NULL DEFAULT now(),
  updated_at    timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT chk_campaigns_period CHECK (period_end >= period_start),
  CONSTRAINT chk_campaigns_non_negative CHECK (spend >= 0 AND leads >= 0 AND impressions >= 0 AND clicks >= 0)
);

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 14. damaged_returns — simple counter per product per period
-- ---------------------------------------------------------------------------
CREATE TABLE damaged_returns (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  period_start date        NOT NULL,
  period_end   date        NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_damaged_returns_period CHECK (period_end >= period_start),
  CONSTRAINT chk_damaged_returns_count CHECK (count >= 0)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- orders: composite partial index for profitability queries (per product, by status + date)
CREATE INDEX idx_orders_product_status_date
  ON orders (product_id, status, converty_created_at)
  WHERE is_duplicated = false AND is_test = false;

-- orders: date-range scans for dashboard / daily settlement views
CREATE INDEX idx_orders_date_status
  ON orders (converty_created_at, status)
  WHERE is_duplicated = false AND is_test = false;

-- orders: DB insertion time (sync operations)
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- orders: exchange flag (low volume, partial index on true only)
CREATE INDEX idx_orders_exchange ON orders(id) WHERE is_exchange = true;

-- order_status_history
CREATE INDEX idx_osh_order_changed ON order_status_history(order_id, changed_at);

-- products
CREATE INDEX idx_products_account_id ON products(account_id);

-- product sub-tables
CREATE INDEX idx_product_cost_components_product ON product_cost_components(product_id);
CREATE INDEX idx_product_batches_product         ON product_batches(product_id);

-- campaigns: product + period range for ad spend lookups
CREATE INDEX idx_campaigns_product_period ON campaigns(product_id, period_start, period_end);

-- investment_deals
CREATE INDEX idx_investment_deals_investor_id ON investment_deals(investor_id);
CREATE INDEX idx_deals_scope ON investment_deals(scope_type, scope_id) WHERE is_active = true;

-- settlements: deal + period for investor reports
CREATE INDEX idx_settlements_deal_period ON settlements(deal_id, period_start, period_end);

-- damaged_returns
CREATE INDEX idx_damaged_returns_product_id ON damaged_returns(product_id);
