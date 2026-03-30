# Financial Calculation Engine Rules

ALL financial logic lives in this directory. NEVER duplicate on client side.

## Two-Layer Model
Layer 1 — Contribution Margin (per product per period):
  Revenue − COGS − delivery fee − packing − Converty fee
  − ad spend allocation − return cost burden
  − failed lead cost burden − exchange cost burden

Layer 2 — Net Profit (business per period):
  Σ(all product contribution margins) − monthly overhead − Navex pickup fees

## Cost Attribution by Terminal Status
delivered:            Converty ✓  COGS ✓  delivery ✓  packing ✓  ad share ✓  revenue ✓
returned/to_be_returned: Converty ✓  delivery ✓ (wasted)  return fee ✓  packing ✓ (wasted)  NO COGS loss  NO revenue
rejected:             Converty ✓ only — zero Navex cost (before deposit)
abandoned/pending:    Converty ✓ only
exchange:             Converty ✓  delivery ✓ (extra cycle)  possible return fee  NO additional revenue
duplicated:           NOTHING — exclude entirely
isTest:               NOTHING — exclude entirely

## Burden Allocation (all divided by delivered order count for same product in period)
- Return cost burden = (return fees on returned orders + delivery fees on returned orders) ÷ delivered count
- Failed lead burden = Converty fees on orders that NEVER generated revenue (rejected + abandoned + stuck pending) ÷ delivered count
- Exchange burden = delivery fees on exchange orders ÷ delivered count

Important: returned orders' Converty fee is a direct cost on those orders (part of return burden),
NOT part of failed lead burden. Failed leads = orders that never reached Navex at all.

## Non-Negotiable Rules
- ALL fee values read from settings DB table at runtime — zero hardcoded numbers
- Revenue = totalPrice ONLY
- Navex costs begin at deposit, not uploaded
- COGS per product × quantity in variant = variant COGS
- Pickup fee is Layer 2 monthly lump sum — NEVER touches Layer 1
- Zero delivered orders → return null for margins, not divide-by-zero