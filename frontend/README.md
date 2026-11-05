# Frontend

React 18, Vite 5 and React Bootstrap provide a listing search page and a detail page. Search supports price, size, bedrooms, bathrooms, furnishing, amenities, location text and price sorting. Details show listing attributes, comparable properties and an optional model estimate.

## Getting started

Start the backend on `127.0.0.1:8000` using the [backend instructions](../backend/README.md). From `frontend/`:

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. Dependency installation was attempted with `npm ci --offline` but packages were not cached. `npm run build` could not run because Vite was unavailable; the production build and browser rendering have not been verified.

## Configuration and usage

`src/api.js` defaults to `http://127.0.0.1:8000`. To use another backend, set `VITE_API_BASE` before starting Vite, for example `VITE_API_BASE=http://127.0.0.1:18082 npm run dev`. Add the frontend origin to the backend's `CORS_ORIGINS` if changing the frontend port.

The app reads `/health` and displays a synthetic-data notice when `data_source` is `demo`. Card and detail titles tolerate absent addresses, falling back to property type, city or a generic label. Open a card to see details and click a comparable to navigate to it.

A missing model returns an explained unavailable state while listing details remain usable. Estimates marked `demo_model: true` display a synthetic-model notice. Synthetic prices and estimates do not describe the Tirana market. The market insights endpoint is available through the API; the frontend has no separate market dashboard.

## API and tests

The interface uses `/health`, `/listings`, `/listings/{id}`, `/listings/{id}/estimate` and `/listings/{id}/comps`. It uses query parameters matching the backend listing filters and paginated response structure. See `/docs` on the backend for the full API.

Run the API helper regressions from the repository root with Node.js 22 or later, without installing frontend dependencies:

```bash
node --test frontend/tests/api.test.mjs
```

Offline result: 6 passed. These cover address fallbacks, estimate error propagation and demo model provenance. They do not verify React rendering or interaction. When dependencies are available, `npm run build` creates a production bundle and `npm run preview` serves it locally; those steps remain unverified.
