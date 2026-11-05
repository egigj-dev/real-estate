# Backend

FastAPI serves listings, comparable properties, dataset summaries and optional XGBoost estimates. pandas loads a single JSON dataset into memory; data and model loaders cache their results until restart.

## Setup and run

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cd backend
PYTHONDONTWRITEBYTECODE=1 python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The run command was smoke-tested using preinstalled dependencies. Installation could not be verified offline because the supplied interpreter has no pip. No training is required to browse the demo. Open `/docs` for the interactive API schema and `/health` for loaded data/model status.

## Data and configuration

| Environment variable | Default / meaning |
| --- | --- |
| `DATA_PATH` | `backend/data/final_data.json`; processed private JSON |
| `USE_DEMO_DATA` | `1`, `true` or `yes` forces synthetic demo data |
| `MODEL_PATH` | `backend/model/model.joblib` |
| `SCALER_PATH` | `scaler.joblib` beside `MODEL_PATH` |
| `CORS_ORIGINS` | Comma-separated allowed browser origins; includes localhost and 127.0.0.1 on port 5173 |

Paths above are resolved relative to the backend source directory by default; explicit relative overrides are relative to the launch directory. A missing configured dataset falls back to `demo/listings.json`. An existing malformed dataset is not silently replaced. Demo use emits a warning and `/health` returns `data_source: "demo"`. An existing configured dataset is reported as `private`; this describes the selection path, not verified provenance of arbitrary user-supplied files.

`demo/generate.py` deterministically generates 48 fictional rows. Generic addresses, descriptions, prices and engineered features are synthetic. Coordinates are intentionally absent. Generate from the repository root with `python3 backend/demo/generate.py`.

Processed records use `price_eur`, `area_sqm`, `bedrooms`, `bathrooms`, `furnishing_status`, `description`, `neighborhood_cluster` and the optional detail/feature fields illustrated by the demo JSON. The loader renames numeric fields for API responses, derives furnishing flags and cluster labels, preserves supplied addresses, and otherwise attempts address extraction from descriptions. An unresolved address is `null`.

## Optional demo model

From `backend/`, with dependencies installed:

```bash
PYTHONDONTWRITEBYTECODE=1 MODEL_PATH=/tmp/real-estate-demo-model/model.joblib python train_model.py --demo
USE_DEMO_DATA=1 MODEL_PATH=/tmp/real-estate-demo-model/model.joblib python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

These commands were run in offline verification. The small XGBoost model trains on all demo rows for interface demonstration only. Training prints no performance metrics, does not modify private data, and tags the artifact so `/health` and estimates return `demo_model: true`. The frontend labels these estimates as synthetic. The separate path above avoids replacing private artifacts. Restart the API to load newly generated files.

A model and its matching scaler are both required. If either is absent, `/listings/{id}/estimate` returns 503. An unknown listing returns 404 even without a model.

## Private training workflow

`python train_model.py` retains the original workflow: read `data/house_price.json`, clean and engineer features, train XGBoost, then write `data/final_data.json`, `model/model.joblib` and `model/scaler.joblib`. It requires the private raw dataset and was not verified here. This original mode uses its fixed paths; the artifact environment overrides apply to demo training and API loading.

The private pipeline prints evaluation statistics when run. No model metrics are asserted here. Location clusters use coordinates only, so that price is not a model input, and earlier models trained with price-derived clusters must be retrained. Do not present estimates as market valuations.

## API usage

All endpoints use GET:

| Path | Behavior |
| --- | --- |
| `/health` | Status, listing count, `data_source`, `model_loaded`, `demo_model` |
| `/listings` | Summaries in `{total, page, per_page, pages, listings}` |
| `/listings/{id}` | Detail or 404 |
| `/listings/{id}/estimate` | Estimate, fixed ±8% band, comparison label, `demo_model`; unavailable model returns 503 |
| `/listings/{id}/comps` | Feature-nearest candidates; optional `n`, default 5, valid range 1–100 |
| `/filters/options` | Dropdown choices and numeric ranges |
| `/market/insights` | Dataset medians and cluster averages/counts |

Listing filters: literal text `q`; `min_`/`max_` pairs for `price`, `sqm`, `beds`, `baths`; booleans `furnished`, `has_elevator`, `has_parking_space`, `has_garden`; `property_type`; `neighborhood` (cluster label or address/description substring). Numeric bounds must be finite and nonnegative; bed bounds are integers. `sort` accepts `price_asc` or `price_desc`.

`page` starts at 1; `per_page` defaults to 20 and accepts 1–100. Invalid parameters return 422. Reversed numeric ranges and unmatched filters return empty results. Pages past the end return an empty list. Comparables never include the target and may contain fewer than n rows.

## Testing and limits

Install pytest and httpx in addition to runtime requirements. From `backend/`:

```bash
PYTHONDONTWRITEBYTECODE=1 python -m pytest -p no:cacheprovider -q
```

Offline result: 131 passed. Existing tests and fixtures were retained unchanged. Added regressions cover optional addresses, deterministic generation, data source selection, missing artifacts, model provenance, feature names, input bounds and unknown IDs. Upstream deprecation warnings and feature-name warnings from the existing synthetic scaler fixture remain.

Demo browsing, filters, details, comparables and summaries work without private files or training. Data summaries and demo predictions are not real market evidence. The fixed estimate band is not a confidence interval; comparable rankings are feature distances, not appraisals. Missing coordinates yield `Distance unavailable`. Data is loaded into memory, IDs follow row order, and changes require restart.
