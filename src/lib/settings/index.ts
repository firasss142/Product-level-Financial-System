import { createClient } from "@/lib/supabase/server";

export interface Settings {
  navex_delivery_fee: number;
  navex_return_fee: number;
  navex_daily_pickup_fee: number;
  converty_platform_fee_rate: number;
  packing_cost: number;
}

/**
 * Type-safe union of all valid setting keys stored in the settings table.
 * Named SettingsKey (plural) to match the Settings interface convention.
 * Adding a new field to Settings automatically widens this union.
 */
export type SettingsKey = keyof Settings;

/** @deprecated Use SettingsKey — kept for backward compatibility */
export type SettingKey = SettingsKey;

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("key, value");

  if (error) throw new Error(error.message);

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, Number(r.value)]));

  return {
    navex_delivery_fee: map.navex_delivery_fee ?? 0,
    navex_return_fee: map.navex_return_fee ?? 0,
    navex_daily_pickup_fee: map.navex_daily_pickup_fee ?? 0,
    converty_platform_fee_rate: map.converty_platform_fee_rate ?? 0,
    packing_cost: map.packing_cost ?? 0,
  };
}

export async function getSetting(key: SettingKey): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error) throw new Error(error.message);
  return Number(data.value);
}

export async function saveSettings(updates: Partial<Settings>): Promise<void> {
  const supabase = await createClient();

  const upserts = Object.entries(updates).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("settings")
    .upsert(upserts, { onConflict: "key" });

  if (error) throw new Error(error.message);
}
