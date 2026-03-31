# UI Design System — Implementation Plan

## Context

The COD Profitability System has no UI components yet. The project has Tailwind 4, React 19, Next.js 16, and TypeScript strict configured, but `src/components/ui/` does not exist. The login page (`src/app/login/page.tsx`) uses inline `style={{}}` attributes with hardcoded hex colors — confirming the need for a proper design system. This plan builds the complete component library with "Swiss Banking meets North African Warmth" aesthetics, French-language defaults, and strict accessibility compliance.

---

## Key Decisions

### 1. Radix UI primitives for Modal, Select, Toast
Install `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-toast` (~15KB total gzipped). These provide WCAG-compliant keyboard nav, focus trapping, and screen reader support out of the box. Building from scratch would be error-prone and slow.

### 2. @tanstack/react-table for DataTable
Headless table library (~12KB gzipped) providing sorting, filtering, pagination hooks. The business has 14+ DB tables with potentially thousands of orders — a custom solution would need to reinvent all of this.

### 3. Toast via context provider
`ToastProvider` at root layout with `useToast()` hook. Toasts must be triggerable from anywhere (form submissions, API responses, sync operations).

### 4. Minimal `cn()` utility instead of `clsx` + `tailwind-merge`
A simple `cn(...classes)` function that filters falsy values and joins. Avoids ~3KB bundle overhead of tailwind-merge. Can upgrade later if class conflicts become an issue.

### 5. Background color correction
Current `globals.css` uses `#F5F3EF`. CLAUDE.md specifies `#FAFAF8`. Will be corrected in the design tokens step.

---

## Warm-Tinted Gray Palette

Standard grays mixed with ~8% amber for cohesive warmth:

| Token | Hex | Usage |
|-------|-----|-------|
| warm-gray-50 | #FAF9F7 | Card hover, subtle backgrounds |
| warm-gray-100 | #F5F3EF | Alternate backgrounds |
| warm-gray-200 | #E8E4DE | Borders, dividers |
| warm-gray-300 | #D4CFC6 | Disabled backgrounds |
| warm-gray-400 | #B5AFA5 | Placeholder text |
| warm-gray-500 | #8C857B | Secondary text |
| warm-gray-600 | #6B6560 | Body text secondary |
| warm-gray-700 | #4A4540 | Body text |
| warm-gray-800 | #2E2A26 | Alt headings |
| warm-gray-900 | #1A1714 | Near-black |

---

## Implementation Order

### Phase 0: Dependencies
```bash
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-toast @tanstack/react-table
```

### Phase 1: Foundation

**`src/lib/utils.ts`** — `cn()` utility
```typescript
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
```

**`src/app/globals.css`** — Expand `@theme inline` with full token set:
- Brand colors: `--color-navy`, `--color-emerald`, `--color-terracotta`, `--color-amber` (+ light/dark variants)
- Warm gray scale: `--color-warm-gray-50` through `--color-warm-gray-900`
- Semantic: `--color-background: #FAFAF8`, `--color-foreground`, `--color-card`, `--color-border`, `--color-ring`, `--color-error`, `--color-success`, `--color-warning`
- Global reduced-motion media query
- Focus ring utility class

### Phase 2: Simple Components (no external deps)

| # | File | Type | Key Props |
|---|------|------|-----------|
| 1 | `src/components/ui/card.tsx` | Server | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`. White bg, shadow-sm, rounded-xl, p-6. |
| 2 | `src/components/ui/button.tsx` | Server | `variant: "primary" \| "secondary" \| "danger" \| "ghost"`, `size: "sm" \| "md" \| "lg"`, `loading: boolean`. Primary=navy, secondary=outlined, danger=terracotta. Min 44px touch target on mobile. Loading state with spinner. |
| 3 | `src/components/ui/badge.tsx` | Server | `variant: "delivered" \| "returned" \| "pending" \| "rejected" \| "default"`. Rounded-full, light bg tint + colored text. No uppercase. |
| 4 | `src/components/ui/stat-card.tsx` | Server | `value`, `label`, `trend?: { direction, value }`, `suffix?`. Hero number text-3xl tabular-nums. Trend arrows: up=emerald, down=terracotta. |
| 5 | `src/components/ui/input.tsx` | Client | `label` (French), `error?`, `hint?`, `suffix?` (e.g. "TND"), `size?`. Label above, error below in terracotta. TND suffix absolutely positioned inside field. |
| 6 | `src/components/ui/skeleton.tsx` | Server | `variant: "text" \| "card" \| "circle" \| "rect"`. Pulse animation via Tailwind `animate-pulse`. Also exports `SkeletonCard` and `SkeletonTable` composites. |
| 7 | `src/components/ui/empty-state.tsx` | Server | `title?` (default "Aucune donnee"), `description?`, `icon?`, `action?`. Centered layout with inline SVG illustration (no emoji). |

### Phase 3: Radix-based Components

| # | File | Radix Package | Key Props |
|---|------|---------------|-----------|
| 8 | `src/components/ui/select.tsx` | `@radix-ui/react-select` | `label`, `options: {value, label}[]`, `placeholder?` (default "Selectionner..."), `error?`, `onValueChange?`. Same visual style as Input. Full keyboard nav from Radix. |
| 9 | `src/components/ui/toast.tsx` | `@radix-ui/react-toast` | `ToastProvider` (wraps app), `useToast()` hook returning `toast({title, description?, variant})`. Variants: success (emerald left border), error (terracotta), info (navy). Slide-in from bottom-right, auto-dismiss 5s. |
| 10 | `src/components/ui/modal.tsx` | `@radix-ui/react-dialog` | `open`, `onOpenChange`, `title`, `children`, `onConfirm?`, `confirmLabel?` (default "Confirmer"), `cancelLabel?` (default "Annuler"), `confirmVariant?: "primary" \| "danger"`, `loading?`. Overlay with backdrop-blur, focus trap, Escape to close. |

### Phase 4: DataTable

| # | File | Library | Key Props |
|---|------|---------|-----------|
| 11 | `src/components/ui/data-table.tsx` | `@tanstack/react-table` | Generic `DataTable<T>`. `data`, `columns` (with `sortable?`, `filterable?`, `numeric?`), `pageSize?: 10\|25\|50`, `searchable?`, `searchPlaceholder?` (default "Rechercher..."), `emptyMessage?`, `loading?`, `onRowClick?`. Uses Input for search, Skeleton for loading, EmptyState for empty. French pagination: "Page 1 sur 12", "10 / 25 / 50 par page". Mobile: `overflow-x-auto` horizontal scroll. |

### Phase 5: Wiring

**`src/components/ui/index.ts`** — Barrel export all components and types.

**`src/app/layout.tsx`** — Wrap `{children}` with `<ToastProvider>`.

---

## Critical Files

| File | Action |
|------|--------|
| `src/app/globals.css` | Expand with full design tokens |
| `src/lib/utils.ts` | Create `cn()` utility |
| `src/components/ui/*.tsx` | Create 11 component files |
| `src/components/ui/index.ts` | Create barrel export |
| `src/app/layout.tsx` | Add ToastProvider wrapper |

---

## Component → Server/Client Breakdown

| Component | Directive | Why |
|-----------|-----------|-----|
| Card, CardHeader, CardTitle, CardContent, CardFooter | Server | Pure rendering |
| Button | Server | Forwards props, no internal state |
| Badge | Server | Pure rendering |
| StatCard | Server | Pure rendering |
| Skeleton, SkeletonCard, SkeletonTable | Server | Pure rendering |
| EmptyState | Server | Pure rendering |
| Input | Client | Focus management, controlled input |
| Select | Client | Radix interactivity |
| Toast, ToastProvider | Client | Context, state, animations |
| Modal | Client | Radix dialog, focus trap |
| DataTable | Client | Sorting/filtering/pagination state |

---

## Prohibited (enforced across all components)

- No gradients
- No colored card backgrounds (always white)
- No `text-transform: uppercase`
- No system fonts (IBM Plex Sans only)
- No emojis in UI labels
- No English text in user-facing strings

---

## Verification

After building all components:
1. `npm run typecheck` — must pass with zero errors
2. `npm run lint` — must pass
3. `npm run build` — must compile successfully
4. Manual verification: Import components in a test page, render each variant
5. Keyboard navigation: Tab through all interactive components, verify focus rings
6. Mobile responsive: Check at 375px viewport width
