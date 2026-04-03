"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  useToast,
  EmptyState,
} from "@/components/ui";
import { fmtPrice, fmtPercent, fmtDateMedium, fmtDateShort } from "@/lib/format";
import type { SettlementResult, Investor, InvestmentDeal, Settlement, InvestorDealScope } from "@/types/investor";
import { WaterfallTable } from "./waterfall-table";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DealRow extends InvestmentDeal {
  scope_name: string;
}

type InvestorDetail = Pick<Investor, "id" | "name" | "email" | "phone" | "notes" | "is_active">;

type SettlementRow = Settlement;

interface ScopeOption {
  value: string;
  label: string;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function InvestorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [investor, setInvestor] = useState<InvestorDetail | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit investor
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [editLoading, setEditLoading] = useState(false);

  // Create deal
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealForm, setDealForm] = useState({
    scope_type: "product" as "product" | "account" | "business",
    scope_id: "",
    capital_amount: "",
    profit_share_pct: "",
    loss_share_pct: "",
    start_date: "",
    end_date: "",
    notes: "",
  });
  const [dealLoading, setDealLoading] = useState(false);
  const [productOptions, setProductOptions] = useState<ScopeOption[]>([]);
  const [accountOptions, setAccountOptions] = useState<ScopeOption[]>([]);

  // Settlement
  const [settleDeal, setSettleDeal] = useState<DealRow | null>(null);
  const [settlePeriod, setSettlePeriod] = useState({ start: "", end: "" });
  const [preview, setPreview] = useState<SettlementResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Settlement history (per deal)
  const [historyDealId, setHistoryDealId] = useState<string | null>(null);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedSettlement, setExpandedSettlement] = useState<string | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true);
    void fetch(`/api/investors/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Investisseur introuvable");
        return r.json();
      })
      .then((data: { investor: InvestorDetail; deals: DealRow[] }) => {
        setInvestor(data.investor);
        setDeals(data.deals);
        if (data.investor) {
          setEditForm({
            name: data.investor.name,
            email: data.investor.email ?? "",
            phone: data.investor.phone ?? "",
            notes: data.investor.notes ?? "",
          });
        }
      })
      .catch(() => {
        toast({ title: "Investisseur introuvable", variant: "error" });
        router.push("/investors");
      })
      .finally(() => setLoading(false));
  }, [id, toast, router]);

  useEffect(() => { load(); }, [load]);

  // Load scope options for deal creation
  useEffect(() => {
    void fetch("/api/products")
      .then((r) => r.json())
      .then((data: Array<{ id: string; name: string }>) =>
        setProductOptions(data.map((p) => ({ value: p.id, label: p.name })))
      )
      .catch(() => {});

    void fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: Array<{ id: string; email: string }>) =>
        setAccountOptions(data.map((a) => ({ value: a.id, label: a.email })))
      )
      .catch(() => {});
  }, []);

  // ── Edit investor ──────────────────────────────────────────────────────────

  const handleEdit = useCallback(async () => {
    setEditLoading(true);
    try {
      const res = await fetch("/api/investors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: editForm.name.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          notes: editForm.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Échec de la mise à jour");
      toast({ title: "Investisseur mis à jour", variant: "success" });
      setEditing(false);
      load();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setEditLoading(false);
    }
  }, [id, editForm, toast, load]);

  // ── Create deal ────────────────────────────────────────────────────────────

  const handleCreateDeal = useCallback(async () => {
    setDealLoading(true);
    try {
      const body = {
        investor_id: id,
        scope_type: dealForm.scope_type,
        scope_id: dealForm.scope_type === "business" ? null : dealForm.scope_id || null,
        capital_amount: Number(dealForm.capital_amount) || 0,
        profit_share_rate: (Number(dealForm.profit_share_pct) || 0) / 100,
        loss_share_rate: (Number(dealForm.loss_share_pct) || 0) / 100,
        start_date: dealForm.start_date,
        end_date: dealForm.end_date || null,
        notes: dealForm.notes.trim() || undefined,
      };
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Erreur inconnue");
      }
      toast({ title: "Accord créé", variant: "success" });
      setShowDealModal(false);
      setDealForm({
        scope_type: "product",
        scope_id: "",
        capital_amount: "",
        profit_share_pct: "",
        loss_share_pct: "",
        start_date: "",
        end_date: "",
        notes: "",
      });
      load();
    } catch (err) {
      toast({
        title: "Échec de la création",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setDealLoading(false);
    }
  }, [id, dealForm, toast, load]);

  // ── Settlement preview ─────────────────────────────────────────────────────

  const handlePreview = useCallback(async () => {
    if (!settleDeal || !settlePeriod.start || !settlePeriod.end) return;
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await fetch(
        `/api/deals/${settleDeal.id}/settlement-preview?period_start=${settlePeriod.start}&period_end=${settlePeriod.end}`
      );
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Erreur inconnue");
      }
      const data = (await res.json()) as SettlementResult;
      setPreview(data);
    } catch (err) {
      toast({
        title: "Erreur de calcul",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setPreviewLoading(false);
    }
  }, [settleDeal, settlePeriod, toast]);

  // ── Save settlement ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!settleDeal || !settlePeriod.start || !settlePeriod.end || saveLoading) return;
    setSaveLoading(true);
    try {
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_id: settleDeal.id,
          period_start: settlePeriod.start,
          period_end: settlePeriod.end,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Erreur inconnue");
      }
      toast({ title: "Rapport enregistré", variant: "success" });
      setSettleDeal(null);
      setPreview(null);
      setSettlePeriod({ start: "", end: "" });
    } catch (err) {
      toast({
        title: "Échec de l'enregistrement",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSaveLoading(false);
    }
  }, [settleDeal, settlePeriod, toast, saveLoading]);

  // ── Settlement history ─────────────────────────────────────────────────────

  const loadHistory = useCallback(
    async (dealId: string) => {
      if (historyDealId === dealId) {
        setHistoryDealId(null);
        return;
      }
      setHistoryDealId(dealId);
      setHistoryLoading(true);
      setSettlements([]);
      try {
        const res = await fetch(`/api/settlements/${dealId}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as SettlementRow[];
        // Guard against stale response if user toggled to a different deal
        setSettlements((prev) => prev.length === 0 ? data : prev);
      } catch {
        toast({ title: "Impossible de charger l'historique", variant: "error" });
      } finally {
        setHistoryLoading(false);
      }
    },
    [historyDealId, toast]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-warm-gray-100 rounded w-1/3" />
          <div className="h-40 bg-warm-gray-100 rounded-xl" />
          <div className="h-60 bg-warm-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!investor) return null;

  const SCOPE_LABELS: Record<InvestorDealScope, string> = { product: "Produit", account: "Compte", business: "Global" };
  const scopeLabel = (d: DealRow) => SCOPE_LABELS[d.scope_type];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/investors")}
            className="text-sm text-warm-gray-500 hover:text-navy transition-colors cursor-pointer"
          >
            &larr; Investisseurs
          </button>
          <h1 className="text-2xl font-semibold text-navy mt-1">{investor.name}</h1>
        </div>
      </div>

      {/* ── Info Card ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Informations</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? "Annuler" : "Modifier"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <Input
                label="Nom"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
              <Input
                label="Téléphone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
              <Input
                label="Notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
              <div className="flex justify-end">
                <Button onClick={() => void handleEdit()} loading={editLoading}>
                  Enregistrer
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-warm-gray-500">Email</p>
                <p className="text-navy">{investor.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-warm-gray-500">Téléphone</p>
                <p className="text-navy">{investor.phone ?? "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-warm-gray-500">Notes</p>
                <p className="text-navy">{investor.notes ?? "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Deals ───────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Accords d&apos;investissement</CardTitle>
            <Button size="sm" onClick={() => setShowDealModal(true)}>
              Ajouter un accord
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <EmptyState title="Aucun accord configuré" />
          ) : (
            <div className="space-y-3">
              {deals.map((deal) => (
                <div key={deal.id} className="rounded-lg border border-warm-gray-100 bg-warm-gray-50">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={deal.is_active ? "delivered" : "rejected"}>
                        {scopeLabel(deal)}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy truncate">
                          {deal.scope_name}
                        </p>
                        <p className="text-xs text-warm-gray-500 mt-0.5">
                          Capital : {fmtPrice(deal.capital_amount)} TND
                          {" · "}
                          Bénéfices : {fmtPercent(deal.profit_share_rate)} %
                          {" · "}
                          Pertes : {fmtPercent(deal.loss_share_rate)} %
                        </p>
                        <p className="text-xs text-warm-gray-400 mt-0.5">
                          {fmtDateShort(deal.start_date)}
                          {deal.end_date ? ` → ${fmtDateShort(deal.end_date)}` : " → En cours"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void loadHistory(deal.id)}
                      >
                        {historyDealId === deal.id ? "Masquer" : "Historique"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSettleDeal(deal);
                          setPreview(null);
                          setSettlePeriod({ start: "", end: "" });
                        }}
                      >
                        Générer le rapport
                      </Button>
                    </div>
                  </div>

                  {/* Settlement history */}
                  {historyDealId === deal.id && (
                    <div className="border-t border-warm-gray-200 p-4">
                      {historyLoading ? (
                        <p className="text-sm text-warm-gray-500">Chargement…</p>
                      ) : settlements.length === 0 ? (
                        <p className="text-sm text-warm-gray-500">Aucun règlement enregistré</p>
                      ) : (
                        <div className="space-y-2">
                          {settlements.map((s) => (
                            <div key={s.id}>
                              <button
                                onClick={() =>
                                  setExpandedSettlement(expandedSettlement === s.id ? null : s.id)
                                }
                                className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-warm-gray-100 transition-colors text-left cursor-pointer"
                              >
                                <div className="text-sm">
                                  <span className="text-navy font-medium">
                                    {fmtDateShort(s.period_start)} → {fmtDateShort(s.period_end)}
                                  </span>
                                  <span className="text-warm-gray-500 ml-3">
                                    créé le {fmtDateMedium(s.created_at)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm tabular-nums">
                                  <span className="text-warm-gray-500">
                                    Net : <span className={s.net_profit >= 0 ? "text-emerald" : "text-terracotta"}>
                                      {fmtPrice(s.net_profit)} TND
                                    </span>
                                  </span>
                                  <span className="font-medium text-navy">
                                    Part : {fmtPrice(s.investor_share)} TND
                                  </span>
                                </div>
                              </button>
                              {expandedSettlement === s.id && (
                                <div className="mt-2 p-4 bg-white rounded-lg border border-warm-gray-100">
                                  <WaterfallTable waterfall={s.snapshot} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Deal Modal ───────────────────────────────────────────────── */}
      <Modal
        open={showDealModal}
        onOpenChange={setShowDealModal}
        title="Nouvel accord d'investissement"
        confirmLabel="Créer"
        onConfirm={() => void handleCreateDeal()}
        loading={dealLoading}
      >
        <div className="space-y-4">
          <Select
            label="Périmètre"
            options={[
              { value: "product", label: "Produit" },
              { value: "account", label: "Compte" },
              { value: "business", label: "Global" },
            ]}
            value={dealForm.scope_type}
            onValueChange={(v) =>
              setDealForm({ ...dealForm, scope_type: v as "product" | "account" | "business", scope_id: "" })
            }
          />
          {dealForm.scope_type === "product" && (
            <Select
              label="Produit"
              options={productOptions}
              value={dealForm.scope_id}
              onValueChange={(v) => setDealForm({ ...dealForm, scope_id: v })}
              placeholder="Sélectionner un produit…"
            />
          )}
          {dealForm.scope_type === "account" && (
            <Select
              label="Compte"
              options={accountOptions}
              value={dealForm.scope_id}
              onValueChange={(v) => setDealForm({ ...dealForm, scope_id: v })}
              placeholder="Sélectionner un compte…"
            />
          )}
          <Input
            label="Capital investi (TND)"
            type="number"
            value={dealForm.capital_amount}
            onChange={(e) => setDealForm({ ...dealForm, capital_amount: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Part des bénéfices (%)"
              type="number"
              value={dealForm.profit_share_pct}
              onChange={(e) => setDealForm({ ...dealForm, profit_share_pct: e.target.value })}
              hint="0–100"
            />
            <Input
              label="Part des pertes (%)"
              type="number"
              value={dealForm.loss_share_pct}
              onChange={(e) => setDealForm({ ...dealForm, loss_share_pct: e.target.value })}
              hint="0–100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date de début"
              type="date"
              value={dealForm.start_date}
              onChange={(e) => setDealForm({ ...dealForm, start_date: e.target.value })}
            />
            <Input
              label="Date de fin"
              type="date"
              value={dealForm.end_date}
              onChange={(e) => setDealForm({ ...dealForm, end_date: e.target.value })}
            />
          </div>
          <Input
            label="Notes"
            value={dealForm.notes}
            onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })}
          />
        </div>
      </Modal>

      {/* ── Settlement Generation Modal ─────────────────────────────────────── */}
      <Modal
        open={!!settleDeal}
        onOpenChange={(open) => {
          if (!open) {
            setSettleDeal(null);
            setPreview(null);
          }
        }}
        title={`Rapport de règlement — ${settleDeal?.scope_name ?? ""}`}
        confirmLabel="Confirmer et sauvegarder"
        onConfirm={preview ? () => void handleSave() : undefined}
        loading={saveLoading}
        className="max-w-2xl"
      >
        <div className="space-y-6">
          {/* Period selection */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Début de période"
              type="date"
              value={settlePeriod.start}
              onChange={(e) => setSettlePeriod({ ...settlePeriod, start: e.target.value })}
            />
            <Input
              label="Fin de période"
              type="date"
              value={settlePeriod.end}
              onChange={(e) => setSettlePeriod({ ...settlePeriod, end: e.target.value })}
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => void handlePreview()}
              loading={previewLoading}
              disabled={!settlePeriod.start || !settlePeriod.end}
            >
              Aperçu
            </Button>
          </div>

          {/* Preview results */}
          {preview && (
            <>
              {/* Waterfall */}
              <WaterfallTable waterfall={preview.waterfall} />

              {/* Capital tracking */}
              <div className="rounded-lg border border-warm-gray-200 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-navy">Suivi du capital</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-warm-gray-500">Capital investi</p>
                    <p className="text-navy tabular-nums font-medium">
                      {fmtPrice(preview.capital_invested)} TND
                    </p>
                  </div>
                  <div>
                    <p className="text-warm-gray-500">Déjà remboursé</p>
                    <p className="text-navy tabular-nums font-medium">
                      {fmtPrice(preview.capital_returned_to_date)} TND
                    </p>
                  </div>
                  <div>
                    <p className="text-warm-gray-500">Remboursement cette période</p>
                    <p className="text-emerald tabular-nums font-medium">
                      {fmtPrice(preview.capital_return_this_period)} TND
                    </p>
                  </div>
                  <div>
                    <p className="text-warm-gray-500">Restant</p>
                    <p className="text-navy tabular-nums font-medium">
                      {fmtPrice(preview.capital_remaining)} TND
                    </p>
                  </div>
                </div>
              </div>

              {/* Investor share */}
              <div className="rounded-lg bg-navy/5 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-warm-gray-500">Part investisseur</p>
                  <p className="text-xs text-warm-gray-400 mt-0.5">
                    {preview.net_profit >= 0
                      ? `Bénéfices (${fmtPercent(settleDeal?.profit_share_rate ?? 0)} %)`
                      : `Pertes (${fmtPercent(settleDeal?.loss_share_rate ?? 0)} %)`}
                  </p>
                </div>
                <p
                  className={`text-xl font-semibold tabular-nums ${
                    preview.investor_share >= 0 ? "text-emerald" : "text-terracotta"
                  }`}
                >
                  {fmtPrice(preview.investor_share)} TND
                </p>
              </div>

              {/* Order info */}
              <p className="text-xs text-warm-gray-400 text-right">
                {preview.scope_order_count} commandes dans le périmètre
                {preview.total_order_count > 0 && preview.scope_order_count !== preview.total_order_count
                  ? ` / ${preview.total_order_count} total`
                  : ""}
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default function InvestorDetailPageWrapper({ params }: { params: Promise<{ id: string }> }) {
  return <InvestorDetailPage params={params} />;
}
