# Supabase Database Schema — Migration Plan

## Context

The project has comprehensive business docs but zero database infrastructure. This plan creates the complete Supabase schema as migration SQL files — 14 tables covering orders, products, cost tracking, investor settlements, and daily reconciliation. No API routes or application code.

## Prerequisites

Run `supabase init` to scaffold the `supabase/` directory before applying migrations.

## Migration Files (3 files)

### File 1: `supabase/migrations/20260330000001_schema.sql`

**Utility function** — reusable `updated_at` trigger:
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
```

**Tables in dependency order:**

| # | Table | Key columns | Notes |
|---|-------|-------------|-------|
| 1 | `settings` | key (text UNIQUE), value (numeric(12,3)), description | No FKs |
| 2 | `overhead_categories` | label, monthly_amount (numeric(12,3)), sort_order | No FKs |
| 3 | `investors` | name, email, phone, is_active | No FKs |
| 4 | `daily_settlements` | date (UNIQUE), expected_amount, actual_amount, difference | No FKs |
| 5 | `accounts` | name, platform (default 'converty'), credentials (jsonb), is_active | No FKs |
| 6 | `products` | account_id → accounts, name, unit_cogs (numeric(12,3)), is_active | FK to accounts |
| 7 | `product_cost_components` | product_id → products, label, amount, sort_order | FK to products |
| 8 | `product_batches` | product_id → products, batch_number, quantity, unit_cogs, cost_breakdown (jsonb) | Append-only |
| 9 | `orders` | account_id → accounts, product_id → products, reference, total_price, status (text), cart (jsonb), is_duplicated, is_exchange, is_test | UNIQUE(account_id, reference) |
| 10 | `order_status_history` | order_id → orders, status, changed_at (timestamptz) | Append-only |
| 11 | `investment_deals` | investor_id → investors, scope_type CHECK('product','account','business'), scope_id (nullable uuid), capital_amount, profit_share_rate, loss_share_rate, is_active | Polymorphic FK |
| 12 | `settlements` | deal_id → investment_deals, period_start, period_end, snapshot (jsonb), totals | **Immutable** — no updated_at |
| 13 | `campaigns` | product_id → products, platform, campaign_name, campaign_id, spend, leads, period_start/end | Ad tracking |
| 14 | `damaged_returns` | product_id → products, period_start, period_end, count | Simple counter |

**Design decisions:**
- All monetary columns: `numeric(12,3)` (max 999,999,999.999 — sufficient for TND)
- `status` is `text` not enum (statuses evolve)
- `orders.product_id` nullable (may not be mapped immediately during sync)
- No `refunded` column (CLAUDE.md: "refunded API field is broken — ignore it")
- `investment_deals.scope_id` is polymorphic (no DB-level FK — enforced via CHECK + app logic)

**Indexes:**
```
orders(account_id), orders(product_id), orders(status), orders(created_at),
orders(is_duplicated), orders(is_exchange), orders(is_test),
orders(converty_created_at),
order_status_history(order_id, changed_at),
campaigns(product_id), investment_deals(investor_id), settlements(deal_id),
product_cost_components(product_id), product_batches(product_id),
damaged_returns(product_id)
```

**`updated_at` triggers** on: accounts, products, product_cost_components, orders, settings, overhead_categories, investors, investment_deals, daily_settlements, campaigns.

NOT on append-only tables: settlements, order_status_history, product_batches, damaged_returns.

---

### File 2: `supabase/migrations/20260330000002_rls.sql`

**All 14 tables:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

**Standard tables (12):** Full CRUD for `authenticated` role:
```sql
CREATE POLICY "Authenticated full access" ON <table> FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

**Settlements table (immutable):** INSERT + SELECT only:
```sql
CREATE POLICY "Authenticated read" ON settlements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON settlements FOR INSERT TO authenticated WITH CHECK (true);
```

**Immutability safety triggers** on settlements (prevents bypass via service_role):
```sql
BEFORE UPDATE → RAISE EXCEPTION
BEFORE DELETE → RAISE EXCEPTION
```

---

### File 3: `supabase/migrations/20260330000003_seed.sql`

**Settings** (5 rows):
| key | value | description (French) |
|-----|-------|------|
| navex_delivery_fee | 6.000 | Frais de livraison Navex par colis livré |
| navex_return_fee | 4.000 | Frais de retour Navex par colis retourné |
| navex_daily_pickup_fee | 4.000 | Frais journaliers de ramassage Navex |
| converty_platform_fee_rate | 0.003 | Taux de commission Converty (0.3%) |
| packing_cost | 2.000 | Coût d'emballage par colis |

**Overhead categories** (4 rows): Salaires agents, Loyer, Téléphone / Internet, Abonnements outils — all 0.

**Test data** (chained via CTE):
- Account: "Test Account" (converty)
- Product: "Rouleau Magique" (unit_cogs=10.000)
- 3 cost components: Prix d'achat (6.00) + Douane (2.50) + Main d'œuvre (1.50) = 10.00
- 1 batch: LOT-2026-01, qty 100, cost_breakdown jsonb snapshot

---

## Verification

1. `supabase init` → scaffold directory
2. Apply migrations via Supabase MCP: `apply_migration` for each file
3. `list_tables` → verify all 14 tables exist
4. `execute_sql` → `SELECT * FROM settings` → verify 5 seed rows
5. `execute_sql` → `SELECT p.name, p.unit_cogs, a.name FROM products p JOIN accounts a ON a.id = p.account_id` → verify test product
6. `execute_sql` → `SELECT * FROM product_cost_components` → verify 3 components summing to 10.00
7. `execute_sql` → `SELECT * FROM product_batches` → verify batch with cost_breakdown jsonb
8. `execute_sql` → attempt `UPDATE settlements SET snapshot = '{}' WHERE id = gen_random_uuid()` → should fail (immutability trigger)
9. `npm run typecheck` after generating types
