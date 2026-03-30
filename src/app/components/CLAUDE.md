# UI Component & Design Rules

## Language
All user-facing text in French. No English leakage anywhere.

## Typography
- Font: IBM Plex Sans — sole font, no fallbacks to system fonts
- Import: @ibm/plex/css/ibm-plex-sans.css
- Financial numbers: font-variant-numeric: tabular-nums (for column alignment)
- KPI hero numbers: text-3xl or larger

## Design Tokens
- Deep Navy: #1B2A4A (primary text, headers, sidebar)
- Warm Emerald: #2D8F5C (profit, positive values, success states)
- Terracotta Red: #C75B39 (losses, negative values, error states)
- Saharan Amber: #D4A843 (warnings, attention-required, pending states)
- Neutral grays: warm-tinted (not pure gray — add slight warmth)
- Background: #FAFAF8 (warm off-white, not pure white)

## Component Patterns
- Cards: bg-white, no border, shadow-sm, rounded-xl, p-6
- Buttons primary: bg-[#1B2A4A] text-white hover:bg-[#243558]
- Buttons secondary: bg-transparent border border-[#1B2A4A] text-[#1B2A4A]
- Status badges: rounded-full px-3 py-1 text-xs font-medium
  - delivered: bg-emerald-50 text-emerald-700
  - returned/to_be_returned: bg-red-50 text-red-700
  - in_transit/deposit: bg-amber-50 text-amber-700
  - rejected: bg-gray-100 text-gray-500
  - pending/confirmed: bg-blue-50 text-blue-700
- Inputs: border-gray-200 rounded-lg focus:ring-[#1B2A4A]
- Mobile-first: stack on mobile (375px+), grid on tablet (768px+), full on desktop

## PROHIBITED
- Gradients anywhere
- Colored card backgrounds (cards are always white)
- Uppercase text (text-transform: uppercase)
- Generic AI dashboard aesthetics
- System/fallback fonts
- Emojis in UI labels