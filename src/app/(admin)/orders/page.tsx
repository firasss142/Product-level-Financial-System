"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  Button,
  Badge,
  DataTable,
  Select,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/ui";
import { ORDER_STATUSES } from "@/types/orders";
import { statusLabel, statusBadgeVariant, fmtPrice, fmtDateShort } from "@/lib/format";

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  reference: string;
  status: string;
  total_price: number | null;
  is_duplicated: boolean;
  is_exchange: boolean;
  is_test: boolean;
  product_id: string | null;
  product_name: string | null;
  store_id: string | null;
  store_name: string | null;
  converty_created_at: string | null;
  variant_unit_count: number;
}

interface Store {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: SelectOption[] = [
  { value: "__all__", label: "Tous les statuts" },
  ...ORDER_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
];

const ALL = "__all__";

// ── Page ─────────────────────────────────────────────────────────────────────

function OrdersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<SelectOption[]>([]);
  const [products, setProducts] = useState<SelectOption[]>([]);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState(ALL);
  const [selectedProduct, setSelectedProduct] = useState(ALL);
  const [selectedStore, setSelectedStore] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAll, setShowAll] = useState(false);

  const isFiltered = selectedStatus !== ALL || selectedProduct !== ALL || selectedStore !== ALL || !!dateFrom || !!dateTo || showAll;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== ALL) params.append("status", selectedStatus);
      if (selectedProduct !== ALL) params.set("product_id", selectedProduct);
      if (selectedStore !== ALL) params.set("store_id", selectedStore);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (showAll) params.set("show_all", "true");

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = (await res.json()) as { data: OrderRow[]; total: number };
      setRows(data.data);
    } catch {
      toast({ title: "Impossible de charger les commandes", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedProduct, selectedStore, dateFrom, dateTo, showAll, toast]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Load stores + products for filters (independent, fire in parallel)
  useEffect(() => {
    void fetch("/api/stores")
      .then((r) => r.json())
      .then((data: Store[]) =>
        setStores([
          { value: ALL, label: "Toutes les boutiques" },
          ...data.map((s) => ({ value: s.id, label: s.name })),
        ])
      )
      .catch(() => {/* non-critical */});

    void fetch("/api/products")
      .then((r) => r.json())
      .then((data: Product[]) =>
        setProducts([
          { value: ALL, label: "Tous les produits" },
          ...data.map((p) => ({ value: p.id, label: p.name })),
        ])
      )
      .catch(() => {/* non-critical */});
  }, []);

  function resetFilters() {
    setSelectedStatus(ALL);
    setSelectedProduct(ALL);
    setSelectedStore(ALL);
    setDateFrom("");
    setDateTo("");
    setShowAll(false);
  }

  const columns = useMemo<DataTableColumn<OrderRow>[]>(() => [
    {
      id: "reference",
      header: "Référence",
      accessorKey: "reference",
      sortable: true,
      cell: (value, row) => (
        <span className="font-medium text-navy font-mono text-xs">
          {value as string}
          {row.is_exchange && (
            <Badge variant="pending" className="ml-1.5 text-[10px]">Échange</Badge>
          )}
        </span>
      ),
    },
    {
      id: "product",
      header: "Produit",
      accessorKey: "product_name",
      sortable: true,
      cell: (value) => (
        <span className="text-warm-gray-700">{(value as string | null) ?? "—"}</span>
      ),
    },
    {
      id: "status",
      header: "Statut",
      accessorKey: "status",
      sortable: true,
      cell: (value) => (
        <Badge variant={statusBadgeVariant(value as string)}>
          {statusLabel(value as string)}
        </Badge>
      ),
    },
    {
      id: "total_price",
      header: "Prix total (TND)",
      accessorKey: "total_price",
      sortable: true,
      numeric: true,
      cell: (value) => (
        <span className="tabular-nums">{fmtPrice(value as number | null)}</span>
      ),
    },
    {
      id: "date",
      header: "Date",
      accessorKey: "converty_created_at",
      sortable: true,
      cell: (value) => (
        <span className="text-warm-gray-600 text-xs">
          {value ? fmtDateShort(value as string) : "—"}
        </span>
      ),
    },
  ], []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-navy">Commandes</h1>

      {/* Filter bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Select
                label="Statut"
                options={STATUS_OPTIONS}
                value={selectedStatus}
                onValueChange={setSelectedStatus}
              />
            </div>
            <div className="w-44">
              <Select
                label="Produit"
                options={products}
                value={selectedProduct}
                onValueChange={setSelectedProduct}
              />
            </div>
            <div className="w-44">
              <Select
                label="Boutique"
                options={stores}
                value={selectedStore}
                onValueChange={setSelectedStore}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-warm-gray-200 bg-white px-3 py-2 text-sm text-navy focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">À</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-warm-gray-200 bg-white px-3 py-2 text-sm text-navy focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none transition-colors"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-warm-gray-300 text-navy focus:ring-navy"
              />
              <span className="text-sm text-navy">Afficher tout</span>
            </label>
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            loading={loading}
            searchable
            searchPlaceholder="Rechercher une commande…"
            emptyMessage="Aucune commande trouvée"
            pageSize={25}
            onRowClick={(row) => router.push(`/orders/${row.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrdersPageWrapper() {
  return <OrdersPage />;
}
