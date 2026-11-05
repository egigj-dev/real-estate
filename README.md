# Tirana Real Estate

A local property browsing MVP with a FastAPI backend and a React interface. A fresh checkout runs with 48 explicitly synthetic listings. These are fictional fixtures, not scraped properties or evidence of Tirana market prices.

## Features and stack

- Search, numeric and amenity filters, price sorting, pagination and listing details.
- Comparable listings based on feature distance; no trained model required.
- Dataset price summaries through the market API.
- Optional XGBoost estimates, with an explicit unavailable state when no model is installed.
- Python, FastAPI, Pydantic, pandas, scikit-learn and XGBoost; React 18, Vite 5 and Bootstrap 5. No database required.

## Getting started

Use Python 3.12 and a current Node.js release (Node 26 was used for the API helper tests). From the repository root, install dependencies in an environment with package access:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

Start the API:

```bash
cd backend
PYTHONDONTWRITEBYTECODE=1 python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. The frontend defaults to `http://127.0.0.1:8000`; set `VITE_API_BASE` before starting Vite to use a different API URL. Stop servers with Ctrl+C.

These install and run steps were verified with Python 3.12 and Node 26, with Python dependencies installed from `backend/requirements.txt` by `uv pip`.

## Usage and data

Browse cards, set filters, and open a property to see details and comparables. If no trained model/scaler pair exists, details remain available and the estimate endpoint returns HTTP 503 with an explanation shown by the frontend.

The backend uses `backend/data/final_data.json` when present. Otherwise it logs that synthetic demo data is in use and loads the versioned `backend/demo/listings.json`. `USE_DEMO_DATA=1` explicitly selects the demo even when private data exists. `/health` exposes `data_source` (`demo` or `private`), row count, model availability and whether the model is synthetic. Restart the API after changing data, artifacts or environment variables.

Regenerate the demo deterministically from the repository root:

```bash
python3 backend/demo/generate.py
```

An optional small demo model can be trained in seconds. See [backend instructions](backend/README.md) for isolated artifact paths. Estimates from it carry `demo_model: true` and a visible UI notice. They have no measured real-world performance.

Real listings require the private processed dataset, which is not included. The original training workflow also requires private `backend/data/house_price.json`. Neither private data nor model binaries are versioned.

## API

All routes below use GET. Interactive documentation is at `http://127.0.0.1:8000/docs`.

| Path | Response |
| --- | --- |
| `/health` | Status, data source, count and model provenance |
| `/listings` | Filtered, paginated listing summaries |
| `/listings/{id}` | Listing detail; 404 for unknown IDs |
| `/listings/{id}/comps?n=5` | Up to n comparables, excluding the target |
| `/listings/{id}/estimate` | Price, fixed range, label and model provenance; 503 if unavailable |
| `/filters/options` | Available categorical values and numeric bounds |
| `/market/insights` | Dataset medians and cluster summaries |

Example: `/listings?neighborhood=Demo%20Block%20A&per_page=1` returns 12 demo matches. Filter parameters and bounds are described in [backend/README.md](backend/README.md).

## Testing

With backend dependencies plus pytest and httpx installed:

```bash
cd backend
PYTHONDONTWRITEBYTECODE=1 python -m pytest -p no:cacheprovider -q
```

From the repository root, frontend API helpers can be tested without node_modules:

```bash
node --test frontend/tests/api.test.mjs
```

Last verified: 131 backend tests and 6 frontend helper tests passed, and `npm ci` and `npm run build` succeeded. The built interface was exercised in headless Chromium at desktop and phone widths against the demo API, covering listings, the detail page and the missing-model state. Local API smoke tests covered browsing, filters, details, comparables, summaries, missing-model 503, unknown-ID 404, invalid-input 422 and labelled demo estimates.

## Limitations

The demo has no real coordinates; geographic distances are unavailable. Its prices, distances from a fictional center and clusters are fixtures. Market summaries describe the loaded dataset only. Cluster labels are internal groupings, not administrative neighborhoods. Addresses may be absent or extracted heuristically from descriptions. IDs are row positions and can change when the dataset changes.

The estimate range is a fixed ±8% band, not a calibrated confidence interval. `train_model.py` previously built its location clusters from price per square metre, which leaked the target. They now use coordinates only. On the notebook's listing dataset, this took the XGBoost test R² from 0.876 to 0.674, with RMSE going from about €39,500 to €64,100. Treat these as the honest scale of the model: estimates are rough and are not valuations. Price-based cleaning still runs before the split, and any previously trained model must be retrained. The full private workflow was not run end to end. This MVP has no authentication, listing editing or live data ingestion.
