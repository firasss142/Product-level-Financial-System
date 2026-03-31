import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreateSchema = z.object({
  name: z.string().min(1),
  account_id: z.string().uuid(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  account_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

const DEFAULT_COMPONENTS = [
  { label: "Prix d'achat fournisseur", is_default: true, sort_order: 1 },
  { label: "Frais de douane / import", is_default: true, sort_order: 2 },
  { label: "Main d'œuvre / assemblage", is_default: true, sort_order: 3 },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");

    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select("id, name, account_id, unit_cogs, is_active, created_at, accounts(name)")
      .order("created_at", { ascending: false });

    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      account_id: p.account_id,
      account_name: (p.accounts as unknown as { name: string } | null)?.name ?? null,
      unit_cogs: p.unit_cogs,
      is_active: p.is_active,
      created_at: p.created_at,
    }));

    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = CreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supabase = await createClient();
    const { data: product, error: insertError } = await supabase
      .from("products")
      .insert({ ...parsed.data, is_active: true, unit_cogs: 0 })
      .select("id, name, account_id, unit_cogs, is_active, created_at")
      .single();

    if (insertError) throw new Error(insertError.message);

    // Seed default cost components
    const components = DEFAULT_COMPONENTS.map((c) => ({
      ...c,
      product_id: product.id,
      amount: 0,
    }));
    await supabase.from("product_cost_components").insert(components);

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = UpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { id, ...updates } = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name, account_id, unit_cogs, is_active, created_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
