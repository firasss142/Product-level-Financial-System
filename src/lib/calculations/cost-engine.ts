// ---------------------------------------------------------------------------
// Core calculation engine — pure functions, server-side only
// All settings read from DB at call time — nothing hardcoded
// ---------------------------------------------------------------------------

import type { Settings } from "@/lib/settings";
import type {
  Period,
  ProductOrderAggregates,
  CampaignSpendAggregate,
  ContributionMargin,
  OverheadLine,
  NetProfit,
  CostWaterfall,
  CostWaterfallStep,
} from "@/types/cost-model";

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Extract total cart quantity from an order, min 1 */
export function extractCartQuantity(
  cart: { quantity?: number; [key: string]: unknown }[] | null
): number {
  if (!cart || cart.length === 0) return 1;
  const sum = cart.reduce((acc, item) => acc + (item.quantity ?? 1), 0);
  return sum > 0 ? sum : 1;
}

/**
 * Count working days (Mon–Sat inclusive) between two dates.
 * Tunisia: Sunday is off. No holiday calendar in v1.
 */
export function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (cursor <= endDay) {
    const dow = cursor.getDay(); // 0 = Sunday
    if (dow !== 0) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Safe division — returns null if denominator is 0 */
export function safeDivide(n: number, d: number): number | null {
  return d === 0 ? null : n / d;
}

// ---------------------------------------------------------------------------
// Layer 1: Contribution Margin
// ---------------------------------------------------------------------------

/**
 * Compute the contribution margin for a single product in a given period.
 *
 * 8 direct cost components (per plan):
 *  1. COGS = unitCogs × totalDeliveredCartQuantity
 *  2. Delivery fee = deliveredCount × navex_delivery_fee
 *  3. Packing = deliveredCount × packing_cost
 *  4. Converty fee on delivered = convertyFeeBaseDelivered × rate
 *  5. Ad spend = campaignSpend.totalSpend
 *  6. Return burden = returnedCount × (return_fee + packing_cost)
 *                   + convertyFeeBaseReturned × rate
 *                   (wasted delivery fee on returned orders excluded — negligible,
 *                    absorbed by business-level daily pickup lump sum)
 *  7. Failed lead burden = convertyFeeBaseFailedLeads × rate
 *  8. Exchange burden = exchangeCount × delivery_fee
 *                     + convertyFeeBaseExchange × rate
 */
export function computeContributionMargin(
  aggregates: ProductOrderAggregates,
  campaignSpend: CampaignSpendAggregate,
  settings: Settings,
  period: Period
): ContributionMargin {
  const {
    productId,
    productName,
    unitCogs,
    deliveredCount,
    returnedCount,
    exchangeCount,
    totalRevenue,
    totalDeliveredCartQuantity,
    convertyFeeBaseDelivered,
    convertyFeeBaseReturned,
    convertyFeeBaseFailedLeads,
    convertyFeeBaseExchange,
  } = aggregates;

  const {
    navex_delivery_fee,
    navex_return_fee,
    packing_cost,
    converty_platform_fee_rate,
  } = settings;

  // navex_delivery_fee used for: delivered orders + exchange burden only

  // 1. COGS — only on delivered orders (returned goes back to inventory)
  const totalCogs = unitCogs * totalDeliveredCartQuantity;

  // 2. Delivery fee on delivered
  const totalDeliveryFee = deliveredCount * navex_delivery_fee;

  // 3. Packing on delivered
  const totalPackingCost = deliveredCount * packing_cost;

  // 4. Converty fee on delivered orders
  const totalConvertyFeeOnDelivered =
    convertyFeeBaseDelivered * converty_platform_fee_rate;

  // 5. Ad spend allocation (full amount, no pro-rating in v1)
  const adSpendAllocation = campaignSpend.totalSpend;

  // 6. Return burden:
  //    - return fee + packing (material consumed) per returned order
  //    - plus Converty fee on returned orders (non-recoverable)
  //    NOTE: wasted delivery fee on returned orders is negligible (absorbed by
  //    the business-level daily pickup lump sum) and excluded from Layer 1.
  const returnCostBurden =
    returnedCount * (navex_return_fee + packing_cost) +
    convertyFeeBaseReturned * converty_platform_fee_rate;

  // 7. Failed lead burden: Converty fee only (no Navex involvement)
  const failedLeadCostBurden =
    convertyFeeBaseFailedLeads * converty_platform_fee_rate;

  // 8. Exchange burden: extra delivery cycle + Converty fee
  const exchangeCostBurden =
    exchangeCount * navex_delivery_fee +
    convertyFeeBaseExchange * converty_platform_fee_rate;

  const totalDirectCosts =
    totalCogs +
    totalDeliveryFee +
    totalPackingCost +
    totalConvertyFeeOnDelivered +
    adSpendAllocation +
    returnCostBurden +
    failedLeadCostBurden +
    exchangeCostBurden;

  const contributionMarginTotal = totalRevenue - totalDirectCosts;
  const contributionMarginPerOrder = safeDivide(contributionMarginTotal, deliveredCount);

  // Per-order breakdown — only computed when deliveredCount > 0 so all divisions are safe
  let perOrder: ContributionMargin["perOrder"] = null;
  if (deliveredCount > 0) {
    const d = deliveredCount;
    perOrder = {
      revenue: totalRevenue / d,
      cogs: totalCogs / d,
      deliveryFee: totalDeliveryFee / d,
      packingCost: totalPackingCost / d,
      convertyFee: totalConvertyFeeOnDelivered / d,
      adSpend: adSpendAllocation / d,
      returnBurden: returnCostBurden / d,
      failedLeadBurden: failedLeadCostBurden / d,
      exchangeBurden: exchangeCostBurden / d,
      totalCost: totalDirectCosts / d,
      margin: contributionMarginTotal / d,
    };
  }

  return {
    productId,
    productName,
    period,
    revenue: totalRevenue,
    deliveredCount,
    exchangeCount,
    totalCogs,
    totalDeliveryFee,
    totalPackingCost,
    totalConvertyFeeOnDelivered,
    adSpendAllocation,
    returnCostBurden,
    failedLeadCostBurden,
    exchangeCostBurden,
    totalDirectCosts,
    contributionMarginTotal,
    contributionMarginPerOrder,
    perOrder,
  };
}

// ---------------------------------------------------------------------------
// Layer 2: Net Profit
// ---------------------------------------------------------------------------

/**
 * Compute business-wide net profit for a period.
 * Net Profit = Σ(ContributionMargins) − Σ(Overhead) − (workingDays × daily_pickup_fee)
 *
 * Navex daily pickup fee is a Layer 2 lump sum — never allocated per order.
 */
export function computeNetProfit(
  productMargins: ContributionMargin[],
  overheadCategories: OverheadLine[],
  settings: Settings,
  period: Period
): NetProfit {
  const totalContributionMargin = productMargins.reduce(
    (sum, m) => sum + m.contributionMarginTotal,
    0
  );

  const totalOverhead = overheadCategories.reduce(
    (sum, cat) => sum + cat.monthlyAmount,
    0
  );

  const workingDays = countWorkingDays(period.start, period.end);
  const totalPickupFees = workingDays * settings.navex_daily_pickup_fee;

  const netProfit = totalContributionMargin - totalOverhead - totalPickupFees;

  return {
    period,
    productMargins,
    totalContributionMargin,
    overheadCategories,
    totalOverhead,
    workingDays,
    dailyPickupFee: settings.navex_daily_pickup_fee,
    totalPickupFees,
    netProfit,
  };
}

// ---------------------------------------------------------------------------
// Cost waterfall builders (for visualization)
// ---------------------------------------------------------------------------

/** Build a product-level cost waterfall (revenue → contribution margin) */
export function buildCostWaterfall(margin: ContributionMargin): CostWaterfall {
  const steps: CostWaterfallStep[] = [];
  let running = margin.revenue;

  const push = (
    label: string,
    amount: number,
    type: CostWaterfallStep["type"]
  ) => {
    running -= amount;
    steps.push({ label, amount, runningTotal: running, type });
  };

  steps.push({
    label: "Revenu brut",
    amount: margin.revenue,
    runningTotal: running,
    type: "revenue",
  });

  push("Coût produit (COGS)", margin.totalCogs, "cost");
  push("Frais de livraison", margin.totalDeliveryFee, "cost");
  push("Coût d'emballage", margin.totalPackingCost, "cost");
  push("Frais Converty (livré)", margin.totalConvertyFeeOnDelivered, "cost");
  push("Dépenses publicitaires", margin.adSpendAllocation, "cost");
  push("Charge retours", margin.returnCostBurden, "cost");
  push("Charge leads échoués", margin.failedLeadCostBurden, "cost");
  push("Charge échanges", margin.exchangeCostBurden, "cost");

  steps.push({
    label: "Marge sur coûts variables",
    amount: margin.contributionMarginTotal,
    runningTotal: margin.contributionMarginTotal,
    type: "result",
  });

  return steps;
}

/** Build a business-level cost waterfall (total CM → net profit) */
export function buildBusinessWaterfall(netProfit: NetProfit): CostWaterfall {
  const steps: CostWaterfallStep[] = [];
  let running = netProfit.totalContributionMargin;

  steps.push({
    label: "Marge sur coûts variables totale",
    amount: netProfit.totalContributionMargin,
    runningTotal: running,
    type: "revenue",
  });

  for (const cat of netProfit.overheadCategories) {
    running -= cat.monthlyAmount;
    steps.push({
      label: cat.label,
      amount: cat.monthlyAmount,
      runningTotal: running,
      type: "cost",
    });
  }

  running -= netProfit.totalPickupFees;
  steps.push({
    label: "Frais de ramassage Navex",
    amount: netProfit.totalPickupFees,
    runningTotal: running,
    type: "cost",
  });

  steps.push({
    label: "Bénéfice net",
    amount: netProfit.netProfit,
    runningTotal: netProfit.netProfit,
    type: "result",
  });

  return steps;
}
