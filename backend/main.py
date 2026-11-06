"""
main.py — FastAPI entry-point
------------------------------
Run:  uvicorn main:app --reload --port 8000

Architecture
------------
  main.py                 ← this file (app factory + health)
  app/config.py           ← paths, CORS, constants
  app/data/loader.py      ← singleton DataFrame + model (lru_cache)
  app/routers/            ← one file per resource group
  app/schemas/            ← Pydantic request/response models
  app/services/           ← pure business logic (no HTTP)
  ml.py                   ← ML utilities (estimate, comps)
"""

import json
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.data.loader import get_df, get_model
from app.routers import comps, estimates, listings, market, suggest, predict, chat


# ---------------------------------------------------------------------------
# Lifespan — pre-warm caches so the first real request is fast.
# Non-fatal: test environments won't have the data/model files.
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        df    = get_df()
        model = get_model()
        status = "ready" if model else "no model — run train_model.py"
        print(f"[startup] {len(df)} listings loaded. Model: {status}")
    except FileNotFoundError as exc:
        print(f"[startup] WARNING — {exc}")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Real Estate API — Tirana",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(listings.router)          # GET /listings, GET /listings/{id}
app.include_router(listings.filters_router)  # GET /filters/options
app.include_router(listings.areas_router)    # GET /areas
app.include_router(estimates.router)         # GET /listings/{id}/estimate
app.include_router(comps.router)             # GET /listings/{id}/comps
app.include_router(market.router)            # GET /market/insights
app.include_router(suggest.router)           # POST /suggest
app.include_router(predict.router)           # POST /predict/by-zone
app.include_router(chat.router)              # POST /chat/parse


# ---------------------------------------------------------------------------
# Health — uses Depends so test dependency_overrides apply automatically
# ---------------------------------------------------------------------------
METRICS_PATH = Path(__file__).resolve().parent / "model" / "metrics.json"


@app.get("/health", tags=["Health"])
def health(df=Depends(get_df), model=Depends(get_model)):
    # Accuracy describes the installed model; report none when no model is loaded.
    metrics = json.loads(METRICS_PATH.read_text()) if model is not None and METRICS_PATH.exists() else None
    return {
        "status":          "ok",
        "data_source":     df.attrs.get("data_source", "private"),
        "model_metrics":   metrics,
        "listings_loaded": len(df),
        "model_loaded":    model is not None,
    }
