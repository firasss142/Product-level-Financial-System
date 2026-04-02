"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  Select,
  StatCard,
  DataTable,
  Modal,
  useToast,
  type DataTableColumn,
} from "@/components/ui";
import { fmtNumber } from "@/lib/format";
import type { CampaignRow, SpendAllocation } from "@/types/cost-model";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastMonth(): { start: string; end: string } {
  const d = new Date();
  const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const month = d.getMonth() === 0 ? 12 : d.getMonth();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
  return { start, end };
}

const INPUT_CLASS =
  "border border-warm-gray-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy bg-white";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// CampaignsPage
// ---------------------------------------------------------------------------

export default function CampaignsPage() {
  const { toast } = useToast();

  // Period
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(today());

  // Data
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);

  // Sync
  const [syncing, setSyncing] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<CampaignRow | null>(null);
  const [editProductId, setEditProductId] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [allocations, setAllocations] = useState<SpendAllocation[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch data
  // ---------------------------------------------------------------------------

  const fetchCampaigns = useCallback(
    (start: string, end: string) => {
      setLoading(true);
      void fetch(`/api/campaigns?period_start=${start}&period_end=${end}`)
        .then((r) => r.json())
        .then((data: CampaignRow[]) => setRows(data))
        .catch(() =>
          toast({ title: "Impossible de charger les campagnes", variant: "error" })
        )
        .finally(() => setLoading(false));
    },
    [toast]
  );

  useEffect(() => {
    fetchCampaigns(startDate, endDate);
  }, [fetchCampaigns, startDate, endDate]);

  useEffect(() => {
    void fetch("/api/products?is_active=true")
      .then((r) => r.json())
      .then((data: ProductOption[]) => setProducts(data))
      .catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  async function handleSync() {
    const adAccountId = process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID;
    if (!adAccountId) {
      toast({
        title: "META_AD_ACCOUNT_ID non configuré",
        description: "Ajoutez NEXT_PUBLIC_META_AD_ACCOUNT_ID dans .env.local",
        variant: "error",
      });
      return;
    }
    if (!products[0]) {
      toast({ title: "Aucun produit disponible pour l'assignation par défaut", variant: "error" });
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch("/api/campaigns/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_account_id: adAccountId,
          period_start: startDate,
          period_end: endDate,
          default_product_id: products[0].id,
        }),
      });
      const body = (await res.json()) as { synced?: number; errors?: string[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Erreur inconnue");

      toast({
        title: `${body.synced ?? 0} campagne(s) synchronisée(s)`,
        variant: "success",
      });
      if (body.errors?.length) {
        toast({
          title: `${body.errors.length} erreur(s) lors de la synchronisation`,
          description: body.errors[0],
          variant: "error",
        });
      }
      fetchCampaigns(startDate, endDate);
    } catch (err) {
      toast({
        title: "Échec de la synchronisation",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSyncing(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Edit modal
  // ---------------------------------------------------------------------------

  const openEdit = useCallback((row: CampaignRow) => {
    setEditRow(row);
    setEditProductId(row.product_id);
    const hasAllocs = row.spend_allocations && row.spend_allocations.length > 0;
    setSplitMode(!!hasAllocs);
    setAllocations(row.spend_allocations ?? []);
    setEditOpen(true);
  }, []);

  const allocationSum = useMemo(
    () => allocations.reduce((s, a) => s + a.percentage, 0),
    [allocations]
  );

  function setAllocationPct(productId: string, pct: number) {
    setAllocations((prev) => {
      const exists = prev.find((a) => a.product_id === productId);
      if (exists) {
        return prev.map((a) =>
          a.product_id === productId ? { ...a, percentage: pct } : a
        );
      }
      return [...prev, { product_id: productId, percentage: pct }];
    });
  }

  async function handleEditSave() {
    if (!editRow) return;

    if (splitMode) {
      const nonZero = allocations.filter((a) => a.percentage > 0);
      if (nonZero.length < 2) {
        toast({
          title: "La répartition nécessite au moins 2 produits",
          variant: "error",
        });
        return;
      }
      if (Math.abs(allocationSum - 100) >= 0.01) {
        toast({
          title: "Les pourcentages doivent totaliser 100",
          variant: "error",
        });
        return;
      }
    }

    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (!splitMode) {
        payload.product_id = editProductId;
        payload.spend_allocations = null;
      } else {
        payload.spend_allocations = allocations.filter((a) => a.percentage > 0);
      }

      const res = await fetch(`/api/campaigns/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const updated = (await res.json()) as CampaignRow;
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast({ title: "Campagne mise à jour", variant: "success" });
      setEditOpen(false);
    } catch (err) {
      toast({
        title: "Échec de la mise à jour",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setEditLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Stat cards
  // ---------------------------------------------------------------------------

  const totalSpend = useMemo(() => rows.reduce((s, r) => s + r.spend, 0), [rows]);
  const totalLeads = useMemo(() => rows.reduce((s, r) => s + r.leads, 0), [rows]);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null;

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns = useMemo<DataTableColumn<CampaignRow>[]>(
    () => [
      {
        id: "campaign_name",
        header: "Nom",
        accessorKey: "campaign_name",
        sortable: true,
        cell: (value) => (
          <span className="text-navy">{(value as string | null) ?? "—"}</span>
        ),
      },
      {
        id: "platform",
        header: "Plateforme",
        accessorKey: "platform",
        sortable: true,
        cell: (value) => (
          <Badge variant="pending">{(value as string).toUpperCase()}</Badge>
        ),
      },
      {
        id: "spend",
        header: "Dépenses (TND)",
        accessorKey: "spend",
        sortable: true,
        numeric: true,
        cell: (value) => (
          <span className="tabular-nums">{fmtNumber(value as number)}</span>
        ),
      },
      {
        id: "cpl",
        header: "CPL (TND)",
        sortable: false,
        numeric: true,
        accessorFn: (row) => (row.leads > 0 ? row.spend / row.leads : null),
        cell: (value) => (
          <span className="tabular-nums">
            {value != null ? fmtNumber(value as number) : "—"}
          </span>
        ),
      },
      {
        id: "leads",
        header: "Leads",
        accessorKey: "leads",
        sortable: true,
        numeric: true,
        cell: (value) => (
          <span className="tabular-nums">{fmtNumber(value as number)}</span>
        ),
      },
      {
        id: "impressions",
        header: "Impressions",
        accessorKey: "impressions",
        sortable: true,
        numeric: true,
        cell: (value) => (
          <span className="tabular-nums">{fmtNumber(value as number)}</span>
        ),
      },
      {
        id: "clicks",
        header: "Clics",
        accessorKey: "clicks",
        sortable: true,
        numeric: true,
        cell: (value) => (
          <span className="tabular-nums">{fmtNumber(value as number)}</span>
        ),
      },
      {
        id: "ctr",
        header: "CTR",
        sortable: false,
        numeric: true,
        accessorFn: (row) =>
          row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null,
        cell: (value) => (
          <span className="tabular-nums">
            {value != null ? `${(value as number).toFixed(2)} %` : "—"}
          </span>
        ),
      },
      {
        id: "product",
        header: "Produit associé",
        sortable: false,
        accessorFn: (row) => row.product_name ?? "Non assigné",
        cell: (_value, row) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            className="text-sm text-emerald underline cursor-pointer hover:text-emerald/80"
          >
            {row.spend_allocations && row.spend_allocations.length > 0
              ? "Répartition multiple"
              : (row.product_name ?? "Non assigné")}
          </button>
        ),
      },
    ],
    [openEdit]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Campagnes</h1>
        <Button onClick={() => void handleSync()} disabled={syncing}>
          {syncing ? "Synchronisation…" : "Synchroniser"}
        </Button>
      </div>

      {/* Period selector */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-warm-gray-500">De</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-warm-gray-500">À</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStartDate(firstOfMonth());
                  setEndDate(today());
                }}
                className="text-sm text-navy underline cursor-pointer hover:text-navy/70"
              >
                Ce mois
              </button>
              <button
                onClick={() => {
                  const lm = lastMonth();
                  setStartDate(lm.start);
                  setEndDate(lm.end);
                }}
                className="text-sm text-navy underline cursor-pointer hover:text-navy/70"
              >
                Mois dernier
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Dépenses publicitaires"
          value={fmtNumber(totalSpend)}
          suffix="TND"
        />
        <StatCard
          label="Coût par lead"
          value={avgCpl != null ? fmtNumber(avgCpl) : "—"}
          suffix={avgCpl != null ? "TND" : undefined}
        />
        <StatCard
          label="Total leads"
          value={fmtNumber(totalLeads)}
        />
      </div>

      {/* DataTable */}
      <Card>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            loading={loading}
            searchable
            searchPlaceholder="Rechercher une campagne…"
            emptyMessage="Aucune campagne sur cette période"
          />
        </CardContent>
      </Card>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Produit associé"
        confirmLabel="Enregistrer"
        onConfirm={() => void handleEditSave()}
        loading={editLoading}
      >
        <div className="space-y-4">
          {/* Split toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-navy">Répartition multiple</span>
            <button
              onClick={() => {
                const next = !splitMode;
                setSplitMode(next);
                if (next && allocations.length === 0) {
                  // Pre-populate with current product at 100%
                  setAllocations([{ product_id: editProductId, percentage: 100 }]);
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                splitMode ? "bg-emerald" : "bg-warm-gray-200"
              }`}
              role="switch"
              aria-checked={splitMode}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  splitMode ? "translate-x-4" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {!splitMode ? (
            <Select
              label="Produit associé"
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              value={editProductId}
              onValueChange={setEditProductId}
              placeholder="Sélectionner un produit…"
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-warm-gray-500">
                Définissez le pourcentage de dépenses alloué à chaque produit.
              </p>
              {products.map((p) => {
                const entry = allocations.find((a) => a.product_id === p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-navy truncate">{p.name}</span>
                    <Input
                      label=""
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      suffix="%"
                      value={String(entry?.percentage ?? 0)}
                      onChange={(e) =>
                        setAllocationPct(p.id, Math.max(0, Math.min(100, Number(e.target.value))))
                      }
                      className="w-28"
                    />
                  </div>
                );
              })}
              <p
                className={`text-sm font-medium tabular-nums ${
                  Math.abs(allocationSum - 100) < 0.01
                    ? "text-emerald"
                    : "text-terracotta"
                }`}
              >
                Total : {allocationSum.toFixed(0)} %
                {Math.abs(allocationSum - 100) >= 0.01 && " (doit totaliser 100 %)"}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

