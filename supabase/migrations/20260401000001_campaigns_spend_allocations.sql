-- Add spend_allocations column to campaigns table
-- Format: [{product_id: uuid, percentage: numeric}] — must sum to 100
-- NULL = 1:1 mapping (campaign.product_id gets 100% of spend)

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS spend_allocations jsonb DEFAULT NULL;

ALTER TABLE campaigns
  ADD CONSTRAINT chk_campaigns_spend_allocations
  CHECK (
    spend_allocations IS NULL
    OR (
      jsonb_typeof(spend_allocations) = 'array'
      AND jsonb_array_length(spend_allocations) > 0
    )
  );

-- Dedup index for Meta-synced campaigns (manual entries with null campaign_id always insert)
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaigns_meta_period
  ON campaigns (campaign_id, platform, period_start, period_end)
  WHERE campaign_id IS NOT NULL;

COMMENT ON COLUMN campaigns.spend_allocations IS
  'Percentage split for mixed campaigns. [{product_id, percentage}] summing to 100. NULL = full spend goes to product_id.';
