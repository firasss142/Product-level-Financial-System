-- ============================================================================
-- Migration 002: Row Level Security policies + settlement immutability
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------
ALTER TABLE settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE overhead_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_settlements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_cost_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_deals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns               ENABLE ROW LEVEL SECURITY;
ALTER TABLE damaged_returns         ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Standard tables: authenticated users get full CRUD
-- ---------------------------------------------------------------------------
CREATE POLICY "Authenticated full access" ON settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON overhead_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON investors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON daily_settlements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON product_cost_components
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON product_batches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON order_status_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON investment_deals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON damaged_returns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Settlements: INSERT + SELECT only (immutable — no UPDATE, no DELETE)
-- ---------------------------------------------------------------------------
CREATE POLICY "Authenticated read" ON settlements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert" ON settlements
  FOR INSERT TO authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Settlement immutability triggers (safety net for service_role access)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_settlement_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'settlements table is immutable — UPDATE and DELETE are not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_settlements
  BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION prevent_settlement_modification();

CREATE TRIGGER no_delete_settlements
  BEFORE DELETE ON settlements
  FOR EACH ROW EXECUTE FUNCTION prevent_settlement_modification();

CREATE TRIGGER no_truncate_settlements
  BEFORE TRUNCATE ON settlements
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_settlement_modification();

-- Defense-in-depth: revoke write privileges on settlements from API roles
REVOKE UPDATE, DELETE ON settlements FROM authenticated;
REVOKE UPDATE, DELETE ON settlements FROM anon;
