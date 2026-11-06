# Frontend — React + Vite + Tailwind

Single-page application for Tirana Real Estate — browse, predict, map, and analyze property listings.

## Pages

| Page | Route | Description |
|------|-------|-------------|
| **Overview** | `/` | Dashboard with key metrics, quick-search |
| **Explore** | `/explore` | Browse listings with cards + filters |
| **Map** | `/map` | Interactive Leaflet map with zone polygons |
| **Find** | `/find` | Feature-based search ("3-bed near Blloku with parking") |
| **Predict** | `/predict` | Zone-by-zone price prediction for custom specs |
| **Insights** | `/insights` | Market analytics & price per sqm by neighborhood |
| **Detail** | `/detail/:id` | Full property detail + ML estimate + comps + map |

## Tech Stack

- **React 18** — UI framework
- **Vite 8** — Build tool
- **Tailwind CSS 4** — Styling
- **Leaflet + react-leaflet** — Interactive maps
- **ECharts** — Charts (sparklines, bar charts)
- **Radix UI** — Accessible UI primitives (select, slider, label)
- **Lucide React** — Icons

## Setup

```bash
npm install
npm run dev
```

Opens at **http://localhost:5173**. Backend should be running on port 8000.

## Backend API URL

The app auto-detects the API at `http://localhost:8000`. Override by setting:

```js
// In src/api.js or via environment
window.RE_API = "https://your-host:8000";
```