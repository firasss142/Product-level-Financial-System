// ---------------------------------------------------------------------------
// Order status constants, type guards, and row types
// ---------------------------------------------------------------------------

/** All known order statuses in the pipeline */
export const ORDER_STATUSES = [
  "pending",
  "abandoned",
  "attempt",
  "confirmed",
  "rejected",
  "uploaded",
  "deposit",
  "in transit",
  "unverified",
  "delivered",
  "to_be_returned",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Terminal statuses — order has reached a final state */
export const TERMINAL_STATUSES = [
  "delivered",
  "returned",
  "to_be_returned",
  "rejected",
] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

/** Return statuses — treated identically for all cost/metric purposes */
export const RETURN_STATUSES = ["returned", "to_be_returned"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/**
 * Navex-zone statuses — order has physically entered the delivery network.
 * Cost boundary: Navex fees begin at "deposit", NOT "uploaded".
 */
export const NAVEX_ZONE_STATUSES = [
  "deposit",
  "in transit",
  "unverified",
  "delivered",
  "to_be_returned",
  "returned",
] as const;
export type NavexZoneStatus = (typeof NAVEX_ZONE_STATUSES)[number];

/**
 * Failed-lead statuses — orders that never generated revenue
 * and never entered the Navex zone. Only Converty fee applies.
 */
export const FAILED_LEAD_STATUSES = [
  "rejected",
  "abandoned",
  "pending",
] as const;
export type FailedLeadStatus = (typeof FAILED_LEAD_STATUSES)[number];

// --- Type guards -----------------------------------------------------------

const _terminalSet = new Set<string>(TERMINAL_STATUSES);
const _returnSet = new Set<string>(RETURN_STATUSES);
const _navexSet = new Set<string>(NAVEX_ZONE_STATUSES);
const _failedLeadSet = new Set<string>(FAILED_LEAD_STATUSES);

export function isTerminalStatus(s: string): s is TerminalStatus {
  return _terminalSet.has(s);
}

export function isReturnStatus(s: string): s is ReturnStatus {
  return _returnSet.has(s);
}

export function isNavexZoneStatus(s: string): s is NavexZoneStatus {
  return _navexSet.has(s);
}

export function isFailedLeadStatus(s: string): s is FailedLeadStatus {
  return _failedLeadSet.has(s);
}

// --- Order flags -----------------------------------------------------------

/** Boolean flags on an order that control calculation inclusion */
export interface OrderFlags {
  is_duplicated: boolean;
  is_exchange: boolean;
  is_test: boolean;
  /** refunded API field is broken — present for completeness, NEVER used in calculations */
  is_refunded: boolean;
}

/**
 * Alias for NavexZoneStatus — statuses at or beyond "deposit" where Navex costs begin.
 * Use this name when emphasizing the cost-boundary meaning rather than zone membership.
 */
export type NavexCostStatus = NavexZoneStatus;

// --- Cart types ------------------------------------------------------------

export interface CartItem {
  quantity?: number;
  [key: string]: unknown;
}

// --- Order row (what Supabase returns) -------------------------------------

export interface OrderRow {
  id: string;
  account_id: string;
  product_id: string | null;
  reference: string;
  total_price: number | null;
  status: string;
  is_duplicated: boolean;
  is_exchange: boolean;
  is_test: boolean;
  cart: CartItem[] | null;
  converty_created_at: string | null;
}
