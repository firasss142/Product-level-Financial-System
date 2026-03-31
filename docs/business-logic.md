**BUSINESS LOGIC SPECIFICATION**

COD E-Commerce Profitability & Investor Tracking System

Version 1.0 — March 2026

*This document is the single source of truth for all business logic, cost formulas, status mappings, and KPI definitions. It serves as the implementation blueprint for Claude Code.*

# **1. Order Status Pipeline**

Every order flows through a defined status pipeline. Each status has specific cost implications and determines which metrics the order contributes to. The critical cost boundary is the 'deposit' status — this is when Navex physically picks up the package and their fees begin accruing.

## **1.1 Complete Status Definitions**

| **Status** | **Source** | **Definition** | **Cost Trigger** |
| --- | --- | --- | --- |
| pending | Converty | Customer submitted order on storefront. First status for all orders. | Converty 0.3% of totalPrice |
| abandoned | Converty | Customer started checkout but did not complete. Order IS created in Converty. | Converty 0.3% of totalPrice |
| attempt (1, 2, ...) | Agent | Agent phone call to customer. These are confirmation attempts, NOT delivery attempts. Multiple attempts possible. | None |
| confirmed | Agent | Agent confirmed the order with customer. Order is scheduled but still in Converty only. NOT yet sent to Navex. | None |
| rejected | Agent | Agent called, customer refused or cancelled. Can happen from pending, confirmed, or uploaded (before deposit). | None (no Navex involvement) |
| uploaded | Agent/Auto | Customer details sent to Navex API. Package NOT yet physically picked up. Auto-triggered if agent selects delivery company during confirmation. | None (Navex not yet involved physically) |
| deposit | Navex | Navex physically picked up the package. Package is at a Navex hub. CRITICAL: This is the cost boundary — Navex fees start here. | Delivery fee applies |
| in transit | Navex | Package is being transported toward the customer. Always customer-bound (never return direction). | None additional |
| unverified | Navex | Delivery problem flagged by Navex (customer unavailable, refused, address issue). Intermediate state, not yet resolved. | None additional |
| delivered | Navex | Customer received package and paid cash. Revenue collected by Navex. | Revenue: totalPrice collected |
| to_be_returned | Navex | Package failed all 3 delivery attempts (1 per day). Heading back. TREATED IDENTICALLY TO 'returned' for all cost and metric purposes. | Return fee applies |
| returned | Navex | Package physically back at your warehouse. Product goes back to inventory (unless damaged). | Return fee confirmed |

## **1.2 Status Flow Diagram**

The order lifecycle follows this flow. Statuses in the shaded zone incur Navex costs:

**PRE-NAVEX ZONE (zero Navex cost):**

pending/abandoned → attempt(s) → confirmed → uploaded → [rejected possible at any point before deposit]

**NAVEX ZONE (costs accruing):**

deposit → in transit ↔ deposit (hub cycles, up to 3 delivery attempts) → unverified (if problem)

**TERMINAL STATES:**

delivered (success) | to_be_returned → returned (failure) | rejected (cancelled)

## **1.3 Special Order Flags**

**duplicated: true — **Completely excluded from ALL calculations. No Converty 0.3% fee, no metrics, no cost attribution. Treat as if the order does not exist.

**exchange: true — **New order created to handle an exchange (refund + return, or packing error correction). The original order retains its delivered status. Exchange orders cost an additional delivery cycle (delivery fee + potential return fee) with no additional revenue. Track exchange rate as a KPI.

**isTest: true — **Test orders. Exclude from all calculations.

# **2. Cost Model**

All costs are organized into two layers. Layer 1 (Contribution Margin) determines product-level viability. Layer 2 (Net Profit) determines overall business profitability. Every variable marked as 'configurable' must be editable in the system settings.

## **2.1 Configurable Variables**

These are the system-wide settings that the user can modify at any time. Changes apply to future calculations; historical data should retain the values active at the time of the order.

| **Variable** | **Current Value** | **Scope** | **Notes** |
| --- | --- | --- | --- |
| Navex Delivery Fee | 6 TND | Per delivered order (post-deposit) | Charged on every order that reaches 'deposit' status and ends as 'delivered' |
| Navex Return Fee | 4 TND | Per returned order | Charged on orders ending as 'returned' or 'to_be_returned'. Currently flat, may vary if provider changes. |
| Navex Daily Pickup Fee | 4 TND | Per working day | Flat daily fee regardless of order count. Tracked as a daily fixed cost, NOT allocated to individual orders. |
| Converty Platform Fee | 0.3% | Per non-duplicated order | Calculated on totalPrice (product + displayed delivery fee). Charged at order creation. Non-recoverable. |
| Packing Cost | Configurable | Per confirmed order (flat) | Same cost per package regardless of product/variant |
| Product Cost (COGS) | Configurable per product | Per product | Set at product level, NOT variant level. For bundles: COGS = unit COGS × quantity in variant. |

## **2.2 Layer 1: Contribution Margin (Per Product)**

This is the metric that answers: 'Should I keep selling this product?' It includes only costs directly caused by selling the product. If this number is negative, no amount of scale will make the product profitable.

### **Formula: Per Delivered Order**

**Revenue** = totalPrice (cash collected by Navex)

**Direct Costs (subtracted in this order):**

- **Product COGS** = product unit cost × quantity in selected variant

- **Delivery Fee** = configurable flat rate (currently 6 TND)

- **Packing Cost** = configurable flat rate per package

- **Converty Fee** = 0.3% × totalPrice

- **Ad Spend Allocation** = total campaign spend for product ÷ number of delivered orders for that product in the period

- **Return Cost Burden** = (total return fees + packing costs on returned orders + Converty fees on returned orders) ÷ number of delivered orders

- **Failed Lead Cost Burden** = total Converty fees on failed lead orders (rejected, abandoned, pending only — NOT returned) ÷ number of delivered orders

- **Exchange Cost Burden** = total delivery fees on exchange orders ÷ number of delivered orders

**Contribution Margin = Revenue − ∑(Direct Costs 1–8)**

### **Key Insight: Return Cost Burden**

Returns cost the return fee, consume packing material (non-recoverable), and trigger a non-recoverable Converty platform fee. All three are distributed across delivered orders because returned orders generate zero revenue. This is why return rate is the single most important KPI in COD.

Note: the delivery fee paid when a returned package was picked up is negligible at scale (it is already absorbed by the business-level Navex daily pickup lump sum) and is excluded from the per-order return burden calculation.

### **COGS for Returned Orders**

Returned products go back into inventory and are resellable (unless damaged). Therefore, COGS is NOT counted as a loss on returned orders — only the return fee and packing cost are lost. The system should maintain a simple 'damaged returns count' per product to track inventory shrinkage, but this is not factored into per-order profitability.

## **2.3 Layer 2: Net Profit (Business Level)**

This answers: 'Is the business actually making money?' It takes the total contribution margin across all products and subtracts fixed overhead costs.

### **Fixed Monthly Overhead Categories**

| **Category** | **Type** | **Allocation Method** |
| --- | --- | --- |
| Agent Salaries (confirmation team) | Monthly fixed | Proportional to order volume per product |
| Office / Warehouse Rent | Monthly fixed | Proportional to order volume per product |
| Phone / Internet Bills | Monthly fixed | Proportional to order volume per product |
| Tool Subscriptions (Converty, etc.) | Monthly fixed | Proportional to order volume per product |
| Navex Daily Pickup Fee | Daily fixed (4 TND/working day) | NOT allocated per order. Tracked as monthly lump sum: ~4 TND × working days/month |

**Net Profit = ∑(Contribution Margins all products) − ∑(Monthly Overhead) − Navex Pickup Fees**

## **2.4 Cost Impact by Terminal Status**

This table shows exactly which costs apply based on an order's final status. This is the definitive reference for the cost engine.

| **Final Status** | **Converty 0.3%** | **COGS** | **Delivery Fee** | **Return Fee** | **Packing** | **Ad Spend Share** | **Revenue** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| delivered | Yes | Yes | Yes | No | Yes | Yes | Yes (totalPrice) |
| returned / to_be_returned | Yes (in return burden) | No (back in inventory) | No (excluded — negligible, absorbed by pickup lump sum) | Yes (in return burden) | Yes (in return burden) | Burden on delivered | No |
| rejected | Yes | No | No | No | No | Burden on delivered | No |
| abandoned | Yes | No | No | No | No | Burden on delivered | No |
| pending (stuck) | Yes | No | No | No | No | Burden on delivered | No |
| exchange (new order) | Yes | Possible | Yes (extra cycle) | Possible | Possible | Burden on delivered | No (already collected) |
| duplicated | No | No | No | No | No | No | No |

# **3. Cash Settlement Model**

Navex settles daily. They collect cash from customers on delivered orders, deduct their fees, and transfer the net amount. Understanding this flow is critical for cash reconciliation.

## **3.1 Navex Settlement Formula**

**Per delivered order, Navex sends you:**

Net Settlement = totalPrice − Delivery Fee − (Pickup Fee ÷ orders picked up that day)

**For returned orders:**

Navex charges the return fee. If the order was never delivered (no cash collected), this is deducted from your overall settlement balance. Navex deducts: delivery fees + return fees + daily pickup fee directly from collected cash.

## **3.2 Expected vs Actual Settlement**

The system should compute an expected daily settlement based on orders that reached terminal status that day, and compare it against actual bank transfers received. Any discrepancy flags a reconciliation issue.

**Expected Daily Settlement = **∑(totalPrice of delivered orders) − ∑(Delivery fees) − ∑(Return fees on returned orders) − Daily Pickup Fee

# **4. KPI Definitions**

All rates are calculated from real order data, not assumptions. Each KPI has a precise formula and the denominator explicitly defined to avoid ambiguity.

| **KPI** | **Formula** | **Denominator Includes** | **Notes** |
| --- | --- | --- | --- |
| Confirmation Rate | confirmed orders ÷ total actionable leads | All non-duplicated, non-test orders (pending + abandoned + rejected + confirmed + uploaded + all Navex statuses) | Measures agent effectiveness |
| Delivery Rate | delivered ÷ shipped orders | All orders that reached 'deposit' status or beyond | Measures Navex success rate. Excludes orders rejected before shipping. |
| Return Rate | (returned + to_be_returned) ÷ shipped orders | Same as Delivery Rate denominator | Return Rate = 1 − Delivery Rate. The #1 margin killer in COD. |
| Exchange Rate | exchange orders ÷ delivered orders | Only successfully delivered orders | Measures packing quality and product-market fit |
| Cost Per Lead (CPL) | Ad spend ÷ total leads | All non-duplicated orders from the campaign | Retrieved via Meta/TikTok MCP integration |
| Cost Per Delivered Order | All direct costs ÷ delivered orders | Only delivered orders | Includes burden from returns, rejects, and failed leads |
| Contribution Margin | Revenue − Direct Costs | Per product, per period | See Section 2.2 formula |
| Net Profit | ∑ Contribution Margins − Overhead | Business-wide | See Section 2.3 formula |
| Cash Collected vs Expected | Actual Navex settlement ÷ Expected settlement | Daily | Flags reconciliation issues with Navex |

# **5. Data Sources ****&**** Integration**

## **5.1 Converty (Order Data)**

Primary data source. No public API — data is obtained via web scraping of multiple Converty accounts. Each account represents a different product line/niche.

**Multi-Account Architecture: **The system manages multiple Converty accounts with different credentials. A 'Sync' button triggers scraping across all accounts simultaneously. Each order is tagged with its source account.

**Key fields extracted per order:**

- reference (unique order ID per account)

- customer: name, phone, address, city

- cart: product name, product ID, quantity, selectedVariants, pricePerUnit

- total: totalPrice (source of truth for revenue and Converty fee calculation)

- status (current status)

- history (full status timeline with timestamps and actionTaker)

- deliveryCompany (navex or none)

- duplicated, exchange, isTest, refunded (boolean flags)

- barcode (Navex tracking number)

- createdAt, updatedAt

## **5.2 Meta ****&**** TikTok Ads (Campaign Metrics)**

Connected via MCP integration. Each campaign maps 1:1 to a product (99% of the time). For the rare mixed campaign, the system provides a manual override to split spend across products.

**Key metrics retrieved per campaign:**

- Total spend (for the period)

- Cost per lead / CPL

- Total leads generated

- Impressions, clicks, CTR (secondary metrics)

## **5.3 Navex (Delivery ****&**** Settlement)**

Navex data flows through Converty order status updates (they push status changes to Converty). Settlement amounts are tracked separately via bank transfers. No direct Navex API integration — their data is reflected in order status history.

## **5.4 Manual Inputs**

The following data must be entered manually by the user:

- Product COGS (per product, set once, editable)

- Monthly overhead amounts (salaries, rent, phone, subscriptions)

- Packing cost per package

- Navex fee configuration (delivery fee, return fee, daily pickup fee)

- Damaged return count per product (simple counter)

- Actual daily Navex settlement amounts (for reconciliation)

- Campaign-to-product override (for the rare mixed campaign)

# **6. Investor Model**

The investor model is capital-return-first with flexible deal structures. Investors can fund specific product batches, entire accounts, or the business generally. The system must accommodate all three scenarios.

## **6.1 Deal Structure**

**Investment Scope: **Configurable per deal. Can be tied to a product, an account, or the entire business.

**Capital Return Priority: **Investor's initial capital is returned first from revenue before any profit sharing begins.

**Profit Sharing: **After capital is fully returned, profits are split according to the agreed percentage (configurable per deal).

**Loss Sharing: **If the venture generates a loss, losses are shared according to the same ratio (or a separate configurable loss-sharing ratio).

## **6.2 Investor Settlement Waterfall**

For each settlement period, the cost waterfall determines how much profit (or loss) is attributable to the investor's funded scope:

- Gross Revenue (totalPrice of all delivered orders in scope)

- − Product COGS

- − Delivery Fees (on delivered orders)

- − Return Fees + Wasted Delivery Fees (on returned orders)

- − Ad Spend (campaign spend for products in scope)

- − Packing Costs

- − Converty Platform Fees (all orders in scope, non-duplicated)

- − Allocated Overhead (proportional to order volume)

- **= Net Profit/Loss for the scope**

- Apply capital return first, then profit/loss sharing ratio

## **6.3 Transparency Requirements**

Investors must see a clear breakdown of the waterfall for their funded scope. The settlement report should show every cost line with exact amounts, not just the final number. This builds trust and reduces disputes.

# **7. Multi-Account ****&**** Synchronization**

## **7.1 Account Architecture**

- Each Converty account = one product niche/line

- Each account has separate scraping credentials

- Products are currently 1:1 with accounts (design for future flexibility where a product could span accounts)

- 90% of accounts share the same Navex delivery account; design for per-account delivery provider configuration

## **7.2 Sync Mechanism**

A manual 'Sync All' button triggers parallel scraping of all configured Converty accounts. Each scrape fetches orders paginated from the API, deduplicating against existing records by (account_id + order_reference). Status history is merged — new status entries are appended, existing ones are not duplicated.

## **7.3 Data Isolation vs Unified View**

The system should provide both: a unified dashboard showing aggregate KPIs across all accounts, AND the ability to filter/drill down by individual account. Product profitability is always computed per product regardless of which account it belongs to.

# **8. Edge Cases ****&**** Business Rules**

## **8.1 Orders Stuck in Intermediate States**

Orders can remain in non-terminal states (pending, confirmed, uploaded, in transit, unverified) for extended periods. These should appear in an 'attention required' view but should NOT be included in profitability calculations until they reach a terminal state (delivered, returned, rejected).

## **8.2 Variant-Level Profitability**

While product COGS is set at the product level, variant selection affects profitability because: the selling price changes per variant (39 vs 62 vs 79 TND), and quantity changes (1 vs 2 vs 3 units). The formula: Variant COGS = Product Unit COGS × Variant Quantity. Example: Rouleau unit cost = 10 TND. Single variant (39 TND): COGS = 10 TND, margin = 29 TND. Triple bundle (79 TND): COGS = 30 TND, margin = 49 TND. The system must compute profitability at the variant level for accurate analysis.

## **8.3 Exchange Orders**

Exchange orders (exchange: true) represent additional cost with no additional revenue. Two scenarios exist: (a) refund where money is sent back and product returned, costing a delivery fee plus loss of the original revenue; (b) packing error where a second delivery is needed. In both cases, the exchange order's delivery costs burden the contribution margin of the original product. Track exchange rate as a quality metric.

## **8.4 Abandoned Orders**

Abandoned orders are real orders in Converty (not just analytics events). They incur the 0.3% Converty fee. They should be counted in total leads for confirmation rate calculation and their platform fees burden delivered orders.

## **8.5 Free Delivery Display Trick**

The delivery price shown to customers in Converty can be manipulated (shown as 0 TND while cost is baked into product price, or shown as 6 TND as a separate line). The system should NEVER use the API's deliveryPrice or deliveryCost for cost calculations. Always use the configurable Navex delivery fee from system settings. Revenue (totalPrice) is the only trustworthy field from the API for financial calculations.

# **9. Implementation Checklist**

This section summarizes every configurable input, computed output, and data integration required for the system.

## **9.1 Configurable Inputs (Settings Page)**

- Navex delivery fee (TND, flat)

- Navex return fee (TND, flat)

- Navex daily pickup fee (TND, flat)

- Converty platform fee rate (%, default 0.3)

- Packing cost per package (TND, flat)

- Product COGS (TND, per product)

- Monthly overhead: agent salaries, rent, phone/internet, tool subscriptions

- Converty account credentials (multiple accounts)

- Campaign-to-product mapping overrides

- Investor deal configuration (scope, capital amount, profit share %, loss share %)

## **9.2 Computed Outputs (Dashboard)**

- Order funnel: total leads → confirmed → shipped → delivered → returned (with rates)

- Product contribution margin (per product, per variant, per period)

- Business net profit (after overhead, per period)

- Cost waterfall visualization (revenue down to net profit)

- Daily Navex cash settlement reconciliation

- Investor settlement report with full cost waterfall

- Exchange rate and damaged return tracking

- Attention Required view (stuck orders in intermediate states)

- Multi-account unified and per-account views

## **9.3 Data Integrations**

| **Source** | **Method** | **Data** | **Frequency** |
| --- | --- | --- | --- |
| Converty (multiple accounts) | Web scraping (authenticated) | Orders, statuses, products | Manual sync (button) |
| Meta Ads | MCP integration | Campaign spend, CPL, leads | Automatic |
| TikTok Ads | MCP integration | Campaign spend, CPL, leads | Automatic |
| Navex Settlement | Manual input | Daily settlement amount | Daily |

*End of Business Logic Specification v1.0*