import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CampaignUpdateSchema, UuidSchema } from "@/lib/supabase/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idParsed = UuidSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 422 });
    }

    const body: unknown = await request.json();
    const parsed = CampaignUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("campaigns")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, products(name)")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ...data,
      product_name: (data.products as unknown as { name: string } | null)?.name ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
