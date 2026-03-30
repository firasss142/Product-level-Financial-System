---
name: order-pipeline
description: |
  Order status pipeline, lifecycle, and cost boundaries for COD e-commerce.
  Use whenever the task involves: order statuses, status transitions, pending,
  abandoned, attempt, confirmed, rejected, uploaded, deposit, in transit,
  unverified, delivered, to_be_returned, returned, terminal states, cost
  boundaries, the Navex delivery cycle, order flags (duplicated, exchange,
  isTest), or status history timeline.
user-invocable: false
---

## Status Pipeline
PRE-NAVEX ZONE (zero Navex cost):
  pending → abandoned (dead end)
  pending → attempt(s) → confirmed → uploaded → [rejected possible before deposit]

NAVEX ZONE (costs accruing from deposit onward):
  deposit → in transit ↔ deposit (hub cycles, up to 3 delivery attempts, 1/day)
  → unverified (problem flagged)

TERMINAL STATES:
  delivered (success — revenue realized, cash collected by Navex)
  to_be_returned → returned (failure — 3 failed attempts, product returns to warehouse)
  rejected (cancelled before deposit — zero Navex cost)

## Cost Triggers Per Status
pending/abandoned: Converty 0.3% fee at creation on totalPrice
attempt: none (phone calls only — confirmation attempts, NOT delivery attempts)
confirmed: none (scheduled in Converty, not yet sent to Navex)
uploaded: none (sent to Navex API but NOT physically picked up — zero cost if cancelled here)
deposit: ★ COST BOUNDARY — Navex delivery fee begins (physical pickup)
in transit: none additional
unverified: none additional (intermediate problem state)
delivered: revenue = totalPrice collected by Navex
to_be_returned: return fee applies (treated identically to returned)
returned: return fee confirmed, product back to inventory (unless damaged)
rejected: none (cancelled before deposit)

## Special Flags
duplicated=true: exclude from ALL calculations, ALL metrics, ALL counts — invisible
exchange=true: extra delivery cycle, no new revenue, costs burden delivered orders
isTest=true: exclude entirely
refunded: API field broken — ignore in all calculations

## Navex Delivery Cycle
Up to 3 delivery attempts (1 per day). Package cycles between deposit↔in transit.
After 3 failed attempts: to_be_returned → returned.
Agents rania.jouets and chaima.jouets handle confirmation calls (visible in order history).