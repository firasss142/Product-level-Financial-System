import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CostComponentSnapshot = z.object({
  label: z.string(),
  amount: z.number().min(0),
});

const CreateBatchSchema = z.object({
  batch_number: z.string().min(1),
  quantity: z.number().int().positive(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  cost_breakdown: z.array(CostComponentSnapshot),
  set_as_active: z.boolean().default(true),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("product_batches")
      .select("id, batch_number, quantity, unit_cost, supplier, notes, cost_breakdown, created_at")
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
    const parsed = CreateBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supabase = await createClient();

    // Verify product exists
    const { error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .single();
    if (productError) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const { batch_number, quantity, supplier, notes, cost_breakdown, set_as_active } = parsed.data;
    const unit_cost = cost_breakdown.reduce((sum, c) => sum + c.amount, 0);

    const { data: batch, error: insertError } = await supabase
      .from("product_batches")
      .insert({
        product_id: productId,
        batch_number,
        quantity,
        unit_cost,
        supplier: supplier ?? null,
        notes: notes ?? null,
        cost_breakdown,
      })
      .select("id, batch_number, quantity, unit_cost, supplier, notes, cost_breakdown, created_at")
      .single();

    if (insertError) throw new Error(insertError.message);

    if (set_as_active) {
      await supabase
        .from("products")
        .update({ unit_cogs: unit_cost, updated_at: new Date().toISOString() })
        .eq("id", productId);
    }

    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
