import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import {
  fetchProductOrders,
  fetchCampaignSpend,
  aggregateProductOrders,
} from "@/lib/calculations/queries";
import { computeContributionMargin, safeDivide } from "@/lib/calculations/cost-engine";
import type { Period } from "@/types/cost-model";

export interface VariantProfitabilityRow {
  sku: string;
  unitCount: number;
  deliveredCount: number;
  revenue: number;
  cogs: number;
  proportionalCosts: number;
  margin: number;
  marginPct: number | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");

    if (!startStr || !endStr) {
      return NextResponse.json(
        { error: "Paramètres start et end requis" },
        { status: 400 }
      );
    }

    const period: Period = {
      start: new Date(`${startStr}T00:00:00.000Z`),
      end: new Date(`${endStr}T23:59:59.999Z`),
    };

    const supabase = await createClient();
    const settings = await getSettings();

    const [productResult, orders, campaignSpend] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, unit_cogs")
        .eq("id", productId)
        .single(),
      fetchProductOrders(supabase, productId, period),
      fetchCampaignSpend(supabase, productId, period),
    ]);

    if (productResult.error) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const productRow = productResult.data;
    const unitCogs = productRow.unit_cogs ?? 0;

    // Compute the full product contribution margin to get total other costs
    const aggregates = aggregateProductOrders(orders, productRow);
    const margin = computeContributionMargin(aggregates, campaignSpend, settings, period);

    // Total "other costs" = everything except COGS (already per-unit via variant)
    const totalOtherCosts =
      margin.totalDeliveryFee +
      margin.totalPackingCost +
      margin.totalConvertyFeeOnDelivered +
      margin.adSpendAllocation +
      margin.returnCostBurden +
      margin.failedLeadCostBurden +
      margin.exchangeCostBurden;

    const totalRevenue = margin.revenue;

    // Group delivered (non-exchange) orders by SKU
    const variantMap = new Map<
      string,
      { unitCount: number; deliveredCount: number; revenue: number; cogsUnits: number }
    >();

    for (const order of orders) {
      if (order.is_exchange) continue;
      if (order.status !== "delivered") continue;

      const sku = order.selected_variant_sku ?? "(sans variante)";
      const unitCount = order.variant_unit_count ?? 1;
      const price = order.total_price ?? 0;

      const existing = variantMap.get(sku);
      if (existing) {
        existing.deliveredCount++;
        existing.revenue += price;
        existing.cogsUnits += unitCount;
      } else {
        variantMap.set(sku, {
          unitCount,
          deliveredCount: 1,
          revenue: price,
          cogsUnits: unitCount,
        });
      }
    }

    // Build rows sorted by marginPct descending
    const rows: VariantProfitabilityRow[] = [];

    for (const [sku, data] of variantMap) {
      const variantCogs = unitCogs * data.cogsUnits;
      // Allocate other costs proportionally by revenue share
      const revenueShare = totalRevenue > 0 ? data.revenue / totalRevenue : 0;
      const proportionalCosts = revenueShare * totalOtherCosts;
      const variantMargin = data.revenue - variantCogs - proportionalCosts;
      const marginPct = safeDivide(variantMargin, data.revenue);

      rows.push({
        sku,
        unitCount: Math.round(data.cogsUnits / data.deliveredCount), // avg units per order
        deliveredCount: data.deliveredCount,
        revenue: data.revenue,
        cogs: variantCogs,
        proportionalCosts,
        margin: variantMargin,
        marginPct: marginPct !== null ? marginPct * 100 : null,
      });
    }

    rows.sort((a, b) => {
      if (a.marginPct === null) return 1;
      if (b.marginPct === null) return -1;
      return b.marginPct - a.marginPct;
    });

    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
