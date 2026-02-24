"""
Real-Estate Backend — FastAPI
==============================
Stack : FastAPI + Pandas + Joblib  (no database, JSON in memory)

Dataset  : backend/data/final_data.json   (4 127 records, column-oriented)
Model    : backend/model/model.joblib     (train with train_model.py)

Column normalisation (raw JSON → internal names)
-------------------------------------------------
  price_eur        → price
  area_sqm         → sqm
  bedrooms         → beds
  bathrooms        → baths
  lat              → latitude
  lng              → longitude
  (all other columns kept as-is)

Generated at load time
  id           → str(row_index)
  neighborhood → "Cluster {neighborhood_cluster}"
  furnished    → bool  (True = fully / partially furnished)

Run
---
  uvicorn main:app --reload --port 8000
"""

import json
import math
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from ml import get_comps, get_estimate

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_PATH  = Path(os.getenv("DATA_PATH",  "data/final_data.json"))
MODEL_PATH = Path(os.getenv("MODEL_PATH", "model/model.joblib"))

# ---------------------------------------------------------------------------
# Column rename map  (raw JSON key → internal short name)
# ---------------------------------------------------------------------------
_COL_MAP = {
    "price_eur":  "price",
    "area_sqm":   "sqm",
    "bedrooms":   "beds",
    "bathrooms":  "baths",
    "lat":        "latitude",
    "lng":        "longitude",
}

# Fields included in list/summary response
_SUMMARY_COLS = [
    "id", "price", "beds", "baths", "sqm",
    "furnished", "furnishing_status",
    "neighborhood", "neighborhood_cluster",
    "property_type", "floor",
    "latitude", "longitude",
    "price_per_sqm", "total_rooms",
]

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------
state: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Data loading & normalisation
# ---------------------------------------------------------------------------
def _load_data(path: Path) -> pd.DataFrame:
    with open(path) as f:
        raw = json.load(f)

    # Supports both column-oriented dict  {"col": {idx: val, …}, …}
    # and list of records                 [{col: val, …}, …]
    df = pd.DataFrame(raw)

    df = df.rename(columns=_COL_MAP)

    # Coerce numeric columns
    for col in ("price", "sqm", "beds", "baths", "floor",
                "latitude", "longitude",
                "neighborhood_cluster",
                "dist_to_nearest_center", "distance_from_center",
                "price_per_sqm", "total_rooms"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows where price or sqm are unusable
    df = df.dropna(subset=["price", "sqm"]).reset_index(drop=True)

    # Fill nulls in beds / baths so numeric filters always work
    df["beds"]  = df["beds"].fillna(0).astype(int)
    df["baths"] = df["baths"].fillna(0)

    # Boolean furnished flag  (fully + partially → True; unfurnished / unknown → False)
    _furnished_true = {"fully_furnished", "partially_furnished"}
    df["furnished"] = df["furnishing_status"].apply(
        lambda v: v in _furnished_true if isinstance(v, str) else False
    )

    # Neighborhood label derived from cluster id
    df["neighborhood"] = df["neighborhood_cluster"].apply(
        lambda c: f"Cluster {int(c)}" if pd.notna(c) else "Unknown"
    )

    # Stable string id
    df["id"] = df.index.astype(str)

    return df


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found at {DATA_PATH.resolve()}. "
            "Set the DATA_PATH env-var or place the file there."
        )

    df = _load_data(DATA_PATH)
    state["df"] = df
    print(f"[startup] Loaded {len(df)} listings from {DATA_PATH}")

    if MODEL_PATH.exists():
        import joblib
        state["model"] = joblib.load(MODEL_PATH)
        print(f"[startup] Model loaded from {MODEL_PATH}")
    else:
        state["model"] = None
        print(f"[startup] WARNING: no model at {MODEL_PATH} — run train_model.py first")

    yield
    state.clear()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Real Estate API — Tirana", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _df() -> pd.DataFrame:
    return state["df"]


def _model() -> Any:
    return state.get("model")


def _safe(val: Any) -> Any:
    """Coerce numpy scalars; replace NaN / inf with None for JSON."""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, np.integer):
        return int(val)
    if isinstance(val, np.floating):
        v = float(val)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(val, np.bool_):
        return bool(val)
    return val


def _row_to_summary(row: pd.Series) -> dict:
    return {col: _safe(row.get(col)) for col in _SUMMARY_COLS if col in row.index}


def _row_to_detail(row: pd.Series) -> dict:
    detail = _row_to_summary(row)
    detail["description"] = row.get("description", "")
    for col in (
        "property_status", "has_elevator", "has_parking_space",
        "has_carport", "has_garage", "has_garden", "has_terrace",
        "balconies", "living_rooms", "city",
        "dist_to_nearest_center", "distance_from_center",
    ):
        if col in row.index:
            detail[col] = _safe(row.get(col))
    return detail


# ---------------------------------------------------------------------------
# BE-2 — GET /listings
# ---------------------------------------------------------------------------
@app.get("/listings", summary="List & filter listings (paginated)")
def get_listings(
    min_price:     float | None = Query(default=None),
    max_price:     float | None = Query(default=None),
    min_beds:      int   | None = Query(default=None),
    max_beds:      int   | None = Query(default=None),
    min_baths:     float | None = Query(default=None),
    max_baths:     float | None = Query(default=None),
    min_sqm:       float | None = Query(default=None),
    max_sqm:       float | None = Query(default=None),
    furnished:     bool  | None = Query(default=None, description="true = fully or partially furnished"),
    neighborhood:  str   | None = Query(default=None, description="'Cluster 0', 'Cluster 1', or 'Cluster 2'"),
    property_type: str   | None = Query(default=None),
    page:     int = Query(default=1,  ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    df   = _df()
    mask = pd.Series(True, index=df.index)

    if min_price     is not None: mask &= df["price"].astype(float) >= min_price
    if max_price     is not None: mask &= df["price"].astype(float) <= max_price
    if min_beds      is not None: mask &= df["beds"].astype(int)    >= min_beds
    if max_beds      is not None: mask &= df["beds"].astype(int)    <= max_beds
    if min_baths     is not None: mask &= df["baths"].astype(float) >= min_baths
    if max_baths     is not None: mask &= df["baths"].astype(float) <= max_baths
    if min_sqm       is not None: mask &= df["sqm"].astype(float)   >= min_sqm
    if max_sqm       is not None: mask &= df["sqm"].astype(float)   <= max_sqm
    if furnished     is not None: mask &= df["furnished"] == furnished
    if neighborhood  is not None:
        mask &= df["neighborhood"].str.lower() == neighborhood.lower()
    if property_type is not None:
        mask &= df["property_type"].str.lower() == property_type.lower()

    filtered = df[mask]
    total    = len(filtered)
    offset   = (page - 1) * per_page
    page_df  = filtered.iloc[offset: offset + per_page]

    return {
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "pages":    math.ceil(total / per_page) if total else 0,
        "listings": [_row_to_summary(row) for _, row in page_df.iterrows()],
    }


# ---------------------------------------------------------------------------
# BE-3 — GET /listings/{id}
# ---------------------------------------------------------------------------
@app.get("/listings/{listing_id}", summary="Full listing detail")
def get_listing(listing_id: str):
    df   = _df()
    mask = df["id"] == listing_id
    if not mask.any():
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")
    return _row_to_detail(df[mask].iloc[0])


# ---------------------------------------------------------------------------
# BE-4 — GET /listings/{id}/estimate
# ---------------------------------------------------------------------------
@app.get("/listings/{listing_id}/estimate", summary="ML price estimate")
def get_listing_estimate(listing_id: str):
    model = _model()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run train_model.py to generate model/model.joblib.",
        )
    try:
        result = get_estimate(listing_id, _df(), model)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Estimation error: {exc}")
    return result


# ---------------------------------------------------------------------------
# BE-5 — GET /listings/{id}/comps
# ---------------------------------------------------------------------------
@app.get("/listings/{listing_id}/comps", summary="Top-5 comparable listings")
def get_listing_comps(listing_id: str):
    try:
        comps = get_comps(listing_id, _df(), n=5)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Comps error: {exc}")
    return {"listing_id": listing_id, "comps": comps}


# ---------------------------------------------------------------------------
# BE-6 — GET /market/insights  (Bonus)
# ---------------------------------------------------------------------------
@app.get("/market/insights", summary="Price statistics by neighborhood cluster")
def get_market_insights():
    df = _df().copy()
    df["price_per_sqm"] = df["price"] / df["sqm"].replace(0, np.nan)

    by_nb = (
        df.groupby("neighborhood")
        .agg(
            avg_price_per_sqm=("price_per_sqm", "mean"),
            avg_price=("price", "mean"),
            listing_count=("price", "count"),
        )
        .reset_index()
        .sort_values("avg_price_per_sqm", ascending=False)
    )

    neighborhoods = [
        {
            "neighborhood":      row["neighborhood"],
            "avg_price_per_sqm": round(float(row["avg_price_per_sqm"]), 2),
            "avg_price":         round(float(row["avg_price"]), 2),
            "listing_count":     int(row["listing_count"]),
        }
        for _, row in by_nb.iterrows()
        if not math.isnan(row["avg_price_per_sqm"])
    ]

    return {
        "overall_median_price":         round(float(df["price"].median()), 2),
        "overall_median_price_per_sqm": round(float(df["price_per_sqm"].median(skipna=True)), 2),
        "neighborhood_count":           len(neighborhoods),
        "neighborhoods":                neighborhoods,
    }
