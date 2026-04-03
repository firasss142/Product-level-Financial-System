-- ---------------------------------------------------------------------------
-- Settlement fixes:
-- 1. Add capital_return_this_period column for accurate capital tracking
-- 2. Add UNIQUE constraint on (deal_id, period_start, period_end) to prevent duplicates
-- ---------------------------------------------------------------------------

-- 1. New column to track capital return separately from investor_share
ALTER TABLE settlements
  ADD COLUMN capital_return_this_period numeric(12,3) NOT NULL DEFAULT 0;

-- 2. Prevent duplicate settlements for the same deal + period
ALTER TABLE settlements
  ADD CONSTRAINT uq_settlements_deal_period
  UNIQUE (deal_id, period_start, period_end);
