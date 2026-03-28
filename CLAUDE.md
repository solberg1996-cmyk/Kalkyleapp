# KalkyleApp

## Prosjektbeskrivelse
KalkyleApp er en norskspråklig kalkyle- og tilbudsapplikasjon for tømrere og håndverkere. Appen lar brukere administrere kunder, prosjekter, materialer og generere profesjonelle tilbud med PDF-utskrift.

## Teknologi
- **Frontend**: Vanilla JavaScript (ingen rammeverk), single-page app
- **Backend/Database**: Supabase (auth + cloud sync + RLS)
- **Lagring**: LocalStorage med backup-rotasjon + Supabase sky-synkronisering
- **Kryptering**: Web Crypto API (AES-GCM) for kundedata i sky
- **Styling**: Inline CSS i `<style>` i index.html

## Arkitektur
Appen er organisert som modulær JavaScript med ES6 modules (25 filer):

```
index.html              ← HTML-markup og CSS (351 linjer)
js/
  ┌── Kjerne ──────────────────────────────────────────────┐
  │ app.js              ← Hovedinngang, init, ~90 window-exports │
  │ config.js           ← Konstanter, standardverdier, maler     │
  │ env-config.js       ← Supabase URL og anon-nøkkel            │
  │ utils.js            ← Hjelpefunksjoner (uid, currency, etc.)  │
  └────────────────────────────────────────────────────────┘
  ┌── Auth & Data ─────────────────────────────────────────┐
  │ auth.js             ← Supabase auth (login, signup, session)  │
  │ state.js            ← State, backup, konflikt, cloud sync     │
  │ crypto.js           ← AES-GCM kryptering av kundedata         │
  │ sync-queue.js       ← Offline-kø, tilkoblingshåndtering       │
  │ migration.js        ← Strukturert DB-migrasjon (SQL + helpers) │
  └────────────────────────────────────────────────────────┘
  ┌── Forretningslogikk ───────────────────────────────────┐
  │ compute.js          ← Kalkyleberegninger, marginer            │
  │ calculator.js       ← 11 jobbtyper, erfaringstimer            │
  │ price-catalog.js    ← CSV-import, søk, favoritter             │
  │ project-history.js  ← Versjonering og rollback (20 snapshots) │
  │ auto-export.js      ← Automatisk sikkerhetskopiering          │
  └────────────────────────────────────────────────────────┘
  ┌── UI-moduler ──────────────────────────────────────────┐
  │ dashboard.js        ← Dashboard-rendering og metrics          │
  │ customers.js        ← Kunde-CRUD, modaler                    │
  │ projects.js         ← Prosjekt-CRUD, navigasjon              │
  │ settings.js         ← Firma, logo, farger, satser, backup    │
  │ modals.js           ← Modal-system (show, close, backdrop)   │
  └────────────────────────────────────────────────────────┘
  ┌── Fane-rendering ──────────────────────────────────────┐
  │ tab-info.js         ← Info-fane + versjonshistorikk           │
  │ tab-work.js         ← Arbeid og kostnader                    │
  │ tab-materials.js    ← Materialer, prissøk, maler             │
  │ tab-offer.js        ← Tilbudsposter, oppsummering            │
  │ tab-preview.js      ← Tilbudseditor med seksjoner            │
  │ offer-preview.js    ← PDF/HTML tilbudsgenerering              │
  └────────────────────────────────────────────────────────┘
```

## Viktige konvensjoner
- Alle beløp lagres eks. mva internt, konverteres ved visning
- `state`-objektet er sentralt og inneholder all applikasjonsstatus
- `saveState()` roterer backup → setter `_lastModified` → localStorage → trigger cloud sync
- `persistAndUpdate()` — live oppdatering uten re-render (hvert tastetrykk)
- `persistAndRenderProject()` — tar snapshot (versjonering) + full re-render
- `window.*`-eksporter brukes for inline onclick i HTML template strings
- Kundedata krypteres med AES-GCM (nøkkel derivert fra bruker-ID via PBKDF2) før sky-lagring
- Konflikthåndtering: `_lastModified` vs cloud `updated_at` — nyeste vinner
- Offline-kø: saves legges i localStorage-kø, flushet automatisk ved reconnect

## Dataflyt
```
Bruker endrer → saveState() → rotateBackups(5) → localStorage → 2s debounce → saveToCloud()
                                                                                  ↓
                                                                Online? → encrypt → Supabase
                                                                Offline? → enqueue → sync later

Ved innlogging:  loadFromCloud() → sammenlign _lastModified → dekrypter → applyStateData()
                                    ↓ lokal nyere? → push lokal til sky
                                    ↓ sky nyere?   → bruk sky-data
```

## Kommandoer
```bash
# Kjør lokalt (krever server pga ES6 modules)
python -m http.server 8080
# eller
npx serve .
# eller VS Code Live Server-utvidelse
```
Ingen build-steg — ren HTML/JS.

## Kjente begrensninger
- Supabase anon-nøkkel i env-config.js (offentlig nøkkel, sikkerhet via RLS)
- All CSS er inline i index.html — bør flyttes til egen fil
- ~90 `window.*`-eksporter pga inline event handlers i HTML-strenger
- Strukturert database (migration.js) krever manuell SQL i Supabase dashboard
- Ingen automatiske tester
- Ingen tilgjengelighet (ARIA-attributter, tastaturnavigasjon)

## Foreslåtte forbedringer

### Kritisk prioritet
1. **Flytt CSS til egen fil** — Ekstraher all CSS fra `<style>` i index.html til `css/style.css`. Reduserer HTML, muliggjør caching, lettere å vedlikeholde.
2. **Feilhåndtering med brukervarsel** — Async-operasjoner (cloud sync, import/eksport) logger bare til konsoll. Brukeren ser aldri feilmeldinger. Erstatt `console.log` med toast-meldinger.
3. **Tilgjengelighet (a11y)** — Legg til `aria-label` på alle inputs/knapper, `role`-attributter på lister og modaler, tastaturnavigasjon (Enter/Escape), fokushåndtering i modaler.

### Høy prioritet
4. **XSS-hardening** — `p.status` brukes uescapet i CSS-klasser (`status-${p.status}`). Sanitiser alle verdier som brukes i attributter, ikke bare innhold.
5. **Enhetstester** — Ingen tester i dag. Start med `compute.js` (beregningslogikk), `crypto.js` (kryptering), `price-catalog.js` (søk). Bruk Vitest (ingen bundler nødvendig).
6. **Splitt app.js** — 850 linjer med kalkulator-widgets, modal-rendering og event handlers. Flytt kalkulatorlogikk, post-editing og pris-lookup til egne moduler.
7. **Fjern `window.*`-mønsteret** — Bytt inline `onclick="fn()"` til `addEventListener()` med event delegation. Eliminerer ~90 globale funksjoner.

### Medium prioritet
8. **Render-debouncing** — `persistAndUpdate()` kjører `compute()` + oppdaterer 7+ DOM-elementer på hvert tastetrykk. Legg til `requestAnimationFrame`-batching.
9. **Input-validering** — Ingen grensesjekkpå numeriske felter (timer, priser, prosenter). Negative verdier og NaN kan gi feil beregninger.
10. **Service Worker** — Ekte offline-støtte med cached assets, ikke bare data-kø.
11. **Responsivt design** — Appen mangler mobiltilpasning (ingen media queries).
12. **Toast-system** — Erstatt alle `alert()` med ikke-blokkerende toast-meldinger.

### Lav prioritet
13. **Fjern ubrukte imports** — `percent`, `safe` i app.js; `renderOfferPosts` importert men ikke brukt.
14. **CI/CD** — GitHub Actions for linting og fremtidige tester.
15. **Bytt `Math.random()` til `uid()`** — tab-preview.js bruker Math.random() for ID-generering i noen steder.
