---
name: converty-sync
description: |
  Converty platform web scraping, order synchronization, and multi-account
  management. Use whenever the task involves: scraping, sync, Converty API,
  order import, multi-account credentials, deduplication, status history
  merging, data extraction from Converty, paginated fetching, or the
  "Synchroniser tout" sync button.
user-invocable: false
---

## Architecture
- No public API — data via authenticated web scraping
- Multiple Converty accounts with different credentials per account
- Each account = one product niche/line
- ~90% share the same Navex delivery account; design for per-account provider config

## Key Fields Extracted Per Order
reference, customer (name/phone/address/city), cart (product/ID/quantity/variants/price),
totalPrice (REVENUE SOURCE OF TRUTH), status, history (timestamps + actionTaker),
deliveryCompany, barcode (Navex tracking), duplicated/exchange/isTest/refunded flags,
createdAt, updatedAt

## NEVER USE for calculations: deliveryPrice, deliveryCost (marketing display tricks)

## Sync Mechanism
- Manual "Synchroniser tout" button triggers parallel scraping of all active accounts
- Paginated fetching per account
- Deduplicate by (account_id + order_reference) unique constraint
- Status history: append new entries, never duplicate existing timestamps
- Store raw API response in raw_data jsonb column for debugging
- Report per-account sync results: orders synced, errors encountered