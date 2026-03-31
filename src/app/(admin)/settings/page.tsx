"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Input,
  Button,
  useToast,
} from "@/components/ui";

const SettingsSchema = z.object({
  navex_delivery_fee: z.coerce.number().positive("Doit être un nombre positif"),
  navex_return_fee: z.coerce.number().positive("Doit être un nombre positif"),
  navex_daily_pickup_fee: z.coerce.number().positive("Doit être un nombre positif"),
  converty_platform_fee_rate: z.coerce.number().positive("Doit être un nombre positif"),
  packing_cost: z.coerce.number().positive("Doit être un nombre positif"),
});

type SettingsFields = z.infer<typeof SettingsSchema>;
type FieldErrors = Partial<Record<keyof SettingsFields, string>>;

const FIELD_CONFIG: {
  key: keyof SettingsFields;
  label: string;
  suffix: string;
  hint?: string;
}[] = [
  {
    key: "navex_delivery_fee",
    label: "Frais de livraison Navex",
    suffix: "TND",
  },
  {
    key: "navex_return_fee",
    label: "Frais de retour Navex",
    suffix: "TND",
  },
  {
    key: "navex_daily_pickup_fee",
    label: "Frais de ramassage Navex",
    suffix: "TND/jour",
    hint: "Forfait journalier — non alloué par commande",
  },
  {
    key: "converty_platform_fee_rate",
    label: "Commission Converty",
    suffix: "%",
    hint: "0,3% = 0.3 — appliqué sur le prix total à la création",
  },
  {
    key: "packing_cost",
    label: "Coût d'emballage",
    suffix: "TND",
  },
];

function SettingsForm() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<keyof SettingsFields, string>>({
    navex_delivery_fee: "",
    navex_return_fee: "",
    navex_daily_pickup_fee: "",
    converty_platform_fee_rate: "",
    packing_cost: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Record<string, number>) => {
        setValues({
          navex_delivery_fee: String(data.navex_delivery_fee ?? ""),
          navex_return_fee: String(data.navex_return_fee ?? ""),
          navex_daily_pickup_fee: String(data.navex_daily_pickup_fee ?? ""),
          converty_platform_fee_rate: String(data.converty_platform_fee_rate ?? ""),
          packing_cost: String(data.packing_cost ?? ""),
        });
      })
      .catch(() => {
        toast({ title: "Impossible de charger les paramètres", variant: "error" });
      })
      .finally(() => setFetching(false));
  }, [toast]);

  function handleChange(key: keyof SettingsFields, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = SettingsSchema.safeParse(values);

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SettingsFields;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }

      toast({ title: "Paramètres enregistrés", variant: "success" });
    } catch (err) {
      toast({
        title: "Échec de l'enregistrement",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Variables de coût</CardTitle>
        </CardHeader>
        <CardContent>
          {fetching ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {FIELD_CONFIG.map((f) => (
                <div key={f.key} className="h-16 rounded-lg bg-warm-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {FIELD_CONFIG.map((f) => (
                <Input
                  key={f.key}
                  label={f.label}
                  type="number"
                  min="0"
                  step="any"
                  suffix={f.suffix}
                  hint={f.hint}
                  value={values[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  error={errors[f.key]}
                />
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={loading} disabled={fetching}>
            Enregistrer
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-navy">Paramètres</h1>
      <SettingsForm />
    </div>
  );
}
