"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Select,
  useToast,
  type SelectOption,
} from "@/components/ui";

interface Store {
  id: string;
  name: string;
}

function NewProductPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [errors, setErrors] = useState<{ name?: string; store_id?: string }>({});
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<SelectOption[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/stores")
      .then((r) => r.json())
      .then((data: Store[]) =>
        setStores(data.map((s) => ({ value: s.id, label: s.name })))
      )
      .catch(() => toast({ title: "Impossible de charger les boutiques", variant: "error" }))
      .finally(() => setStoresLoading(false));
  }, [toast]);

  async function handleSubmit() {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Champ obligatoire";
    if (!storeId) errs.store_id = "Sélectionnez une boutique";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), store_id: storeId }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const created = (await res.json()) as { id: string };
      toast({ title: "Produit créé", variant: "success" });
      router.push(`/products/${created.id}`);
    } catch (err) {
      toast({
        title: "Échec de la création",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/products"
          className="text-sm text-warm-gray-500 hover:text-navy transition-colors"
        >
          ← Produits
        </Link>
        <span className="text-warm-gray-300" aria-hidden="true">/</span>
        <span className="text-sm text-navy font-medium">Nouveau produit</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau produit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              label="Nom du produit"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
              error={errors.name}
              placeholder="ex. Rouleau Magique"
            />
            <Select
              label="Boutique"
              options={stores}
              value={storeId}
              onValueChange={(v) => { setStoreId(v); setErrors((p) => ({ ...p, store_id: undefined })); }}
              placeholder={storesLoading ? "Chargement…" : "Sélectionner une boutique"}
              disabled={storesLoading}
              error={errors.store_id}
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Link href="/products">
              <Button variant="secondary">Annuler</Button>
            </Link>
            <Button onClick={() => void handleSubmit()} loading={loading}>
              Créer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewProductPageWrapper() {
  return <NewProductPage />;
}
