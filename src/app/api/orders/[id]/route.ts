import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const [orderRes, historyRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, reference, status, total_price, is_duplicated, is_exchange, is_test, product_id, account_id, cart, customer_data, converty_created_at, products(id, name), accounts(id, name)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("order_status_history")
        .select("id, status, created_at, action_taker")
        .eq("order_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (orderRes.error) {
      if (orderRes.error.code === "PGRST116") {
        return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
      }
      throw new Error(orderRes.error.message);
    }

    const o = orderRes.data;
    return NextResponse.json({
      id: o.id,
      reference: o.reference,
      status: o.status,
      total_price: o.total_price,
      is_duplicated: o.is_duplicated,
      is_exchange: o.is_exchange,
      is_test: o.is_test,
      product_id: o.product_id,
      product_name: (o.products as unknown as { id: string; name: string } | null)?.name ?? null,
      account_id: o.account_id,
      account_name: (o.accounts as unknown as { id: string; name: string } | null)?.name ?? null,
      cart: o.cart,
      customer_data: o.customer_data,
      converty_created_at: o.converty_created_at,
      status_history: historyRes.data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
