# Dashboard — Next.js + TypeScript

Admin dashboard for Tirana Real Estate, built with Next.js, TypeScript, and shadcn-style UI components.

## Pages

| Page | Description |
|------|-------------|
| **Home** | Landing / overview |
| **Explore** | Browse listings with filters |
| **Find** | Feature-based property search |
| **Map** | Interactive Leaflet map with zone polygons |
| **Predict** | Zone-based price prediction |
| **Insights** | Market analytics with charts |
| **Listing detail** | Full property view |

## Tech Stack

- **Next.js 16** — React framework with SSR
- **TypeScript** — Type-safe code
- **Tailwind CSS 3** — Utility CSS
- **Leaflet + react-leaflet** — Maps
- **ECharts + echarts-for-react** — Charts
- **Radix UI** — Accessible components
- **Lucide React** — Icons

## Setup

```bash
npm install
npm run dev
```

Make sure the backend is running on port 8000.

### Environment

Copy `.env.example` to `.env.local` and configure your API URL:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Run from a fresh clone

Start the API with `cd backend && uvicorn main:app --reload --port 8000` after
installing `backend/requirements.txt`. No private data or trained artefacts are required.
If `backend/data/final_data.json` is missing, or `USE_DEMO_DATA=1`, the loader
uses the bundled synthetic, fictional `backend/demo/listings.json` and logs a
warning. `/health` reports `data_source: "demo"`; both frontends display a notice.
Listings, filters, areas, comparable listings and market insights remain available.
Without a trained model, estimate, predict-by-zone and suggest return HTTP 503
with a JSON `detail` explanation. Demo listings have no held-out estimates, so
their estimates remain unavailable even with a model installed. No demo training
is needed. Start the Vite UI with `cd frontend && npm install && npm run dev`,
or the Next.js UI with `cd nextapp && npm install && npm run dev`.
