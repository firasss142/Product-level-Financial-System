
---
name: investor-settlement
description: |
  Investor model, settlement waterfall, capital return priority, profit/loss
  sharing, and deal configuration for COD e-commerce. Use whenever the task
  involves: investors, settlements, capital return, profit sharing, loss sharing,
  deal structures, investment scope, settlement reports, investor transparency,
  the cost waterfall, or investor-facing views.
user-invocable: false
---

## Deal Structure
- Scope: configurable per deal — product, account, or entire business
- Capital return priority: investor capital returned first before any profit sharing
- Profit sharing: configurable % per deal (applied after capital fully returned)
- Loss sharing: configurable % (can differ from profit share ratio)

## Settlement Waterfall (exact order)
1. Gross Revenue = Σ totalPrice of delivered orders in scope
2. − Product COGS
3. − Delivery fees (on delivered orders that reached deposit)
4. − Return fees + wasted delivery fees (on returned orders in scope)
5. − Ad spend (campaign spend for products in scope)
6. − Packing costs
7. − Converty platform fees (all non-duplicated orders in scope)
8. − Allocated overhead (proportional to order volume in scope vs total)
9. = Net Profit/Loss for scope
10. Apply capital return first → then profit/loss sharing at configured %

## Settlement Snapshots
- Saved as immutable JSON — no UPDATE, only INSERT + SELECT
- Must contain complete waterfall with exact TND amounts per line
- Capital returned vs. remaining tracked across periods
- Every number must be auditable — investor-facing transparency

## Edge Cases
- Zero delivered orders in period → report as zero-revenue period, no divide-by-zero
- Capital > total revenue → partial capital return, remainder carries forward
- Negative profit → apply loss sharing ratio
- Multiple deals per investor → each settled independently by scope