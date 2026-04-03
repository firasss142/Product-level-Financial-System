# COD Profitability System

Internal tool for tracking per-product profitability and investor settlements for a Tunisian COD (Cash on Delivery) e-commerce business. Replaces manual spreadsheets with real-time cost attribution, margin analysis, and investor-facing transparency reports.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript (strict)
- **Database & Auth:** Supabase (PostgreSQL + Row Level Security)
- **Styling:** Tailwind CSS 4
- **Deployment:** Vercel
- **UI Language:** French

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd cod-profitability

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## Environment Variables

| Variable | Required | Scope | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client + Server | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Supabase service role key (bypasses RLS) |
| `META_ACCESS_TOKEN` | No | Server only | Meta Ads API access token for campaign spend tracking |
| `NEXT_PUBLIC_META_AD_ACCOUNT_ID` | No | Client + Server | Meta ad account ID |

## Database

The application uses Supabase (PostgreSQL). See [docs/data-model.md](docs/data-model.md) for the complete schema reference including tables, relationships, and RLS policies.

### Key Tables

- **orders** — Order lifecycle tracking with status history
- **products** — Product catalog with unit COGS
- **investors** — Investor profiles and deal terms
- **settlements** — Immutable settlement snapshots
- **settings** — Runtime configuration (fee rates, delivery costs)
- **campaigns** — Ad campaign spend allocation

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run start      # Start production server
npm run typecheck  # TypeScript compilation check
npm run lint       # ESLint
```

## Project Structure

```
src/
  app/
    (admin)/        Admin pages (authenticated layout)
    api/            Route handlers
    login/          Public login page
  components/
    ui/             Design system primitives
    layout/         Shell, sidebar, header
  lib/
    calculations/   Financial logic (server-side only)
    supabase/       DB client + typed queries
    sync/           Converty REST API sync engine
    settings/       Settings reader/writer
    campaigns/      Ad platform integration
  types/            Shared TypeScript types
docs/
  business-logic.md Cost model reference
  data-model.md     Database schema reference
```

## Design System

| Token | Value |
|---|---|
| Deep Navy | `#1B2A4A` |
| Warm Emerald | `#2D8F5C` |
| Terracotta Red | `#C75B39` |
| Saharan Amber | `#D4A843` |
| Font | IBM Plex Sans (tabular numerals for financial columns) |
| Cards | White background, no border, `shadow-sm`, `rounded-xl` |

See [CLAUDE.md](CLAUDE.md) for the full design system rules and business logic constraints.

## Deployment

The application is configured for Vercel deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set all required environment variables in the Vercel dashboard under **Settings > Environment Variables**. The `vercel.json` configures the Paris (`cdg1`) region for lowest latency to Tunisia and extended timeouts for sync operations.

## Business Logic

All financial calculations live in `src/lib/calculations/` and run server-side only. See [docs/business-logic.md](docs/business-logic.md) for the complete cost model covering COGS attribution, delivery fees, return handling, exchange burden allocation, and investor settlement waterfall.
