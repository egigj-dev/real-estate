# Design refinement log

Branch `redesign/refinement`, built on `redesign/frontend`, dated 2026-11-08. Nothing is pushed. The backend, models and API schemas are unchanged.

**No concept image was available to this session.** The work follows the written direction: warm off-white, forest green, restrained bronze, editorial titles, and the map as the centrepiece.

| Commit | Phase |
|---|---|
| `34485d8` | Map rework and homepage |
| `b81e0e9` | Consistency across pages |
| `e247ebc` | Accessibility fix found in verification |
| this commit | This log |

## 1. Design audit (before)

### Homepage
- **Too many things competing:**
  - a three-line headline;
  - four large figures, including model error, which isn't an overview fact;
  - a map;
  - a six-zone list repeating the map;
  - three navigation blocks repeating the header;
  - a footer repeating the data note.
- **Square-grid map:** rigid, legend in six steps, a busy basemap at full contrast, and data only in hover tooltips. There was no selection, no detail panel and no route to the listings in an area.

### Other pages
- **Explore:** nine filter groups were visible at once.
- **Valuation:** a 13-field form shown in full, followed by a model-importance chart of equal weight to the result.
- **Titles:** page titles were nearly as large as the homepage headline, so hierarchy came from size alone.

## 2. Map: choice and evidence

| Option | Verdict |
|---|---|
| **Choropleth of OSM administrative units** | **Rejected.** The `/areas` outlines are simplified and overlap: 48% of listings fall inside two or more. Statistics per unit would be wrong. |
| **Choropleth of the model's pricing zones** | **Kept, as the second view.** The zones are KMeans clusters on latitude and longitude, so each zone is exactly the region closer to its centre than to any other (a Voronoi cell). Computing the centres as the mean of each zone's listings and assigning every listing to the nearest one reproduces all 4,148 zone labels (100%). The regions are drawn from that geometry, clipped to the hull of the listings within the 99th distance percentile. These zones are the ones Explore filters by and the valuation uses, so selecting one links straight to its listings. |
| **Hexagonal aggregation** | **Default view.** Hand-written pointy-top hexagons on a local metric projection, about 70 lines in `lib/geo.ts`. H3 would add a dependency for no analytical gain at one fixed resolution. |
| **Proportional circles** | Not used. The Explore map already shows listing density as points. |
| **Spike map** | Not used. Spikes overlap and make medians harder to compare. |

### Choosing the hexagon resolution
Measured on the 4,148 listings, with the grid shifted by about half a cell to test sensitivity:

| Cell width | Minimum listings | Coloured cells | Listings covered | Cells with fewer than 10 | Median change under a grid shift |
|---|---|---|---|---|---|
| 520 m | 8 | 112 | 92% | 8% | 4.0% |
| 606 m | 8 | 94 | 94% | 10% | 3.6% |
| **693 m** | **8** | **82** | **95%** | **4%** | **4.0%** |
| 866 m | 8 | 65 | 96% | 14% | 4.8% |

Coordinates are coarse. Only 2,591 of the 4,148 coordinates are distinct, and 1,323 listings sit on coordinates shared by ten or more listings (developments or default geocodes). Smaller cells mostly split those stacks without adding real detail. At **693 m with at least 8 listings** a cell's median rests on a reasonable sample: half the coloured cells have 39 or more listings. Cells with 1–7 listings are drawn with a dashed outline and no colour, and the legend gives them their own entry, so they can't be mistaken for cheap areas.

### Statistics shown
- **Median asking price per m²** and the number of listings in the area.
- **"X% above/below the city median"** appears only when the city median lies outside an approximate 95% confidence interval for the area's median (order statistics, at least 8 listings). Otherwise the panel says the difference isn't clear with this many listings. Example: Zona e Mesme B, with 1,207 listings and a median of 1,696, isn't flagged against the city's 1,639, because the interval's lower bound is exactly 1,639.
- **Colours:** five quintile classes of listing €/m², in restrained greens, with explicit euro values in the legend.

## 3. Homepage changes
- **Headline:** "Njih çmimet në Tiranë, përpara se të blesh." in serif at 44 px. The sentence below it explains what you can do.
- **Actions:** two, "Eksploro pronat" and "Vlerëso pronën".
- **Figures:** two, the median asking price per m² and the number of listings, set inline in the hero. Model error moved out; it remains on the valuation and data pages.
- **Map:** the page's focal point, with the detail panel inside the map on desktop and below it on mobile.
- **Removed:** the six-zone list (the zones view and the market page cover it) and the three navigation blocks. A single-sentence data note with two links ends the page.
- **Footer:** one line.

## 4. Interaction improvements
- **Map flow:** the price pattern, then hovering for a preview (desktop), then clicking or tapping to select. The selection stays outlined on a layer above its neighbours, the panel shows the statistics, and the panel links to the listings in that area.
- **Geographic context:** a hexagon link opens Explore with a hexagon filter (`?hex=q:r`, applied in the browser because the API has no area filter), and the map view outlines it. A zone link uses the existing zone filter.
- **State in the URL:** the map view and selection (`?harta=zonat&zgjedhur=…`), so Back from the listings returns to the same selection. Switching view clears the selection, and an × clears it explicitly.
- **Keyboard and screen readers:** use a list control in the panel, with every coloured area sorted by price. The map shapes are hidden from assistive technology rather than becoming about 100 unlabelled tab stops.
- **Explore:** zone, price, size and bedrooms are visible. "Më shumë filtra" holds bathrooms, amenities, furnishing and description words, and opens by itself when one of them is active.
- **Valuation:** size, rooms, floor, lift and parking are visible. "Më shumë detaje" holds the rest, with a count of values changed from the defaults. Results open with a one-sentence range, and the model-importance list is collapsible.
- **Basemaps:** data maps use a muted, desaturated basemap and whole zoom levels; fractional zoom produced visible tile seams.

## 5. Components

| | |
|---|---|
| **New** | `components/maps/MapExplorer.tsx` (views, panel, list control, legend); `components/maps/PriceMap.tsx` (Leaflet layer, hover, selection) |
| **Rewritten** | `lib/geo.ts` (hexagons, zone regions, the difference test); `lib/ramp.ts`; `components/maps/RampLegend.tsx`; `app/HomeClient.tsx`; `components/layout/SiteFooter.tsx` |
| **Changed** | `lib/stats.ts` (median interval), `lib/filters.ts` (hexagon filter), `app/pronat/ExploreClient.tsx`, `components/listings/FilterPanel.tsx`, `app/vleresimi/ValuationClient.tsx`, `components/ui/layout.tsx` (type scale), `components/maps/ListingsMap.tsx` and `useTheme.ts` (muted basemap, outline), the detail page header and characteristics label, the colour tokens |
| **Removed** | `components/maps/PriceGridMap.tsx`; the unused `pointInPolygon` |

**Type scale:** home headline 44 px serif; page titles 36 px serif; section headings 22 px sans; key figures 28 px; body 16 px; supporting text 14 px; captions 12 px. Serif appears only in the logo and titles.

## 6. Verification

| Check | Result |
|---|---|
| Unit tests (Vitest) | 18 passed: hexagon keying and geometry, sparse cells, zone regions, the median interval, the difference test, plus the earlier tests |
| Typecheck and production build | Clean |
| Interaction suite on the production build | 21 of 21 passed |
| Map flow on the production build | List selection, then panel and URL, then a shape click, then "Shiko … njoftimet", then Explore filtered to the same hexagon, then Back restores the selection. Hover previews without changing the URL; the clear button and view switch reset the selection |
| axe-core, 8 URLs (including both map views with a selection) in light and dark | No violations, after fixing two found in this pass |
| Screenshots at 1440 and 390 px, light and dark | No horizontal overflow |
| Backend | Untouched |

Before and after screenshots are in `~/portfolio-mission/worktrees/re-redesign-screens/refinement/`.

## 7. Remaining limitations and future work
- **Hexagon list control:** lists 83 cells by their dominant zone, which is serviceable but not friendly. A street or place name per cell would need reverse geocoding.
- **Coordinates:** shared coordinates make some hexagons reflect a single development. The data can't distinguish these.
- **Hexagon filter in Explore:** downloads all matching listings. That's fine at 4,000; a backend bounding-box filter would scale better.
- **Basemap:** still standard OpenStreetMap tiles, muted by CSS. A dedicated low-detail basemap would look calmer, but every hosted option now needs an API key.
- **No architectural illustration:** the brief allowed one but warned against decoration, and without the concept image I didn't invent one.
- **Not done:** testing with real screen readers, in Firefox and Safari, and native-speaker review of the Albanian copy are still outstanding.
