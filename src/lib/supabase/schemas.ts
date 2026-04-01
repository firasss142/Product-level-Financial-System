// ---------------------------------------------------------------------------
// Zod validation schemas for all API endpoints
// Co-located with the Supabase client to keep validation near the data layer.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { ORDER_STATUSES } from "@/types/orders";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const UuidSchema = z.string().uuid();

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date requis : YYYY-MM-DD");

export const PeriodSchema = z.object({
  date_from: DateStringSchema,
  date_to: DateStringSchema,
});

// ---------------------------------------------------------------------------
// Settings — POST /api/settings
// ---------------------------------------------------------------------------

export const SettingsWriteSchema = z.object({
  navex_delivery_fee: z.number().positive(),
  navex_return_fee: z.number().positive(),
  navex_daily_pickup_fee: z.number().positive(),
  converty_platform_fee_rate: z.number().positive().max(1),
  packing_cost: z.number().nonnegative(),
});

export type SettingsWriteInput = z.infer<typeof SettingsWriteSchema>;

// ---------------------------------------------------------------------------
// Converty accounts — POST /api/accounts, PATCH /api/accounts
// ---------------------------------------------------------------------------

export const ConvertyAccountCreateSchema = z.object({
  email: z.string().email(),
  password_encrypted: z.string().min(1),
  auth_token: z.string().optional(),
});

export const ConvertyAccountUpdateSchema = z.object({
  id: UuidSchema,
  auth_token: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type ConvertyAccountCreateInput = z.infer<typeof ConvertyAccountCreateSchema>;
export type ConvertyAccountUpdateInput = z.infer<typeof ConvertyAccountUpdateSchema>;

// ---------------------------------------------------------------------------
// Stores — POST /api/stores, PATCH /api/stores
// ---------------------------------------------------------------------------

export const StoreCreateSchema = z.object({
  converty_account_id: UuidSchema,
  converty_store_id: z.string().min(1),
  name: z.string().min(1),
  navex_account_id: z.string().optional(),
});

export const StoreUpdateSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).optional(),
  navex_account_id: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type StoreCreateInput = z.infer<typeof StoreCreateSchema>;
export type StoreUpdateInput = z.infer<typeof StoreUpdateSchema>;

// ---------------------------------------------------------------------------
// Products — POST /api/products, PATCH /api/products
// ---------------------------------------------------------------------------

export const ProductCreateSchema = z.object({
  name: z.string().min(1),
  store_id: UuidSchema,
});

export const ProductUpdateSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).optional(),
  store_id: UuidSchema.optional(),
  is_active: z.boolean().optional(),
  converty_product_id: z.string().nullable().optional(),
  variant_quantity_map: z.record(z.string(), z.number().int().positive()).optional(),
});

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;

// ---------------------------------------------------------------------------
// Cost components — POST /api/products/[id]/components
// ---------------------------------------------------------------------------

export const CostComponentInputSchema = z.object({
  id: UuidSchema.optional(),
  label: z.string().min(1),
  amount: z.number().nonnegative(),
  is_default: z.boolean(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const ComponentsSaveSchema = z.object({
  components: z.array(CostComponentInputSchema).min(1),
});

export type CostComponentInput = z.infer<typeof CostComponentInputSchema>;
export type ComponentsSaveInput = z.infer<typeof ComponentsSaveSchema>;

// ---------------------------------------------------------------------------
// Product batches — POST /api/products/[id]/batches
// ---------------------------------------------------------------------------

export const CostBreakdownSnapshotSchema = z.object({
  label: z.string().min(1),
  amount: z.number().nonnegative(),
});

export const BatchCreateSchema = z.object({
  batch_number: z.string().min(1),
  quantity: z.number().int().positive(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  cost_breakdown: z.array(CostBreakdownSnapshotSchema).min(1),
  set_as_active: z.boolean().default(true),
});

export type BatchCreateInput = z.infer<typeof BatchCreateSchema>;

// ---------------------------------------------------------------------------
// Overhead categories — POST /api/overhead, PATCH /api/overhead
// ---------------------------------------------------------------------------

export const OverheadCreateSchema = z.object({
  label: z.string().min(1),
  monthly_amount: z.number().nonnegative(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const OverheadUpdateSchema = z.object({
  id: UuidSchema,
  label: z.string().min(1).optional(),
  monthly_amount: z.number().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

export type OverheadCreateInput = z.infer<typeof OverheadCreateSchema>;
export type OverheadUpdateInput = z.infer<typeof OverheadUpdateSchema>;

// ---------------------------------------------------------------------------
// Orders — GET /api/orders query params
// ---------------------------------------------------------------------------

export const OrderStatusSchema = z.enum(ORDER_STATUSES);

export const OrdersQuerySchema = z.object({
  status: z.array(OrderStatusSchema).optional(),
  product_id: UuidSchema.optional(),
  store_id: UuidSchema.optional(),
  date_from: DateStringSchema.optional(),
  date_to: DateStringSchema.optional(),
  show_all: z.boolean().optional(),
});

export type OrdersQueryInput = z.infer<typeof OrdersQuerySchema>;

// ---------------------------------------------------------------------------
// Profitability query params — GET /api/profitability/[productId], etc.
// ---------------------------------------------------------------------------

export const ProfitabilityQuerySchema = z
  .object({
    date_from: DateStringSchema,
    date_to: DateStringSchema,
    working_days: z.coerce.number().int().positive().optional(),
  })
  .refine((d) => d.date_from <= d.date_to, {
    message: "date_from doit être antérieure ou égale à date_to",
    path: ["date_to"],
  });

export type ProfitabilityQueryInput = z.infer<typeof ProfitabilityQuerySchema>;

// ---------------------------------------------------------------------------
// Investors — POST /api/investors, PATCH /api/investors
// ---------------------------------------------------------------------------

export const InvestorCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const InvestorUpdateSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
});

export type InvestorCreateInput = z.infer<typeof InvestorCreateSchema>;
export type InvestorUpdateInput = z.infer<typeof InvestorUpdateSchema>;

// ---------------------------------------------------------------------------
// Investment deals — POST /api/deals, PATCH /api/deals
// ---------------------------------------------------------------------------

export const DealCreateSchema = z
  .object({
    investor_id: UuidSchema,
    scope_type: z.enum(["product", "account", "business"]),
    scope_id: UuidSchema.nullable().optional(),
    capital_amount: z.number().nonnegative(),
    profit_share_rate: z.number().min(0).max(1),
    loss_share_rate: z.number().min(0).max(1),
    start_date: DateStringSchema,
    end_date: DateStringSchema.nullable().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (d) =>
      d.scope_type === "business" ? d.scope_id == null : d.scope_id != null,
    {
      message:
        "scope_id doit être null pour scope_type='business' et renseigné sinon",
      path: ["scope_id"],
    }
  );

export const DealUpdateSchema = z.object({
  id: UuidSchema,
  profit_share_rate: z.number().min(0).max(1).optional(),
  loss_share_rate: z.number().min(0).max(1).optional(),
  end_date: DateStringSchema.nullable().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional(),
});

export type DealCreateInput = z.infer<typeof DealCreateSchema>;
export type DealUpdateInput = z.infer<typeof DealUpdateSchema>;

// ---------------------------------------------------------------------------
// Settlements — POST /api/settlements
// ---------------------------------------------------------------------------

export const SettlementCreateSchema = z
  .object({
    deal_id: UuidSchema,
    period_start: DateStringSchema,
    period_end: DateStringSchema,
  })
  .refine((d) => d.period_start <= d.period_end, {
    message: "period_start doit être antérieure ou égale à period_end",
    path: ["period_end"],
  });

export type SettlementCreateInput = z.infer<typeof SettlementCreateSchema>;

// ---------------------------------------------------------------------------
// Daily settlements — POST /api/daily-settlements
// ---------------------------------------------------------------------------

export const DailySettlementUpsertSchema = z.object({
  date: DateStringSchema,
  actual_amount: z.number().nonnegative(),
  expected_amount: z.number().optional(),
  notes: z.string().optional(),
});

export type DailySettlementUpsertInput = z.infer<
  typeof DailySettlementUpsertSchema
>;
