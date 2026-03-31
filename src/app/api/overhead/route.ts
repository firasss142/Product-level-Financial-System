import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OverheadCreateSchema, OverheadUpdateSchema } from "@/lib/supabase/schemas";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("overhead_categories")
      .select("id, label, monthly_amount, sort_order, is_active, created_at, updated_at")
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = OverheadCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("overhead_categories")
      .insert(parsed.data)
      .select("id, label, monthly_amount, sort_order, is_active, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = OverheadUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { id, ...updates } = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("overhead_categories")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, label, monthly_amount, sort_order, is_active, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
