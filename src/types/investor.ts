// ---------------------------------------------------------------------------
// Investor domain types
// ---------------------------------------------------------------------------

/** Scope of an investment deal */
export type InvestorDealScope = "product" | "account" | "business";

/**
 * Named waterfall of cost lines for an investor settlement.
 * Every field is a TND amount (positive = cost subtracted from revenue,
 * except gross_revenue and net_profit which follow their natural sign).
 *
 * Immutable once created — stored as JSON snapshot in settlements.snapshot.
 */
export interface SettlementWaterfall {
  /** Σ totalPrice of all delivered orders in scope */
  gross_revenue: number;
  /** Σ (unit_cogs × quantity) for delivered orders */
  product_cogs: number;
  /** Σ navex_delivery_fee for delivered orders */
  delivery_fees: number;
  /** Σ navex_return_fee for returned/to_be_returned orders */
  return_fees: number;
  /** Σ packing_cost for returned orders (non-recoverable) */
  wasted_packing_costs: number;
  /** Σ (converty_platform_fee_rate × totalPrice) for returned orders */
  converty_fees_on_returns: number;
  /** Σ (converty_platform_fee_rate × totalPrice) for failed-lead orders */
  converty_fees_on_failed_leads: number;
  /** Σ (converty_platform_fee_rate × totalPrice) for delivered orders */
  converty_fees_on_delivered: number;
  /** Σ navex_delivery_fee for exchange orders */
  exchange_delivery_costs: number;
  /** Σ packing_cost for delivered + exchange orders */
  packing_costs: number;
  /** Total campaign spend for products in scope */
  ad_spend: number;
  /** Overhead allocated proportionally to this scope's order volume */
  allocated_overhead: number;
  /** = gross_revenue − all cost lines */
  net_profit: number;
}

/** Full investor row */
export interface Investor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Investment deal row */
export interface InvestmentDeal {
  id: string;
  investor_id: string;
  scope_type: InvestorDealScope;
  /** NULL when scope_type = 'business' */
  scope_id: string | null;
  capital_amount: number;
  /** 0–1, e.g. 0.30 = 30% */
  profit_share_rate: number;
  /** 0–1 */
  loss_share_rate: number;
  start_date: string;
  /** NULL = open-ended */
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Result of computeSettlement — used for previews and API responses */
export interface SettlementResult {
  waterfall: SettlementWaterfall;
  total_revenue: number;
  total_costs: number;
  net_profit: number;
  capital_invested: number;
  capital_returned_to_date: number;
  capital_return_this_period: number;
  capital_remaining: number;
  investor_share: number;
  scope_order_count: number;
  total_order_count: number;
}

/** Settlement snapshot row (immutable — INSERT only) */
export interface Settlement {
  id: string;
  deal_id: string;
  period_start: string;
  period_end: string;
  snapshot: SettlementWaterfall;
  total_revenue: number;
  total_costs: number;
  net_profit: number;
  capital_return_this_period: number;
  investor_share: number;
  created_at: string;
}
