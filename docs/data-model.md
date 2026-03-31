# Data Model Reference

Schema lives in `supabase/migrations/`. Updated after each schema change.

## Tables

### settings
Configurable cost variables. ALL financial calculations read from here — zero hardcoded values.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| key | text UNIQUE NOT NULL | Lookup key |
| value | numeric(12,3) NOT NULL | |
| description | text | |
| updated_at | timestamptz | Auto-updated |

Seeded keys: `navex_delivery_fee`, `navex_return_fee`, `navex_daily_pickup_fee`, `converty_platform_fee_rate`, `packing_cost`

---

### overhead_categories
Monthly fixed costs (Layer 2 net profit calculation).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| label | text NOT NULL | French label |
| monthly_amount | numeric(12,3) | Default 0 |
| sort_order | integer | Display ordering |
| created_at / updated_at | timestamptz | |

---

### accounts
Converty account credentials. Each account = one product niche/line.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| platform | text NOT NULL | Default 'converty' |
| credentials | jsonb | Encrypted scraping credentials |
| is_active | boolean | Soft delete |
| created_at / updated_at | timestamptz | |

---

### products
Product catalog. `unit_cogs` is the **sole source of truth** for all calculations.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts | ON DELETE RESTRICT |
| name | text NOT NULL | |
| unit_cogs | numeric(12,3) | Updated when new batch is created |
| is_active | boolean | Soft delete |
| created_at / updated_at | timestamptz | |

---

### product_cost_components
Current COGS breakdown per product. Display/editing only — calculation engine reads `products.unit_cogs`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products | ON DELETE CASCADE |
| label | text NOT NULL | French label |
| amount | numeric(12,3) | |
| sort_order | integer | |
| created_at / updated_at | timestamptz | |

---

### product_batches
Historical cost snapshots per batch. Append-only.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products | ON DELETE CASCADE |
| batch_number | text NOT NULL | e.g. LOT-2026-01 |
| quantity | integer NOT NULL | CHECK > 0 |
| unit_cogs | numeric(12,3) NOT NULL | Snapshot at batch creation |
| cost_breakdown | jsonb NOT NULL | Array of {label, amount} |
| notes | text | |
| created_at | timestamptz | No updated_at — append-only |

---

### orders
All synced orders. Source of truth for all financials. Deduplicated by `(account_id, reference)`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts | ON DELETE RESTRICT, NOT NULL |
| product_id | uuid FK → products | ON DELETE RESTRICT, nullable |
| reference | text NOT NULL | Converty order reference |
| customer_name / phone / address / city | text | |
| governorate | text | |
| total_price | numeric(12,3) | **Revenue field** — only trustworthy amount |
| delivery_price | numeric(12,3) | Stored but NEVER used in calculations |
| delivery_cost | numeric(12,3) | Stored but NEVER used in calculations |
| status | text NOT NULL | Plain text (not enum) — statuses evolve |
| barcode | text | Navex barcode |
| delivery_company | text | |
| is_duplicated | boolean NOT NULL | Exclude from ALL calculations when true |
| is_exchange | boolean NOT NULL | Extra delivery cost, no additional revenue |
| is_test | boolean NOT NULL | Exclude entirely when true |
| cart | jsonb | Raw cart data (variants + quantities) |
| notes | text | |
| converty_created_at | timestamptz | Original order date from Converty |
| converty_updated_at | timestamptz | Last Converty update |
| created_at / updated_at | timestamptz | |

**Unique constraint:** `(account_id, reference)` — deduplication key on sync

---

### order_status_history
Complete status timeline per order. Append-only.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK → orders | ON DELETE CASCADE |
| status | text NOT NULL | |
| changed_at | timestamptz NOT NULL | When the status changed in Converty |
| raw_data | jsonb | Raw payload from Converty |
| created_at | timestamptz | When synced into DB |

---

### investors
Investor profiles.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| email / phone / notes | text | |
| is_active | boolean | Soft delete |
| created_at / updated_at | timestamptz | |

---

### investment_deals
Deal configuration per investor. Scope can be a product, account, or the whole business.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| investor_id | uuid FK → investors | ON DELETE RESTRICT |
| scope_type | text NOT NULL | CHECK IN ('product', 'account', 'business') |
| scope_id | uuid | NULL when scope_type = 'business' |
| capital_amount | numeric(12,3) | CHECK >= 0 |
| profit_share_rate | numeric(5,4) | CHECK 0–1 (e.g. 0.3 = 30%) |
| loss_share_rate | numeric(5,4) | CHECK 0–1 |
| start_date | date NOT NULL | |
| end_date | date | NULL = open-ended |
| is_active | boolean | Soft delete |
| notes | text | |
| created_at / updated_at | timestamptz | |

**Constraint:** `scope_id` must be NULL iff `scope_type = 'business'`

---

### settlements
Immutable settlement snapshots. **INSERT + SELECT only — no UPDATE, no DELETE.**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| deal_id | uuid FK → investment_deals | ON DELETE RESTRICT |
| period_start | date NOT NULL | CHECK period_end >= period_start |
| period_end | date NOT NULL | |
| snapshot | jsonb NOT NULL | Full cost waterfall at settlement time |
| total_revenue | numeric(12,3) | Denormalized summary |
| total_costs | numeric(12,3) | |
| net_profit | numeric(12,3) | |
| investor_share | numeric(12,3) | |
| created_at | timestamptz | No updated_at — immutable |

**Immutability enforced by:** RLS (no UPDATE/DELETE policy), BEFORE UPDATE/DELETE/TRUNCATE triggers, and REVOKE on authenticated/anon roles.

---

### daily_settlements
Manual Navex cash reconciliation. One row per day.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| date | date UNIQUE NOT NULL | One row per calendar day |
| expected_amount | numeric(12,3) | Calculated from delivered orders |
| actual_amount | numeric(12,3) | Bank transfer received |
| difference | numeric(12,3) | actual − expected |
| notes | text | |
| created_at / updated_at | timestamptz | |

---

### campaigns
Ad campaign spend per product per period (Meta / TikTok).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products | ON DELETE RESTRICT |
| platform | text NOT NULL | 'meta' or 'tiktok' |
| campaign_name / campaign_id | text | Platform identifiers |
| spend | numeric(12,3) | CHECK >= 0 |
| leads / impressions / clicks | integer | CHECK >= 0 |
| period_start | date NOT NULL | CHECK period_end >= period_start |
| period_end | date NOT NULL | |
| created_at / updated_at | timestamptz | |

---

### damaged_returns
Count of damaged units per product per period (inventory adjustment).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products | ON DELETE RESTRICT |
| period_start | date NOT NULL | CHECK period_end >= period_start |
| period_end | date NOT NULL | |
| count | integer | CHECK >= 0 |
| notes | text | |
| created_at | timestamptz | No updated_at |

---

## Key Constraints Summary

| Constraint | Table | Detail |
|---|---|---|
| Deduplication | orders | UNIQUE (account_id, reference) |
| Immutable | settlements | No UPDATE/DELETE via RLS + triggers + REVOKE |
| Unique day | daily_settlements | UNIQUE (date) |
| Unique setting | settings | UNIQUE (key) |
| Soft deletes | accounts, products, investors, investment_deals | is_active boolean DEFAULT true |
| Scope integrity | investment_deals | scope_id NULL iff scope_type = 'business' |
| Period validity | settlements, campaigns, damaged_returns | period_end >= period_start |
| Share rates | investment_deals | profit_share_rate, loss_share_rate in [0,1] |
| Batch quantity | product_batches | quantity > 0 |

## Indexes

| Index | Table | Columns | Type |
|---|---|---|---|
| idx_orders_product_status_date | orders | (product_id, status, converty_created_at) | Partial: not duplicated/test |
| idx_orders_date_status | orders | (converty_created_at, status) | Partial: not duplicated/test |
| idx_orders_created_at | orders | (created_at) | Full |
| idx_orders_exchange | orders | (id) | Partial: is_exchange = true |
| idx_osh_order_changed | order_status_history | (order_id, changed_at) | Full |
| idx_products_account_id | products | (account_id) | Full |
| idx_product_cost_components_product | product_cost_components | (product_id) | Full |
| idx_product_batches_product | product_batches | (product_id) | Full |
| idx_campaigns_product_period | campaigns | (product_id, period_start, period_end) | Full |
| idx_investment_deals_investor_id | investment_deals | (investor_id) | Full |
| idx_deals_scope | investment_deals | (scope_type, scope_id) | Partial: is_active = true |
| idx_settlements_deal_period | settlements | (deal_id, period_start, period_end) | Full |
| idx_damaged_returns_product_id | damaged_returns | (product_id) | Full |

## FK Behaviors

| Relationship | ON DELETE |
|---|---|
| products → accounts | RESTRICT |
| orders → accounts | RESTRICT |
| orders → products | RESTRICT |
| campaigns → products | RESTRICT |
| damaged_returns → products | RESTRICT |
| investment_deals → investors | RESTRICT |
| settlements → investment_deals | RESTRICT |
| product_cost_components → products | CASCADE |
| product_batches → products | CASCADE |
| order_status_history → orders | CASCADE |

## COGS Architecture

```
products.unit_cogs                ← sole source of truth for all calculations
       ↑
product_batches.unit_cogs         ← sets unit_cogs when new batch is created
       ↑
product_batches.cost_breakdown    ← jsonb snapshot [{label, amount}, ...]
       ↑ (mirrors)
product_cost_components           ← current editable breakdown (display/UI only)
```

The calculation engine **only reads `products.unit_cogs`** — it never queries components or batches directly.

## Migrations

| File | Contents |
|---|---|
| `20260330000001_schema.sql` | All 14 tables, constraints, indexes, updated_at triggers |
| `20260330000002_rls.sql` | RLS enable + policies, settlement immutability triggers + REVOKE |
| `20260330000003_seed.sql` | Settings, overhead categories, test account/product/components/batch |
| `20260330000004_simplify_fixes.sql` | FK ON DELETE behaviors, CHECK constraints, index optimization |

See `docs/business-logic.md` for the full cost model and order status pipeline.
