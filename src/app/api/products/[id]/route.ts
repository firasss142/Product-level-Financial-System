import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const [productRes, componentsRes, batchesRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, account_id, unit_cogs, is_active, created_at, updated_at, accounts(id, name)")
        .eq("id", id)
        .single(),
      supabase
        .from("product_cost_components")
        .select("id, label, amount, is_default, sort_order")
        .eq("product_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("product_batches")
        .select("id, batch_number, quantity, unit_cost, supplier, notes, cost_breakdown, created_at")
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (productRes.error) {
      if (productRes.error.code === "PGRST116") {
        return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
      }
      throw new Error(productRes.error.message);
    }

    const p = productRes.data;
    return NextResponse.json({
      id: p.id,
      name: p.name,
      account_id: p.account_id,
      account_name: (p.accounts as unknown as { id: string; name: string } | null)?.name ?? null,
      unit_cogs: p.unit_cogs,
      is_active: p.is_active,
      created_at: p.created_at,
      updated_at: p.updated_at,
      cost_components: componentsRes.data ?? [],
      batches: batchesRes.data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
