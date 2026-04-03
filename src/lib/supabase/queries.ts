// ---------------------------------------------------------------------------
// Typed Supabase query helpers — return domain types, not raw DB rows.
// Server-side only.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductSummary, ProductWithCosts, CostComponent, ProductBatch } from "@/types/product";
import type { Investor, InvestmentDeal, Settlement } from "@/types/investor";
import { TERMINAL_STATUSES, type OrderRow } from "@/types/orders";
import type { Period } from "@/types/cost-model";
import type { SettingsKey } from "@/lib/settings";
import type { Settings } from "@/lib/settings";

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/** Fetch all active products with their store name (for lists / selectors) */
export async function queryActiveProducts(
  supabase: SupabaseClient
): Promise<ProductSummary[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, store_id, unit_cogs, is_active, created_at, stores(name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    store_id: p.store_id as string,
    store_name: (p.stores as unknown as { name: string } | null)?.name ?? null,
    unit_cogs: p.unit_cogs as number | null,
    is_active: p.is_active as boolean,
    created_at: p.created_at as string,
  }));
}

/** Fetch a single product with all cost components and batch history */
export async function queryProductWithCosts(
  supabase: SupabaseClient,
  productId: string
): Promise<ProductWithCosts | null> {
  const [productResult, componentsResult, batchesResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, store_id, unit_cogs, converty_product_id, variant_quantity_map, active_batch_id, is_active, created_at, updated_at")
      .eq("id", productId)
      .single(),
    supabase
      .from("product_cost_components")
      .select("id, product_id, label, amount, is_default, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_batches")
      .select("id, product_id, batch_number, quantity, unit_cogs, cost_breakdown, supplier, notes, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
  ]);

  if (productResult.error) {
    if (productResult.error.code === "PGRST116") return null;
    throw new Error(productResult.error.message);
  }
  if (componentsResult.error) throw new Error(componentsResult.error.message);
  if (batchesResult.error) throw new Error(batchesResult.error.message);

  const p = productResult.data;

  const cost_components: CostComponent[] = (componentsResult.data ?? []).map((c) => ({
    id: c.id as string,
    product_id: c.product_id as string,
    label: c.label as string,
    amount: Number(c.amount),
    is_default: c.is_default as boolean,
    sort_order: c.sort_order as number,
  }));

  const batches: ProductBatch[] = (batchesResult.data ?? []).map((b) => ({
    id: b.id as string,
    product_id: b.product_id as string,
    batch_number: b.batch_number as string,
    quantity: b.quantity as number,
    unit_cogs: Number(b.unit_cogs),
    cost_breakdown: (b.cost_breakdown ?? []) as Array<{ label: string; amount: number }>,
    supplier: (b.supplier as string | null) ?? null,
    notes: (b.notes as string | null) ?? null,
    created_at: b.created_at as string,
  }));

  return {
    id: p.id as string,
    store_id: p.store_id as string,
    name: p.name as string,
    unit_cogs: Number(p.unit_cogs ?? 0),
    converty_product_id: (p.converty_product_id as string | null) ?? null,
    variant_quantity_map: (p.variant_quantity_map as Record<string, number>) ?? {},
    active_batch_id: (p.active_batch_id as string | null) ?? null,
    is_active: p.is_active as boolean,
    created_at: p.created_at as string,
    updated_at: p.updated_at as string,
    cost_components,
    batches,
    active_batch: batches[0],
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Fetch all settings as a typed Settings object */
export async function querySettings(supabase: SupabaseClient): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .select("key, value");

  if (error) throw new Error(error.message);

  const map = Object.fromEntries((data ?? []).map((r) => [r.key as SettingsKey, Number(r.value)]));

  return {
    navex_delivery_fee: map.navex_delivery_fee ?? 0,
    navex_return_fee: map.navex_return_fee ?? 0,
    navex_daily_pickup_fee: map.navex_daily_pickup_fee ?? 0,
    converty_platform_fee_rate: map.converty_platform_fee_rate ?? 0,
    packing_cost: map.packing_cost ?? 0,
  };
}

/** Fetch a single setting value by key */
export async function querySettingByKey(
  supabase: SupabaseClient,
  key: SettingsKey
): Promise<number> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error) throw new Error(error.message);
  return Number(data.value);
}

// ---------------------------------------------------------------------------
// Orders (calculation-safe: excludes duplicated + test)
// ---------------------------------------------------------------------------

/** Fetch filtered orders for profitability calculations */
export async function queryOrdersForPeriod(
  supabase: SupabaseClient,
  period: Period,
  options: { productId?: string; storeId?: string } = {}
): Promise<OrderRow[]> {
  let query = supabase
    .from("orders")
    .select(
      "id, store_id, product_id, reference, total_price, status, is_duplicated, is_exchange, is_test, cart, converty_created_at, converty_order_id, selected_variant_id, selected_variant_sku, variant_unit_count"
    )
    .eq("is_duplicated", false)
    .eq("is_test", false)
    .gte("converty_created_at", period.start.toISOString())
    .lte("converty_created_at", period.end.toISOString());

  if (options.productId) {
    query = query.eq("product_id", options.productId);
  }
  if (options.storeId) {
    query = query.eq("store_id", options.storeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderRow[];
}

// ---------------------------------------------------------------------------
// Stuck orders (dashboard alerts)
// ---------------------------------------------------------------------------

export interface StuckOrderRow {
  id: string;
  reference: string;
  status: string;
  product_name: string | null;
  converty_created_at: string;
  hours_stuck: number;
}

/** Fetch non-terminal orders older than 48 hours (stuck in pipeline) */
export async function fetchStuckOrders(
  supabase: SupabaseClient
): Promise<StuckOrderRow[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select("id, reference, status, converty_created_at, products(name)")
    .eq("is_duplicated", false)
    .eq("is_test", false)
    .not("status", "in", `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(",")})`)
    .lt("converty_created_at", cutoff)
    .order("converty_created_at", { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);

  const now = Date.now();
  return (data ?? []).map((row) => ({
    id: row.id as string,
    reference: row.reference as string,
    status: row.status as string,
    product_name: (row.products as unknown as { name: string } | null)?.name ?? null,
    converty_created_at: row.converty_created_at as string,
    hours_stuck: Math.round((now - new Date(row.converty_created_at as string).getTime()) / (1000 * 60 * 60)),
  }));
}

// ---------------------------------------------------------------------------
// Investors
// ---------------------------------------------------------------------------

/** Fetch all active investors */
export async function queryActiveInvestors(
  supabase: SupabaseClient
): Promise<Investor[]> {
  const { data, error } = await supabase
    .from("investors")
    .select("id, name, email, phone, notes, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    email: (i.email as string | null) ?? null,
    phone: (i.phone as string | null) ?? null,
    notes: (i.notes as string | null) ?? null,
    is_active: i.is_active as boolean,
    created_at: i.created_at as string,
    updated_at: i.updated_at as string,
  }));
}

/** Fetch all active deals for an investor */
export async function queryDealsByInvestor(
  supabase: SupabaseClient,
  investorId: string
): Promise<InvestmentDeal[]> {
  const { data, error } = await supabase
    .from("investment_deals")
    .select(
      "id, investor_id, scope_type, scope_id, capital_amount, profit_share_rate, loss_share_rate, start_date, end_date, is_active, notes, created_at, updated_at"
    )
    .eq("investor_id", investorId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((d) => ({
    id: d.id as string,
    investor_id: d.investor_id as string,
    scope_type: d.scope_type as InvestmentDeal["scope_type"],
    scope_id: (d.scope_id as string | null) ?? null,
    capital_amount: Number(d.capital_amount),
    profit_share_rate: Number(d.profit_share_rate),
    loss_share_rate: Number(d.loss_share_rate),
    start_date: d.start_date as string,
    end_date: (d.end_date as string | null) ?? null,
    is_active: d.is_active as boolean,
    notes: (d.notes as string | null) ?? null,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  }));
}

/** Fetch a single deal by ID */
export async function queryDealById(
  supabase: SupabaseClient,
  dealId: string
): Promise<InvestmentDeal | null> {
  const { data, error } = await supabase
    .from("investment_deals")
    .select(
      "id, investor_id, scope_type, scope_id, capital_amount, profit_share_rate, loss_share_rate, start_date, end_date, is_active, notes, created_at, updated_at"
    )
    .eq("id", dealId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  return {
    id: data.id as string,
    investor_id: data.investor_id as string,
    scope_type: data.scope_type as InvestmentDeal["scope_type"],
    scope_id: (data.scope_id as string | null) ?? null,
    capital_amount: Number(data.capital_amount),
    profit_share_rate: Number(data.profit_share_rate),
    loss_share_rate: Number(data.loss_share_rate),
    start_date: data.start_date as string,
    end_date: (data.end_date as string | null) ?? null,
    is_active: data.is_active as boolean,
    notes: (data.notes as string | null) ?? null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

/** Fetch store IDs belonging to a Converty account */
export async function queryStoreIdsByAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .eq("converty_account_id", accountId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => s.id as string);
}

/** Fetch all settlements for a deal, ordered newest first */
export async function querySettlementsByDeal(
  supabase: SupabaseClient,
  dealId: string
): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from("settlements")
    .select(
      "id, deal_id, period_start, period_end, snapshot, total_revenue, total_costs, net_profit, capital_return_this_period, investor_share, created_at"
    )
    .eq("deal_id", dealId)
    .order("period_start", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((s) => ({
    id: s.id as string,
    deal_id: s.deal_id as string,
    period_start: s.period_start as string,
    period_end: s.period_end as string,
    snapshot: s.snapshot as Settlement["snapshot"],
    total_revenue: Number(s.total_revenue),
    total_costs: Number(s.total_costs),
    net_profit: Number(s.net_profit),
    capital_return_this_period: Number(s.capital_return_this_period),
    investor_share: Number(s.investor_share),
    created_at: s.created_at as string,
  }));
}
