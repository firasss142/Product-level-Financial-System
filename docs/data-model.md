# Data Model Reference

Schema lives in supabase/migrations/. This doc is updated after each schema change.

## Core Tables
- accounts — Converty account credentials and config
- products — Product catalog with COGS
- orders — All synced orders (source of truth for financials)
- order_status_history — Complete status timeline per order
- settings — Configurable cost variables (fees, rates)
- overhead_categories — Monthly fixed costs
- investors — Investor profiles
- investment_deals — Deal configurations per investor
- settlements — Immutable settlement snapshots
- daily_settlements — Navex cash reconciliation
- campaigns — Ad campaign → product mappings
- damaged_returns — Simple counter per product per period

## Key Constraints
- orders deduplicated by (account_id, reference) unique constraint
- settlements table: INSERT + SELECT only, no UPDATE (immutable)
- Soft deletes on: products, investors, accounts, deals (is_active boolean)

See docs/business-logic.md for full cost model and status pipeline.