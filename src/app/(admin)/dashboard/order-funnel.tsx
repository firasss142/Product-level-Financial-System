import { Card, CardContent, CardTitle, Skeleton } from "@/components/ui";
import { fmtNumber, fmtPercent } from "@/lib/format";
import { safeDivide } from "@/lib/calculations/cost-engine";
import { cn } from "@/lib/utils";

interface FunnelData {
  totalOrders: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  returned: number;
}

interface OrderFunnelProps {
  funnel: FunnelData | null;
  loading: boolean;
}

interface StageProps {
  label: string;
  count: number;
  colorClass?: string;
}

function Stage({ label, count, colorClass }: StageProps) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-warm-gray-50 px-5 py-4 min-w-[120px]">
      <span className={cn("text-2xl font-semibold tabular-nums", colorClass ?? "text-navy")}>
        {fmtNumber(count)}
      </span>
      <span className="text-xs text-warm-gray-500 mt-1 text-center">{label}</span>
    </div>
  );
}

function Arrow({ rate }: { rate: number | null }) {
  return (
    <div className="flex flex-col items-center justify-center px-2">
      <span className="text-warm-gray-400 text-lg">→</span>
      {rate !== null && (
        <span className="text-[10px] text-warm-gray-500 tabular-nums">
          {fmtPercent(rate)}%
        </span>
      )}
    </div>
  );
}

export function OrderFunnel({ funnel, loading }: OrderFunnelProps) {
  if (loading || !funnel) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="rect" className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const confRate = safeDivide(funnel.confirmed, funnel.totalOrders);
  const shipRate = safeDivide(funnel.shipped, funnel.confirmed);
  const delRate = safeDivide(funnel.delivered, funnel.shipped);
  const retRate = safeDivide(funnel.returned, funnel.shipped);

  return (
    <Card>
      <CardContent>
        <CardTitle className="mb-4">Entonnoir de commandes</CardTitle>
        <div className="flex flex-wrap items-center justify-center gap-1 lg:gap-0">
          <Stage label="Toutes les commandes" count={funnel.totalOrders} />
          <Arrow rate={confRate} />
          <Stage label="Confirmées" count={funnel.confirmed} />
          <Arrow rate={shipRate} />
          <Stage label="Expédiées" count={funnel.shipped} />
          <Arrow rate={delRate} />
          <Stage label="Livrées" count={funnel.delivered} colorClass="text-emerald" />
          <div className="flex flex-col items-center justify-center px-2">
            <span className="text-warm-gray-400 text-lg">|</span>
            {retRate !== null && (
              <span className="text-[10px] text-warm-gray-500 tabular-nums">
                {fmtPercent(retRate)}%
              </span>
            )}
          </div>
          <Stage label="Retournées" count={funnel.returned} colorClass="text-terracotta" />
        </div>
      </CardContent>
    </Card>
  );
}
