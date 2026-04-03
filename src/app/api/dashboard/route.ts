import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfitability } from "@/lib/calculations";
import { fetchStuckOrders } from "@/lib/supabase/queries";
import { fetchAllOrders } from "@/lib/calculations/queries";
import type { Period } from "@/types/cost-model";

/** Count exchange and delivered orders in a period — lightweight alternative to full profitability. */
async function fetchExchangeRateCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  period: Period
): Promise<{ exchangeCount: number; deliveredCount: number }> {
  const orders = await fetchAllOrders(supabase, period);
  let exchangeCount = 0;
  let deliveredCount = 0;
  for (const o of orders) {
    if (o.is_exchange) exchangeCount++;
    else if (o.status === "delivered") deliveredCount++;
  }
  return { exchangeCount, deliveredCount };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");

    if (!startStr || !endStr) {
      return NextResponse.json({ error: "Paramètres start et end requis" }, { status: 400 });
    }

    const period: Period = {
      start: new Date(`${startStr}T00:00:00.000Z`),
      end: new Date(`${endStr}T23:59:59.999Z`),
    };

    // Previous period: same duration, immediately before
    const durationMs = period.end.getTime() - period.start.getTime();
    const prevPeriod: Period = {
      start: new Date(period.start.getTime() - durationMs - 1),
      end: new Date(period.start.getTime() - 1),
    };

    const supabase = await createClient();

    const [profitability, prevCounts, stuckOrders] = await Promise.all([
      getBusinessProfitability(period),
      fetchExchangeRateCounts(supabase, prevPeriod),
      fetchStuckOrders(supabase),
    ]);

    // Overall exchange rate for current period (derived from already-computed margins)
    let totalExchangeCount = 0;
    let totalDeliveredCount = 0;
    for (const d of profitability.productDetails) {
      totalExchangeCount += d.margin.exchangeCount;
      totalDeliveredCount += d.margin.deliveredCount;
    }
    const overallExchangeRate =
      totalDeliveredCount > 0 ? totalExchangeCount / totalDeliveredCount : null;

    // Previous period exchange rate for trend
    const prevExchangeRate =
      prevCounts.deliveredCount > 0
        ? prevCounts.exchangeCount / prevCounts.deliveredCount
        : null;

    // Trend: 'up' means rate increased (worse), 'down' means decreased (better)
    let exchangeRateTrend: "up" | "down" | "flat" | null = null;
    if (overallExchangeRate !== null && prevExchangeRate !== null) {
      const diff = overallExchangeRate - prevExchangeRate;
      if (Math.abs(diff) < 0.001) exchangeRateTrend = "flat";
      else if (diff > 0) exchangeRateTrend = "up";
      else exchangeRateTrend = "down";
    }

    const productDetails = profitability.productDetails.map((d) => {
      const exchangeRate =
        d.margin.deliveredCount > 0
          ? d.margin.exchangeCount / d.margin.deliveredCount
          : null;
      return {
        productId: d.margin.productId,
        productName: d.margin.productName,
        revenue: d.margin.revenue,
        deliveredCount: d.margin.deliveredCount,
        contributionMarginTotal: d.margin.contributionMarginTotal,
        contributionMarginPerOrder: d.margin.contributionMarginPerOrder,
        confirmationRate: d.kpis.confirmationRate,
        deliveryRate: d.kpis.deliveryRate,
        returnRate: d.kpis.returnRate,
        exchangeRate,
        totalLeads: d.kpis.totalLeads,
        confirmedOrders: d.kpis.confirmedOrders,
        shippedOrders: d.kpis.shippedOrders,
        deliveredOrders: d.kpis.deliveredOrders,
        returnedOrders: d.kpis.returnedOrders,
      };
    });

    const funnel = { totalOrders: 0, confirmed: 0, shipped: 0, delivered: 0, returned: 0 };
    for (const d of productDetails) {
      funnel.totalOrders += d.totalLeads;
      funnel.confirmed += d.confirmedOrders;
      funnel.shipped += d.shippedOrders;
      funnel.delivered += d.deliveredOrders;
      funnel.returned += d.returnedOrders;
    }

    return NextResponse.json({
      kpis: {
        overallConfirmationRate: profitability.kpis.overallConfirmationRate,
        overallDeliveryRate: profitability.kpis.overallDeliveryRate,
        overallReturnRate: profitability.kpis.overallReturnRate,
        totalContributionMargin: profitability.kpis.totalContributionMargin,
        netProfit: profitability.kpis.netProfit,
        overallExchangeRate,
        exchangeRateTrend,
      },
      funnel,
      productDetails,
      stuckOrders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
