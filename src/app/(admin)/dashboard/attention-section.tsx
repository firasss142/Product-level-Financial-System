import { Card, CardContent, Badge, Skeleton } from "@/components/ui";
import { statusLabel, statusBadgeVariant } from "@/lib/format";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface StuckOrder {
  id: string;
  reference: string;
  status: string;
  product_name: string | null;
  hours_stuck: number;
}

interface AttentionSectionProps {
  stuckOrders: StuckOrder[];
  loading: boolean;
}

function formatAge(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export function AttentionSection({ stuckOrders, loading }: AttentionSectionProps) {
  if (loading) {
    return (
      <Card className="border-2 border-amber">
        <CardContent>
          <Skeleton variant="rect" className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (stuckOrders.length === 0) return null;

  // Group by status
  const grouped = new Map<string, StuckOrder[]>();
  for (const order of stuckOrders) {
    const list = grouped.get(order.status) ?? [];
    list.push(order);
    grouped.set(order.status, list);
  }

  return (
    <Card className="border-2 border-amber">
      <CardContent>
        <details open>
          <summary className="flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <AlertTriangle size={18} className="text-amber flex-shrink-0" />
            <span className="text-sm font-semibold text-navy">
              Attention requise ({stuckOrders.length} commande{stuckOrders.length !== 1 ? "s" : ""})
            </span>
          </summary>

          <div className="mt-4 space-y-4">
            {Array.from(grouped.entries()).map(([status, orders]) => (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={statusBadgeVariant(status)}>
                    {statusLabel(status)}
                  </Badge>
                  <span className="text-xs text-warm-gray-500">
                    {orders.length} commande{orders.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-warm-gray-50 px-2.5 py-1 text-xs font-mono text-navy hover:bg-warm-gray-100 transition-colors"
                    >
                      {order.reference}
                      <span className="text-warm-gray-400">·</span>
                      <span className="text-warm-gray-500">{formatAge(order.hours_stuck)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
