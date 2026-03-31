"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Badge,
  Modal,
  useToast,
} from "@/components/ui";
import { fmtDateMedium } from "@/lib/format";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Store {
  id: string;
  converty_account_id: string;
  converty_store_id: string;
  name: string;
  navex_account_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ConvertyAccount {
  id: string;
  email: string;
  auth_token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stores: Store[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

// ── Store row component ───────────────────────────────────────────────────────

function StoreRow({
  store,
  onToggle,
  onEdit,
}: {
  store: Store;
  onToggle: (store: Store) => void;
  onEdit: (store: Store) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-warm-gray-50 border border-warm-gray-100">
      <div className="flex items-center gap-4 min-w-0">
        <div>
          <p className="text-sm font-medium text-navy">{store.name}</p>
          <p className="text-xs text-warm-gray-500 font-mono mt-0.5">{store.converty_store_id}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-warm-gray-400">Dernière synchronisation : —</span>
        <button
          onClick={() => onToggle(store)}
          className="cursor-pointer"
          aria-label={store.is_active ? "Désactiver la boutique" : "Activer la boutique"}
        >
          <Badge variant={store.is_active ? "delivered" : "rejected"}>
            {store.is_active ? "Actif" : "Inactif"}
          </Badge>
        </button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(store)}>
          Modifier
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function AccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<ConvertyAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Add account modal
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addAccountLoading, setAddAccountLoading] = useState(false);
  const [addAccountErrors, setAddAccountErrors] = useState<{ email?: string; password?: string }>({});

  // Add store modal
  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const [addStoreAccountId, setAddStoreAccountId] = useState<string | null>(null);
  const [addStoreName, setAddStoreName] = useState("");
  const [addStoreConvertyId, setAddStoreConvertyId] = useState("");
  const [addStoreNavexId, setAddStoreNavexId] = useState("");
  const [addStoreLoading, setAddStoreLoading] = useState(false);
  const [addStoreErrors, setAddStoreErrors] = useState<{ name?: string; converty_store_id?: string }>({});

  // Edit store modal
  const [editStoreOpen, setEditStoreOpen] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreNavexId, setEditStoreNavexId] = useState("");
  const [editStoreLoading, setEditStoreLoading] = useState(false);
  const [editStoreErrors, setEditStoreErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    setLoading(true);
    void fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: ConvertyAccount[]) => setAccounts(data))
      .catch(() => toast({ title: "Impossible de charger les comptes", variant: "error" }))
      .finally(() => setLoading(false));
  }, [toast]);

  // ── Toggle account active ────────────────────────────────────────────────

  const toggleAccount = useCallback(async (account: ConvertyAccount) => {
    try {
      const res = await fetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, is_active: !account.is_active }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Erreur inconnue");
      setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, is_active: !a.is_active } : a));
    } catch (err) {
      toast({ title: "Échec de la mise à jour", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }, [toast]);

  const testConnection = useCallback((account: ConvertyAccount) => {
    toast({
      title: "Test de connexion",
      description: `Connexion Converty pour "${account.email}" disponible à partir de la session 9.`,
      variant: "info",
    });
  }, [toast]);

  // ── Add account ──────────────────────────────────────────────────────────

  async function handleAddAccount() {
    const errs: typeof addAccountErrors = {};
    if (!addEmail.trim()) errs.email = "Champ obligatoire";
    if (!addPassword.trim()) errs.password = "Champ obligatoire";
    if (Object.keys(errs).length) { setAddAccountErrors(errs); return; }

    setAddAccountLoading(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim(), password_encrypted: addPassword }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Erreur inconnue");
      const created = (await res.json()) as ConvertyAccount;
      setAccounts((prev) => [...prev, created]);
      toast({ title: "Compte ajouté", variant: "success" });
      setAddAccountOpen(false);
      setAddEmail("");
      setAddPassword("");
    } catch (err) {
      toast({ title: "Échec de l'ajout", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setAddAccountLoading(false);
    }
  }

  // ── Add store ────────────────────────────────────────────────────────────

  function openAddStore(accountId: string) {
    setAddStoreAccountId(accountId);
    setAddStoreName("");
    setAddStoreConvertyId("");
    setAddStoreNavexId("");
    setAddStoreErrors({});
    setAddStoreOpen(true);
  }

  async function handleAddStore() {
    if (!addStoreAccountId) return;
    const errs: typeof addStoreErrors = {};
    if (!addStoreName.trim()) errs.name = "Champ obligatoire";
    if (!addStoreConvertyId.trim()) errs.converty_store_id = "Champ obligatoire";
    if (Object.keys(errs).length) { setAddStoreErrors(errs); return; }

    setAddStoreLoading(true);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          converty_account_id: addStoreAccountId,
          converty_store_id: addStoreConvertyId.trim(),
          name: addStoreName.trim(),
          navex_account_id: addStoreNavexId.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Erreur inconnue");
      const created = (await res.json()) as Store;
      setAccounts((prev) =>
        prev.map((a) => a.id === addStoreAccountId ? { ...a, stores: [...a.stores, created] } : a)
      );
      toast({ title: "Boutique ajoutée", variant: "success" });
      setAddStoreOpen(false);
    } catch (err) {
      toast({ title: "Échec de l'ajout", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setAddStoreLoading(false);
    }
  }

  // ── Toggle store active ──────────────────────────────────────────────────

  const toggleStore = useCallback(async (store: Store) => {
    try {
      const res = await fetch("/api/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: store.id, is_active: !store.is_active }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Erreur inconnue");
      const updated = (await res.json()) as Store;
      setAccounts((prev) =>
        prev.map((a) => ({
          ...a,
          stores: a.stores.map((s) => s.id === updated.id ? updated : s),
        }))
      );
    } catch (err) {
      toast({ title: "Échec de la mise à jour", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }, [toast]);

  // ── Edit store ───────────────────────────────────────────────────────────

  const openEditStore = useCallback((store: Store) => {
    setEditStore(store);
    setEditStoreName(store.name);
    setEditStoreNavexId(store.navex_account_id ?? "");
    setEditStoreErrors({});
    setEditStoreOpen(true);
  }, []);

  async function handleEditStore() {
    if (!editStore) return;
    const errs: typeof editStoreErrors = {};
    if (!editStoreName.trim()) errs.name = "Champ obligatoire";
    if (Object.keys(errs).length) { setEditStoreErrors(errs); return; }

    setEditStoreLoading(true);
    try {
      const res = await fetch("/api/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editStore.id,
          name: editStoreName.trim(),
          navex_account_id: editStoreNavexId.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Erreur inconnue");
      const updated = (await res.json()) as Store;
      setAccounts((prev) =>
        prev.map((a) => ({
          ...a,
          stores: a.stores.map((s) => s.id === updated.id ? updated : s),
        }))
      );
      toast({ title: "Boutique mise à jour", variant: "success" });
      setEditStoreOpen(false);
    } catch (err) {
      toast({ title: "Échec de la mise à jour", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setEditStoreLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white shadow-sm rounded-xl p-6 animate-pulse">
            <div className="h-5 w-48 bg-warm-gray-200 rounded mb-4" />
            <div className="space-y-2">
              <div className="h-12 bg-warm-gray-100 rounded-lg" />
              <div className="h-12 bg-warm-gray-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Comptes Converty</h1>
        <Button onClick={() => { setAddAccountErrors({}); setAddAccountOpen(true); }}>
          Ajouter un compte
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-warm-gray-500 py-8">Aucun compte Converty configuré</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              {/* Account header */}
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <CardTitle className="text-base">{maskEmail(account.email)}</CardTitle>
                      <p className="text-xs text-warm-gray-400 mt-0.5">
                        Ajouté le {fmtDateMedium(account.created_at)}
                        {account.auth_token && (
                          <span className="ml-2 text-emerald">· Token actif</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => testConnection(account)}
                    >
                      Tester la connexion
                    </Button>
                    <button
                      onClick={() => void toggleAccount(account)}
                      className="cursor-pointer"
                      aria-label={account.is_active ? "Désactiver le compte" : "Activer le compte"}
                    >
                      <Badge variant={account.is_active ? "delivered" : "rejected"}>
                        {account.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </button>
                  </div>
                </div>
              </CardHeader>

              {/* Stores section */}
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-warm-gray-600">
                    Boutiques
                    <span className="ml-1.5 text-warm-gray-400 font-normal">
                      ({account.stores.length})
                    </span>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openAddStore(account.id)}
                  >
                    + Ajouter une boutique
                  </Button>
                </div>

                {account.stores.length === 0 ? (
                  <p className="text-sm text-warm-gray-400 py-2">Aucune boutique configurée</p>
                ) : (
                  <div className="space-y-2">
                    {account.stores.map((store) => (
                      <StoreRow
                        key={store.id}
                        store={store}
                        onToggle={(s) => void toggleStore(s)}
                        onEdit={openEditStore}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add account modal */}
      <Modal
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        title="Nouveau compte Converty"
        confirmLabel="Ajouter"
        onConfirm={() => void handleAddAccount()}
        loading={addAccountLoading}
      >
        <div className="space-y-4">
          <Input
            label="Adresse e-mail"
            type="email"
            value={addEmail}
            onChange={(e) => { setAddEmail(e.target.value); setAddAccountErrors((p) => ({ ...p, email: undefined })); }}
            error={addAccountErrors.email}
            placeholder="email@converty.shop"
          />
          <Input
            label="Mot de passe"
            type="password"
            value={addPassword}
            onChange={(e) => { setAddPassword(e.target.value); setAddAccountErrors((p) => ({ ...p, password: undefined })); }}
            error={addAccountErrors.password}
            placeholder="••••••••"
          />
        </div>
      </Modal>

      {/* Add store modal */}
      <Modal
        open={addStoreOpen}
        onOpenChange={setAddStoreOpen}
        title="Nouvelle boutique"
        confirmLabel="Ajouter"
        onConfirm={() => void handleAddStore()}
        loading={addStoreLoading}
      >
        <div className="space-y-4">
          <Input
            label="Nom de la boutique"
            value={addStoreName}
            onChange={(e) => { setAddStoreName(e.target.value); setAddStoreErrors((p) => ({ ...p, name: undefined })); }}
            error={addStoreErrors.name}
            placeholder="ex. Rouleau Magique Store"
          />
          <Input
            label="ID Converty de la boutique"
            value={addStoreConvertyId}
            onChange={(e) => { setAddStoreConvertyId(e.target.value); setAddStoreErrors((p) => ({ ...p, converty_store_id: undefined })); }}
            error={addStoreErrors.converty_store_id}
            placeholder="ex. 67a8b2c3d4e5f6a7b8c9d0e1"
          />
          <Input
            label="ID compte Navex"
            value={addStoreNavexId}
            onChange={(e) => setAddStoreNavexId(e.target.value)}
            placeholder="Optionnel"
          />
        </div>
      </Modal>

      {/* Edit store modal */}
      <Modal
        open={editStoreOpen}
        onOpenChange={setEditStoreOpen}
        title="Modifier la boutique"
        description={editStore ? `ID Converty : ${editStore.converty_store_id}` : undefined}
        confirmLabel="Enregistrer"
        onConfirm={() => void handleEditStore()}
        loading={editStoreLoading}
      >
        <div className="space-y-4">
          <Input
            label="Nom de la boutique"
            value={editStoreName}
            onChange={(e) => { setEditStoreName(e.target.value); setEditStoreErrors((p) => ({ ...p, name: undefined })); }}
            error={editStoreErrors.name}
          />
          <Input
            label="ID compte Navex"
            value={editStoreNavexId}
            onChange={(e) => setEditStoreNavexId(e.target.value)}
            placeholder="Laisser vide pour supprimer"
          />
        </div>
      </Modal>
    </div>
  );
}

export default function AccountsPageWrapper() {
  return <AccountsPage />;
}
