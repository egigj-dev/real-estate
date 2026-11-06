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