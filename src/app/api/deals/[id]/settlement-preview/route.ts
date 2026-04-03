import { NextResponse } from "next/server";
import { computeSettlement } from "@/lib/calculations";
import { parsePeriod } from "@/types/cost-model";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;
    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("period_start");
    const periodEnd = searchParams.get("period_end");

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "period_start et period_end sont requis" },
        { status: 422 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(periodStart) || !dateRegex.test(periodEnd)) {
      return NextResponse.json(
        { error: "Format de date invalide (attendu : YYYY-MM-DD)" },
        { status: 422 }
      );
    }

    if (periodStart > periodEnd) {
      return NextResponse.json(
        { error: "period_start doit être antérieure ou égale à period_end" },
        { status: 422 }
      );
    }

    const period = parsePeriod(periodStart, periodEnd);

    const result = await computeSettlement(dealId, period);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    const status = message === "Accord introuvable" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
