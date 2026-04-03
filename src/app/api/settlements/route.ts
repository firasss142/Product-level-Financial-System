import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SettlementCreateSchema } from "@/lib/supabase/schemas";
import { computeSettlement } from "@/lib/calculations";
import { parsePeriod } from "@/types/cost-model";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = SettlementCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { deal_id, period_start, period_end } = parsed.data;

    const period = parsePeriod(period_start, period_end);

    // Compute the settlement waterfall
    const result = await computeSettlement(deal_id, period);

    // Insert immutable snapshot
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("settlements")
      .insert({
        deal_id,
        period_start,
        period_end,
        snapshot: result.waterfall,
        total_revenue: result.total_revenue,
        total_costs: result.total_costs,
        net_profit: result.net_profit,
        capital_return_this_period: result.capital_return_this_period,
        investor_share: result.investor_share,
      })
      .select(
        "id, deal_id, period_start, period_end, snapshot, total_revenue, total_costs, net_profit, capital_return_this_period, investor_share, created_at"
      )
      .single();

    if (error) {
      // Unique constraint violation → duplicate settlement
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Un règlement existe déjà pour cet accord et cette période" },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    const status = message === "Accord introuvable" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
