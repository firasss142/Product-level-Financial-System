"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  DataTable,
  Modal,
  useToast,
  type DataTableColumn,
} from "@/components/ui";
import { fmtPrice, fmtDateMedium } from "@/lib/format";
import type { Investor } from "@/types/investor";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvestorRow extends Investor {
  active_deals_count: number;
  total_capital: number;
  last_settlement_at: string | null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvestorsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<InvestorRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  // Toggle modal
  const [toggleTarget, setToggleTarget] = useState<InvestorRow | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    void fetch("/api/investors")
      .then((r) => r.json())
      .then((data: InvestorRow[]) => setRows(data))
      .catch(() => toast({ title: "Impossible de charger les investisseurs", variant: "error" }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // ── Create ────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) return;
    setCreateLoading(true);
    try {
      const res = await fetch("/api/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      toast({ title: "Investisseur créé", variant: "success" });
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "", notes: "" });
      load();
    } catch (err) {
      toast({
        title: "Échec de la création",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setCreateLoading(false);
    }
  }, [form, toast, load]);

  // ── Toggle active ─────────────────────────────────────────────────────────

  const handleToggle = useCallback(async () => {
    if (!toggleTarget) return;
    setToggleLoading(true);
    try {
      const res = await fetch("/api/investors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: toggleTarget.id, is_active: !toggleTarget.is_active }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      toast({
        title: toggleTarget.is_active ? "Investisseur désactivé" : "Investisseur activé",
        variant: "success",
      });
      setToggleTarget(null);
      load();
    } catch (err) {
      toast({
        title: "Échec de la mise à jour",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setToggleLoading(false);
    }
  }, [toggleTarget, toast, load]);

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo<DataTableColumn<InvestorRow>[]>(() => [
    {
      id: "name",
      header: "Nom",
      accessorKey: "name",
      sortable: true,
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      sortable: true,
      cell: (value) => (
        <span className="text-warm-gray-600">{(value as string | null) ?? "—"}</span>
      ),
    },
    {
      id: "active_deals_count",
      header: "Accords actifs",
      accessorKey: "active_deals_count",
      sortable: true,
      numeric: true,
      cell: (value) => (
        <Badge variant={(value as number) > 0 ? "delivered" : "default"}>
          {String(value)}
        </Badge>
      ),
    },
    {
      id: "total_capital",
      header: "Capital total (TND)",
      accessorKey: "total_capital",
      sortable: true,
      numeric: true,
      cell: (value) => (
        <span className="tabular-nums">{fmtPrice(value as number)}</span>
      ),
    },
    {
      id: "last_settlement_at",
      header: "Dernier règlement",
      accessorKey: "last_settlement_at",
      sortable: true,
      cell: (value) => (
        <span className="text-warm-gray-600">
          {value ? fmtDateMedium(value as string) : "—"}
        </span>
      ),
    },
    {
      id: "is_active",
      header: "Statut",
      accessorKey: "is_active",
      sortable: false,
      cell: (value, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setToggleTarget(row); }}
          className="cursor-pointer"
          aria-label={value ? "Désactiver" : "Activer"}
        >
          <Badge variant={value ? "delivered" : "rejected"}>
            {value ? "Actif" : "Inactif"}
          </Badge>
        </button>
      ),
    },
  ], []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Investisseurs</h1>
        <Button onClick={() => setShowCreate(true)}>Ajouter un investisseur</Button>
      </div>

      <Card>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            loading={loading}
            searchable
            searchPlaceholder="Rechercher un investisseur…"
            emptyMessage="Aucun investisseur configuré"
            pageSize={25}
            onRowClick={(row) => router.push(`/investors/${row.id}`)}
          />
        </CardContent>
      </Card>

      {/* Create investor modal */}
      <Modal
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Nouvel investisseur"
        confirmLabel="Créer"
        onConfirm={() => void handleCreate()}
        loading={createLoading}
      >
        <div className="space-y-4">
          <Input
            label="Nom"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Téléphone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </Modal>

      {/* Toggle active modal */}
      <Modal
        open={!!toggleTarget}
        onOpenChange={(open) => { if (!open) setToggleTarget(null); }}
        title={toggleTarget?.is_active ? "Désactiver l'investisseur" : "Activer l'investisseur"}
        description={
          toggleTarget?.is_active
            ? `"${toggleTarget.name}" sera masqué des listes actives.`
            : `"${toggleTarget?.name}" sera réactivé.`
        }
        confirmLabel={toggleTarget?.is_active ? "Désactiver" : "Activer"}
        confirmVariant={toggleTarget?.is_active ? "danger" : "primary"}
        onConfirm={() => void handleToggle()}
        loading={toggleLoading}
      >
        <p className="text-sm text-warm-gray-600">Confirmez-vous cette action ?</p>
      </Modal>
    </div>
  );
}

