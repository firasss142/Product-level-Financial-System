# Production Deployment Preparation

## Context
Prepare the COD Profitability app for Vercel production deployment. The codebase is nearly clean — 1 lint error, 0 type errors, build passes. Need to fix the lint error, create deployment config files, and replace the boilerplate README.

## Current State
- **typecheck**: PASS
- **lint**: 1 error — conditional `useMemo` hook in `product-grid.tsx:46`
- **build**: PASS (1 non-critical deprecation warning about `middleware` → `proxy` convention in Next.js 16)

## Plan

### 1. Fix lint error in product-grid.tsx
**File:** `src/app/(admin)/dashboard/product-grid.tsx`
**Issue:** `useMemo` called after early returns (lines 23, 36), violating rules-of-hooks.
**Fix:** Move `useMemo` before the early returns. The hook will receive `productDetails` regardless of loading state — when loading is true or array is empty, the sorted result is unused but the hook still runs in consistent order.

### 2. Create `.env.example`
Document all required environment variables with comments:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `META_ACCESS_TOKEN` — Meta Ads API token (optional)
- `NEXT_PUBLIC_META_AD_ACCOUNT_ID` — Meta ad account ID (optional)

### 3. Create `vercel.json`
- Region: `cdg1` (Paris — closest Vercel region to Tunisia)
- Function timeout: 60s for sync engine API routes (`/api/sync/*`)

### 4. Replace `README.md`
English developer-facing README with:
- Project description
- Tech stack
- Setup instructions (clone, install, env vars, Supabase, dev server)
- Environment variables table
- Database migration notes (reference `docs/data-model.md`)
- Design system reference (palette, font, card style from CLAUDE.md)
- Deployment instructions (Vercel)

### 5. Verify
```bash
npm run lint      # expect 0 errors, 0 warnings
npm run typecheck # expect clean
npm run build     # expect success
```

## Files Modified
- `src/app/(admin)/dashboard/product-grid.tsx` — fix conditional hook
- `.env.example` — new
- `vercel.json` — new
- `README.md` — rewrite

## Notes
- The `middleware.ts` deprecation warning is a Next.js 16 change (`middleware` → `proxy`). This is non-blocking for deployment and renaming it could break auth behavior. Leave as-is — it's a future migration item, not a deployment blocker.
- Build produces zero errors and zero warnings (the deprecation is printed as info, not a warning).
