import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { InvestorCreateSchema, InvestorUpdateSchema } from "@/lib/supabase/schemas";
import { queryActiveInvestors } from "@/lib/supabase/queries";

export async function GET() {
  try {
    const supabase = await createClient();
    const investors = await queryActiveInvestors(supabase);

    // Fetch deal stats per investor in one query
    const { data: deals, error: dealError } = await supabase
      .from("investment_deals")
      .select("investor_id, capital_amount, is_active");

    if (dealError) throw new Error(dealError.message);

    // Fetch latest settlement per investor (through deals)
    const { data: settlements, error: settError } = await supabase
      .from("settlements")
      .select("deal_id, created_at, investment_deals!inner(investor_id)")
      .order("created_at", { ascending: false });

    if (settError) throw new Error(settError.message);

    // Build lookup maps
    const dealStats = new Map<string, { activeCount: number; totalCapital: number }>();
    for (const d of deals ?? []) {
      const iid = d.investor_id as string;
      const stats = dealStats.get(iid) ?? { activeCount: 0, totalCapital: 0 };
      if (d.is_active) {
        stats.activeCount++;
        stats.totalCapital += Number(d.capital_amount ?? 0);
      }
      dealStats.set(iid, stats);
    }

    const latestSettlement = new Map<string, string>();
    for (const s of settlements ?? []) {
      const iid = (s.investment_deals as unknown as { investor_id: string }).investor_id;
      if (!latestSettlement.has(iid)) {
        latestSettlement.set(iid, s.created_at as string);
      }
    }

    const rows = investors.map((i) => {
      const stats = dealStats.get(i.id) ?? { activeCount: 0, totalCapital: 0 };
      return {
        ...i,
        active_deals_count: stats.activeCount,
        total_capital: stats.totalCapital,
        last_settlement_at: latestSettlement.get(i.id) ?? null,
      };
    });

    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = InvestorCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("investors")
      .insert({ ...parsed.data, is_active: true })
      .select("id, name, email, phone, notes, is_active, created_at, updated_at")
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
    const parsed = InvestorUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { id, ...updates } = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("investors")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name, email, phone, notes, is_active, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
