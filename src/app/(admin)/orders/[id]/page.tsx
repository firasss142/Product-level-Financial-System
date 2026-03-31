"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Badge, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  statusLabel,
  statusBadgeVariant,
  timelineDotColor,
  fmtPrice,
  fmtDateTime,
} from "@/lib/format";

// ── Types ───────────────────────────────────────────────────────────────────

interface StatusHistoryEntry {
  id: string;
  status: string;
  created_at: string;
  action_taker: string | null;
}

interface OrderDetail {
  id: string;
  reference: string;
  status: string;
  total_price: number | null;
  is_duplicated: boolean;
  is_exchange: boolean;
  is_test: boolean;
  product_id: string | null;
  product_name: string | null;
  account_id: string;
  account_name: string | null;
  cart: Record<string, unknown> | unknown[] | null;
  customer_data: Record<string, unknown> | unknown[] | null;
  converty_created_at: string | null;
  status_history: StatusHistoryEntry[];
}

// ── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-warm-gray-100 last:border-0">
      <span className="text-xs text-warm-gray-500 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-navy">{children}</span>
    </div>
  );
}

// ── JSON Display ─────────────────────────────────────────────────────────────

function JsonDisplay({ data, label }: { data: unknown; label: string }) {
  if (!data) return null;

  const entries: Array<[string, unknown]> = Array.isArray(data)
    ? (data as Record<string, unknown>[]).flatMap((item) => Object.entries(item))
    : Object.entries(data as Record<string, unknown>).filter(
        ([, v]) => v !== null && v !== undefined && v !== ""
      );

  if (entries.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-warm-gray-500 mb-2">{label}</p>
      <div className="bg-warm-gray-50 rounded-lg p-3 space-y-1">
        {entries.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="flex gap-2 text-xs">
            <span className="text-warm-gray-500 w-28 shrink-0">{k}</span>
            <span className="text-navy">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/orders/${params.id}`)
      .then((r) => {
        if (r.status === 404) { router.push("/orders"); return null; }
        return r.json() as Promise<OrderDetail>;
      })
      .then((data) => { if (data) setOrder(data); })
      .catch(() => toast({ title: "Impossible de charger la commande", variant: "error" }))
      .finally(() => setLoading(false));
  }, [params.id, router, toast]);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white shadow-sm rounded-xl p-6 animate-pulse space-y-3">
              <div className="h-5 w-32 bg-warm-gray-200 rounded" />
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-8 bg-warm-gray-100 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/orders"
          className="text-sm text-warm-gray-500 hover:text-navy transition-colors"
        >
          ← Commandes
        </Link>
        <span className="text-warm-gray-300" aria-hidden="true">/</span>
        <span className="text-sm text-navy font-medium font-mono">{order.reference}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Order info */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Commande</CardTitle>
                <Badge variant={statusBadgeVariant(order.status)}>
                  {statusLabel(order.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <InfoRow label="Référence">
                  <span className="font-mono">{order.reference}</span>
                </InfoRow>
                <InfoRow label="Prix total">
                  <span className="tabular-nums font-semibold">{fmtPrice(order.total_price)} TND</span>
                </InfoRow>
                <InfoRow label="Produit">{order.product_name ?? "—"}</InfoRow>
                <InfoRow label="Compte">{order.account_name ?? "—"}</InfoRow>
                <InfoRow label="Date">
                  {order.converty_created_at ? fmtDateTime(order.converty_created_at) : "—"}
                </InfoRow>
                {order.is_exchange && (
                  <InfoRow label="Type">
                    <Badge variant="pending">Échange</Badge>
                  </InfoRow>
                )}
                {order.is_duplicated && (
                  <InfoRow label="Doublon">
                    <Badge variant="rejected">Dupliqué</Badge>
                  </InfoRow>
                )}
                {order.is_test && (
                  <InfoRow label="Test">
                    <Badge variant="default">Test</Badge>
                  </InfoRow>
                )}
              </div>
            </CardContent>
          </Card>

          {order.customer_data && (
            <Card>
              <CardContent className="pt-4">
                <JsonDisplay data={order.customer_data} label="Informations client" />
              </CardContent>
            </Card>
          )}

          {order.cart && (
            <Card>
              <CardContent className="pt-4">
                <JsonDisplay data={order.cart} label="Panier" />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Status timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Historique des statuts</CardTitle>
            </CardHeader>
            <CardContent>
              {order.status_history.length === 0 ? (
                <p className="text-sm text-warm-gray-400 text-center py-4">Aucun historique</p>
              ) : (
                <ol className="relative">
                  {order.status_history.map((entry, idx) => (
                    <li key={entry.id} className="flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className={cn("w-2.5 h-2.5 rounded-full mt-1 shrink-0", timelineDotColor(entry.status))} />
                        {idx < order.status_history.length - 1 && (
                          <div className="w-px flex-1 bg-warm-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="min-w-0 pb-0.5">
                        <Badge variant={statusBadgeVariant(entry.status)}>
                          {statusLabel(entry.status)}
                        </Badge>
                        <p className="text-xs text-warm-gray-500 mt-1">
                          {fmtDateTime(entry.created_at)}
                        </p>
                        {entry.action_taker && (
                          <p className="text-xs text-warm-gray-400">{entry.action_taker}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPageWrapper() {
  return <OrderDetailPage />;
}
