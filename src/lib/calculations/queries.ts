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
 * the query period (no pro-rating in v1 — full spend if any overlap).
 */
export async function fetchCampaignSpend(
  supabase: SupabaseClient,
  productId: string,
  period: Period
): Promise<CampaignSpendAggregate> {
  const startStr = period.start.toISOString().slice(0, 10);
  const endStr = period.end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("campaigns")
    .select("spend, leads")
    .eq("product_id", productId)
    .lte("period_start", endStr)
    .gte("period_end", startStr);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return {
    productId,
    totalSpend: rows.reduce((s, r) => s + (r.spend ?? 0), 0),
    totalLeads: rows.reduce((s, r) => s + (r.leads ?? 0), 0),
  };
}

/**
 * Fetch campaign spend for all products in a single query.
 * Returns a Map keyed by product_id — missing products default to zero spend.
 */
export async function fetchAllCampaignSpends(
  supabase: SupabaseClient,
  period: Period
): Promise<Map<string, CampaignSpendAggregate>> {
  const startStr = period.start.toISOString().slice(0, 10);
  const endStr = period.end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("campaigns")
    .select("product_id, spend, leads")
    .lte("period_start", endStr)
    .gte("period_end", startStr);

  if (error) throw new Error(error.message);

  const result = new Map<string, CampaignSpendAggregate>();
  for (const row of data ?? []) {
    const pid = row.product_id as string;
    const existing = result.get(pid) ?? { productId: pid, totalSpend: 0, totalLeads: 0 };
    existing.totalSpend += row.spend ?? 0;
    existing.totalLeads += row.leads ?? 0;
    result.set(pid, existing);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Product / overhead queries
// ---------------------------------------------------------------------------

export async function fetchActiveProducts(
  supabase: SupabaseClient
): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, unit_cogs")
    .eq("is_active", true);

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
