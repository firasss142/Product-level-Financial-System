# Plan: Meta Campaign Integration

## Context

The calculation engine already has `adSpendAllocation` as a direct Layer 1 cost component, and `fetchCampaignSpend`/`fetchAllCampaignSpends` already exist in `queries.ts`. The `campaigns` DB table is defined. What is missing:
- No `spend_allocations` field for mixed (multi-product) campaigns
- No API route for campaigns
- No campaigns admin page
- Spend allocator only does simple `product_id` equality — no percentage splits
- MCP/Meta API sync to pull live campaign metrics into the DB

Nav item `{ label: "Campagnes", href: "/campaigns" }` already exists at `src/components/layout/nav-items.ts:26`.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `supabase/migrations/20260401000001_campaigns_spend_allocations.sql` | Create — add `spend_allocations jsonb` column + partial unique index |
| `src/types/cost-model.ts` | Modify — add `SpendAllocation` and `CampaignRow` interfaces |
| `src/lib/supabase/schemas.ts` | Modify — append campaign Zod schemas |
| `src/lib/calculations/queries.ts` | Modify — update both spend functions to handle `spend_allocations` |
| `src/app/api/campaigns/route.ts` | Create — GET list + POST upsert |
| `src/app/api/campaigns/[id]/route.ts` | Create — PATCH product mapping + spend_allocations |
| `src/app/api/campaigns/sync/route.ts` | Create — POST Meta Graph API sync |
| `src/app/(admin)/campaigns/page.tsx` | Create — admin page |

---

## Step 1 — DB Migration

**`supabase/migrations/20260401000001_campaigns_spend_allocations.sql`**

```sql
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS spend_allocations jsonb DEFAULT NULL;

ALTER TABLE campaigns
  ADD CONSTRAINT chk_campaigns_spend_allocations
  CHECK (
    spend_allocations IS NULL
    OR (jsonb_typeof(spend_allocations) = 'array'
        AND jsonb_array_length(spend_allocations) > 0)
  );

-- Dedup index for Meta-synced campaigns
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaigns_meta_period
  ON campaigns (campaign_id, platform, period_start, period_end)
  WHERE campaign_id IS NOT NULL;

COMMENT ON COLUMN campaigns.spend_allocations IS
  'Percentage split for mixed campaigns. [{product_id, percentage}] summing to 100. NULL = 1:1 to product_id.';
```

---

## Step 2 — Types (`src/types/cost-model.ts`)

Add after `CampaignSpendAggregate` (line 45):

```typescript
/** One entry in a mixed campaign's spend_allocations JSONB array */
export interface SpendAllocation {
  product_id: string;
  percentage: number; // 0–100, all entries must sum to 100
}

/** Raw row from campaigns table (API + admin page) */
export interface CampaignRow {
  id: string;
  product_id: string;
  product_name: string | null;
  platform: string;
  campaign_name: string | null;
  campaign_id: string | null;
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  period_start: string;
  period_end: string;
  spend_allocations: SpendAllocation[] | null;
  created_at: string;
  updated_at: string;
}
```

---

## Step 3 — Zod Schemas (`src/lib/supabase/schemas.ts`)

Append after `DailySettlementUpsertInput` export (end of file):

```typescript
// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export const SpendAllocationSchema = z.object({
  product_id: UuidSchema,
  percentage: z.number().min(0).max(100),
});

export const SpendAllocationsSchema = z
  .array(SpendAllocationSchema)
  .min(2)
  .refine(
    (arr) => Math.abs(arr.reduce((s, a) => s + a.percentage, 0) - 100) < 0.01,
    { message: "Les pourcentages doivent totaliser 100" }
  );

export const CampaignCreateSchema = z.object({
  product_id: UuidSchema,
  platform: z.string().min(1),
  campaign_name: z.string().nullable().optional(),
  campaign_id: z.string().nullable().optional(),
  spend: z.number().nonnegative(),
  leads: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  period_start: DateStringSchema,
  period_end: DateStringSchema,
  spend_allocations: SpendAllocationsSchema.nullable().optional(),
});

export const CampaignUpdateSchema = z.object({
  product_id: UuidSchema.optional(),
  spend_allocations: SpendAllocationsSchema.nullable().optional(),
  campaign_name: z.string().nullable().optional(),
});

export const CampaignsQuerySchema = z.object({
  period_start: DateStringSchema,
  period_end: DateStringSchema,
});

export const CampaignSyncSchema = z.object({
  ad_account_id: z.string().min(1),
  period_start: DateStringSchema,
  period_end: DateStringSchema,
  default_product_id: UuidSchema,
});

export type CampaignCreateInput = z.infer<typeof CampaignCreateSchema>;
export type CampaignUpdateInput = z.infer<typeof CampaignUpdateSchema>;
export type CampaignSyncInput = z.infer<typeof CampaignSyncSchema>;
```

---

## Step 4 — Spend Allocator (`src/lib/calculations/queries.ts`)

Add import at top: `import type { SpendAllocation } from "@/types/cost-model";`

**Replace `fetchCampaignSpend` (lines 171–194):** Drop the `.eq("product_id", productId)` filter and add split logic:

```typescript
export async function fetchCampaignSpend(
  supabase: SupabaseClient,
  productId: string,
  period: Period
): Promise<CampaignSpendAggregate> {
  const startStr = period.start.toISOString().slice(0, 10);
  const endStr = period.end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("campaigns")
    .select("product_id, spend, leads, spend_allocations")
    .lte("period_start", endStr)
    .gte("period_end", startStr);

  if (error) throw new Error(error.message);

  let totalSpend = 0;
  let totalLeads = 0;
  for (const row of data ?? []) {
    const allocs = row.spend_allocations as SpendAllocation[] | null;
    if (!allocs) {
      if (row.product_id === productId) {
        totalSpend += row.spend ?? 0;
        totalLeads += row.leads ?? 0;
      }
    } else {
      const entry = allocs.find((a) => a.product_id === productId);
      if (entry) {
        totalSpend += (row.spend ?? 0) * (entry.percentage / 100);
        totalLeads += (row.leads ?? 0) * (entry.percentage / 100);
      }
    }
  }
  return { productId, totalSpend, totalLeads };
}
```

**Replace `fetchAllCampaignSpends` (lines 200–224):** Same SQL change, distribute to all allocation entries:

```typescript
export async function fetchAllCampaignSpends(
  supabase: SupabaseClient,
  period: Period
): Promise<Map<string, CampaignSpendAggregate>> {
  const startStr = period.start.toISOString().slice(0, 10);
  const endStr = period.end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("campaigns")
    .select("product_id, spend, leads, spend_allocations")
    .lte("period_start", endStr)
    .gte("period_end", startStr);

  if (error) throw new Error(error.message);

  const result = new Map<string, CampaignSpendAggregate>();
  const getOrCreate = (pid: string) => {
    if (!result.has(pid)) result.set(pid, { productId: pid, totalSpend: 0, totalLeads: 0 });
    return result.get(pid)!;
  };

  for (const row of data ?? []) {
    const allocs = row.spend_allocations as SpendAllocation[] | null;
    if (!allocs) {
      const agg = getOrCreate(row.product_id as string);
      agg.totalSpend += row.spend ?? 0;
      agg.totalLeads += row.leads ?? 0;
    } else {
      for (const entry of allocs) {
        const agg = getOrCreate(entry.product_id);
        agg.totalSpend += (row.spend ?? 0) * (entry.percentage / 100);
        agg.totalLeads += (row.leads ?? 0) * (entry.percentage / 100);
      }
    }
  }
  return result;
}
```

**No callers change** — `computeContributionMargin` and `computeNetProfit` are unaffected.

---

## Step 5 — API Routes

### `src/app/api/campaigns/route.ts` (GET + POST)

- `GET ?period_start=&period_end=` — validates with `CampaignsQuerySchema`, queries `campaigns` with `.select("*, products(name)")`, returns `CampaignRow[]` with `product_name` flattened
- `POST` — validates with `CampaignCreateSchema`, upserts via conflict on `uq_campaigns_meta_period` when `campaign_id` is non-null (manual entries always insert)

### `src/app/api/campaigns/[id]/route.ts` (PATCH)

- Validates `id` as UUID, body via `CampaignUpdateSchema`
- Updates `product_id` and/or `spend_allocations` + `updated_at`
- Returns updated row

### `src/app/api/campaigns/sync/route.ts` (POST)

- Validates with `CampaignSyncSchema`
- Reads `META_ACCESS_TOKEN` from `process.env` (never hardcode, never `NEXT_PUBLIC_`)
- Calls Meta Graph API: `GET https://graph.facebook.com/v20.0/{ad_account_id}/insights`
  - `fields=campaign_id,campaign_name,impressions,clicks,spend,actions`
  - `level=campaign`, `time_range={"since":"...","until":"..."}`
- Meta field mapping:

  | Meta | DB |
  |---|---|
  | `campaign_id` | `campaign_id` |
  | `campaign_name` | `campaign_name` |
  | `spend` (string) | `spend` → `parseFloat()` |
  | `impressions` (string) | `impressions` → `parseInt()` |
  | `clicks` (string) | `clicks` → `parseInt()` |
  | `actions[type=lead].value` | `leads` (0 if absent) |
  | `date_start` / `date_stop` | `period_start` / `period_end` |
  | hardcoded `"meta"` | `platform` |

- Sets `product_id = default_product_id` on all synced rows (admin re-assigns in UI)
- Batch upserts via `POST /api/campaigns` internally or direct Supabase upsert
- Returns `{ synced: number, errors: string[] }`

---

## Step 6 — Admin Page (`src/app/(admin)/campaigns/page.tsx`)

`"use client"` component. Pattern: `src/app/(admin)/overhead/page.tsx`.

**Period selector** — same markup as dashboard (`De` / `À` date inputs + `Ce mois` / `Mois dernier` shortcuts).

**Stat cards row** (3 cards above the table):
- Total dépenses (sum of `spend` for period)
- CPL moyen (total spend ÷ total leads)
- Total leads

**DataTable columns:**

| Header | Source | Notes |
|---|---|---|
| Nom | `campaign_name` | |
| Plateforme | `platform` | `<Badge>` |
| Dépenses (TND) | `spend` | `tabular-nums`, 3 dp |
| CPL (TND) | `spend / leads` | computed, `—` if leads=0 |
| Leads | `leads` | |
| Impressions | `impressions` | |
| Clics | `clicks` | |
| CTR | `clicks / impressions * 100` | computed, `—` if impressions=0 |
| Produit associé | `product_name` | clickable → opens edit modal |

**Edit modal** (opens on "Produit associé" cell click):
- `Select` dropdown for `product_id` (fetch from `GET /api/products`)
- Toggle button "Répartition multiple" — enables split mode
- Split mode: list each active product with a `%` number input; live sum-to-100 indicator (terracotta if not 100)
- "Enregistrer" → `PATCH /api/campaigns/[id]`, refetch table, close modal

**"Synchroniser" button** (header area):
- Calls `POST /api/campaigns/sync` with current `period_start`, `period_end`, and a stored `META_AD_ACCOUNT_ID` (read from a settings field or env)
- Shows loading state, then toast with sync count

**French labels only:** "Campagnes", "Dépenses publicitaires", "Coût par lead", "Produit associé", "Répartition multiple", "Synchroniser", "Enregistrer", "Annuler".

---

## Reusable Existing Code

| What | Where |
|---|---|
| `fetchAllCampaignSpends` / `fetchCampaignSpend` | `src/lib/calculations/queries.ts:171,200` |
| `CampaignSpendAggregate` type | `src/types/cost-model.ts:41` |
| `queryActiveProducts()` | `src/lib/supabase/queries.ts:19` |
| `UuidSchema`, `DateStringSchema` | `src/lib/supabase/schemas.ts:13,15` |
| `DataTable`, `Card`, `Button`, `Select`, `Input`, `Badge`, `Modal`, `useToast` | `src/components/ui/` |
| `fmtPrice`, `fmtNumber` | `src/lib/format.ts` |
| `createClient()` (server) | `src/lib/supabase/server.ts` |
| Period selector markup pattern | `src/app/(admin)/dashboard/` dashboard client |
| Nav item already defined | `src/components/layout/nav-items.ts:26` |

---

## Verification

1. `npm run typecheck` — zero errors
2. `npm run lint` — clean
3. Run migration against local Supabase (`supabase db push` or apply SQL directly)
4. Navigate to `/campaigns` — page loads with empty table
5. Call `POST /api/campaigns/sync` (curl or button) — verify rows appear
6. Assign a product to a campaign via the edit modal — verify `PATCH` succeeds and product name updates in row
7. Enable split mode, enter percentages summing to 100 — save, verify `spend_allocations` column populated
8. Navigate to dashboard — verify `adSpendAllocation` in product contribution margin now reflects split spend (compare with direct DB query)
9. Set split to non-100 total — verify UI shows validation error and blocks save
