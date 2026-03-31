// ---------------------------------------------------------------------------
// KPI computation — pure functions, server-side only
// ---------------------------------------------------------------------------

import type { ProductOrderAggregates, CampaignSpendAggregate, ContributionMargin, NetProfit, Period } from "@/types/cost-model";
import type { ProductKPIs, BusinessKPIs, DailySettlementKPI } from "@/types/kpi";
import { safeDivide } from "./cost-engine";
import type { DailySettlementRow } from "./queries";

// ---------------------------------------------------------------------------
// Product-level KPIs
// ---------------------------------------------------------------------------

/**
 * Compute all KPIs for a single product.
 *
 * Denominators:
 * - confirmationRate: totalOrders (all non-dup, non-test leads)
 * - deliveryRate / returnRate: shippedCount (reached deposit+)
 * - exchangeRate: deliveredCount
 * - costPerLead: campaignSpend.totalLeads
 * - costPerDeliveredOrder: deliveredCount
 */
export function computeProductKPIs(
  aggregates: ProductOrderAggregates,
  campaignSpend: CampaignSpendAggregate,
  margin: ContributionMargin,
  period: Period
): ProductKPIs {
  const {
    productId,
    productName,
    totalOrders,
    confirmedCount,
    shippedCount,
    deliveredCount,
    returnedCount,
    exchangeCount,
  } = aggregates;

  const confirmationRate = safeDivide(confirmedCount, totalOrders);
  const deliveryRate = safeDivide(deliveredCount, shippedCount);
  const returnRate = safeDivide(returnedCount, shippedCount);
  const exchangeRate = safeDivide(exchangeCount, deliveredCount);
  const costPerLead = safeDivide(campaignSpend.totalSpend, campaignSpend.totalLeads);
  const costPerDeliveredOrder = safeDivide(margin.totalDirectCosts, deliveredCount);

  const contributionMarginPercent =
    margin.revenue > 0
      ? safeDivide(margin.contributionMarginTotal, margin.revenue)
      : null;

  return {
    productId,
    productName,
    period,
    confirmationRate,
    deliveryRate,
    returnRate,
    exchangeRate,
    costPerLead,
    costPerDeliveredOrder,
    contributionMarginPerOrder: margin.contributionMarginPerOrder,
    contributionMarginPercent,
    totalLeads: totalOrders,
    confirmedOrders: confirmedCount,
    shippedOrders: shippedCount,
    deliveredOrders: deliveredCount,
    returnedOrders: returnedCount,
    exchangeOrders: exchangeCount,
  };
}

// ---------------------------------------------------------------------------
// Business-level KPIs
// ---------------------------------------------------------------------------

export function computeBusinessKPIs(
  allAggregates: ProductOrderAggregates[],
  netProfit: NetProfit
): BusinessKPIs {
  const totalLeads = allAggregates.reduce((s, a) => s + a.totalOrders, 0);
  const totalConfirmed = allAggregates.reduce((s, a) => s + a.confirmedCount, 0);
  const totalShipped = allAggregates.reduce((s, a) => s + a.shippedCount, 0);
  const totalDelivered = allAggregates.reduce((s, a) => s + a.deliveredCount, 0);
  const totalReturned = allAggregates.reduce((s, a) => s + a.returnedCount, 0);
  const totalExchange = allAggregates.reduce((s, a) => s + a.exchangeCount, 0);

  const totalRevenue = netProfit.productMargins.reduce((s, m) => s + m.revenue, 0);
  const totalDirectCosts = netProfit.productMargins.reduce(
    (s, m) => s + m.totalDirectCosts,
    0
  );

  const netProfitMarginPercent =
    totalRevenue > 0 ? safeDivide(netProfit.netProfit, totalRevenue) : null;

  return {
    period: netProfit.period,
    overallConfirmationRate: safeDivide(totalConfirmed, totalLeads),
    overallDeliveryRate: safeDivide(totalDelivered, totalShipped),
    overallReturnRate: safeDivide(totalReturned, totalShipped),
    overallExchangeRate: safeDivide(totalExchange, totalDelivered),
    totalRevenue,
    totalDirectCosts,
    totalContributionMargin: netProfit.totalContributionMargin,
    totalOverhead: netProfit.totalOverhead + netProfit.totalPickupFees,
    netProfit: netProfit.netProfit,
    netProfitMarginPercent,
  };
}

// ---------------------------------------------------------------------------
// Daily settlement KPIs
// ---------------------------------------------------------------------------

export function computeDailySettlementKPIs(
  settlements: DailySettlementRow[]
): DailySettlementKPI[] {
  return settlements.map((row) => {
    const expected = row.expected_amount ?? 0;
    const actual = row.actual_amount ?? null;
    const difference = actual !== null ? actual - expected : null;
    const reconciliationRatio =
      actual !== null && expected > 0 ? safeDivide(actual, expected) : null;

    return {
      date: row.date,
      expectedAmount: expected,
      actualAmount: actual,
      difference,
      reconciliationRatio,
    };
  });
}
