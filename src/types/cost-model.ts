// ---------------------------------------------------------------------------
// Cost model types — two-layer profitability model
// ---------------------------------------------------------------------------

/** Date range for all period-scoped calculations (inclusive both ends) */
export interface Period {
  start: Date;
  end: Date;
}

// ---------------------------------------------------------------------------
// Aggregated order data (input to pure computation)
// ---------------------------------------------------------------------------

/** Bucketed order counts + financial sums for a single product in a period */
export interface ProductOrderAggregates {
  productId: string;
  productName: string;
  unitCogs: number;

  // --- Order counts ---
  totalOrders: number;
  deliveredCount: number;
  returnedCount: number; // includes to_be_returned
  exchangeCount: number; // is_exchange = true, any status
  shippedCount: number; // reached deposit+
  confirmedCount: number; // orders NOT in failed-lead statuses (reached confirmed or beyond)

  // --- Financial aggregates ---
  totalRevenue: number; // Σ total_price of delivered, non-exchange
  totalDeliveredCartQuantity: number; // Σ cart quantities for delivered orders

  // --- Converty fee bases (Σ total_price per status group) ---
  convertyFeeBaseDelivered: number;
  convertyFeeBaseReturned: number;
  convertyFeeBaseFailedLeads: number; // rejected + abandoned + pending
  convertyFeeBaseExchange: number;
}

/** Campaign spend aggregate for a product in a period */
export interface CampaignSpendAggregate {
  productId: string;
  totalSpend: number;
  totalLeads: number;
}

/** One entry in a mixed campaign's spend_allocations JSONB array */
export interface SpendAllocation {
  product_id: string;
  percentage: number; // 0–100, all entries must sum to 100
}

/** Raw row from campaigns table (API + admin page) */
export interface CampaignRow {
  id: string;
  product_id: string;
  product_name: string | null;
  platform: string;
  campaign_name: string | null;
  campaign_id: string | null;
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  period_start: string;
  period_end: string;
  spend_allocations: SpendAllocation[] | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Layer 1 — Contribution Margin (per product per period)
// ---------------------------------------------------------------------------

/** Per-delivered-order cost breakdown (null when zero delivered orders) */
export interface PerOrderBreakdown {
  revenue: number;
  cogs: number;
  deliveryFee: number;
  packingCost: number;
  convertyFee: number;
  adSpend: number;
  returnBurden: number;
  failedLeadBurden: number;
  exchangeBurden: number;
  totalCost: number;
  margin: number;
}

export interface ContributionMargin {
  productId: string;
  productName: string;
  period: Period;

  // Revenue
  revenue: number;
  deliveredCount: number;

  // 8 direct cost components (totals for the period)
  totalCogs: number;
  totalDeliveryFee: number;
  totalPackingCost: number;
  totalConvertyFeeOnDelivered: number;
  adSpendAllocation: number;
  returnCostBurden: number;
  failedLeadCostBurden: number;
  exchangeCostBurden: number;

  // Totals
  totalDirectCosts: number;
  contributionMarginTotal: number;
  contributionMarginPerOrder: number | null; // null if zero delivered

  // Per-order breakdown (null if zero delivered)
  perOrder: PerOrderBreakdown | null;
}

// ---------------------------------------------------------------------------
// Layer 2 — Net Profit (business-wide per period)
// ---------------------------------------------------------------------------

export interface OverheadLine {
  label: string;
  monthlyAmount: number;
}

export interface NetProfit {
  period: Period;
  productMargins: ContributionMargin[];

  totalContributionMargin: number;

  // Overhead
  overheadCategories: OverheadLine[];
  totalOverhead: number;

  // Pickup fees (Layer 2 only — never in Layer 1)
  workingDays: number;
  dailyPickupFee: number;
  totalPickupFees: number;

  // Final
  netProfit: number;
}

// ---------------------------------------------------------------------------
// Computation inputs — typed API between caller and engine
// ---------------------------------------------------------------------------

/** Full input bundle required to compute Layer 1 contribution margin */
export interface ContributionMarginInput {
  productId: string;
  period: Period;
  /** Pre-aggregated order buckets for this product + period */
  aggregates: ProductOrderAggregates;
  /** Campaign spend for this product + period */
  campaignSpend: CampaignSpendAggregate;
  /** All cost variables from DB settings — never hardcode */
  settings: {
    navex_delivery_fee: number;
    navex_return_fee: number;
    converty_platform_fee_rate: number;
    packing_cost: number;
  };
}

/** Full output of a Layer 1 contribution margin computation (snake_case API variant) */
export interface ContributionMarginOutput {
  product_id: string;
  product_name: string;
  period: Period;

  revenue: number;
  delivered_count: number;

  total_cogs: number;
  total_delivery_fee: number;
  total_packing_cost: number;
  total_converty_fee_on_delivered: number;
  ad_spend_allocation: number;
  return_cost_burden: number;
  failed_lead_cost_burden: number;
  exchange_cost_burden: number;
  total_direct_costs: number;
  contribution_margin_total: number;

  /** null when delivered_count = 0 */
  contribution_margin_per_order: number | null;
  /** null when delivered_count = 0 */
  per_order: {
    revenue: number;
    cogs: number;
    delivery_fee: number;
    packing_cost: number;
    converty_fee: number;
    ad_spend: number;
    return_burden: number;
    failed_lead_burden: number;
    exchange_burden: number;
    total_cost: number;
    margin: number;
  } | null;
}

/** Full input bundle required to compute Layer 2 net profit */
export interface NetProfitInput {
  period: Period;
  /** Layer 1 outputs for all active products */
  productMargins: ContributionMargin[];
  /** Monthly overhead lines from overhead_categories table */
  overheadCategories: OverheadLine[];
  /** navex_daily_pickup_fee from settings */
  dailyPickupFee: number;
  /** Number of working days in the period (for pickup fee calculation) */
  workingDays: number;
}

// ---------------------------------------------------------------------------
// Cost waterfall (for visualization)
// ---------------------------------------------------------------------------

export interface CostWaterfallStep {
  label: string;
  amount: number;
  runningTotal: number;
  type: "revenue" | "cost" | "result";
}

export type CostWaterfall = CostWaterfallStep[];
