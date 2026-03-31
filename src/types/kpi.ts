// ---------------------------------------------------------------------------
// KPI result types
// ---------------------------------------------------------------------------

import type { Period } from "./cost-model";

export interface ProductKPIs {
  productId: string;
  productName: string;
  period: Period;

  // Funnel rates (null when denominator is zero)
  confirmationRate: number | null;
  deliveryRate: number | null;
  returnRate: number | null;
  exchangeRate: number | null;

  // Cost metrics
  costPerLead: number | null;
  costPerDeliveredOrder: number | null;

  // Margin
  contributionMarginPerOrder: number | null;
  contributionMarginPercent: number | null;

  // Counts (context for rates)
  totalLeads: number;
  confirmedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  exchangeOrders: number;
}

export interface BusinessKPIs {
  period: Period;

  // Aggregate funnel rates
  overallConfirmationRate: number | null;
  overallDeliveryRate: number | null;
  overallReturnRate: number | null;
  overallExchangeRate: number | null;

  // Financial
  totalRevenue: number;
  totalDirectCosts: number;
  totalContributionMargin: number;
  totalOverhead: number;
  netProfit: number;
  netProfitMarginPercent: number | null;
}

export interface DailySettlementKPI {
  date: string;
  expectedAmount: number;
  actualAmount: number | null;
  difference: number | null;
  reconciliationRatio: number | null;
}
