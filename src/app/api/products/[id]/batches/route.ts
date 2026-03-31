import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BatchCreateSchema } from "@/lib/supabase/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("product_batches")
      .select("id, batch_number, quantity, unit_cogs, supplier, notes, cost_breakdown, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const body: unknown = await request.json();
    const parsed = BatchCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supabase = await createClient();

    const { error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .single();
    if (productError) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const { batch_number, quantity, supplier, notes, cost_breakdown, set_as_active } = parsed.data;
    const unit_cogs = cost_breakdown.reduce((sum, c) => sum + c.amount, 0);

    const { data: batch, error: insertError } = await supabase
      .from("product_batches")
      .insert({
        product_id: productId,
        batch_number,
        quantity,
        unit_cogs,
        supplier: supplier ?? null,
        notes: notes ?? null,
        cost_breakdown,
      })
      .select("id, batch_number, quantity, unit_cogs, supplier, notes, cost_breakdown, created_at")
      .single();

    if (insertError) throw new Error(insertError.message);

    if (set_as_active) {
      const { error: activateError } = await supabase
        .from("products")
        .update({ unit_cogs, active_batch_id: batch.id, updated_at: new Date().toISOString() })
        .eq("id", productId);
      if (activateError) throw new Error(activateError.message);
    }

    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
