# Plan: Products & Orders Management Pages

## Context

The app has a working shell (auth, sidebar, design system) and existing CRUD pages for Accounts, Overhead, and Settings — but no Product or Order management views. This plan adds:
- Full product CRUD with COGS breakdown editor and batch history
- Order list (read-only, server-synced) with filters and detail page

The calculation engine already reads `products.unit_cogs` as its sole input — this work is pure cost **visibility**, not calculation change.

---

## Files to Create

### API Routes
- `src/app/api/products/route.ts` — GET (list + filter by account), POST (create), PATCH (update name/account_id/is_active)
- `src/app/api/products/[id]/route.ts` — GET single product with cost_components + recent batches
- `src/app/api/products/[id]/components/route.ts` — POST/PATCH/DELETE cost components + auto-update unit_cogs
- `src/app/api/products/[id]/batches/route.ts` — GET (list), POST (create new batch + optionally update unit_cogs)
- `src/app/api/orders/route.ts` — GET with filters: status[], product_id, account_id, date_from, date_to, show_all (for duplicated+test toggle), pagination (page, page_size=25)
- `src/app/api/orders/[id]/route.ts` — GET single order with status_history

### Pages
- `src/app/(admin)/products/page.tsx` — Product list
- `src/app/(admin)/products/new/page.tsx` — Create product form
- `src/app/(admin)/products/[id]/page.tsx` — Product detail (3 sections)
- `src/app/(admin)/orders/page.tsx` — Order list with filters
- `src/app/(admin)/orders/[id]/page.tsx` — Order detail

---

## Implementation Detail

### 1. `GET /api/products`
```
SELECT id, name, account_id, unit_cogs, is_active, created_at
FROM products
JOIN accounts ON products.account_id = accounts.id  -- to get account name
ORDER BY created_at DESC
```
Returns: `{ id, name, account_id, account_name, unit_cogs, is_active, created_at }`

### 2. `POST /api/products`
Schema: `{ name: string, account_id: uuid }`
Insert with `is_active: true, unit_cogs: 0`.
After insert, seed 3 default cost components:
- "Prix d'achat fournisseur" (amount: 0)
- "Frais de douane / import" (amount: 0)
- "Main d'œuvre / assemblage" (amount: 0)

### 3. `GET /api/products/[id]`
Returns full product row + `cost_components[]` ordered by `sort_order` + last 10 `product_batches[]` ordered by `created_at DESC`

### 4. `POST /api/products/[id]/components` (bulk save)
Accept array of components `{ id?, label, amount, is_default }`.
- Upsert all
- Delete removed non-default components
- Recompute total = sum(amounts)
- Update `products.unit_cogs` to total
- Return updated components + new unit_cogs

### 5. `POST /api/products/[id]/batches`
Schema: `{ batch_number, quantity, supplier?, notes?, cost_breakdown: ComponentSnapshot[], set_as_active: boolean }`
`cost_breakdown` is a jsonb snapshot of `[{ label, amount }]`.
`unit_cost` = sum of cost_breakdown amounts.
If `set_as_active=true`: update `products.unit_cogs` to unit_cost.

### 6. `GET /api/orders`
Query params: `status` (repeatable), `product_id`, `account_id`, `date_from`, `date_to`, `show_all`, `page`, `page_size`
Default: `is_duplicated=false AND is_test=false` unless `show_all=true`
Returns paginated `{ data: OrderRow[], total: number, page: number, page_size: number }`
Join to products and accounts for display names.

### 7. `GET /api/orders/[id]`
Returns full order row + `order_status_history[]` ordered by `created_at ASC`

---

## Products List Page (`/products`)

Pattern: mirrors `/accounts/page.tsx`
- `useEffect` to `GET /api/products` + `GET /api/accounts`
- `DataTable` columns: Nom | Compte | Coût unitaire (TND, numeric, tabular-nums) | Statut
- Statut cell: `<Badge variant={is_active ? "delivered" : "rejected"}>`toggle on click with confirmation Modal
- "Nouveau produit" button → navigates to `/products/new`
- `onRowClick` → navigate to `/products/[id]`

## Create Product Page (`/products/new`)

Simple form page (not a modal — dedicated page like the spec implies):
- Input: Nom (required)
- Select: Compte (loads from `/api/accounts`, `{ value: id, label: name }`)
- "Créer" button → POST → redirect to `/products/[id]`
- "Annuler" → back to `/products`

## Product Detail Page (`/products/[id]`)

Three `<Card>` sections stacked vertically.

**Section 1 — Informations produit**
- Input: Nom (editable)
- Select: Compte
- Badge: Statut (with toggle button)
- "Enregistrer" button → PATCH

**Section 2 — Coût de revient**
- Inline table: rows from `cost_components`
  - Default rows: label shown as text (not editable label), amount as `<input type="number">`
  - Custom rows: label editable + amount editable + delete button (×)
- "Ajouter un composant" → appends a blank custom row
- Footer row: "Coût unitaire total: XX.XX TND" (bold, large, recomputed live from inputs)
- "Enregistrer le coût" button → POST to components API → toast "Coût de revient mis à jour"

**Section 3 — Historique des lots**
- `DataTable`: N° Lot | Date | Quantité | Coût unitaire | Fournisseur
- Most recent batch row: `bg-warm-gray-50` highlight (via `className` on the row — need custom approach since DataTable doesn't support row className; implement as a plain table here instead of DataTable)
- Expandable rows: clicking a batch row shows cost_breakdown jsonb as a nested component list
- "Nouveau lot" button → opens Modal with:
  - Numéro de lot (text)
  - Quantité (number)
  - Fournisseur (text, optional)
  - Notes (text, optional)
  - Cost components table pre-filled from current product components (editable)
  - Checkbox "Définir comme coût actif" (default: checked)
- Empty state: "Aucun lot enregistré"

## Orders List Page (`/orders`)

**Filter bar** above DataTable:
- Multi-select status filter (use checkboxes grouped in a dropdown; or if simpler, a group of toggle Badges)
- Select: Produit (loads from `/api/products`)
- Select: Compte (loads from `/api/accounts`)
- Date range: two `<input type="date">` fields (De / À)
- Toggle: "Afficher les doublons et tests" (default: off)

**DataTable** columns: Référence | Produit | Statut (Badge) | Prix total (TND, numeric) | Date
- `pageSize={25}`
- `onRowClick` → navigate to `/orders/[id]`
- Pagination handled server-side via API (not client-side TanStack pagination, since data volume can be large)
  - Actually: fetch all filtered results (reasonable for a daily-synced internal tool) and use DataTable's built-in pagination to avoid complexity
  - If orders volume is large, switch to server pagination — but start simple

**Status badge mapping** (extend badge variants or use inline styles):
| Status | Variant |
|--------|---------|
| delivered | delivered |
| returned, to_be_returned | returned |
| pending, abandoned, rejected | rejected |
| confirmed, attempt | pending |
| uploaded, deposit, in transit, unverified | default |

## Order Detail Page (`/orders/[id]`)

Two-column layout (lg: side by side, sm: stacked):

**Left — Order info card**
- Référence, Statut (Badge), Prix total, is_exchange, is_duplicated, Compte, Produit
- Customer info section from `customer_data` jsonb (show key-value pairs)
- Cart section from `cart_data` jsonb (show items list)

**Right — Status history timeline**
- Vertical timeline, newest first
- Each entry: colored dot (by status category) | Status Badge | formatted timestamp | action_taker
- "Retour aux commandes" link at top

---

## DB Schema Reminder (from docs/data-model.md)

```sql
products: id, account_id, name, unit_cogs, is_active
product_cost_components: id, product_id, label, amount, is_default, sort_order
product_batches: id, product_id, batch_number, quantity, unit_cost, supplier, notes, cost_breakdown (jsonb), created_at
orders: id, account_id, product_id, reference, total_price, status, is_duplicated, is_exchange, is_test, cart (jsonb), customer_data (jsonb), converty_created_at
order_status_history: id, order_id, status, created_at, action_taker
```

---

## Reused Patterns

- API route pattern: `src/app/api/accounts/route.ts` — Zod validation + createClient() + NextResponse
- Page pattern: `src/app/(admin)/accounts/page.tsx` — useEffect fetch + DataTable + Modal
- Components: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Button`, `Input`, `Select`, `Badge`, `DataTable`, `Modal`, `useToast`, `EmptyState` from `@/components/ui`
- `createClient` from `@/lib/supabase/server`

---

## Sidebar Nav

`src/components/layout/nav-items.ts` already has `/orders` and `/products` entries — no changes needed.

---

## Verification — DONE ✓

1. `npx tsc --noEmit` — 0 errors ✓
2. `npm run lint` — 0 errors, 0 warnings ✓
3. Manual flow:
   - Create product → verify 3 default components seeded
   - Edit components, save → verify unit_cogs updated in DB
   - Add batch with "Définir comme coût actif" → verify unit_cogs updated
   - Navigate to Orders → filter by status → verify badge rendering
   - Click order → verify status history timeline renders newest-first
