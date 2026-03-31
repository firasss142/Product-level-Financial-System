import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import { SettingsWriteSchema } from "@/lib/supabase/schemas";

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
    const parsed = SettingsWriteSchema.safeParse(body);

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
