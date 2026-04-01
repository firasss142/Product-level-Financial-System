// ---------------------------------------------------------------------------
// GET  /api/reconciliation?month=YYYY-MM   — daily expected vs actual for a month
// POST /api/reconciliation                 — upsert actual_amount for one day
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOrderStatusHistoryForMonth } from "@/lib/calculations/queries";
import { querySettings } from "@/lib/supabase/queries";
import { isNavexZoneStatus, isReturnStatus } from "@/types/orders";
import { DailySettlementUpsertSchema } from "@/lib/supabase/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconciliationOrderDetail {
  reference: string;
  total_price: number;
  contribution: "delivered" | "deposited" | "returned";
}

export interface ReconciliationDay {
  date: string; // YYYY-MM-DD
  delivered_count: number;
  returned_count: number;
  expected_amount: number;
  actual_amount: number | null;
  difference: number | null; // actual - expected, null if no actual entered
  orders: ReconciliationOrderDetail[];
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // YYYY-MM

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json(
        { error: "Paramètre 'month' requis au format YYYY-MM" },
        { status: 400 }
      );
    }

    const [yearStr, monthStr] = monthParam.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-based

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Mois invalide" }, { status: 400 });
    }

    const supabase = await createClient();

    const monthStart = `${monthParam}-01`;
    const lastDay = new Date(year, month, 0).getDate(); // days in month
    const monthEnd = `${monthParam}-${String(lastDay).padStart(2, "0")}`;

    // Fetch all data in parallel
    const [historyRows, settings, savedResult] = await Promise.all([
      fetchOrderStatusHistoryForMonth(supabase, year, month),
      querySettings(supabase),
      supabase
        .from("daily_settlements")
        .select("date, actual_amount")
        .gte("date", monthStart)
        .lte("date", monthEnd),
    ]);

    if (savedResult.error) throw new Error(savedResult.error.message);

    const { navex_delivery_fee, navex_return_fee, navex_daily_pickup_fee } = settings;

    const actualByDate = new Map<string, number>();
    for (const row of savedResult.data ?? []) {
      actualByDate.set(row.date as string, Number(row.actual_amount ?? 0));
    }

    // -----------------------------------------------------------------------
    // Single pass over historyRows: build firstNavexEntry + byDate groups
    // -----------------------------------------------------------------------

    interface DayAccumulator {
      delivered: ReconciliationOrderDetail[];
      deposited: ReconciliationOrderDetail[];
      returned: ReconciliationOrderDetail[];
    }

    const firstNavexEntry = new Map<string, { date: string; reference: string; total_price: number }>();
    const byDate = new Map<string, DayAccumulator>();

    const getDay = (date: string): DayAccumulator => {
      if (!byDate.has(date)) {
        byDate.set(date, { delivered: [], deposited: [], returned: [] });
      }
      return byDate.get(date)!;
    };

    for (const row of historyRows) {
      const rowDate = row.changed_at.slice(0, 10);

      if (isNavexZoneStatus(row.status)) {
        const existing = firstNavexEntry.get(row.order_id);
        if (!existing || rowDate < existing.date) {
          firstNavexEntry.set(row.order_id, {
            date: rowDate,
            reference: row.reference,
            total_price: row.total_price,
          });
        }
      }

      if (row.status === "delivered") {
        getDay(rowDate).delivered.push({
          reference: row.reference,
          total_price: row.total_price,
          contribution: "delivered",
        });
      } else if (isReturnStatus(row.status)) {
        getDay(rowDate).returned.push({
          reference: row.reference,
          total_price: row.total_price,
          contribution: "returned",
        });
      }
    }

    // Deposited (first Navex-zone entry per order) — delivery fee day
    for (const [, entry] of firstNavexEntry) {
      if (entry.date >= monthStart && entry.date <= monthEnd) {
        getDay(entry.date).deposited.push({
          reference: entry.reference,
          total_price: entry.total_price,
          contribution: "deposited",
        });
      }
    }

    // -----------------------------------------------------------------------
    // Build one row per calendar day in the month
    // -----------------------------------------------------------------------

    const days: ReconciliationDay[] = [];

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${monthParam}-${String(d).padStart(2, "0")}`;
      const acc = byDate.get(dateStr) ?? { delivered: [], deposited: [], returned: [] };

      // Determine if this is a working day (Mon–Sat; Sun = day 0)
      const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=Sun
      const isWorkingDay = dayOfWeek !== 0;

      const revenueFromDelivered = acc.delivered.reduce((s, o) => s + o.total_price, 0);
      const deliveryFees = acc.deposited.length * navex_delivery_fee;
      const returnFees = acc.returned.length * navex_return_fee;
      const pickupFee = isWorkingDay ? navex_daily_pickup_fee : 0;

      const expected = revenueFromDelivered - deliveryFees - returnFees - pickupFee;

      const actual = actualByDate.has(dateStr) ? actualByDate.get(dateStr)! : null;
      const difference = actual !== null ? actual - expected : null;

      const orders: ReconciliationOrderDetail[] = [
        ...acc.delivered,
        ...acc.deposited,
        ...acc.returned,
      ];

      days.push({
        date: dateStr,
        delivered_count: acc.delivered.length,
        returned_count: acc.returned.length,
        expected_amount: expected,
        actual_amount: actual,
        difference,
        orders,
      });
    }

    return NextResponse.json({ days });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — upsert actual_amount for one day
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = DailySettlementUpsertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { date, actual_amount, expected_amount, notes } = parsed.data;
    const difference = expected_amount !== undefined ? actual_amount - expected_amount : null;

    const supabase = await createClient();

    const { error } = await supabase.from("daily_settlements").upsert(
      {
        date,
        actual_amount,
        expected_amount,
        difference,
        notes,
      },
      { onConflict: "date" }
    );

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
