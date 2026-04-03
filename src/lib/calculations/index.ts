// ---------------------------------------------------------------------------
// Calculation engine — public API (server-side only)
// ---------------------------------------------------------------------------

import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { Period, ContributionMargin, NetProfit, CostWaterfall, ProductOrderAggregates } from "@/types/cost-model";
import type { ProductKPIs, BusinessKPIs, DailySettlementKPI } from "@/types/kpi";
import {
  computeContributionMargin,
  computeNetProfit,
  buildCostWaterfall,
  buildBusinessWaterfall,
} from "./cost-engine";
import { computeProductKPIs, computeBusinessKPIs, computeDailySettlementKPIs } from "./kpi";
import {
  fetchProductOrders,
  fetchAllOrders,
  fetchCampaignSpend,
  fetchAllCampaignSpends,
  fetchActiveProducts,
  fetchOverheadCategories,
  fetchDailySettlements,
  aggregateProductOrders,
  type ProductRow,
} from "./queries";
export { computeSettlement, type SettlementResult } from "./settlement";

// ---------------------------------------------------------------------------
// Product profitability
// ---------------------------------------------------------------------------

export interface ProductProfitabilityResult {
  margin: ContributionMargin;
  kpis: ProductKPIs;
  waterfall: CostWaterfall;
}

export async function getProductProfitability(
  productId: string,
  period: Period
): Promise<ProductProfitabilityResult> {
  const supabase = await createClient();
  const settings = await getSettings();

  const [productResult, orders, campaignSpend] = await Promise.all([
    supabase.from("products").select("id, name, unit_cogs").eq("id", productId).single(),
    fetchProductOrders(supabase, productId, period),
    fetchCampaignSpend(supabase, productId, period),
  ]);

  if (productResult.error) throw new Error(productResult.error.message);
  const productRow = productResult.data;

  const aggregates = aggregateProductOrders(orders, productRow as ProductRow);

  const margin = computeContributionMargin(aggregates, campaignSpend, settings, period);
  const kpis = computeProductKPIs(aggregates, campaignSpend, margin, period);
  const waterfall = buildCostWaterfall(margin);

  return { margin, kpis, waterfall };
}

// ---------------------------------------------------------------------------
// Business-wide profitability
// ---------------------------------------------------------------------------

export interface BusinessProfitabilityResult {
  netProfit: NetProfit;
  kpis: BusinessKPIs;
  waterfall: CostWaterfall;
  productDetails: ProductProfitabilityResult[];
}

export async function getBusinessProfitability(
  period: Period
): Promise<BusinessProfitabilityResult> {
  const supabase = await createClient();
  const settings = await getSettings();

  const [products, overheadCategories, allOrders, campaignSpendMap] = await Promise.all([
    fetchActiveProducts(supabase),
    fetchOverheadCategories(supabase),
    fetchAllOrders(supabase, period),
    fetchAllCampaignSpends(supabase, period),
  ]);

  // Group orders by product_id
  const ordersByProduct = new Map<string, typeof allOrders>();
  for (const order of allOrders) {
    const pid = order.product_id ?? "__unknown__";
    if (!ordersByProduct.has(pid)) ordersByProduct.set(pid, []);
    ordersByProduct.get(pid)!.push(order);
  }

  // Single aggregation pass — reused for both product details and business KPIs
  const allAggregates: ProductOrderAggregates[] = [];
  const productDetails: ProductProfitabilityResult[] = products.map((product) => {
    const orders = ordersByProduct.get(product.id) ?? [];
    const aggregates = aggregateProductOrders(orders, product);
    allAggregates.push(aggregates);
    const campaignSpend = campaignSpendMap.get(product.id) ?? { productId: product.id, totalSpend: 0, totalLeads: 0 };

    const margin = computeContributionMargin(aggregates, campaignSpend, settings, period);
    const kpis = computeProductKPIs(aggregates, campaignSpend, margin, period);
    const waterfall = buildCostWaterfall(margin);

    return { margin, kpis, waterfall };
  });

  const productMargins = productDetails.map((d) => d.margin);
  const netProfit = computeNetProfit(productMargins, overheadCategories, settings, period);
  const kpis = computeBusinessKPIs(allAggregates, netProfit);
  const waterfall = buildBusinessWaterfall(netProfit);

  return { netProfit, kpis, waterfall, productDetails };
}

// ---------------------------------------------------------------------------
// Daily settlement
// ---------------------------------------------------------------------------

export async function getDailySettlement(date: Date): Promise<DailySettlementKPI | null> {
  const supabase = await createClient();
  const period: Period = { start: date, end: date };
  const rows = await fetchDailySettlements(supabase, period);
  const kpis = computeDailySettlementKPIs(rows);
  return kpis[0] ?? null;
}

export async function getDailySettlements(period: Period): Promise<DailySettlementKPI[]> {
  const supabase = await createClient();
  const rows = await fetchDailySettlements(supabase, period);
  return computeDailySettlementKPIs(rows);
}
