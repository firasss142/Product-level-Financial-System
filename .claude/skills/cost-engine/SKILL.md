---
name: cost-engine
description: |
  Calculate product-level profitability, contribution margins, cost attribution,
  burden allocation, and net profit for COD e-commerce orders. Use whenever the
  task involves: profitability, margins, COGS, Navex fees, Converty fees,
  delivery costs, return costs, return burden, exchange burden, failed lead burden,
  packing costs, ad spend allocation, cost per delivered order, financial
  calculations, the two-layer profitability model, or any monetary computation.
user-invocable: false
---

## Layer 1 — Contribution Margin (Per Product Per Period)
Revenue (totalPrice) minus 8 direct costs:
1. COGS = product unit_cogs × variant quantity
   unit_cogs is the ONLY cost input — never read from product_cost_components or product_batches
   (those are visibility/management tables, not calculation inputs)
2. Delivery fee = settings.navex_delivery_fee (per delivered order that reached deposit)
3. Packing cost = settings.packing_cost (per package)
4. Converty fee = settings.converty_fee_rate × totalPrice (on THIS delivered order)
5. Ad spend allocation = total campaign spend for product ÷ delivered count
6. Return cost burden = (Σ return fees + Σ wasted delivery fees on returned orders) ÷ delivered count
7. Failed lead cost burden = Σ Converty fees on never-revenue orders (rejected/abandoned/pending) ÷ delivered count
8. Exchange cost burden = Σ delivery fees on exchange orders ÷ delivered count

## Layer 2 — Net Profit (Business Per Period)
Σ(all product contribution margins) − Σ(monthly overhead categories) − (pickup_fee × working_days)

## Critical Rules
- ALL fees from DB settings table — never hardcoded
- Revenue = totalPrice ONLY — never deliveryPrice/deliveryCost
- Navex costs begin at deposit — not uploaded
- duplicated/isTest = exclude from everything
- to_be_returned = identical to returned
- Returned products = NOT a COGS loss (back to inventory)
- Pickup fee = daily lump sum in Layer 2 only
- Zero delivered orders → return null, not divide-by-zero