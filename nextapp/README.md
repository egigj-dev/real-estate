# Web app: Next.js

The Albanian-language interface for Tirana Real Estate Explorer. See the [root README](../README.md) for the product, the models and the API.

## Run

```bash
npm ci
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev   # http://localhost:3000
```

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server. `NEXT_PUBLIC_API_URL` is fixed at build time |
| `npm test` | Vitest unit tests in `tests/` |
| `npm run typecheck` | TypeScript, no emit |

## Structure

```
app/                 Routes: /, /pronat, /pronat/[id], /vleresimi, /tregu, /rreth-te-dhenave
components/ui/       Buttons, form fields, page layout, loading/empty/error states
components/listings  Listing card, filter panel, plain-language search
components/detail    Price assessment, comparables, characteristics, nearby places
components/maps      Leaflet maps (listings, price grid, location) and the colour legend
components/charts    Median-and-spread rows, histogram
lib/                 API client and types, URL filters, formatting, statistics, redaction
```

## Design system

- **Colour tokens:** defined once in `app/globals.css` as RGB channels for light and dark themes, and exposed to Tailwind in `tailwind.config.js` (`canvas`, `surface`, `ink`, `line`, `primary`, `brass`, `above`, `below`, and the six-step `ramp` for €/m²). Contrast ratios are noted next to the tokens. `brass` (#B58D5B) is only used for fills; text uses `brass-ink`.
- **Type:** Inter for the interface, and Source Serif 4 for page titles only, both via `next/font`.
- **Icons:** Lucide only.
- **Components:** native `select` and `input` elements styled with the tokens, so they work with the keyboard and on mobile without extra libraries.
- **Numbers:** formatted the Albanian way ("483 000 €", "13,4%") by `lib/format.ts`, without relying on the browser's locale data.

## Conventions

- **State in the URL:** filters, page, view and valuation inputs live in the query string, so the back button and shared links work.
- **Statistics:** computed from all listings, fetched in pages of 500 and cached for the session, never from a sample.
- **Every figure says what it is:** asking price, model estimate, median or sample size. Measured model error is never presented as a prediction interval.
- **Contact details:** phone numbers, e-mail addresses and websites in listing descriptions are hidden on display; the data itself is unchanged.
