# COD Profitability System

## WHY
Internal tool for tracking per-product profitability and investor settlements
for a Tunisian COD e-commerce business. Replaces manual spreadsheets.
French-language UI. Investor-facing transparency reports.

## WHAT
- Next.js 14 App Router + TypeScript (strict)
- Supabase (database + auth + RLS)
- Deployed on Vercel
- French-language UI throughout
- Design: "Swiss Banking meets North African Warmth"
- Font: IBM Plex Sans only (French diacritics + Arabic client names + tabular numerals)

## Stack layout
src/
  app/              → Next.js pages (App Router)
    (admin)/        → All admin pages (inside authenticated layout)
    api/            → Route handlers
  components/
    ui/             → Design system primitives (card, button, input, badge)
    layout/         → Shell, sidebar, header
  lib/
    calculations/   → ALL financial logic — server-side ONLY, never duplicate on client
    supabase/       → DB client + typed queries
    sync/           → Converty REST API sync engine (NOT scraping)
    settings/       → Settings reader/writer
    campaigns/      → Ad platform integration
  types/            → Shared TypeScript types

## HOW
- npm run dev — local dev server
- npm run typecheck — run after EVERY file change
- npm run lint — before every commit

## Critical rules (Claude gets these wrong without explicit instruction)
- All cost variables read from DB settings table — NEVER hardcode fees
- Revenue = totalPrice field ONLY — NEVER deliveryPrice or deliveryCost
- Navex costs begin at deposit status — NOT uploaded
- duplicated=true orders excluded from ALL calculations including Converty fee
- isTest=true orders excluded entirely
- to_be_returned treated IDENTICALLY to returned (same cost + metric treatment)
- exchange=true → extra delivery cycle cost, NO additional revenue, burden on delivered orders
- Converty fee = 0.3% × totalPrice at order creation — non-recoverable even on cancellation
- COGS set per product NOT per variant; variant COGS = unit cost × quantity
- COGS is composite (purchase + customs + labor + custom) but calculation engine ONLY reads products.unit_cogs
- Returned products go back to inventory (NOT a COGS loss) — only delivery + return fees lost
- Navex pickup fee = daily lump sum (currently 4 TND/day) — NEVER allocated per order
- All UI text in French — no English leakage
- Soft deletes: is_active boolean (products, investors, accounts, deals)
- Settlement snapshots = immutable JSON — historical accuracy preserved
- refunded API field is broken — ignore it in all calculations

## References (load on demand — do NOT @-include)
- Full cost model: docs/business-logic.md
- DB schema: docs/data-model.md

## Design system
- Palette: Deep Navy (#1B2A4A), Warm Emerald (#2D8F5C), Terracotta Red (#C75B39), Saharan Amber (#D4A843)
- Neutral grays: warm-tinted, not pure gray
- Cards: white background, no border, shadow-sm, rounded-xl, large hero numbers
- Font: IBM Plex Sans everywhere, tabular-nums for financial columns
- PROHIBITED: gradients, colored card backgrounds, uppercase text, generic AI dashboard patterns, system fonts