import { StatCard, SkeletonCard } from "@/components/ui";
import { fmtPercent, fmtPrice } from "@/lib/format";

interface KpiData {
  overallConfirmationRate: number | null;
  overallDeliveryRate: number | null;
  overallReturnRate: number | null;
  totalContributionMargin: number;
  netProfit: number;
  overallExchangeRate: number | null;
  exchangeRateTrend: "up" | "down" | "flat" | null;
}

interface KpiStripProps {
  kpis: KpiData | null;
  loading: boolean;
}

function marginColor(value: number): string {
  return value >= 0 ? "text-emerald" : "text-terracotta";
}

export function KpiStrip({ kpis, loading }: KpiStripProps) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Exchange rate trend: 'up' means rate increased (worse), 'down' means decreased (better)
  const exchangeTrend =
    kpis.exchangeRateTrend === "up"
      ? { direction: "up" as const, value: "vs mois préc." }
      : kpis.exchangeRateTrend === "down"
      ? { direction: "down" as const, value: "vs mois préc." }
      : undefined;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
      <StatCard
        value={fmtPercent(kpis.overallConfirmationRate)}
        suffix="%"
        label="Taux de confirmation"
      />
      <StatCard
        value={fmtPercent(kpis.overallDeliveryRate)}
        suffix="%"
        label="Taux de livraison"
      />
      <StatCard
        value={fmtPercent(kpis.overallReturnRate)}
        suffix="%"
        label="Taux de retour"
        valueClassName="text-terracotta"
      />
      <StatCard
        value={
          kpis.overallExchangeRate !== null
            ? fmtPercent(kpis.overallExchangeRate)
            : "—"
        }
        suffix={kpis.overallExchangeRate !== null ? "%" : ""}
        label="Taux d'échange"
        valueClassName={
          kpis.overallExchangeRate !== null && kpis.overallExchangeRate > 0.1
            ? "text-terracotta"
            : "text-navy"
        }
        trend={exchangeTrend}
      />
      <StatCard
        value={fmtPrice(kpis.totalContributionMargin)}
        suffix="TND"
        label="Marge de contribution"
        valueClassName={marginColor(kpis.totalContributionMargin)}
      />
      <StatCard
        value={fmtPrice(kpis.netProfit)}
        suffix="TND"
        label="Bénéfice net"
        valueClassName={marginColor(kpis.netProfit)}
      />
    </div>
  );
}
