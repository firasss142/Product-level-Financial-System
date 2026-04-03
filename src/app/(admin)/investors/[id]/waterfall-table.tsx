"use client";

import type { SettlementWaterfall } from "@/types/investor";
import { fmtNumber, fmtPrice } from "@/lib/format";

interface WaterfallLine {
  label: string;
  amount: number;
  type: "revenue" | "cost" | "result";
}

function buildLines(w: SettlementWaterfall): WaterfallLine[] {
  return [
    { label: "Revenu brut", amount: w.gross_revenue, type: "revenue" },
    { label: "Coût des marchandises (COGS)", amount: w.product_cogs, type: "cost" },
    { label: "Frais de livraison", amount: w.delivery_fees, type: "cost" },
    {
      label: "Frais de retour + livraisons perdues",
      amount: w.return_fees + w.wasted_packing_costs + w.converty_fees_on_returns,
      type: "cost",
    },
    { label: "Dépenses publicitaires", amount: w.ad_spend, type: "cost" },
    { label: "Coût d'emballage", amount: w.packing_costs, type: "cost" },
    {
      label: "Commission Converty",
      amount: w.converty_fees_on_delivered + w.converty_fees_on_failed_leads,
      type: "cost",
    },
    { label: "Coût échanges (livraison)", amount: w.exchange_delivery_costs, type: "cost" },
    { label: "Frais fixes alloués", amount: w.allocated_overhead, type: "cost" },
    { label: "Résultat net du périmètre", amount: w.net_profit, type: "result" },
  ];
}

function pctOfRevenue(amount: number, revenue: number): string {
  if (revenue === 0) return "—";
  return fmtNumber((amount / revenue) * 100) + " %";
}

export function WaterfallTable({ waterfall }: { waterfall: SettlementWaterfall }) {
  const lines = buildLines(waterfall);
  const revenue = waterfall.gross_revenue;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-warm-gray-200 text-left">
            <th className="py-2 pr-4 font-medium text-warm-gray-500">Ligne</th>
            <th className="py-2 px-4 font-medium text-warm-gray-500 text-right">Montant (TND)</th>
            <th className="py-2 pl-4 font-medium text-warm-gray-500 text-right">% du revenu</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const isResult = line.type === "result";
            const isRevenue = line.type === "revenue";
            const isCost = line.type === "cost";
            const displayAmount = isCost ? -line.amount : line.amount;
            const colorClass =
              isResult
                ? line.amount >= 0
                  ? "text-emerald"
                  : "text-terracotta"
                : isRevenue
                  ? "text-emerald"
                  : "text-navy";

            return (
              <tr
                key={line.label}
                className={
                  isResult
                    ? "border-t-2 border-navy font-semibold"
                    : "border-b border-warm-gray-100"
                }
              >
                <td className="py-2.5 pr-4 text-navy">
                  {isCost ? "− " : ""}
                  {isResult ? "= " : ""}
                  {line.label}
                </td>
                <td className={`py-2.5 px-4 text-right tabular-nums ${colorClass}`}>
                  {fmtPrice(displayAmount)}
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums text-warm-gray-500">
                  {isResult
                    ? pctOfRevenue(line.amount, revenue)
                    : isRevenue
                      ? "100,00 %"
                      : pctOfRevenue(line.amount, revenue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
