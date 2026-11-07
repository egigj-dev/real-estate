# Frontend redesign: implementation log

Branch `redesign/frontend`, from `main` at `13ffe62`, dated 2026-11-07. Commits are local and nothing is pushed. The backend and model files are unchanged.

| Commit | Phase |
|---|---|
| `96b761a` | A. Audit and target architecture ([AUDIT.md](AUDIT.md)) |
| `965895b` | B. Design tokens, fonts, shell, routes and redirects, data layer |
| `f62a3f5` | C. Explore and listing detail |
| `15b89cb` | D. Valuation, market analysis, overview, data and model page |
| `b337075` | E. Fixes from browser QA, dependency cleanup, unit tests |
| `62a550c` | Removal of the Vite frontend (revert this one commit to restore it) |
| this commit | READMEs and this log |

## 1. Architecture decisions

- **Next.js is the only frontend.** It already had file routing, TypeScript types matching the API, a single styling system and packaged maps; the Vite app had none of these. The comparison is in [AUDIT.md](AUDIT.md) §2.
- **No backend changes.**
  - Medians, spread and distributions are computed in the browser from all 4,148 listings: 9 requests of 500, cached for the session. The API's `/market/insights` only returns means.
  - The cost is about 2 MB of JSON on the first statistics page.
- **The URL is the state.** Explore filters, page and view, and the valuation inputs, all live in the query string. `/pronat` and `/vleresimi` render per request, because static prerendering broke navigation for links that carried a query.
- **Native form controls** (`select`, `input`, `checkbox`) styled with design tokens replace the Radix wrappers.
- **Small SVG/CSS charts** replace ECharts, which was only used for one chart.
- **The price map is a grid of listing coordinates (~650 m cells),** not administrative areas.
  - The OSM outlines from `/areas` are simplified, and 48% of listings fall inside two or more of them, so per-area statistics would be wrong.
  - Cells with fewer than 5 listings are hidden. 93 cells remain, covering 4,026 listings.

## 2. The new product

| Buyer's question | Page |
|---|---|
| What's available? | **Eksploro pronat:** filters for zone, price, size, bedrooms, bathrooms, amenities, furnishing and description words; sorting; list or map; the result count; chips for each active filter; and an optional plain-language description |
| Is this price reasonable? | **Listing page:** asking price, model estimate and difference; the measured error band; an interpretation that never says "fair value"; five comparables with their median €/m²; characteristics; location; nearby places; the seller's text |
| What would this apartment cost? | **Vlerëso pronën:** every input the model uses, with its defaults visible, and an estimate per zone with median and 75th-percentile error |
| Where should I buy? | **Analiza e tregut:** medians and middle-half spread by zone, bedrooms, size and distance from Skanderbeg Square; a histogram of €/m²; differences with and without amenities, labelled as descriptive. **Përmbledhje** adds the price map |
| Can I trust this? | **Rreth të dhënave:** what the data are and aren't, how the two models were tested and their live metrics, how to read the error, and what the site doesn't offer |

## 3. Major UI and component changes

- **Header:** a top navigation bar, with a mobile menu, a skip link and a theme switch. It replaces the generic sidebar.
- **Design tokens:** in `app/globals.css`, with measured contrast:
  - canvas `#F7F6F2`, primary `#243D35`, ink `#242824`;
  - brass `#B58D5B` for fills only, with a darker `#8A6738` for brass text, since `#B58D5B` is only 3.0:1;
  - a six-step sand-to-green ramp for €/m²;
  - a separate dark theme.
- **Type:** Inter for the interface, and Source Serif 4 for page titles only.
- **Listing cards:** text-first, because listings have no photos or addresses. Each shows zone, a title built from the bedroom count, price, €/m², size, bathrooms and floor.
- **Price assessment:** three figures, a scale with the error band and the asking price, and an explanation that changes with the result.
- **Primitives:** `Button`/`ButtonLink`, `Field` (label, hint and error wired with ids), `Segmented`, `Checkbox`, `PageIntro`, `Section`, `Panel`, `Figure`, and `Loading`/`ErrorState`/`EmptyState`/`Note`.

## 4. Technical debt removed

- Bootstrap, Tailwind 4 and the shadcn/custom CSS mix in the Vite app (the whole app was removed).
- The commented-out colour tokens and the dropped Google Fonts import.
- About 200 inline styles and 12 hard-coded colours.
- In the Next.js app:
  - ECharts and echarts-for-react, six Radix packages and postcss-cli: 75 packages uninstalled;
  - the `next lint` script, which Next 16 removed;
  - the committed `tsconfig.tsbuildinfo`;
  - unused components and API helpers.
- The Next.js home page crash ("Map tirana-zones not exists"), the hydration warnings, and the 547 px horizontal overflow at phone width.

## 5. Functionality: preserved, improved, removed

**Preserved:** every API feature the app used: filtering, sorting by price, detail, held-out estimates, comparables, valuation by zone, plain-language parsing, and nearby places from OpenStreetMap.

**Improved:**
- **Shareable state:** shareable URLs for searches and valuations, and a link back to the exact results from a listing.
- **Plain-language search:** it shows which criteria it understood, which become filters, and which it can't apply. Floor has no filter, and a broad zone such as "Zona e Mesme" spans two pricing zones.
- **Statistics:** computed from all listings instead of a 500-listing sample.
- **Labels:** the comparables' reasons and distances are translated from the API's English, and `-1` (unknown) values are shown as "Nuk tregohet".
- **Contact details:** phone numbers, e-mail addresses and websites are hidden in the 1,918 descriptions that contain them. No prices are hidden; this is checked across all 4,148 descriptions.

**Removed, with reasons:**
- **Growth projections:** fixed assumed rates with no data behind them. The API still returns them.
- **"Family" and "investment" scores out of 10:** invented from amenity counts. Nearby places are now shown as plain distances.
- **Synthetic match percentage from `/suggest`:** derived from rank alone.
- **"Krahaso" (compare), "Të preferuarat" (favourites), the avatar and the "/" hint:** they never worked.
- **"Fair / overpriced / underpriced" labels:** replaced by "above/below the estimate by more than the typical error", with an explanation.

## 6. Tests and verification

| Check | Result |
|---|---|
| Backend `pytest` | 153 passed (backend unchanged) |
| `npm test` (Vitest) | 14 passed: formatting, URL filters, redaction, valuation input, quantiles, ramp classes, price grid |
| `npm run typecheck` | Clean |
| `next build` | Succeeds; 7 routes |
| Interaction checks, Playwright against the **production** build | 21 of 21 passed: filters and the back button, card to detail and back to the same results, map view, plain-language search applied as filters, valuation validation and focus, six-zone results with no growth shown, theme persisting, skip link and focus ring, mobile menu, five redirects |
| axe-core, 6 pages × light and dark | No violations |
| Screenshots at 1440 px and 390 px, light and dark | No horizontal overflow; reviewed by eye |
| Fresh-clone mode (`USE_DEMO_DATA=1`, no model) | Demo notice on every page; estimate and valuation say they're unavailable; empty maps explain why |

## 7. Remaining issues and limitations

- **Cards can't show "vs estimate":** the list schema has no estimate field, and adding one is a backend change.
- **Sorting** is by price only, because the API offers nothing else.
- **Compare and favourites** aren't implemented; they were removed rather than faked.
- **The first statistics page downloads all listings** (~2 MB). That's fine at 4,000 listings; a backend aggregate endpoint would be better at larger scale.
- **Not yet tested:**
  - with real screen readers;
  - in Firefox or Safari (only headless Chromium);
  - for load performance (no Lighthouse run).
- **Albanian copy:** written for this redesign and checked for terminology consistency, but not reviewed by a native editor.
- **External services:** nearby places depend on the public Overpass API, and map tiles come from OpenStreetMap. Their usage policies apply if traffic grows.
- **Unused API surface:** `/suggest`, `/market/insights` and `/areas` are now unused by the app, and `/predict/by-zone` still computes growth figures nobody displays. Removing them is a backend decision.

## 8. Commands

```bash
# API, real data if present, otherwise demo
cd backend && .venv/bin/uvicorn main:app --reload --port 8000

# Web app
cd nextapp && npm ci && NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev    # http://localhost:3000

# Checks
cd backend && .venv/bin/python -m pytest -q
cd nextapp && npm test && npm run typecheck && npm run build
```
