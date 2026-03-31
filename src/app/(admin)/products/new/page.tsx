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

interface Account {
  id: string;
  name: string;
}

function NewProductPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [errors, setErrors] = useState<{ name?: string; account_id?: string }>({});
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<SelectOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: Account[]) =>
        setAccounts(data.map((a) => ({ value: a.id, label: a.name })))
      )
      .catch(() => toast({ title: "Impossible de charger les comptes", variant: "error" }))
      .finally(() => setAccountsLoading(false));
  }, [toast]);

  async function handleSubmit() {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Champ obligatoire";
    if (!accountId) errs.account_id = "Sélectionnez un compte";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), account_id: accountId }),
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
              label="Compte"
              options={accounts}
              value={accountId}
              onValueChange={(v) => { setAccountId(v); setErrors((p) => ({ ...p, account_id: undefined })); }}
              placeholder={accountsLoading ? "Chargement…" : "Sélectionner un compte"}
              disabled={accountsLoading}
              error={errors.account_id}
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
