// ---------------------------------------------------------------------------
// Data layer — Supabase queries + pure-TS aggregation
// Server-side only
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderRow } from "@/types/orders";
import type {
  Period,
  ProductOrderAggregates,
  CampaignSpendAggregate,
  SpendAllocation,
  OverheadLine,
} from "@/types/cost-model";
import {
  isReturnStatus,
  isNavexZoneStatus,
  isFailedLeadStatus,
  FAILED_LEAD_STATUSES,
} from "@/types/orders";

// ---------------------------------------------------------------------------
// Order queries
// ---------------------------------------------------------------------------

/**
 * Fetch all non-duplicated, non-test orders for a product in a period.
 * Uses the partial index idx_orders_product_status_date.
 */
export async function fetchProductOrders(
  supabase: SupabaseClient,
  productId: string,
  period: Period
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, store_id, product_id, reference, total_price, status, is_duplicated, is_exchange, is_test, cart, converty_created_at, variant_unit_count"
    )
    .eq("product_id", productId)
    .eq("is_duplicated", false)
    .eq("is_test", false)
    .gte("converty_created_at", period.start.toISOString())
    .lte("converty_created_at", period.end.toISOString());

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderRow[];
}

/**
 * Fetch all non-duplicated, non-test orders across all products in a period.
 * Uses the partial index idx_orders_date_status.
 */
export async function fetchAllOrders(
  supabase: SupabaseClient,
  period: Period
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, store_id, product_id, reference, total_price, status, is_duplicated, is_exchange, is_test, cart, converty_created_at, variant_unit_count"
    )
    .eq("is_duplicated", false)
    .eq("is_test", false)
    .gte("converty_created_at", period.start.toISOString())
    .lte("converty_created_at", period.end.toISOString());

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderRow[];
}

/**
 * Fetch non-duplicated, non-test orders for specific store IDs in a period.
 * Used for account-scoped settlement calculations.
 */
export async function fetchOrdersByStoreIds(
  supabase: SupabaseClient,
  storeIds: string[],
  period: Period
): Promise<OrderRow[]> {
  if (storeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, store_id, product_id, reference, total_price, status, is_duplicated, is_exchange, is_test, cart, converty_created_at, variant_unit_count"
    )
    .in("store_id", storeIds)
    .eq("is_duplicated", false)
    .eq("is_test", false)
    .gte("converty_created_at", period.start.toISOString())
    .lte("converty_created_at", period.end.toISOString());

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderRow[];
}

// ---------------------------------------------------------------------------
// Pure-TS aggregation (single pass)
// ---------------------------------------------------------------------------

export interface ProductRow {
  id: string;
  name: string;
  unit_cogs: number | null;
}

/**
 * Aggregate orders into per-product metrics in a single pass — O(n).
 * COGS uses variant_unit_count (defaults to 1 for legacy/unmapped orders).
 */
export function aggregateProductOrders(
  orders: OrderRow[],
  product: ProductRow
): ProductOrderAggregates {
  const failedLeadSet = new Set<string>(FAILED_LEAD_STATUSES);

  let totalOrders = 0;
  let deliveredCount = 0;
  let returnedCount = 0;
  let exchangeCount = 0;
  let shippedCount = 0;
  let confirmedCount = 0;

  let totalRevenue = 0;
  let totalDeliveredCartQuantity = 0;

  let convertyFeeBaseDelivered = 0;
  let convertyFeeBaseReturned = 0;
  let convertyFeeBaseFailedLeads = 0;
  let convertyFeeBaseExchange = 0;

  for (const order of orders) {
    const price = order.total_price ?? 0;
    const status = order.status;
    // variant_unit_count defaults to 1 for pre-migration orders or unmapped variants
    const unitCount = order.variant_unit_count ?? 1;

    totalOrders++;

    if (order.is_exchange) {
      // Exchange orders: extra delivery cycle, no additional revenue
      exchangeCount++;
      convertyFeeBaseExchange += price;
      // Exchange orders may also be shipped
      if (isNavexZoneStatus(status)) shippedCount++;
    } else if (status === "delivered") {
      deliveredCount++;
      totalRevenue += price;
      // Use variant_unit_count for COGS calculation (Change 5)
      totalDeliveredCartQuantity += unitCount;
      convertyFeeBaseDelivered += price;
      if (isNavexZoneStatus(status)) shippedCount++;
    } else if (isReturnStatus(status)) {
      returnedCount++;
      convertyFeeBaseReturned += price;
      if (isNavexZoneStatus(status)) shippedCount++;
    } else if (isFailedLeadStatus(status)) {
      convertyFeeBaseFailedLeads += price;
    } else {
      // confirmed, uploaded, in transit, unverified, attempt — not yet terminal
      if (isNavexZoneStatus(status)) shippedCount++;
    }

    // confirmedCount: any order that is NOT a failed lead
    if (!failedLeadSet.has(status)) {
      confirmedCount++;
    }
  }

  return {
    productId: product.id,
    productName: product.name,
    unitCogs: product.unit_cogs ?? 0,
    totalOrders,
    deliveredCount,
    returnedCount,
    exchangeCount,
    shippedCount,
    confirmedCount,
    totalRevenue,
    totalDeliveredCartQuantity,
    convertyFeeBaseDelivered,
    convertyFeeBaseReturned,
    convertyFeeBaseFailedLeads,
    convertyFeeBaseExchange,
  };
}

// ---------------------------------------------------------------------------
// Campaign spend query
// ---------------------------------------------------------------------------

/**
 * Fetch campaign spend for a product where the campaign period overlaps
 * the query period. Handles mixed campaigns via spend_allocations JSONB:
 * - NULL allocations: 1:1 mapping — full spend goes to campaign.product_id
 * - Non-null allocations: proportional split by percentage to each listed product
 */
export async function fetchCampaignSpend(
  supabase: SupabaseClient,
  productId: string,
  period: Period
): Promise<CampaignSpendAggregate> {
  const startStr = period.start.toISOString().slice(0, 10);
  const endStr = period.end.toISOString().slice(0, 10);

  // Fetch all campaigns in period — no product_id filter, because a mixed campaign
  // may have product_id = "product B" but allocate spend to "product A" via spend_allocations
  const { data, error } = await supabase
    .from("campaigns")
    .select("product_id, spend, leads, spend_allocations")
    .lte("period_start", endStr)
    .gte("period_end", startStr)
    .limit(5000);

  if (error) throw new Error(error.message);

  let totalSpend = 0;
  let totalLeads = 0;
  for (const row of data ?? []) {
    const allocs = row.spend_allocations as SpendAllocation[] | null;
    if (!allocs) {
      if (row.product_id === productId) {
        totalSpend += row.spend ?? 0;
        totalLeads += row.leads ?? 0;
      }
    } else {
      const entry = allocs.find((a) => a.product_id === productId);
      if (entry) {
        totalSpend += (row.spend ?? 0) * (entry.percentage / 100);
        totalLeads += (row.leads ?? 0) * (entry.percentage / 100);
      }
    }
  }
  return { productId, totalSpend, totalLeads };
}

/**
 * Fetch campaign spend for all products in a single query.
 * Returns a Map keyed by product_id — missing products default to zero spend.
 * Handles mixed campaigns via spend_allocations proportional split.
 */
export async function fetchAllCampaignSpends(
  supabase: SupabaseClient,
  period: Period
): Promise<Map<string, CampaignSpendAggregate>> {
  const startStr = period.start.toISOString().slice(0, 10);
  const endStr = period.end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("campaigns")
    .select("product_id, spend, leads, spend_allocations")
    .lte("period_start", endStr)
    .gte("period_end", startStr)
    .limit(5000);

  if (error) throw new Error(error.message);

  const result = new Map<string, CampaignSpendAggregate>();
  const getOrCreate = (pid: string): CampaignSpendAggregate => {
    if (!result.has(pid)) result.set(pid, { productId: pid, totalSpend: 0, totalLeads: 0 });
    return result.get(pid)!;
  };

  for (const row of data ?? []) {
    const allocs = row.spend_allocations as SpendAllocation[] | null;
    if (!allocs) {
      const agg = getOrCreate(row.product_id as string);
      agg.totalSpend += row.spend ?? 0;
      agg.totalLeads += row.leads ?? 0;
    } else {
      for (const entry of allocs) {
        const agg = getOrCreate(entry.product_id);
        agg.totalSpend += (row.spend ?? 0) * (entry.percentage / 100);
        agg.totalLeads += (row.leads ?? 0) * (entry.percentage / 100);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Product / overhead queries
// ---------------------------------------------------------------------------

export async function fetchActiveProducts(
  supabase: SupabaseClient,
  storeIds?: string[]
): Promise<ProductRow[]> {
  let query = supabase
    .from("products")
    .select("id, name, unit_cogs, store_id")
    .eq("is_active", true);

  if (storeIds && storeIds.length > 0) {
    query = query.in("store_id", storeIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductRow[];
}

export async function fetchOverheadCategories(
  supabase: SupabaseClient
): Promise<OverheadLine[]> {
  const { data, error } = await supabase
    .from("overhead_categories")
    .select("label, monthly_amount")
    .order("sort_order");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    label: row.label,
    monthlyAmount: Number(row.monthly_amount ?? 0),
  }));
}

export interface DailySettlementRow {
  date: string;
  expected_amount: number | null;
  actual_amount: number | null;
}

export async function fetchDailySettlements(
  supabase: SupabaseClient,
  period: Period
): Promise<DailySettlementRow[]> {
  const startStr = period.start.toISOString().slice(0, 10);
  const endStr = period.end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("daily_settlements")
    .select("date, expected_amount, actual_amount")
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date");

  if (error) throw new Error(error.message);
  return (data ?? []) as DailySettlementRow[];
}

// ---------------------------------------------------------------------------
// Reconciliation — order status history joined with orders for a full month
// ---------------------------------------------------------------------------

export interface StatusHistoryWithOrder {
  /** order_status_history.id */
  history_id: string;
  order_id: string;
  reference: string;
  status: string;
  /** ISO timestamp when this status change occurred in Converty */
  changed_at: string;
  total_price: number;
  is_duplicated: boolean;
  is_test: boolean;
}

/**
 * Fetch all order_status_history rows for a calendar month, joined with their
 * parent orders. Excludes duplicated and test orders at the query level.
 * Used to compute per-day expected Navex settlement amounts.
 */
export async function fetchOrderStatusHistoryForMonth(
  supabase: SupabaseClient,
  year: number,
  month: number // 1-based
): Promise<StatusHistoryWithOrder[]> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1); // first day of next month (exclusive)
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  // Fetch history rows within the month, joining orders for flags + price
  const { data, error } = await supabase
    .from("order_status_history")
    .select(
      "id, order_id, status, changed_at, orders!inner(reference, total_price, is_duplicated, is_test)"
    )
    .gte("changed_at", `${startStr}T00:00:00.000Z`)
    .lt("changed_at", `${endStr}T00:00:00.000Z`)
    .order("changed_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const order = row.orders as unknown as {
        reference: string;
        total_price: number | null;
        is_duplicated: boolean;
        is_test: boolean;
      };
      return {
        history_id: row.id as string,
        order_id: row.order_id as string,
        reference: order.reference,
        status: row.status as string,
        changed_at: row.changed_at as string,
        total_price: Number(order.total_price ?? 0),
        is_duplicated: order.is_duplicated,
        is_test: order.is_test,
      };
    })
    .filter((r) => !r.is_duplicated && !r.is_test);
}
