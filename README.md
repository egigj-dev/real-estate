# Tirana Real Estate — ML-Powered Property Platform

A full-stack real estate platform for Tirana, Albania. Browse 4,000+ property listings with **ML-powered price estimation**, **neighborhood-based predictions**, **comparable listings**, and **interactive maps**.

### Architecture

```
real-estate/
├── backend/          ← FastAPI + XGBoost (Python)
├── frontend/         ← React + Vite + Tailwind (JSX)
└── nextapp/          ← Next.js admin dashboard (TypeScript)
```

### Backend — FastAPI + XGBoost

**7 API endpoint groups:**

| Route | Description |
|-------|-------------|
| `GET /listings` | Paginated, filtered listings (price, beds, sqm, zone, amenities) |
| `GET /listings/{id}` | Full listing detail |
| `GET /listings/{id}/estimate` | ML price estimate with cluster-specific error bands |
| `GET /listings/{id}/comps` | 5 most similar properties |
| `POST /predict/by-zone` | Price prediction per neighborhood zone |
| `POST /suggest` | Find best matching listings from feature description |
| `POST /chat/parse` | Natural language → structured property features |
| `GET /market/insights` | Price statistics by neighborhood |
| `GET /filters/options` | Dynamic filter dropdown values |
| `GET /areas` | OSM sub-area polygons for the map |

**ML Pipeline:**
- **XGBoost** price regression trained on 4,000+ Tirana listings
- **Features**: sqm, floor, bedrooms, bathrooms, elevator, parking, distance from city center, KMeans neighborhood clusters
- **Haversine distance** for spatial feature engineering
- **Two-phase training** with proper 70/15/15 split
- **Cluster-specific error bands** — each zone has its own uncertainty estimate
- **Growth projections** — INSTAT-sourced ~5-7.5% annual appreciation per zone

### Frontend — React/Vite SPA

7 pages with Leaflet maps, ECharts visualizations, and responsive design.

| Page | Description |
|------|-------------|
| **Overview** | Dashboard with key metrics and quick-search |
| **Explore** | Browse & filter listings with cards |
| **Map** | Interactive map with zone polygons |
| **Find** | Feature-based property search ("3-bedroom with parking near Blloku") |
| **Predict** | Zone-by-zone price prediction for custom property specs |
| **Insights** | Market analytics by neighborhood |
| **Detail** | Full property detail with estimate, comps, and map |

### Dashboard — Next.js (TypeScript)

Admin dashboard with the same pages in TypeScript + shadcn UI components.

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt

# Train the model (one-time)
python train_model.py

# Start the API
uvicorn main:app --reload --port 8000
```

Open **http://localhost:8000/docs** for interactive API docs.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

### Dashboard

```bash
cd nextapp
npm install
npm run dev
```

Open **http://localhost:3000**.

## System Design

### Key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **ML model** | XGBoost Regressor | Best for tabular data, handles missing values, fast inference |
| **API framework** | FastAPI | Async support, automatic OpenAPI docs, Pydantic validation |
| **Data storage** | JSON files (static) + model.joblib | Simple for current scale; PostgreSQL planned |
| **Frontend** | React + Vite | Fast dev experience, no SSR complexity needed |
| **Dashboard** | Next.js | SSR for SEO, TypeScript for type safety |
| **Maps** | Leaflet + OSM | Free, no API key needed for basic use |
| **Caching** | `lru_cache` singleton | Models/data loaded once in memory |

### Planned enhancements

- **PostgreSQL** — replace JSON storage with proper database
- **Redis** — cache popular queries, rate limiting
- **Celery/ARQ** — async model retraining, batch scraping
- **Scraping pipeline** — daily data from merrjep.al, njoftime.al
- **Alembic** — database migrations
- **Docker Compose** — full stack orchestration
- **Prometheus** — API monitoring

## 📊 Dataset

- **Source**: Scraped from Albanian real estate portals
- **Listings**: 4,000+ properties in Tirana
- **Features**: Price, sqm, bedrooms, bathrooms, floor, elevator, parking, garden, terrace, coordinates, property type, furnishing status
- **Zones**: 6 KMeans-clustered neighborhoods with OSM sub-areas

## 🛠️ Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.10+, FastAPI, XGBoost, scikit-learn, Pandas |
| **Frontend** | React 18, Vite, Tailwind CSS, Leaflet, ECharts |
| **Dashboard** | Next.js, TypeScript, Tailwind, shadcn UI |
| **ML** | XGBoost, scikit-learn, joblib, NumPy |
| **NLP** | Keyword + Claude API natural language parsing |

## 📄 License

MIT