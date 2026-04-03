import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DealCreateSchema, DealUpdateSchema } from "@/lib/supabase/schemas";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = DealCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("investment_deals")
      .insert({ ...parsed.data, is_active: true })
      .select(
        "id, investor_id, scope_type, scope_id, capital_amount, profit_share_rate, loss_share_rate, start_date, end_date, is_active, notes, created_at, updated_at"
      )
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
    const parsed = DealUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { id, ...updates } = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("investment_deals")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(
        "id, investor_id, scope_type, scope_id, capital_amount, profit_share_rate, loss_share_rate, start_date, end_date, is_active, notes, created_at, updated_at"
      )
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
