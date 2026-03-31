// ---------------------------------------------------------------------------
// Product domain types
// ---------------------------------------------------------------------------

/**
 * A single line-item in a product's COGS breakdown.
 * Stored in product_cost_components (current, editable) and
 * product_batches.cost_breakdown (historical JSON snapshot).
 *
 * NOTE: The calculation engine ONLY reads products.unit_cogs — these components
 * are for display and editing only.
 */
export interface CostComponent {
  id: string;
  product_id: string;
  /** French label, e.g. "Prix d'achat fournisseur" */
  label: string;
  amount: number;
  /** Default components (purchase, customs, labor) cannot be deleted */
  is_default: boolean;
  sort_order: number;
}

/**
 * A snapshot of COGS at the time a batch was created.
 * product_batches is append-only — no updated_at.
 *
 * NOTE: The DB column is `unit_cost` (not `unit_cogs`) on this table.
 * `products.unit_cogs` is set to this value when set_as_active = true.
 */
export interface ProductBatch {
  id: string;
  product_id: string;
  /** e.g. "LOT-2026-01" */
  batch_number: string;
  quantity: number;
  /** Snapshot of COGS at batch creation — sum of cost_breakdown amounts */
  unit_cost: number;
  /** JSON snapshot of cost line-items at batch creation */
  cost_breakdown: Array<{ label: string; amount: number }>;
  supplier: string | null;
  notes: string | null;
  created_at: string;
}

/** Full product row with all relational data loaded */
export interface ProductWithCosts {
  id: string;
  account_id: string;
  name: string;
  /** Sole source of truth for all calculations — updated when a new batch is created */
  unit_cogs: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Current COGS breakdown (mirrors most recent batch if synced) */
  cost_components: CostComponent[];
  /** Full batch history, newest first */
  batches: ProductBatch[];
  /** Most recently created batch, or undefined if no batches exist */
  active_batch: ProductBatch | undefined;
}

/** Slim product row used in list/selector contexts (no batch history) */
export interface ProductSummary {
  id: string;
  account_id: string;
  account_name: string | null;
  name: string;
  unit_cogs: number | null;
  is_active: boolean;
  created_at: string;
}
