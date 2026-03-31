"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  Button,
  Badge,
  DataTable,
  Modal,
  useToast,
  type DataTableColumn,
} from "@/components/ui";
import { fmtNumber } from "@/lib/format";

interface Product {
  id: string;
  name: string;
  account_id: string;
  account_name: string | null;
  unit_cogs: number;
  is_active: boolean;
  created_at: string;
}


function ProductsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [toggleTarget, setToggleTarget] = useState<Product | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetch("/api/products")
      .then((r) => r.json())
      .then((data: Product[]) => setRows(data))
      .catch(() => toast({ title: "Impossible de charger les produits", variant: "error" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleToggleConfirm = useCallback(async () => {
    if (!toggleTarget) return;
    setToggleLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: toggleTarget.id, is_active: !toggleTarget.is_active }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const updated = (await res.json()) as Product;
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, is_active: updated.is_active } : r)));
      toast({ title: toggleTarget.is_active ? "Produit désactivé" : "Produit activé", variant: "success" });
      setToggleTarget(null);
    } catch (err) {
      toast({
        title: "Échec de la mise à jour",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setToggleLoading(false);
    }
  }, [toggleTarget, toast]);

  const columns = useMemo<DataTableColumn<Product>[]>(() => [
    {
      id: "name",
      header: "Nom",
      accessorKey: "name",
      sortable: true,
    },
    {
      id: "account",
      header: "Compte",
      accessorKey: "account_name",
      sortable: true,
      cell: (value) => (
        <span className="text-warm-gray-600">{(value as string | null) ?? "—"}</span>
      ),
    },
    {
      id: "unit_cogs",
      header: "Coût unitaire (TND)",
      accessorKey: "unit_cogs",
      sortable: true,
      numeric: true,
      cell: (value) => (
        <span className="tabular-nums">{fmtNumber(value as number)}</span>
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
        <h1 className="text-2xl font-semibold text-navy">Produits</h1>
        <Button onClick={() => router.push("/products/new")}>
          Nouveau produit
        </Button>
      </div>

      <Card>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            loading={loading}
            searchable
            searchPlaceholder="Rechercher un produit…"
            emptyMessage="Aucun produit configuré"
            pageSize={25}
            onRowClick={(row) => router.push(`/products/${row.id}`)}
          />
        </CardContent>
      </Card>

      <Modal
        open={!!toggleTarget}
        onOpenChange={(open) => { if (!open) setToggleTarget(null); }}
        title={toggleTarget?.is_active ? "Désactiver le produit" : "Activer le produit"}
        description={
          toggleTarget?.is_active
            ? `"${toggleTarget.name}" sera masqué des calculs actifs.`
            : `"${toggleTarget?.name}" sera réactivé.`
        }
        confirmLabel={toggleTarget?.is_active ? "Désactiver" : "Activer"}
        confirmVariant={toggleTarget?.is_active ? "danger" : "primary"}
        onConfirm={() => void handleToggleConfirm()}
        loading={toggleLoading}
      >
        <p className="text-sm text-warm-gray-600">Confirmez-vous cette action ?</p>
      </Modal>
    </div>
  );
}

export default function ProductsPageWrapper() {
  return <ProductsPage />;
}
