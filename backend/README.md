# Backend — FastAPI + XGBoost

REST API for the Tirana Real Estate platform with ML-powered price estimation.

## Stack

- **FastAPI** — REST framework with automatic OpenAPI docs
- **XGBoost** — Price prediction model
- **scikit-learn** — StandardScaler, KMeans clustering
- **Pandas** — Data handling and feature engineering
- **Pydantic** — Request/response validation
- **HTTPX** — Claude API integration for NL parsing

## Structure

```
backend/
├── main.py                  Entry point
├── ml.py                    ML utilities (estimate, comps, suggest, price-by-zone)
├── train_model.py           Model training pipeline
├── data_cleaner.py          Data cleaning chain
├── extractors.py            Feature extraction helpers
├── assign_areas.py          OSM area assignment script
├── debug_zones.py           Zone debugging utility
├── explore_clusters.py      Cluster exploration
├── patch_filter.py          Filter patching
├── app/
│   ├── config.py            Paths, CORS, constants
│   ├── data/
│   │   ├── loader.py        DataFrame + model singleton (lru_cache)
│   │   └── areas.py         OSM sub-area polygons
│   ├── routers/
│   │   ├── listings.py      CRUD + search + OSM areas
│   │   ├── estimates.py     ML price estimate per listing
│   │   ├── comps.py         Comparable listings
│   │   ├── market.py        Market insights by neighborhood
│   │   ├── predict.py       Zone-based price prediction
│   │   ├── suggest.py       Feature-based property suggestions
│   │   └── chat.py          Natural language → features
│   ├── schemas/             Pydantic models
│   └── services/            Business logic (no HTTP)
├── data/
│   ├── house_price.json     Raw scraped data
│   └── final_data.json      Cleaned + processed data
├── model/
│   ├── model.joblib         Trained XGBoost
│   ├── scaler.joblib        StandardScaler
│   ├── price_bands.joblib   Per-cluster error bands
│   └── zone_config.joblib   Zone names config
└── tests/
    ├── conftest.py
    ├── test_listings.py
    ├── test_market.py
    ├── test_ml.py
    └── test_services.py
```

## Setup

```bash
# Create virtualenv
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Train the model (one-time, before first run)
python train_model.py

# Start the API
uvicorn main:app --reload --port 8000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | API + model status |
| GET | `/listings` | Paginated, filtered listings |
| GET | `/listings/{id}` | Single listing detail |
| GET | `/listings/{id}/estimate` | ML price estimate with fair/overpriced/underpriced label |
| GET | `/listings/{id}/comps` | 5 comparable listings |
| POST | `/predict/by-zone` | Per-zone price prediction for custom features |
| POST | `/suggest` | Find best matching listings from feature description |
| POST | `/chat/parse` | Natural language → structured features |
| GET | `/market/insights` | Price stats by neighborhood |
| GET | `/filters/options` | Available filter dropdown values |
| GET | `/areas` | OSM sub-area polygons for map |

Interactive docs at **http://127.0.0.1:8000/docs**

## ML Model

### Training pipeline

```
Raw JSON → Clean → Feature engineer → Encode → Scale → XGBoost train
```

**Key features:**
- `area_sqm`, `floor`, `bedrooms`, `bathrooms`, `has_elevator`, `has_parking_space`
- `distance_from_center` (Haversine to Tirana center)
- `neighborhood_cluster` (KMeans on lat/lng + price_per_sqm)
- `dist_to_nearest_center`, `total_rooms`

**Training:**
- XGBoost with tuned params: `max_depth=7`, `subsample=0.8`, `learning_rate=0.01`
- Targets log-transformed prices: `np.log1p(price_eur)`
- Early stopping at 50 rounds

### Inference

```
Features → StandardScaler → XGBoost predict → np.expm1 → EUR price
```

Each cluster has its own error bands (p75 relative error) for fair range estimation.
Labels: **Fair** / **Overpriced** / **Underpriced** based on cluster-specific threshold.

## Run Tests

```bash
pytest -v
```

## Model evaluation

Each listing's error was measured with a model that never saw it: grouped 5-fold cross-fitting over the 4,148 cleaned listings. Listings that are exact duplicates, or share an identical description once numbers are removed, form one group, giving 3,913 groups, and a group never spans the training and test sides. Location zones, the text model and both XGBoost models are refitted inside every fold. Trained 2026-11-06.

| Model | MAE | Median error | Mean error | R² | Within 10% | Within 20% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Listing | €33,786 | 13.4% | 18.9% | 0.771 | 38.9% | 67.4% |
| Property | €39,424 | 15.2% | 22.6% | 0.699 | 34.9% | 61.6% |

- **Listing model:** estimates and Fair/Overpriced labels on listing pages. It adds the listing's description, with all numbers removed, to the property features. Each listing page shows its held-out estimate, so no listing is scored by a model trained on its own price.
- **Property model:** Predict, Find and zone prices, from the features a user can enter.

These are asking prices, so the models estimate asking prices, not sale prices. The cleaner drops listings it treats as outliers using statistics over all listings, so these figures describe listings that pass it.


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
