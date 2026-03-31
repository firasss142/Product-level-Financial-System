"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  Input,
  Button,
  Badge,
  DataTable,
  Modal,
  useToast,
  type DataTableColumn,
} from "@/components/ui";

interface OverheadCategory {
  id: string;
  label: string;
  monthly_amount: number;
  sort_order: number | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

function formatTND(value: number) {
  return value.toLocaleString("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function OverheadPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OverheadCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addErrors, setAddErrors] = useState<{ label?: string; amount?: string }>({});
  const [addLoading, setAddLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<OverheadCategory | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editErrors, setEditErrors] = useState<{ label?: string; amount?: string }>({});
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetch("/api/overhead")
      .then((r) => r.json())
      .then((data: OverheadCategory[]) => setRows(data))
      .catch(() => toast({ title: "Impossible de charger les frais fixes", variant: "error" }))
      .finally(() => setLoading(false));
  }, [toast]);

  async function patch(id: string, updates: Partial<OverheadCategory>) {
    const res = await fetch("/api/overhead", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? "Erreur inconnue");
    }
    return (await res.json()) as OverheadCategory;
  }

  const toggleActive = useCallback(async (row: OverheadCategory) => {
    try {
      const updated = await patch(row.id, { is_active: !row.is_active });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast({ title: "Frais fixes mis à jour", variant: "success" });
    } catch (err) {
      toast({
        title: "Échec de la mise à jour",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  }, [toast]);

  const openEdit = useCallback((row: OverheadCategory) => {
    setEditRow(row);
    setEditLabel(row.label);
    setEditAmount(String(row.monthly_amount));
    setEditErrors({});
    setEditOpen(true);
  }, []);

  function validateAmountForm(label: string, amount: string) {
    const errs: { label?: string; amount?: string } = {};
    if (!label.trim()) errs.label = "Champ obligatoire";
    const amt = Number(amount);
    if (isNaN(amt) || amt < 0) errs.amount = "Montant invalide";
    return { errs, amt };
  }

  async function handleEdit() {
    if (!editRow) return;
    const { errs, amt } = validateAmountForm(editLabel, editAmount);
    if (Object.keys(errs).length) { setEditErrors(errs); return; }

    setEditLoading(true);
    try {
      const updated = await patch(editRow.id, { label: editLabel.trim(), monthly_amount: amt });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast({ title: "Frais fixes mis à jour", variant: "success" });
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

  async function handleAdd() {
    const { errs, amt } = validateAmountForm(addLabel, addAmount);
    if (Object.keys(errs).length) { setAddErrors(errs); return; }

    setAddLoading(true);
    try {
      const res = await fetch("/api/overhead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: addLabel.trim(), monthly_amount: amt }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const created = (await res.json()) as OverheadCategory;
      setRows((prev) => [...prev, created]);
      toast({ title: "Frais fixes mis à jour", variant: "success" });
      setAddOpen(false);
      setAddLabel("");
      setAddAmount("");
    } catch (err) {
      toast({
        title: "Échec de l'ajout",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setAddLoading(false);
    }
  }

  const columns = useMemo<DataTableColumn<OverheadCategory>[]>(() => [
    {
      id: "label",
      header: "Nom",
      accessorKey: "label",
      sortable: true,
    },
    {
      id: "monthly_amount",
      header: "Montant mensuel (TND)",
      accessorKey: "monthly_amount",
      numeric: true,
      sortable: true,
      cell: (value) => (
        <span className="tabular-nums">{formatTND(value as number)}</span>
      ),
    },
    {
      id: "is_active",
      header: "Actif",
      accessorKey: "is_active",
      sortable: false,
      cell: (value, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); void toggleActive(row); }}
          className="cursor-pointer"
          aria-label={value ? "Désactiver" : "Activer"}
        >
          <Badge variant={value ? "delivered" : "rejected"}>
            {value ? "Actif" : "Inactif"}
          </Badge>
        </button>
      ),
    },
    {
      id: "actions",
      header: "",
      sortable: false,
      cell: (_value, row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); openEdit(row); }}
        >
          Modifier
        </Button>
      ),
    },
  ], [toggleActive, openEdit]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Frais fixes</h1>
        <Button onClick={() => { setAddErrors({}); setAddOpen(true); }}>
          Ajouter une catégorie
        </Button>
      </div>

      <Card>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            loading={loading}
            searchable
            searchPlaceholder="Rechercher une catégorie…"
            emptyMessage="Aucune catégorie de frais fixes"
          />
        </CardContent>
      </Card>

      {/* Add modal */}
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Nouvelle catégorie"
        confirmLabel="Ajouter"
        onConfirm={() => void handleAdd()}
        loading={addLoading}
      >
        <div className="space-y-4">
          <Input
            label="Nom"
            value={addLabel}
            onChange={(e) => { setAddLabel(e.target.value); setAddErrors((p) => ({ ...p, label: undefined })); }}
            error={addErrors.label}
            placeholder="ex. Assurance"
          />
          <Input
            label="Montant mensuel"
            type="number"
            min="0"
            step="any"
            suffix="TND"
            value={addAmount}
            onChange={(e) => { setAddAmount(e.target.value); setAddErrors((p) => ({ ...p, amount: undefined })); }}
            error={addErrors.amount}
          />
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Modifier la catégorie"
        confirmLabel="Enregistrer"
        onConfirm={() => void handleEdit()}
        loading={editLoading}
      >
        <div className="space-y-4">
          <Input
            label="Nom"
            value={editLabel}
            onChange={(e) => { setEditLabel(e.target.value); setEditErrors((p) => ({ ...p, label: undefined })); }}
            error={editErrors.label}
          />
          <Input
            label="Montant mensuel"
            type="number"
            min="0"
            step="any"
            suffix="TND"
            value={editAmount}
            onChange={(e) => { setEditAmount(e.target.value); setEditErrors((p) => ({ ...p, amount: undefined })); }}
            error={editErrors.amount}
          />
        </div>
      </Modal>
    </div>
  );
}

export default function OverheadPageWrapper() {
  return <OverheadPage />;
}
