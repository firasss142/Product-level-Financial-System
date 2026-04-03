import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { querySettlementsByDeal } from "@/lib/supabase/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const supabase = await createClient();
    const settlements = await querySettlementsByDeal(supabase, dealId);
    return NextResponse.json(settlements);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
