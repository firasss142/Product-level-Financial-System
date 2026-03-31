// ---------------------------------------------------------------------------
// Converty REST API types — used by the sync engine (src/lib/sync/)
//
// API base: https://partner.converty.shop
// Endpoints:
//   POST /api/v2/auth/login
//   GET  /api/v1/user
//   PATCH /api/v1/store/select-store/{store_id}
//   GET  /api/v1/order?page=1&limit=100
// ---------------------------------------------------------------------------

export interface ConvertySyncAuthRequest {
  email: string;
  password: string;
}

export interface ConvertySyncAuthResponse {
  token: string;
}

export interface ConvertySyncStoreInfo {
  _id: string;
  name: string;
  /** Navex account identifier, if configured */
  navexAccountId?: string;
}

export interface ConvertySyncCartItem {
  quantity: number;
  /** Variant ID selected by the customer */
  selectedVariantsId?: string;
  /** Product reference / SKU */
  productRef?: string;
  [key: string]: unknown;
}

export interface ConvertySyncOrder {
  /** Converty internal order ID */
  _id: string;
  /** Human-readable order reference */
  reference: string;
  status: string;
  /**
   * Revenue source of truth — use this field ONLY.
   * NEVER use deliveryPrice or deliveryCost (marketing tricks).
   */
  totalPrice: number;
  deliveryPrice?: number;
  deliveryCost?: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  governorate?: string;
  barcode?: string;
  deliveryCompany?: string;
  isDuplicated?: boolean;
  isExchange?: boolean;
  isTest?: boolean;
  /** refunded field is broken — ignore in all calculations */
  refunded?: boolean;
  cart: ConvertySyncCartItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConvertySyncOrdersResponse {
  data: ConvertySyncOrder[];
  total: number;
  page: number;
  limit: number;
}

/** A Converty login credential record (stored in converty_accounts table) */
export interface ConvertyAccount {
  id: string;
  email: string;
  /** Encrypted/hashed password — never expose in client */
  password_encrypted: string;
  auth_token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** A store/niche under a Converty account (stored in stores table) */
export interface Store {
  id: string;
  converty_account_id: string;
  /** Converty's internal store ID — used with PATCH /api/v1/store/select-store/{id} */
  converty_store_id: string;
  name: string;
  navex_account_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Store with its parent account (used in API responses) */
export interface StoreWithAccount extends Store {
  converty_account_email: string;
}

/** Converty account with its child stores (used in accounts page) */
export interface ConvertyAccountWithStores extends ConvertyAccount {
  stores: Store[];
}
