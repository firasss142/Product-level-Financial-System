import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Last day of a given month (1-based) */
function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // day 0 of next month = last day of this month
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get("year");
    const monthStr = searchParams.get("month");

    if (!yearStr || !monthStr) {
      return NextResponse.json(
        { error: "Paramètres year et month requis" },
        { status: 400 }
      );
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    }

    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodEnd = lastDayOfMonth(year, month);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("damaged_returns")
      .select("count, notes")
      .eq("product_id", productId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      count: data?.count ?? 0,
      notes: data?.notes ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const body = (await request.json()) as {
      count: number;
      notes?: string | null;
      year: number;
      month: number;
    };

    const { count, notes, year, month } = body;

    if (
      typeof count !== "number" ||
      count < 0 ||
      typeof year !== "number" ||
      typeof month !== "number" ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodEnd = lastDayOfMonth(year, month);

    const supabase = await createClient();

    // Check if a row already exists for this product + month
    const { data: existing, error: selectError } = await supabase
      .from("damaged_returns")
      .select("id")
      .eq("product_id", productId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (selectError) throw new Error(selectError.message);

    let error;
    if (existing) {
      // Update existing row
      ({ error } = await supabase
        .from("damaged_returns")
        .update({
          count: Math.max(0, Math.round(count)),
          notes: notes ?? null,
        })
        .eq("id", existing.id));
    } else {
      // Insert new row
      ({ error } = await supabase.from("damaged_returns").insert({
        product_id: productId,
        period_start: periodStart,
        period_end: periodEnd,
        count: Math.max(0, Math.round(count)),
        notes: notes ?? null,
      }));
    }

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
