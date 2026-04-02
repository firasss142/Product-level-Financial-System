import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CampaignSyncSchema } from "@/lib/supabase/schemas";

interface MetaInsightAction {
  action_type: string;
  value: string;
}

interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  actions?: MetaInsightAction[];
  date_start: string;
  date_stop: string;
}

interface MetaInsightsResponse {
  data: MetaInsightRow[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message: string; code: number };
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = CampaignSyncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { ad_account_id, period_start, period_end, default_product_id } = parsed.data;

    const token = process.env.META_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "META_ACCESS_TOKEN non configuré" },
        { status: 500 }
      );
    }

    // Fetch campaign insights from Meta Graph API
    const timeRange = JSON.stringify({ since: period_start, until: period_end });
    const fields = "campaign_id,campaign_name,spend,impressions,clicks,actions";
    const url =
      `https://graph.facebook.com/v20.0/${ad_account_id}/insights` +
      `?fields=${encodeURIComponent(fields)}` +
      `&time_range=${encodeURIComponent(timeRange)}` +
      `&level=campaign` +
      `&access_token=${token}`;

    const metaRes = await fetch(url);
    const metaJson = (await metaRes.json()) as MetaInsightsResponse;

    if (!metaRes.ok || metaJson.error) {
      const msg = metaJson.error?.message ?? `Erreur Meta API (${metaRes.status})`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const payloads = (metaJson.data ?? []).map((row) => {
      const leads =
        row.actions?.find(
          (a) =>
            a.action_type === "lead" ||
            a.action_type === "onsite_conversion.lead_grouped"
        )?.value ?? "0";

      return {
        product_id: default_product_id,
        platform: "meta",
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name ?? null,
        spend: parseFloat(row.spend ?? "0"),
        impressions: parseInt(row.impressions ?? "0", 10),
        clicks: parseInt(row.clicks ?? "0", 10),
        leads: parseInt(leads, 10),
        period_start,
        period_end,
      };
    });

    if (payloads.length === 0) {
      return NextResponse.json({ synced: 0, errors: [] });
    }

    const supabase = await createClient();
    const { error: upsertError } = await supabase
      .from("campaigns")
      .upsert(payloads, {
        onConflict: "campaign_id,platform,period_start,period_end",
        ignoreDuplicates: false,
      });

    if (upsertError) throw new Error(upsertError.message);

    return NextResponse.json({ synced: payloads.length, errors: [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
