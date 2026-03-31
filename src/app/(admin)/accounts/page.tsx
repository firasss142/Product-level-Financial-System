"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  Input,
  Button,
  Badge,
  Select,
  DataTable,
  Modal,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/ui";

interface Account {
  id: string;
  name: string;
  platform: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AccountWithCredentials extends Account {
  credentials?: Record<string, unknown>;
}

const PLATFORM_OPTIONS: SelectOption[] = [
  { value: "converty", label: "Converty" },
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-TN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function AccountsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPlatform, setAddPlatform] = useState("converty");
  const [addCredentials, setAddCredentials] = useState("");
  const [addErrors, setAddErrors] = useState<{ name?: string; credentials?: string }>({});
  const [addLoading, setAddLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<AccountWithCredentials | null>(null);
  const [editName, setEditName] = useState("");
  const [editCredentials, setEditCredentials] = useState("");
  const [editErrors, setEditErrors] = useState<{ name?: string; credentials?: string }>({});
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: Account[]) => setRows(data))
      .catch(() => toast({ title: "Impossible de charger les comptes", variant: "error" }))
      .finally(() => setLoading(false));
  }, [toast]);

  async function patch(id: string, updates: Partial<AccountWithCredentials>) {
    const res = await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? "Erreur inconnue");
    }
    return (await res.json()) as Account;
  }

  const toggleActive = useCallback(async (row: Account) => {
    try {
      const updated = await patch(row.id, { is_active: !row.is_active });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      toast({
        title: "Échec de la mise à jour",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  }, [toast]);

  const openEdit = useCallback((row: Account) => {
    setEditRow(row);
    setEditName(row.name);
    setEditCredentials("");
    setEditErrors({});
    setEditOpen(true);
  }, []);

  const handleTestConnection = useCallback((row: Account) => {
    toast({
      title: "Test de connexion",
      description: `Synchronisation de "${row.name}" disponible à partir de la session 9.`,
      variant: "info",
    });
  }, [toast]);

  async function handleAdd() {
    const errs: typeof addErrors = {};
    if (!addName.trim()) errs.name = "Champ obligatoire";
    let parsedAddCredentials: Record<string, unknown> | undefined;
    if (addCredentials.trim()) {
      try { parsedAddCredentials = JSON.parse(addCredentials) as Record<string, unknown>; }
      catch { errs.credentials = "JSON invalide"; }
    }
    if (Object.keys(errs).length) { setAddErrors(errs); return; }

    setAddLoading(true);
    try {
      const credentials = parsedAddCredentials;
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), platform: addPlatform, credentials }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const created = (await res.json()) as Account;
      setRows((prev) => [...prev, created]);
      toast({ title: "Compte ajouté", variant: "success" });
      setAddOpen(false);
      setAddName("");
      setAddPlatform("converty");
      setAddCredentials("");
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

  async function handleEdit() {
    if (!editRow) return;
    const errs: typeof editErrors = {};
    if (!editName.trim()) errs.name = "Champ obligatoire";
    let parsedEditCredentials: Record<string, unknown> | undefined;
    if (editCredentials.trim()) {
      try { parsedEditCredentials = JSON.parse(editCredentials) as Record<string, unknown>; }
      catch { errs.credentials = "JSON invalide"; }
    }
    if (Object.keys(errs).length) { setEditErrors(errs); return; }

    setEditLoading(true);
    try {
      const credentials = parsedEditCredentials;
      const updates: Partial<AccountWithCredentials> = { name: editName.trim() };
      if (credentials !== undefined) updates.credentials = credentials;

      const updated = await patch(editRow.id, updates);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast({ title: "Compte mis à jour", variant: "success" });
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

  const columns = useMemo<DataTableColumn<Account>[]>(() => [
    {
      id: "name",
      header: "Nom",
      accessorKey: "name",
      sortable: true,
    },
    {
      id: "platform",
      header: "Plateforme",
      accessorKey: "platform",
      sortable: true,
      cell: (value) => (
        <span className="capitalize">{value as string}</span>
      ),
    },
    {
      id: "last_sync",
      header: "Dernière synchronisation",
      sortable: false,
      cell: () => (
        <span className="text-warm-gray-400">—</span>
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
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleTestConnection(row); }}
          >
            Tester la connexion
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
          >
            Modifier
          </Button>
        </div>
      ),
    },
  ], [toggleActive, openEdit, handleTestConnection]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Comptes</h1>
        <Button onClick={() => { setAddErrors({}); setAddOpen(true); }}>
          Ajouter un compte
        </Button>
      </div>

      <Card>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            loading={loading}
            searchable
            searchPlaceholder="Rechercher un compte…"
            emptyMessage="Aucun compte configuré"
          />
        </CardContent>
      </Card>

      {/* Add modal */}
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Nouveau compte"
        confirmLabel="Ajouter"
        onConfirm={() => void handleAdd()}
        loading={addLoading}
      >
        <div className="space-y-4">
          <Input
            label="Nom"
            value={addName}
            onChange={(e) => { setAddName(e.target.value); setAddErrors((p) => ({ ...p, name: undefined })); }}
            error={addErrors.name}
            placeholder="ex. Boutique principale"
          />
          <Select
            label="Plateforme"
            options={PLATFORM_OPTIONS}
            value={addPlatform}
            onValueChange={setAddPlatform}
          />
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">
              Identifiants <span className="text-warm-gray-400 font-normal">(JSON)</span>
            </label>
            <textarea
              value={addCredentials}
              onChange={(e) => { setAddCredentials(e.target.value); setAddErrors((p) => ({ ...p, credentials: undefined })); }}
              placeholder={'{"email": "...", "password": "..."}'}
              rows={4}
              className="w-full rounded-lg border border-warm-gray-200 bg-white px-3 py-2 text-sm text-navy font-mono focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none transition-colors placeholder:text-warm-gray-400 resize-none"
            />
            {addErrors.credentials && (
              <p className="text-sm text-terracotta mt-1" role="alert">{addErrors.credentials}</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Modifier le compte"
        description={editRow ? `Plateforme : ${editRow.platform} · Créé le ${formatDate(editRow.created_at)}` : undefined}
        confirmLabel="Enregistrer"
        onConfirm={() => void handleEdit()}
        loading={editLoading}
        className="max-w-lg"
      >
        <div className="space-y-4">
          <Input
            label="Nom"
            value={editName}
            onChange={(e) => { setEditName(e.target.value); setEditErrors((p) => ({ ...p, name: undefined })); }}
            error={editErrors.name}
          />
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">
              Identifiants <span className="text-warm-gray-400 font-normal">(JSON — laisser vide pour ne pas modifier)</span>
            </label>
            <textarea
              value={editCredentials}
              onChange={(e) => { setEditCredentials(e.target.value); setEditErrors((p) => ({ ...p, credentials: undefined })); }}
              placeholder={'{"email": "...", "password": "..."}'}
              rows={4}
              className="w-full rounded-lg border border-warm-gray-200 bg-white px-3 py-2 text-sm text-navy font-mono focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none transition-colors placeholder:text-warm-gray-400 resize-none"
            />
            {editErrors.credentials && (
              <p className="text-sm text-terracotta mt-1" role="alert">{editErrors.credentials}</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function AccountsPageWrapper() {
  return <AccountsPage />;
}
