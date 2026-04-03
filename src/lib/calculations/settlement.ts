// ---------------------------------------------------------------------------
// Settlement calculation engine — computes investor waterfall + capital sharing
// Server-side only. Reuses existing cost-engine and query functions.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Period } from "@/types/cost-model";
import type { InvestmentDeal, SettlementWaterfall, SettlementResult } from "@/types/investor";
import type { OrderRow } from "@/types/orders";
import { computeContributionMargin, countWorkingDays } from "./cost-engine";
import {
  fetchProductOrders,
  fetchAllOrders,
  fetchOrdersByStoreIds,
  aggregateProductOrders,
  fetchCampaignSpend,
  fetchActiveProducts,
  fetchOverheadCategories,
  type ProductRow,
} from "./queries";
import {
  queryDealById,
  queryStoreIdsByAccount,
  querySettlementsByDeal,
} from "@/lib/supabase/queries";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export type { SettlementResult } from "@/types/investor";

// ---------------------------------------------------------------------------
// Scope resolution — fetch orders belonging to the deal's scope
// ---------------------------------------------------------------------------

async function fetchOrdersForScope(
  supabase: SupabaseClient,
  deal: InvestmentDeal,
  period: Period
): Promise<OrderRow[]> {
  switch (deal.scope_type) {
    case "product":
      return fetchProductOrders(supabase, deal.scope_id!, period);
    case "account": {
      const storeIds = await queryStoreIdsByAccount(supabase, deal.scope_id!);
      return fetchOrdersByStoreIds(supabase, storeIds, period);
    }
    case "business":
      return fetchAllOrders(supabase, period);
  }
}

// ---------------------------------------------------------------------------
// Resolve product rows for orders in scope (needed for aggregation)
// ---------------------------------------------------------------------------

async function resolveProductRows(
  supabase: SupabaseClient,
  deal: InvestmentDeal,
  allProducts: ProductRow[],
  orderProductIds: Set<string>
): Promise<Map<string, ProductRow>> {
  const productMap = new Map<string, ProductRow>();

  if (deal.scope_type === "product") {
    // Single product — find it in allProducts
    const p = allProducts.find((pr) => pr.id === deal.scope_id);
    if (p) productMap.set(p.id, p);
  } else {
    // Account or business scope — include all products that have orders
    for (const p of allProducts) {
      if (orderProductIds.has(p.id)) {
        productMap.set(p.id, p);
      }
    }
  }

  // Fallback: if an order references a product not in the active list,
  // fetch it directly so COGS is still computed
  for (const pid of orderProductIds) {
    if (!productMap.has(pid)) {
      const { data } = await supabase
        .from("products")
        .select("id, name, unit_cogs")
        .eq("id", pid)
        .single();
      if (data) {
        productMap.set(data.id as string, {
          id: data.id as string,
          name: data.name as string,
          unit_cogs: data.unit_cogs as number | null,
        });
      }
    }
  }

  return productMap;
}

// ---------------------------------------------------------------------------
// Main settlement computation
// ---------------------------------------------------------------------------

export async function computeSettlement(
  dealId: string,
  period: Period
): Promise<SettlementResult> {
  const supabase = await createClient();
  const settings = await getSettings();

  // 1. Load deal
  const deal = await queryDealById(supabase, dealId);
  if (!deal) throw new Error("Accord introuvable");

  // 2. Fetch orders in scope + all orders (for overhead ratio)
  const [scopeOrders, allOrders, allProducts, overheadCategories, priorSettlements] =
    await Promise.all([
      fetchOrdersForScope(supabase, deal, period),
      // For business scope we reuse the same array; for other scopes we need the total
      deal.scope_type === "business"
        ? Promise.resolve([] as OrderRow[]) // placeholder — reused below
        : fetchAllOrders(supabase, period),
      fetchActiveProducts(supabase),
      fetchOverheadCategories(supabase),
      querySettlementsByDeal(supabase, dealId),
    ]);

  // For business scope, allOrders === scopeOrders
  const totalOrders = deal.scope_type === "business" ? scopeOrders : allOrders;
  const scopeOrderCount = scopeOrders.length;
  const totalOrderCount = deal.scope_type === "business" ? scopeOrderCount : totalOrders.length;

  // 3. Group scope orders by product_id
  const ordersByProduct = new Map<string, OrderRow[]>();
  const orderProductIds = new Set<string>();
  for (const order of scopeOrders) {
    const pid = order.product_id ?? "__unknown__";
    orderProductIds.add(pid);
    if (!ordersByProduct.has(pid)) ordersByProduct.set(pid, []);
    ordersByProduct.get(pid)!.push(order);
  }

  // 4. Resolve product rows — validate product scope
  const productMap = await resolveProductRows(supabase, deal, allProducts, orderProductIds);

  if (deal.scope_type === "product" && productMap.size === 0 && scopeOrderCount === 0) {
    throw new Error("Produit introuvable ou inactif — impossible de générer le règlement");
  }

  // 5. For each product: aggregate → campaign spend → contribution margin
  //    Also accumulate raw aggregates for the split fields
  let grossRevenue = 0;
  let productCogs = 0;
  let deliveryFees = 0;
  let returnFees = 0;
  let wastedPackingCosts = 0;
  let convertyFeesOnReturns = 0;
  let convertyFeesOnFailedLeads = 0;
  let convertyFeesOnDelivered = 0;
  let exchangeDeliveryCosts = 0;
  let packingCosts = 0;
  let adSpend = 0;

  for (const [pid, orders] of ordersByProduct) {
    const product = productMap.get(pid);
    if (!product) continue;

    const aggregates = aggregateProductOrders(orders, product);
    const campaignSpend = await fetchCampaignSpend(supabase, pid, period);
    const margin = computeContributionMargin(aggregates, campaignSpend, settings, period);

    // Accumulate waterfall fields
    grossRevenue += margin.revenue;
    productCogs += margin.totalCogs;
    deliveryFees += margin.totalDeliveryFee;
    packingCosts += margin.totalPackingCost;
    convertyFeesOnDelivered += margin.totalConvertyFeeOnDelivered;
    adSpend += margin.adSpendAllocation;

    // Split return burden into components using raw aggregates + settings
    returnFees += aggregates.returnedCount * settings.navex_return_fee;
    wastedPackingCosts += aggregates.returnedCount * settings.packing_cost;
    convertyFeesOnReturns +=
      aggregates.convertyFeeBaseReturned * settings.converty_platform_fee_rate;

    // Failed lead burden is purely Converty fee
    convertyFeesOnFailedLeads += margin.failedLeadCostBurden;

    // Exchange burden split: delivery fee is separate, Converty fee is grouped
    // with delivered fees in the waterfall (Commission Converty = all non-dup orders).
    // margin.totalConvertyFeeOnDelivered excludes exchange orders, so we add them here.
    exchangeDeliveryCosts += aggregates.exchangeCount * settings.navex_delivery_fee;
    convertyFeesOnDelivered +=
      aggregates.convertyFeeBaseExchange * settings.converty_platform_fee_rate;
  }

  // 6. Overhead allocation
  const totalOverhead = overheadCategories.reduce(
    (sum, cat) => sum + cat.monthlyAmount,
    0
  );
  const workingDays = countWorkingDays(period.start, period.end);
  const totalPickupFees = workingDays * settings.navex_daily_pickup_fee;
  const totalOverheadWithPickup = totalOverhead + totalPickupFees;

  let allocatedOverhead: number;
  if (deal.scope_type === "business") {
    allocatedOverhead = totalOverheadWithPickup;
  } else if (totalOrderCount === 0) {
    allocatedOverhead = 0;
  } else {
    allocatedOverhead = totalOverheadWithPickup * (scopeOrderCount / totalOrderCount);
  }

  // 7. Compute net profit
  const totalCosts =
    productCogs +
    deliveryFees +
    returnFees +
    wastedPackingCosts +
    convertyFeesOnReturns +
    convertyFeesOnFailedLeads +
    convertyFeesOnDelivered +
    exchangeDeliveryCosts +
    packingCosts +
    adSpend +
    allocatedOverhead;

  const netProfit = grossRevenue - totalCosts;

  // 8. Build waterfall snapshot
  const waterfall: SettlementWaterfall = {
    gross_revenue: grossRevenue,
    product_cogs: productCogs,
    delivery_fees: deliveryFees,
    return_fees: returnFees,
    wasted_packing_costs: wastedPackingCosts,
    converty_fees_on_returns: convertyFeesOnReturns,
    converty_fees_on_failed_leads: convertyFeesOnFailedLeads,
    converty_fees_on_delivered: convertyFeesOnDelivered,
    exchange_delivery_costs: exchangeDeliveryCosts,
    packing_costs: packingCosts,
    ad_spend: adSpend,
    allocated_overhead: allocatedOverhead,
    net_profit: netProfit,
  };

  // 9. Capital tracking — sum actual capital returns, not investor_share
  // (investor_share includes profit share which is not capital return)
  const capitalReturned = priorSettlements.reduce(
    (sum, s) => sum + (s.capital_return_this_period ?? 0),
    0
  );
  const capitalRemaining = Math.max(0, deal.capital_amount - capitalReturned);

  let capitalReturnThisPeriod: number;
  let investorShare: number;

  if (netProfit > 0) {
    capitalReturnThisPeriod = Math.min(netProfit, capitalRemaining);
    const distributable = netProfit - capitalReturnThisPeriod;
    investorShare = capitalReturnThisPeriod + distributable * deal.profit_share_rate;
  } else {
    capitalReturnThisPeriod = 0;
    investorShare = netProfit * deal.loss_share_rate;
  }

  return {
    waterfall,
    total_revenue: grossRevenue,
    total_costs: totalCosts,
    net_profit: netProfit,
    capital_invested: deal.capital_amount,
    capital_returned_to_date: capitalReturned,
    capital_return_this_period: capitalReturnThisPeriod,
    capital_remaining: capitalRemaining - capitalReturnThisPeriod,
    investor_share: investorShare,
    scope_order_count: scopeOrderCount,
    total_order_count: totalOrderCount,
  };
}
