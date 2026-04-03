"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, Button, useToast } from "@/components/ui";
import { firstOfMonth, today, firstOfLastMonth, lastOfLastMonth } from "@/lib/dates";
import { KpiStrip } from "./kpi-strip";
import { OrderFunnel } from "./order-funnel";
import { ProductGrid } from "./product-grid";
import { AttentionSection } from "./attention-section";

interface KpiData {
  overallConfirmationRate: number | null;
  overallDeliveryRate: number | null;
  overallReturnRate: number | null;
  totalContributionMargin: number;
  netProfit: number;
  overallExchangeRate: number | null;
  exchangeRateTrend: "up" | "down" | "flat" | null;
}

interface FunnelData {
  totalOrders: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  returned: number;
}

interface ProductDetail {
  productId: string;
  productName: string;
  revenue: number;
  deliveredCount: number;
  contributionMarginTotal: number;
  contributionMarginPerOrder: number | null;
  confirmationRate: number | null;
  deliveryRate: number | null;
  returnRate: number | null;
  exchangeRate: number | null;
  totalLeads: number;
  confirmedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
}

interface StuckOrder {
  id: string;
  reference: string;
  status: string;
  product_name: string | null;
  hours_stuck: number;
}

interface DashboardResponse {
  kpis: KpiData;
  funnel: FunnelData;
  productDetails: ProductDetail[];
  stuckOrders: StuckOrder[];
}


const INPUT_CLASS =
  "rounded-lg border border-warm-gray-200 bg-white px-3 py-2 text-sm text-navy focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none transition-colors";

export function DashboardClient() {
  const { toast } = useToast();

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardResponse | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?start=${startDate}&end=${endDate}`);
      if (!res.ok) throw new Error("Erreur de chargement");
      const json = (await res.json()) as DashboardResponse;
      setData(json);
    } catch {
      toast({ title: "Impossible de charger le tableau de bord", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, toast]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  function setThisMonth() {
    setStartDate(firstOfMonth());
    setEndDate(today());
  }

  function setLastMonth() {
    setStartDate(firstOfLastMonth());
    setEndDate(lastOfLastMonth());
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-navy">Tableau de bord</h1>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">De</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">À</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={setThisMonth}>
              Ce mois
            </Button>
            <Button variant="ghost" size="sm" onClick={setLastMonth}>
              Mois dernier
            </Button>
          </div>
        </CardContent>
      </Card>

      <KpiStrip kpis={data?.kpis ?? null} loading={loading} />

      <OrderFunnel funnel={data?.funnel ?? null} loading={loading} />

      <ProductGrid productDetails={data?.productDetails ?? []} loading={loading} />

      <AttentionSection stuckOrders={data?.stuckOrders ?? []} loading={loading} />
    </div>
  );
}
