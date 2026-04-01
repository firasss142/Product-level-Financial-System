"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Card,
  CardContent,
  Button,
  Badge,
  useToast,
} from "@/components/ui";
import { fmtPrice, fmtDateMedium } from "@/lib/format";
import type { ReconciliationDay, ReconciliationOrderDetail } from "@/app/api/reconciliation/route";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("fr-TN", {
    month: "long",
    year: "numeric",
  });
}

function yyyyMM(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function ecartColor(diff: number | null): string {
  if (diff === null) return "text-warm-gray-400";
  const abs = Math.abs(diff);
  if (abs < 1) return "text-emerald font-medium";
  if (abs <= 10) return "text-amber font-medium";
  return "text-terracotta font-medium";
}

function ecartBgClass(diff: number | null): string {
  if (diff === null) return "";
  const abs = Math.abs(diff);
  if (abs < 1) return "bg-emerald/5";
  if (abs <= 10) return "bg-amber/5";
  return "bg-terracotta/5";
}

// ---------------------------------------------------------------------------
// Contribution badge
// ---------------------------------------------------------------------------

function ContribBadge({ type }: { type: ReconciliationOrderDetail["contribution"] }) {
  if (type === "delivered") return <Badge variant="delivered">Livré</Badge>;
  if (type === "returned") return <Badge variant="returned">Retourné</Badge>;
  return <Badge variant="default">Enlèvement</Badge>;
}

// ---------------------------------------------------------------------------
// Inline editable "Reçu" cell
// ---------------------------------------------------------------------------

interface RecuCellProps {
  date: string;
  expectedAmount: number;
  initialValue: number | null;
  onSaved: (date: string, actual: number) => void;
}

function RecuCell({ date, expectedAmount, initialValue, onSaved }: RecuCellProps) {
  const [value, setValue] = useState(initialValue !== null ? String(initialValue) : "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if parent data refreshes
  useEffect(() => {
    setValue(initialValue !== null ? String(initialValue) : "");
  }, [initialValue]);

  async function save() {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    if (num === initialValue) return; // no change

    setSaving(true);
    try {
      const res = await fetch("/api/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, actual_amount: num, expected_amount: expectedAmount }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      onSaved(date, num);
    } catch {
      toast({ title: "Impossible de sauvegarder", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setValue(initialValue !== null ? String(initialValue) : "");
      inputRef.current?.blur();
    }
  }

  return (
    <input
      ref={inputRef}
      type="number"
      min="0"
      step="0.001"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={handleKeyDown}
      disabled={saving}
      placeholder="—"
      className={cn(
        "w-28 rounded-md border border-warm-gray-200 bg-white px-2 py-1 text-sm tabular-nums text-right text-navy",
        "focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "placeholder:text-warm-gray-400"
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Expandable order detail row
// ---------------------------------------------------------------------------

interface ExpandedOrdersProps {
  orders: ReconciliationOrderDetail[];
}

function ExpandedOrders({ orders }: ExpandedOrdersProps) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-warm-gray-400 italic py-2">Aucune commande ce jour</p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-warm-gray-500 text-xs border-b border-warm-gray-100">
          <th className="text-left py-1 pr-4 font-medium">Référence</th>
          <th className="text-left py-1 pr-4 font-medium">Type</th>
          <th className="text-right py-1 font-medium">Montant (TND)</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o, i) => (
          <tr key={`${o.reference}-${i}`} className="border-b border-warm-gray-50 last:border-0">
            <td className="py-1 pr-4 font-mono text-xs text-navy">{o.reference}</td>
            <td className="py-1 pr-4">
              <ContribBadge type={o.contribution} />
            </td>
            <td className="py-1 text-right tabular-nums text-navy">{fmtPrice(o.total_price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ReconciliationPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
  const [days, setDays] = useState<ReconciliationDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reconciliation?month=${yyyyMM(year, month)}`);
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = (await res.json()) as { days: ReconciliationDay[] };
      setDays(data.days);
    } catch {
      toast({ title: "Impossible de charger les données", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setExpandedDates(new Set());
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setExpandedDates(new Set());
  }

  function toggleExpand(date: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function handleActualSaved(date: string, actual: number) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        return { ...d, actual_amount: actual, difference: actual - d.expected_amount };
      })
    );
  }

  const {
    significantDays,
    totalDelivered,
    totalReturned,
    totalExpected,
    totalActual,
    totalDiff,
  } = useMemo(() => {
    const significantDays = days.filter(
      (d) => d.difference !== null && Math.abs(d.difference) > 10
    );
    const totalDelivered = days.reduce((s, d) => s + d.delivered_count, 0);
    const totalReturned = days.reduce((s, d) => s + d.returned_count, 0);
    const totalExpected = days.reduce((s, d) => s + d.expected_amount, 0);
    const totalActual = days
      .filter((d) => d.actual_amount !== null)
      .reduce((s, d) => s + (d.actual_amount ?? 0), 0);
    const allActualEntered = days.length > 0 && days.every((d) => d.actual_amount !== null);
    const totalDiff = allActualEntered ? totalActual - totalExpected : null;
    return { significantDays, totalDelivered, totalReturned, totalExpected, totalActual, totalDiff };
  }, [days]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-navy">Rapprochement Navex</h1>

        {/* Month selector */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={prevMonth}>‹</Button>
          <span className="text-base font-medium text-navy w-36 text-center capitalize">
            {formatMonth(year, month)}
          </span>
          <Button variant="ghost" size="sm" onClick={nextMonth}>›</Button>
        </div>
      </div>

      {!loading && (
        <div>
          {significantDays.length === 0 ? (
            <Badge variant="delivered" className="text-sm px-3 py-1">
              Aucun écart significatif ce mois
            </Badge>
          ) : (
            <Badge variant="returned" className="text-sm px-3 py-1">
              {significantDays.length} jour{significantDays.length > 1 ? "s" : ""} avec écart{" "}
              {">"} 10 TND
            </Badge>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-warm-gray-400 text-sm">Chargement…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy text-white text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium w-8"></th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-right px-4 py-3 font-medium">Livrées</th>
                  <th className="text-right px-4 py-3 font-medium">Retournées</th>
                  <th className="text-right px-4 py-3 font-medium">Attendu (TND)</th>
                  <th className="text-right px-4 py-3 font-medium">Reçu (TND)</th>
                  <th className="text-right px-4 py-3 font-medium">Écart (TND)</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => {
                  const isExpanded = expandedDates.has(day.date);
                  const hasOrders = day.orders.length > 0;

                  return (
                    <>
                      <tr
                        key={day.date}
                        className={cn(
                          "border-b border-warm-gray-100 transition-colors",
                          ecartBgClass(day.difference),
                          hasOrders ? "hover:bg-warm-gray-50 cursor-pointer" : ""
                        )}
                        onClick={() => hasOrders && toggleExpand(day.date)}
                      >
                        {/* Expand toggle */}
                        <td className="pl-4 py-3 text-warm-gray-400">
                          {hasOrders && (
                            <span className="text-xs select-none">
                              {isExpanded ? "▾" : "▸"}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-navy font-medium whitespace-nowrap">
                          {fmtDateMedium(`${day.date}T12:00:00Z`)}
                        </td>

                        {/* Livrées */}
                        <td className="px-4 py-3 text-right tabular-nums text-navy">
                          {day.delivered_count > 0 ? (
                            <span className="text-emerald font-medium">{day.delivered_count}</span>
                          ) : (
                            <span className="text-warm-gray-300">—</span>
                          )}
                        </td>

                        {/* Retournées */}
                        <td className="px-4 py-3 text-right tabular-nums text-navy">
                          {day.returned_count > 0 ? (
                            <span className="text-terracotta font-medium">{day.returned_count}</span>
                          ) : (
                            <span className="text-warm-gray-300">—</span>
                          )}
                        </td>

                        {/* Attendu */}
                        <td className="px-4 py-3 text-right tabular-nums text-navy">
                          {fmtPrice(day.expected_amount)}
                        </td>

                        {/* Reçu — editable input, stop row click propagation */}
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RecuCell
                            date={day.date}
                            expectedAmount={day.expected_amount}
                            initialValue={day.actual_amount}
                            onSaved={handleActualSaved}
                          />
                        </td>

                        {/* Écart */}
                        <td className={cn("px-4 py-3 text-right tabular-nums", ecartColor(day.difference))}>
                          {day.difference !== null ? fmtPrice(day.difference) : "—"}
                        </td>
                      </tr>

                      {/* Expandable detail */}
                      {isExpanded && (
                        <tr key={`${day.date}-detail`} className="bg-warm-gray-50 border-b border-warm-gray-100">
                          <td colSpan={7} className="px-8 py-3">
                            <ExpandedOrders orders={day.orders} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>

              {/* Summary footer */}
              <tfoot>
                <tr className="bg-navy/5 border-t-2 border-navy/20 font-semibold text-navy">
                  <td className="px-4 py-3" colSpan={2}>
                    Total du mois
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald">
                    {totalDelivered}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-terracotta">
                    {totalReturned}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtPrice(totalExpected)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {totalDiff !== null ? fmtPrice(totalActual) : "—"}
                  </td>
                  <td className={cn("px-4 py-3 text-right tabular-nums", ecartColor(totalDiff))}>
                    {totalDiff !== null ? fmtPrice(totalDiff) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
