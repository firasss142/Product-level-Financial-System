-- ============================================================================
-- Migration 003: Seed data — settings, overhead, test account/product/batch
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Settings (5 configurable cost variables)
-- ---------------------------------------------------------------------------
INSERT INTO settings (key, value, description) VALUES
  ('navex_delivery_fee',          6.000, 'Frais de livraison Navex par colis livré'),
  ('navex_return_fee',            4.000, 'Frais de retour Navex par colis retourné'),
  ('navex_daily_pickup_fee',      4.000, 'Frais journaliers de ramassage Navex'),
  ('converty_platform_fee_rate',  0.003, 'Taux de commission Converty (0.3%)'),
  ('packing_cost',                2.000, 'Coût d''emballage par colis');

-- ---------------------------------------------------------------------------
-- Overhead categories (4 monthly fixed cost lines)
-- ---------------------------------------------------------------------------
INSERT INTO overhead_categories (label, monthly_amount, sort_order) VALUES
  ('Salaires agents',          0, 1),
  ('Loyer',                    0, 2),
  ('Téléphone / Internet',     0, 3),
  ('Abonnements outils',       0, 4);

-- ---------------------------------------------------------------------------
-- Test account → product → cost components → batch
-- ---------------------------------------------------------------------------
WITH new_account AS (
  INSERT INTO accounts (name, platform, is_active)
  VALUES ('Test Account', 'converty', true)
  RETURNING id
),
new_product AS (
  INSERT INTO products (account_id, name, unit_cogs, is_active)
  SELECT id, 'Rouleau Magique', 10.000, true
  FROM new_account
  RETURNING id
),
comp1 AS (
  INSERT INTO product_cost_components (product_id, label, amount, sort_order)
  SELECT id, 'Prix d''achat fournisseur', 6.000, 1
  FROM new_product
),
comp2 AS (
  INSERT INTO product_cost_components (product_id, label, amount, sort_order)
  SELECT id, 'Frais de douane / import', 2.500, 2
  FROM new_product
),
comp3 AS (
  INSERT INTO product_cost_components (product_id, label, amount, sort_order)
  SELECT id, 'Main d''œuvre / assemblage', 1.500, 3
  FROM new_product
)
INSERT INTO product_batches (product_id, batch_number, quantity, unit_cogs, cost_breakdown)
SELECT
  id,
  'LOT-2026-01',
  100,
  10.000,
  '[
    {"label": "Prix d''achat fournisseur", "amount": 6.00},
    {"label": "Frais de douane / import", "amount": 2.50},
    {"label": "Main d''œuvre / assemblage", "amount": 1.50}
  ]'::jsonb
FROM new_product;
