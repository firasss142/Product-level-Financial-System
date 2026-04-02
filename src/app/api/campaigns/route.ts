import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CampaignCreateSchema, CampaignsQuerySchema } from "@/lib/supabase/schemas";
import type { CampaignRow } from "@/types/cost-model";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = CampaignsQuerySchema.safeParse({
      period_start: searchParams.get("period_start"),
      period_end: searchParams.get("period_end"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { period_start, period_end } = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("campaigns")
      .select("*, products(name)")
      .lte("period_start", period_end)
      .gte("period_end", period_start)
      .order("period_start", { ascending: false });

    if (error) throw new Error(error.message);

    const rows: CampaignRow[] = (data ?? []).map((r) => ({
      id: r.id as string,
      product_id: r.product_id as string,
      product_name: (r.products as unknown as { name: string } | null)?.name ?? null,
      platform: r.platform as string,
      campaign_name: (r.campaign_name as string | null) ?? null,
      campaign_id: (r.campaign_id as string | null) ?? null,
      spend: Number(r.spend ?? 0),
      leads: Number(r.leads ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      period_start: r.period_start as string,
      period_end: r.period_end as string,
      spend_allocations: (r.spend_allocations ?? null) as CampaignRow["spend_allocations"],
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
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
    const parsed = CampaignCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supabase = await createClient();
    const payload = parsed.data;

    // campaign_id present → upsert (dedup Meta syncs); absent → always insert (manual entry)
    const query = payload.campaign_id
      ? supabase.from("campaigns").upsert(payload, {
          onConflict: "campaign_id,platform,period_start,period_end",
          ignoreDuplicates: false,
        })
      : supabase.from("campaigns").insert(payload);

    const { data, error } = await query.select("*, products(name)").single();
    if (error) throw new Error(error.message);

    return NextResponse.json(
      {
        ...data,
        product_name: (data.products as unknown as { name: string } | null)?.name ?? null,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
