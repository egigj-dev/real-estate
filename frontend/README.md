# Tirana Listings — React + Vite + Bootstrap

A property listings web app for Tirana, Albania.

## Stack

- **React 18** — UI framework
- **Vite 5** — build tool & dev server
- **React Bootstrap 2** — Bootstrap 5 components
- **Bootstrap 5** — styling base

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (make sure your API is running on http://localhost:8000)
npm run dev

# 3. Open http://localhost:5173
```

## Project Structure

```
src/
├── api.js                  # API helpers & formatters
├── App.jsx                 # Root — routing between pages
├── index.css               # Global styles & Bootstrap overrides
├── main.jsx                # React entry point
├── components/
│   ├── AppNavbar.jsx       # Sticky navbar
│   ├── FeatureBadges.jsx   # Key feature chips
│   ├── Hero.jsx            # Hero header with stats
│   └── ListingCard.jsx     # Individual listing card
└── pages/
    ├── ListingsPage.jsx    # Browse + filter listings
    └── DetailPage.jsx      # Full listing details
```

## API Endpoints Expected

| Method | Path | Description |
|--------|------|-------------|
| GET | `/listings?limit=20&q=...` | Paginated listing search |
| GET | `/listings/:id` | Single listing detail |

## Features

- 📍 Location (Lat/Lng, formatted address)
- 📐 Size (m², bedrooms, bathrooms, floor)
- 🏗️ Amenities (elevator, parking, terrace)
- 🇦🇱 Albanian descriptions
- 🏠 Status (furnished, property type)
- Responsive grid layout
- Animated card entrance
- Glassmorphism dark theme
