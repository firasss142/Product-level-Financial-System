import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, saveSettings } from "@/lib/settings";

const SettingsSchema = z.object({
  navex_delivery_fee: z.number().positive(),
  navex_return_fee: z.number().positive(),
  navex_daily_pickup_fee: z.number().positive(),
  converty_platform_fee_rate: z.number().positive(),
  packing_cost: z.number().positive(),
});

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = SettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valeurs invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    await saveSettings(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
