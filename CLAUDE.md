# KalkyleApp

## Overview
Norwegian estimation and offer tool for small/medium craft businesses (carpenters, painters, plumbers, etc.). Replaces manual Excel sheets with a web-based app for managing customers, project cost calculations, and generating offers/quotes.

## Tech Stack
- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework, no build step)
- **Backend/DB:** Supabase (auth + database)
- **Auth:** Supabase Auth (email/password)
- **PDF:** Browser's built-in print
- **Hosting:** Static file — open `index.html` directly or host on any static server

## Project Structure
```
index.html      — Main HTML file, entry point
app.js          — Core app logic, built-in templates, state management, helper functions
auth.js         — Supabase client init, login/signup/session handling
customers.js    — Customer CRUD and UI
projects.js     — Project management, cost calculations
offer.js        — Offer/quote generation and preview
settings.js     — Company settings, default rates, logo/color config
makker.js       — Extended features / companion module
utils.js        — Shared utilities (state load/save, formatting)
style.css       — All styles
img/            — Image assets
```

## Architecture
- Single-page app with view toggling via CSS classes (`hidden`)
- Global state object persisted to `localStorage` (key: `kalkyleapp_round6`) and synced to Supabase
- DOM queried with `$()` shorthand (`document.querySelector`)
- UIDs generated with `Math.random().toString(36).slice(2,10)`
- All JS files are loaded as plain `<script>` tags — no modules, no bundler

## Key Concepts
- **Customers** — name, phone, email, address
- **Projects** — linked to a customer, contain steps/phases with materials, labor hours, driving costs, subcontractors
- **Offers** — generated from projects, support multiple display modes (detailed, simple, merged lines), printable
- **Pipeline** — statuses: Utkast (Draft) → Sendt (Sent) → Vunnet (Won) / Tapt (Lost) / Pagar (In Progress) / Ferdig (Done)
- **Templates** — built-in material templates (Terrasse, Lettvegg, Vindu, Listing, Kledning, Etterisolering, Tak) plus user-defined templates
- **Settings** — default rates (hourly: 850 kr, internal cost: 450 kr, material markup: 20%, driving: 650 kr), company info, logo, colors

## Language
- UI and user-facing text is in **Norwegian (Bokmal)**
- Code (variable names, functions) is in **English**
- Keep this convention when making changes

## Development
No build step. Edit files and refresh the browser. For Supabase, the client is initialized in `auth.js` with the project URL and anon key.

## Important Notes
- State includes migration logic (e.g., old `subcontractor` field → `subcontractors` array)
- VAT handling supports both ex. and incl. display modes
- Price catalog and favorites are stored in state for quick material lookup
