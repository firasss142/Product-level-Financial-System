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
// Cost waterfall (for visualization)
// ---------------------------------------------------------------------------

export interface CostWaterfallStep {
  label: string;
  amount: number;
  runningTotal: number;
  type: "revenue" | "cost" | "result";
}

export type CostWaterfall = CostWaterfallStep[];
