import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statuses = searchParams.getAll("status");
    const productId = searchParams.get("product_id");
    const storeId = searchParams.get("store_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const showAll = searchParams.get("show_all") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "500", 10), 1000);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

    const supabase = await createClient();

    let query = supabase
      .from("orders")
      .select(
        "id, reference, status, total_price, is_duplicated, is_exchange, is_test, product_id, store_id, converty_created_at, variant_unit_count, products(name), stores(name)",
        { count: "exact" }
      )
      .order("converty_created_at", { ascending: false });

    if (!showAll) {
      query = query.eq("is_duplicated", false).eq("is_test", false);
    }

    if (statuses.length > 0) {
      query = query.in("status", statuses);
    }

    if (productId) query = query.eq("product_id", productId);
    if (storeId) query = query.eq("store_id", storeId);
    if (dateFrom) query = query.gte("converty_created_at", dateFrom);
    if (dateTo) {
      const end = dateTo.endsWith("T") ? dateTo : `${dateTo}T23:59:59.999Z`;
      query = query.lte("converty_created_at", end);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((o) => ({
      id: o.id,
      reference: o.reference,
      status: o.status,
      total_price: o.total_price,
      is_duplicated: o.is_duplicated,
      is_exchange: o.is_exchange,
      is_test: o.is_test,
      product_id: o.product_id,
      product_name: (o.products as unknown as { name: string } | null)?.name ?? null,
      store_id: o.store_id,
      store_name: (o.stores as unknown as { name: string } | null)?.name ?? null,
      converty_created_at: o.converty_created_at,
      variant_unit_count: o.variant_unit_count,
    }));

    return NextResponse.json({ data: rows, total: count ?? rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
