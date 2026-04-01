import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfitability } from "@/lib/calculations";
import { fetchStuckOrders } from "@/lib/supabase/queries";
import type { Period } from "@/types/cost-model";

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

    const supabase = await createClient();

    const [profitability, stuckOrders] = await Promise.all([
      getBusinessProfitability(period),
      fetchStuckOrders(supabase),
    ]);

    const productDetails = profitability.productDetails.map((d) => ({
      productId: d.margin.productId,
      productName: d.margin.productName,
      revenue: d.margin.revenue,
      deliveredCount: d.margin.deliveredCount,
      contributionMarginTotal: d.margin.contributionMarginTotal,
      contributionMarginPerOrder: d.margin.contributionMarginPerOrder,
      confirmationRate: d.kpis.confirmationRate,
      deliveryRate: d.kpis.deliveryRate,
      returnRate: d.kpis.returnRate,
      totalLeads: d.kpis.totalLeads,
      confirmedOrders: d.kpis.confirmedOrders,
      shippedOrders: d.kpis.shippedOrders,
      deliveredOrders: d.kpis.deliveredOrders,
      returnedOrders: d.kpis.returnedOrders,
    }));

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
