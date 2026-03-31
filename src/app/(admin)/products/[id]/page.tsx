"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Badge,
  Select,
  Modal,
  EmptyState,
  useToast,
  type SelectOption,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtNumber, fmtDateMedium } from "@/lib/format";

// ── Types ───────────────────────────────────────────────────────────────────

interface CostComponent {
  id?: string;
  label: string;
  amount: number;
  is_default: boolean;
  sort_order?: number;
}

interface Batch {
  id: string;
  batch_number: string;
  quantity: number;
  unit_cost: number;
  supplier: string | null;
  notes: string | null;
  cost_breakdown: Array<{ label: string; amount: number }>;
  created_at: string;
}

interface ProductDetail {
  id: string;
  name: string;
  account_id: string;
  account_name: string | null;
  unit_cogs: number;
  is_active: boolean;
  created_at: string;
  cost_components: CostComponent[];
  batches: Batch[];
}

// ── Formatters (from shared lib/format) ─────────────────────────────────────

const fmt = fmtNumber;
const fmtDate = fmtDateMedium;

// ── Section 1: Product Info ─────────────────────────────────────────────────

function InfoSection({
  product,
  accounts,
  onSave,
}: {
  product: ProductDetail;
  accounts: SelectOption[];
  onSave: (updates: { name?: string; account_id?: string; is_active?: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [accountId, setAccountId] = useState(product.account_id);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  async function handleSave() {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Champ obligatoire";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), account_id: accountId });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    setSaving(true);
    try {
      await onSave({ is_active: !product.is_active });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations produit</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            label="Nom du produit"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
            error={errors.name}
          />
          <Select
            label="Compte"
            options={accounts}
            value={accountId}
            onValueChange={setAccountId}
          />
          <div>
            <p className="text-sm font-medium text-navy mb-1.5">Statut</p>
            <div className="flex items-center gap-3">
              <Badge variant={product.is_active ? "delivered" : "rejected"}>
                {product.is_active ? "Actif" : "Inactif"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleToggleActive()}
                loading={saving}
              >
                {product.is_active ? "Désactiver" : "Activer"}
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => void handleSave()} loading={saving}>
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section 2: COGS Breakdown ────────────────────────────────────────────────

function CogsSection({
  initialComponents,
  onSave,
}: {
  initialComponents: CostComponent[];
  onSave: (components: CostComponent[]) => Promise<void>;
}) {
  const [components, setComponents] = useState<CostComponent[]>(initialComponents);
  const [saving, setSaving] = useState(false);

  const total = components.reduce((sum, c) => sum + (c.amount || 0), 0);

  function updateAmount(idx: number, value: string) {
    const num = parseFloat(value) || 0;
    setComponents((prev) => prev.map((c, i) => i === idx ? { ...c, amount: num } : c));
  }

  function updateLabel(idx: number, value: string) {
    setComponents((prev) => prev.map((c, i) => i === idx ? { ...c, label: value } : c));
  }

  function addCustom() {
    setComponents((prev) => [
      ...prev,
      { label: "", amount: 0, is_default: false, sort_order: prev.length + 1 },
    ]);
  }

  function removeCustom(idx: number) {
    setComponents((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(components);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Coût de revient</CardTitle>
          <Button variant="secondary" size="sm" onClick={addCustom}>
            + Ajouter un composant
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-gray-200">
                <th className="text-left px-0 py-2 text-xs font-medium text-warm-gray-500 w-full">
                  Composant
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-warm-gray-500 whitespace-nowrap">
                  Montant (TND/unité)
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {components.map((c, idx) => (
                <tr key={idx} className="border-b border-warm-gray-100">
                  <td className="py-2 pr-4">
                    {c.is_default ? (
                      <span className="text-navy">{c.label}</span>
                    ) : (
                      <input
                        type="text"
                        value={c.label}
                        onChange={(e) => updateLabel(idx, e.target.value)}
                        placeholder="Nom du composant"
                        className="w-full rounded border border-warm-gray-200 px-2 py-1 text-sm text-navy focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none"
                      />
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={c.amount}
                      onChange={(e) => updateAmount(idx, e.target.value)}
                      className="w-28 rounded border border-warm-gray-200 px-2 py-1 text-sm text-right tabular-nums text-navy focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none ml-auto block"
                    />
                  </td>
                  <td className="py-2 pl-2 text-center">
                    {!c.is_default && (
                      <button
                        onClick={() => removeCustom(idx)}
                        className="text-warm-gray-400 hover:text-terracotta transition-colors text-lg leading-none cursor-pointer"
                        aria-label="Supprimer"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-warm-gray-200">
                <td className="py-3 font-semibold text-navy">Coût unitaire total</td>
                <td className="py-3 px-4 text-right">
                  <span className="text-xl font-bold text-navy tabular-nums">{fmt(total)} TND</span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void handleSave()} loading={saving}>
            Enregistrer le coût
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section 3: Batch History ─────────────────────────────────────────────────

function BatchSection({
  batches,
  currentComponents,
  onNewBatch,
}: {
  batches: Batch[];
  currentComponents: CostComponent[];
  onNewBatch: (batch: Batch, setAsActive: boolean) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const params = useParams<{ id: string }>();

  // Form state
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [setAsActive, setSetAsActive] = useState(true);
  const [batchComponents, setBatchComponents] = useState<Array<{ label: string; amount: number }>>([]);
  const [formErrors, setFormErrors] = useState<{ batch_number?: string; quantity?: string }>({});

  function openModal() {
    setBatchNumber("");
    setQuantity("");
    setSupplier("");
    setNotes("");
    setSetAsActive(true);
    setBatchComponents(currentComponents.map((c) => ({ label: c.label, amount: c.amount })));
    setFormErrors({});
    setModalOpen(true);
  }

  const batchTotal = batchComponents.reduce((sum, c) => sum + (c.amount || 0), 0);

  async function handleCreate() {
    const errs: typeof formErrors = {};
    if (!batchNumber.trim()) errs.batch_number = "Champ obligatoire";
    const qty = parseInt(quantity, 10);
    if (!quantity || isNaN(qty) || qty <= 0) errs.quantity = "Quantité invalide";
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/products/${params.id}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_number: batchNumber.trim(),
          quantity: qty,
          supplier: supplier.trim() || undefined,
          notes: notes.trim() || undefined,
          cost_breakdown: batchComponents,
          set_as_active: setAsActive,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const batch = (await res.json()) as Batch;
      toast({ title: "Lot créé", variant: "success" });
      onNewBatch(batch, setAsActive);
      setModalOpen(false);
    } catch (err) {
      toast({
        title: "Échec de la création",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Historique des lots</CardTitle>
          <Button variant="secondary" size="sm" onClick={openModal}>
            + Nouveau lot
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <EmptyState title="Aucun lot enregistré" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-warm-gray-500">N° Lot</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-warm-gray-500">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-warm-gray-500">Quantité</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-warm-gray-500">Coût unitaire (TND)</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-warm-gray-500">Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch, idx) => (
                  <React.Fragment key={batch.id}>
                    <tr
                      className={cn(
                        "border-b border-warm-gray-100 cursor-pointer hover:bg-warm-gray-50 transition-colors",
                        idx === 0 && "bg-warm-gray-50"
                      )}
                      onClick={() => setExpanded(expanded === batch.id ? null : batch.id)}
                    >
                      <td className="px-4 py-3 text-navy font-medium">
                        <span className="flex items-center gap-1.5">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            className={cn(
                              "text-warm-gray-400 transition-transform",
                              expanded === batch.id && "rotate-90"
                            )}
                          >
                            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {batch.batch_number}
                          {idx === 0 && (
                            <Badge variant="pending" className="ml-1 text-[10px]">Récent</Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-warm-gray-600">{fmtDate(batch.created_at)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy">{batch.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy font-medium">{fmt(batch.unit_cost)}</td>
                      <td className="px-4 py-3 text-warm-gray-600">{batch.supplier ?? "—"}</td>
                    </tr>
                    {expanded === batch.id && (
                      <tr key={`${batch.id}-detail`} className="bg-warm-gray-50 border-b border-warm-gray-200">
                        <td colSpan={5} className="px-8 py-3">
                          <p className="text-xs font-medium text-warm-gray-500 mb-2">Détail du coût</p>
                          <table className="text-xs w-auto">
                            <tbody>
                              {(batch.cost_breakdown ?? []).map((c, i) => (
                                <tr key={i}>
                                  <td className="pr-8 py-0.5 text-warm-gray-600">{c.label}</td>
                                  <td className="text-right tabular-nums text-navy">{fmt(c.amount)} TND</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {batch.notes && (
                            <p className="mt-2 text-xs text-warm-gray-500 italic">{batch.notes}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* New batch modal */}
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Nouveau lot"
          confirmLabel="Créer le lot"
          onConfirm={() => void handleCreate()}
          loading={saving}
          className="max-w-lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Numéro de lot"
                value={batchNumber}
                onChange={(e) => { setBatchNumber(e.target.value); setFormErrors((p) => ({ ...p, batch_number: undefined })); }}
                error={formErrors.batch_number}
                placeholder="LOT-2026-04"
              />
              <Input
                label="Quantité"
                type="number"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setFormErrors((p) => ({ ...p, quantity: undefined })); }}
                error={formErrors.quantity}
                placeholder="100"
              />
            </div>
            <Input
              label="Fournisseur"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Optionnel"
            />
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optionnel"
                rows={2}
                className="w-full rounded-lg border border-warm-gray-200 bg-white px-3 py-2 text-sm text-navy focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none transition-colors placeholder:text-warm-gray-400 resize-none"
              />
            </div>

            {/* Cost components for this batch */}
            <div>
              <p className="text-sm font-medium text-navy mb-2">Composants du coût</p>
              <table className="w-full text-sm">
                <tbody>
                  {batchComponents.map((c, i) => (
                    <tr key={i} className="border-b border-warm-gray-100 last:border-0">
                      <td className="py-1.5 pr-4 text-warm-gray-700">{c.label}</td>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={c.amount}
                          onChange={(e) =>
                            setBatchComponents((prev) =>
                              prev.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)
                            )
                          }
                          className="w-24 rounded border border-warm-gray-200 px-2 py-1 text-sm text-right tabular-nums text-navy focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none ml-auto block"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-2 text-sm font-semibold text-navy">Total</td>
                    <td className="pt-2 text-right tabular-nums font-bold text-navy">{fmt(batchTotal)} TND</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={setAsActive}
                onChange={(e) => setSetAsActive(e.target.checked)}
                className="rounded border-warm-gray-300 text-navy focus:ring-navy"
              />
              <span className="text-sm text-navy">Définir comme coût actif</span>
            </label>
          </div>
        </Modal>
      </CardContent>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<SelectOption[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch(`/api/products/${params.id}`).then((r) => {
        if (r.status === 404) { router.push("/products"); return null; }
        return r.json() as Promise<ProductDetail>;
      }),
      fetch("/api/accounts").then((r) => r.json() as Promise<Array<{ id: string; name: string; is_active: boolean }>>),
    ])
      .then(([productData, accountsData]) => {
        if (productData) setProduct(productData);
        setAccounts(accountsData.filter((a) => a.is_active).map((a) => ({ value: a.id, label: a.name })));
      })
      .catch(() => toast({ title: "Impossible de charger le produit", variant: "error" }))
      .finally(() => setLoading(false));
  }, [params.id, router, toast]);

  const handleInfoSave = useCallback(async (updates: { name?: string; account_id?: string; is_active?: boolean }) => {
    if (!product) return;
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, ...updates }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const updated = (await res.json()) as { name: string; account_id: string; is_active: boolean };
      setProduct((prev) => prev ? { ...prev, ...updated } : prev);
      toast({ title: "Informations mises à jour", variant: "success" });
    } catch (err) {
      toast({
        title: "Échec de la mise à jour",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
      throw err;
    }
  }, [product, toast]);

  const handleCogsSave = useCallback(async (components: CostComponent[]) => {
    if (!product) return;
    try {
      const res = await fetch(`/api/products/${product.id}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ components }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const result = (await res.json()) as { components: CostComponent[]; unit_cogs: number };
      setProduct((prev) => prev ? { ...prev, cost_components: result.components, unit_cogs: result.unit_cogs } : prev);
      toast({ title: "Coût de revient mis à jour", variant: "success" });
    } catch (err) {
      toast({
        title: "Échec de l'enregistrement",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
      throw err;
    }
  }, [product, toast]);

  const handleNewBatch = useCallback((batch: Batch, setAsActive: boolean) => {
    setProduct((prev) => prev ? { ...prev, batches: [batch, ...prev.batches] } : prev);
    // Only refetch when unit_cogs changed server-side
    if (setAsActive) {
      void fetch(`/api/products/${params.id}`)
        .then((r) => r.json() as Promise<ProductDetail>)
        .then((data) => setProduct(data))
        .catch(() => {/* non-critical */});
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white shadow-sm rounded-xl p-6 animate-pulse">
            <div className="h-5 w-40 bg-warm-gray-200 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-9 bg-warm-gray-100 rounded" />
              <div className="h-9 bg-warm-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/products"
          className="text-sm text-warm-gray-500 hover:text-navy transition-colors"
        >
          ← Produits
        </Link>
        <span className="text-warm-gray-300" aria-hidden="true">/</span>
        <span className="text-sm text-navy font-medium">{product.name}</span>
      </div>

      <InfoSection
        product={product}
        accounts={accounts}
        onSave={handleInfoSave}
      />

      <CogsSection
        initialComponents={product.cost_components}
        onSave={handleCogsSave}
      />

      <BatchSection
        batches={product.batches}
        currentComponents={product.cost_components}
        onNewBatch={handleNewBatch}
      />
    </div>
  );
}

export default function ProductDetailPageWrapper() {
  return <ProductDetailPage />;
}
