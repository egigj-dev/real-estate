# Tirana Real Estate Explorer

An Albanian-language web app for apartment-for-sale listings in Tirana. It lets a buyer browse and filter listings, compare an asking price with a machine-learning estimate and with similar listings, value a hypothetical apartment in each part of the city, and compare prices across zones.

The data are **asking prices** from 4,148 listings collected once, on a date that wasn't recorded. They aren't transaction prices, and they can't show trends over time.

```
real-estate/
├── backend/   FastAPI service and the two XGBoost models (Python)
├── nextapp/   The web app: Next.js, TypeScript, Tailwind CSS
└── docs/      Frontend audit and redesign log
```

## Run it

You need Python 3.10+ and Node.js 20+.

### 1. API (port 8000)

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000
```

The listing data and trained models are private and aren't in this repository. If you have them, put the data in `backend/data/` and either copy the trained files into `backend/model/` or train them with `.venv/bin/python train_model.py`. Without them the API runs on 48 fictional demo listings (see [Fresh clone](#fresh-clone)).

API documentation: http://localhost:8000/docs

### 2. Web app (port 3000)

```bash
cd nextapp
npm ci
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev
```

Open http://localhost:3000. `NEXT_PUBLIC_API_URL` defaults to `http://127.0.0.1:8000`, so you can leave it out when the API is on that port. For a production build, run `npm run build && npm start`. The API URL is fixed at build time.

If you serve the app from another port, allow it in the API with, for example, `CORS_ORIGINS=http://localhost:3100`.

## Pages

| Path | Page | What it answers |
|---|---|---|
| `/` | Përmbledhje | Key figures, a map of median price per m², and the six pricing zones |
| `/pronat` | Eksploro pronat | What's for sale. Filters live in the URL; list or map view; optional plain-language description |
| `/pronat/[id]` | Listing | Is the asking price reasonable? Model estimate, measured error, comparables, location |
| `/vleresimi` | Vlerëso pronën | What would this apartment be listed at in each zone? |
| `/tregu` | Analiza e tregut | Medians and spread by zone, bedrooms, size, distance and amenities |
| `/rreth-te-dhenave` | Rreth të dhënave | The data, the models, their error and their limits |

Old paths (`/explore`, `/map`, `/find`, `/predict`, `/insights`, `/listings/:id`) redirect to these.

## Models

Two XGBoost models predict the asking price:

- **Property model:** structured features only (size, rooms, floor, amenities, furnishing, location). The valuation page uses it.
- **Listing model:** the same features plus a text-based prediction from the description. The listing pages use it.

Accuracy is measured with grouped five-fold cross-fitting. Every listing is estimated by a model that didn't see it in training, and duplicate listings or identical descriptions are always kept in the same fold. The estimate shown on a listing's page is that held-out estimate.

| Measured on 4,148 listings | Listing model | Property model |
|---|---|---|
| Median absolute percentage error | 13.4% | 15.2% |
| Within ±10% | 39% | 35% |
| Within ±20% | 67% | 62% |
| R² | 0.77 | 0.70 |

The band around an estimate is the 75th percentile of held-out error in that pricing zone. It describes past error; it isn't a prediction interval.

**Pricing zones:** six KMeans clusters on location, named and ordered by price. They aren't official boundaries.

## API

| Route | Use in the app |
|---|---|
| `GET /listings`, `GET /listings/{id}` | Explore, listing pages, and all statistics (aggregated in the browser) |
| `GET /listings/{id}/estimate` | Asking price against the held-out estimate |
| `GET /listings/{id}/comps` | Five most similar listings |
| `POST /predict/by-zone` | Valuation. It also returns growth figures from assumed rates, which the app doesn't show |
| `POST /chat/parse` | Plain-language search. Uses Claude when `ANTHROPIC_API_KEY` is set, otherwise keyword rules |
| `GET /filters/options`, `GET /health` | Filter options; data source and model metrics |
| `POST /suggest`, `GET /market/insights`, `GET /areas` | Not used by the current app |

## Fresh clone

If `backend/data/final_data.json` is missing, or `USE_DEMO_DATA=1` is set, the API loads the synthetic listings in `backend/demo/listings.json` and `/health` reports `data_source: "demo"`. The app shows a notice on every page.

Without a trained model, estimates and valuations return HTTP 503 with an explanation, and the app says they're unavailable. Demo listings have no coordinates, so the maps explain why they're empty.

## Tests

```bash
cd backend && .venv/bin/python -m pytest -q
cd nextapp && npm test && npm run typecheck
```

## Limitations

- **Prices:** asking prices from a single, undated snapshot; no sales prices and no trends.
- **Sources:** the listings carry no addresses, URLs or source names. The project's earlier notes say they were collected from Albanian property portals.
- **What the model can't see:** condition, view, build quality, age and paperwork.
- **External services:** nearby places on a listing page come from the public Overpass API (OpenStreetMap), which can be slow or incomplete. Map tiles also come from OpenStreetMap.

## License

MIT
