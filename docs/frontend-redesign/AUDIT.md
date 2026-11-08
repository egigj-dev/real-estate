# Frontend audit

Branch `redesign/frontend`, based on `main` at `13ffe62`. Audited 2026-11-07 against the running app: the API on the real data (4,148 listings, both models loaded), the Vite app on 5173 and the Next.js app on 3200. Screenshots were taken with headless Chromium at 1440 px and 390 px.

## 1. Repository

| Part | State |
|---|---|
| `backend/` | FastAPI with 9 routes, a two-model XGBoost estimate served out-of-fold, and 153 tests |
| `frontend/` | React 18, Vite 8, JavaScript; Bootstrap 5, Tailwind 4, shadcn/ui and 561 lines of custom CSS |
| `nextapp/` | Next.js 16, React 19, TypeScript; Tailwind 3, shadcn/ui, react-leaflet, ECharts |

The working tree was clean. Private data and model files are git-ignored and linked into this worktree, not committed.

## 2. The two frontends

Both cover the same seven screens: overview, explore, map, find, predict by zone, market, and detail.

| | Vite (`frontend/`) | Next.js (`nextapp/`) |
|---|---|---|
| Routing | In-memory page state; no URLs, no back button, no shareable listing link | File routes, including `/listings/[id]` |
| Types | None | `lib/types.ts` mirrors the API schemas |
| Styling | Four systems; `.card`, `.btn-primary` and `.btn-secondary` collide with Bootstrap | Tailwind and shadcn only |
| Colour tokens | **Commented out**: about 190 `var(--…)` references resolve to nothing | Default shadcn slate; works, but is the generic look |
| Fonts | Google Fonts `@import` placed after the Tailwind import, so it's dropped; Inter and DM Serif never load | Inter `@import` |
| Inline styles | About 200 `style={{…}}`, 12 hard-coded colours | Few |
| Maps | Leaflet loaded at runtime from unpkg | react-leaflet as a package |
| Charts | Hand-made SVG | ECharts (heavy) |
| Unused code | `AppNavbar`, `Hero`, `FeatureBadges`, `Sparkline` | `Sparkline`, `useAnimatedNumber` |

**Decision: keep Next.js and retire Vite.** It already has routing, types, a single styling system and packaged maps. Moving the Vite app to TypeScript and routing would mean rewriting it anyway.

## 3. Verified defects

### Both apps
- **Placeholder controls:** "Krahaso" (compare), "Të preferuarat" (favourites) and the avatar do nothing. The top-bar "/" shortcut isn't wired up.
- **Invented location scores.** The detail page turns OpenStreetMap amenity counts into "8.8/10 Shkëlqyeshëm për familje" and "7.7/10 Zonë investimi e mirë". There's no basis for these scores.
- **Sample statistics shown as area facts.** The overview computes per-area prices from a 500-listing sample ("145 prona në kampion") rather than all 4,148.
- **"Fair price" wording.**
  - The detail page labels listings "Çmim i drejtë", "Çmim i lartë" or "Çmim i ulët", and calls the band "Diapazoni i drejtë".
  - The band is the zone's 75th-percentile held-out error, clipped to 8–35%. That describes past model error; it isn't a prediction interval or a fair range.
- **Growth projections.** Predict shows 2- and 5-year prices from fixed rates assumed in code (4.5–7.5% a year). No data supports them.
- **Synthetic match score.** `/suggest` returns `match_score = 97 − 52·rank/(n−1)`, a number derived only from rank and shown as a percentage.
- **Personal data.** Listing descriptions contain agents' phone numbers and agency names, which are shown verbatim.
- **English backend strings:** "Similar bedroom count", "Distance unavailable", and "has carport" in the feature list.
- **Unknown values shown as data:** `-1` stands for unknown in balconies, living rooms and bathrooms.

### Next.js only
- **The home page crashes:** ECharts throws "Map tirana-zones not exists" before the geographic data is registered.
- **Hydration mismatch warnings** on explore, find, predict and detail.
- **At 390 px every page overflows horizontally by 547 px.** The 258 px sidebar never collapses.

### Vite only
- The commented-out colour tokens, the fonts that never load, the four colliding styling systems, and the missing URLs listed above.
- **Accessibility:** zero `aria-*` attributes, seven clickable `div`/`tr` elements with no keyboard access, and emoji used as icons.

## 4. Backend contract (unchanged by the redesign)

| Route | Used for | Notes |
|---|---|---|
| `GET /listings` | Search, with paging up to 500 per page | Filters: q (description text), price, beds, baths, m², furnished, elevator, parking, garden and zone. Sort is by price only |
| `GET /listings/{id}` | Detail | `address` is empty for every listing; descriptions contain contact details |
| `GET /listings/{id}/estimate` | Asking price vs model | Out-of-fold estimate. The band is p75 error, the label threshold is p50 error (at least 10%) |
| `GET /listings/{id}/comps` | 5 nearest listings by feature distance | Reasons and distances come back in English |
| `POST /predict/by-zone` | Valuation for all 6 zones | All 13 inputs change the estimate. Also returns `future_prices` (assumed growth) and global feature importance |
| `POST /chat/parse` | Natural-language criteria | Uses Claude when `ANTHROPIC_API_KEY` is set, otherwise keyword rules. Understands m², rooms, bathrooms, floor, elevator, parking and a broad zone |
| `POST /suggest` | Nearest listings to given features | Same estimate as the property model |
| `GET /market/insights` | Per-zone statistics | **Means** only, for the 6 pricing zones; no medians or spread |
| `GET /filters/options`, `GET /areas`, `GET /health` | Options, 24 OSM administrative polygons, data and model status | |

### Geography
- **Listings carry one of 6 pricing zones.** These are KMeans clusters used by the model, not official boundaries. `area_name` equals the pricing zone.
- **`/areas` returns 24 OSM administrative units,** which have no statistics of their own.

## 5. Target architecture

| Route | Page | Answers |
|---|---|---|
| `/` | Përmbledhje | What's here and where to start; the map of prices by administrative unit |
| `/pronat` | Eksploro Pronat | What's available? Filters in the URL, list or map view, optional description search |
| `/pronat/[id]` | Detail | Is this reasonably priced? Asking price vs model, error, comparables, location |
| `/vleresimi` | Vlerëso Pronën | What would this property be listed at in each zone? |
| `/tregu` | Analiza e Tregut | Where to buy? Medians, spread, sample sizes, size and room breakdowns |
| `/rreth-te-dhenave` | Rreth të dhënave | Source, snapshot, model and its error, and definitions |

Old paths redirect to the new ones: `/explore`, `/map`, `/find`, `/predict`, `/insights` and `/listings/:id`.

### Decisions
- **Medians and distributions are computed in the browser** from all listings (9 cached requests of 500), instead of adding a backend endpoint.
- **Growth projections, location scores, the synthetic match score, compare and favourites are removed** from the UI. Section 3 gives the reasons, and the implementation log records them.
- **Natural-language search moves into Explore.** Parsed criteria are shown as editable filters before they're applied, so the user sees exactly what was understood.
- **Contact details in descriptions are hidden** when displayed. The data itself isn't modified.
- **ECharts is replaced by small SVG charts,** and Leaflet stays.

## 6. Risks

- **Nearby amenities come from the public Overpass API.** It can be slow or rate-limited, so it must fail quietly.
- **Asking prices from a snapshot of unknown date.** Every price view says so.
- **The fresh-clone demo mode has no estimates.** Every estimate view needs an "unavailable" state.
