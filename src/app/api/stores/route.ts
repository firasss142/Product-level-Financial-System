// ---------------------------------------------------------------------------
// /api/stores — Stores (niche level under a Converty account)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { StoreCreateSchema, StoreUpdateSchema } from "@/lib/supabase/schemas";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const convertyAccountId = searchParams.get("converty_account_id");

    const supabase = await createClient();
    let query = supabase
      .from("stores")
      .select("id, converty_account_id, converty_store_id, name, navex_account_id, is_active, created_at, updated_at")
      .order("created_at", { ascending: true });

    if (convertyAccountId) {
      query = query.eq("converty_account_id", convertyAccountId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = StoreCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stores")
      .insert({ ...parsed.data, is_active: true })
      .select("id, converty_account_id, converty_store_id, name, navex_account_id, is_active, created_at, updated_at")
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
    const parsed = StoreUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { id, ...updates } = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stores")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, converty_account_id, converty_store_id, name, navex_account_id, is_active, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
