import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ComponentSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  amount: z.number().min(0),
  is_default: z.boolean(),
  sort_order: z.number().int().optional(),
});

const SaveSchema = z.object({
  components: z.array(ComponentSchema),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const body: unknown = await request.json();
    const parsed = SaveSchema.safeParse(body);

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

    const { components } = parsed.data;

    // Get existing components to know which custom ones to delete
    const { data: existing } = await supabase
      .from("product_cost_components")
      .select("id, is_default")
      .eq("product_id", productId);

    const incomingIds = new Set(components.filter((c) => c.id).map((c) => c.id!));
    const toDelete = (existing ?? [])
      .filter((e) => !e.is_default && !incomingIds.has(e.id))
      .map((e) => e.id);

    if (toDelete.length > 0) {
      await supabase
        .from("product_cost_components")
        .delete()
        .in("id", toDelete);
    }

    // Upsert all components
    const upsertData = components.map((c, idx) => ({
      ...(c.id ? { id: c.id } : {}),
      product_id: productId,
      label: c.label,
      amount: c.amount,
      is_default: c.is_default,
      sort_order: c.sort_order ?? idx + 1,
    }));

    const { data: saved, error: upsertError } = await supabase
      .from("product_cost_components")
      .upsert(upsertData, { onConflict: "id" })
      .select("id, label, amount, is_default, sort_order")
      .order("sort_order", { ascending: true });

    if (upsertError) throw new Error(upsertError.message);

    // Recompute total and update unit_cogs
    const total = components.reduce((sum, c) => sum + c.amount, 0);
    const { error: updateError } = await supabase
      .from("products")
      .update({ unit_cogs: total, updated_at: new Date().toISOString() })
      .eq("id", productId);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ components: saved, unit_cogs: total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
