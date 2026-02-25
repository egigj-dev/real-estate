# Frontend — React + Vite

## Stack

- **React 18** — UI
- **Vite 5** — dev server + build
- **React Bootstrap** — components
- **Bootstrap 5** — styling

## Structure

```
frontend/src/
├── api.js                 API calls + formatters
├── App.jsx                Routing (listings ↔ detail)
├── index.css              Global styles
├── components/
│   ├── AppNavbar.jsx
│   ├── FeatureBadges.jsx
│   ├── Hero.jsx
│   ├── ListingCard.jsx
│   └── SearchableList.jsx
└── pages/
    ├── ListingsPage.jsx   Browse + filter
    └── DetailPage.jsx     Listing detail + ML estimate + comps
```

## Setup

```bash
npm install
```

## Run

Make sure the backend is running on port 8000 first, then:

```bash
npm run dev
```

Open **http://127.0.0.1:5173**

> **WSL users:** use `127.0.0.1` not `localhost` in both the browser and `src/api.js`.

## Environment

The API base URL is set at the top of `src/api.js`:

```js
export const API_BASE = 'http://127.0.0.1:8000'
```

Change this if your backend runs on a different host or port.