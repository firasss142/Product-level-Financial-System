import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryDealsByInvestor } from "@/lib/supabase/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch investor
    const { data: investor, error: invError } = await supabase
      .from("investors")
      .select("id, name, email, phone, notes, is_active, created_at, updated_at")
      .eq("id", id)
      .single();

    if (invError) {
      if (invError.code === "PGRST116") {
        return NextResponse.json({ error: "Investisseur introuvable" }, { status: 404 });
      }
      throw new Error(invError.message);
    }

    // Fetch deals
    const deals = await queryDealsByInvestor(supabase, id);

    // Resolve scope display names for each deal
    const scopeIds = deals
      .filter((d) => d.scope_id)
      .map((d) => ({ type: d.scope_type, id: d.scope_id! }));

    const productIds = scopeIds.filter((s) => s.type === "product").map((s) => s.id);
    const accountIds = scopeIds.filter((s) => s.type === "account").map((s) => s.id);

    const [productNames, accountEmails] = await Promise.all([
      productIds.length > 0
        ? supabase
            .from("products")
            .select("id, name")
            .in("id", productIds)
            .then(({ data }) => new Map((data ?? []).map((p) => [p.id as string, p.name as string])))
        : Promise.resolve(new Map<string, string>()),
      accountIds.length > 0
        ? supabase
            .from("converty_accounts")
            .select("id, email")
            .in("id", accountIds)
            .then(({ data }) => new Map((data ?? []).map((a) => [a.id as string, a.email as string])))
        : Promise.resolve(new Map<string, string>()),
    ]);

    const dealsWithScope = deals.map((d) => ({
      ...d,
      scope_name:
        d.scope_type === "business"
          ? "Global"
          : d.scope_type === "product"
            ? productNames.get(d.scope_id!) ?? d.scope_id
            : accountEmails.get(d.scope_id!) ?? d.scope_id,
    }));

    return NextResponse.json({ investor, deals: dealsWithScope });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
