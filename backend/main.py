"""
Real-Estate Backend — FastAPI
==============================
Stack : FastAPI + Pandas + Joblib  (no database, JSON in memory)

Dataset  : backend/data/tirana_house_prices.json  (4 505 records)
Model    : backend/model/model.joblib              (train with train_model.py)

Column normalisation (raw JSON → internal names)
-------------------------------------------------
  price_in_euro                                   → price
  main_property_property_composition_bedrooms     → beds
  main_property_property_composition_bathrooms    → baths
  main_property_property_square                   → sqm
  main_property_furnishing_status                 → furnishing_status
  main_property_location_city_zone_formatted_addr → address
  main_property_description_text_content_…        → description
  main_property_location_lat / _lng               → latitude / longitude
  main_property_floor                             → floor
  main_property_property_type                     → property_type
  main_property_property_status                   → property_status
  main_property_has_elevator / _garage / …        → has_*

Generated at load time
  id              → str(row_index)  after dropping nulls
  neighborhood    → first comma-segment of address
  furnished       → bool  (True = fully/partially furnished)

Run
---
  uvicorn main:app --reload --port 8000
"""

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
# Paths — override via env-vars if needed
# ---------------------------------------------------------------------------
DATA_PATH = Path(os.getenv("DATA_PATH", "data/tirana_house_prices.json"))
MODEL_PATH = Path(os.getenv("MODEL_PATH", "model/model.joblib"))

# ---------------------------------------------------------------------------
# Column rename map  (raw JSON key → internal short name)
# ---------------------------------------------------------------------------
_COL_MAP = {
    "price_in_euro":                                            "price",
    "main_property_property_composition_bedrooms":              "beds",
    "main_property_property_composition_bathrooms":             "baths",
    "main_property_property_square":                            "sqm",
    "main_property_furnishing_status":                          "furnishing_status",
    "main_property_location_city_zone_formatted_address":       "address",
    "main_property_description_text_content_original_text":     "description",
    "main_property_location_lat":                               "latitude",
    "main_property_location_lng":                               "longitude",
    "main_property_floor":                                      "floor",
    "main_property_property_type":                              "property_type",
    "main_property_property_status":                            "property_status",
    "main_property_has_elevator":                               "has_elevator",
    "main_property_has_parking_space":                          "has_parking",
    "main_property_has_carport":                                "has_carport",
    "main_property_has_garage":                                 "has_garage",
    "main_property_has_garden":                                 "has_garden",
    "main_property_has_terrace":                                "has_terrace",
    "main_property_property_composition_balconies":             "balconies",
    "main_property_property_composition_kitchens":              "kitchens",
    "main_property_property_composition_living_rooms":          "living_rooms",
    "main_property_location_city_zone_city_city_name":          "city",
    "main_property_price":                                      "price_local",
    "main_property_price_currency":                             "currency",
}

# Columns included in summary response
_SUMMARY_COLS = [
    "id", "price", "beds", "baths", "sqm",
    "furnished", "furnishing_status",
    "neighborhood", "address",
    "property_type", "floor",
    "latitude", "longitude",
]

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------
state: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Data loading & normalisation
# ---------------------------------------------------------------------------
def _extract_neighborhood(addr: Any) -> str:
    """First comma-segment of the formatted address, lower-cased and stripped."""
    if not isinstance(addr, str) or not addr.strip():
        return "unknown"
    segment = addr.split(",")[0].strip().lower()
    return segment or "unknown"


def _load_data(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".json":
        df = pd.read_json(path)
    else:
        df = pd.read_csv(path)

    df = df.rename(columns=_COL_MAP)

    # -1 is used as a sentinel for "unknown" in composition fields
    for col in ("beds", "baths", "balconies", "kitchens", "living_rooms"):
        if col in df.columns:
            df[col] = df[col].replace(-1, np.nan)

    # Coerce numeric columns
    for col in ("price", "sqm", "beds", "baths", "floor", "latitude", "longitude"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows where both price and sqm are unusable
    df = df.dropna(subset=["price", "sqm"]).reset_index(drop=True)

    # Fill remaining numeric nulls with 0 for beds/baths so filters work
    df["beds"] = df["beds"].fillna(0).astype(int)
    df["baths"] = df["baths"].fillna(0)

    # Boolean furnished flag  (fully + partially both count as True)
    _furnished_true = {"fully_furnished", "partially_furnished"}
    df["furnished"] = df["furnishing_status"].apply(
        lambda v: v in _furnished_true if isinstance(v, str) else False
    )

    # Neighbourhood derived from address
    df["neighborhood"] = df["address"].apply(_extract_neighborhood)

    # Generate stable string id after dropping rows
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

    # Model is optional — estimate endpoint returns 503 if absent
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
app = FastAPI(title="Real Estate API — Tirana", version="1.0.0", lifespan=lifespan)

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
    """Coerce numpy scalars and replace NaN/inf with None for JSON serialisation."""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    # numpy integer / float → plain Python
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
        "property_status", "property_type", "floor",
        "has_elevator", "has_parking", "has_carport",
        "has_garage", "has_garden", "has_terrace",
        "balconies", "kitchens", "living_rooms",
        "city", "currency",
    ):
        if col in row.index:
            detail[col] = _safe(row.get(col))
    return detail


# ---------------------------------------------------------------------------
# BE-2 — GET /listings
# ---------------------------------------------------------------------------
@app.get("/listings", summary="List & filter listings (paginated)")
def get_listings(
    min_price: float | None = Query(default=None),
    max_price: float | None = Query(default=None),
    min_beds: int   | None = Query(default=None),
    max_beds: int   | None = Query(default=None),
    min_baths: float | None = Query(default=None),
    max_baths: float | None = Query(default=None),
    min_sqm: float  | None = Query(default=None),
    max_sqm: float  | None = Query(default=None),
    furnished: bool | None = Query(default=None, description="true = fully or partially furnished"),
    neighborhood: str | None = Query(default=None, description="Case-insensitive substring match"),
    property_type: str | None = Query(default=None, description="apartment | house | villa …"),
    page: int     = Query(default=1,  ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    df = _df()
    mask = pd.Series(True, index=df.index)

    if min_price  is not None: mask &= df["price"].astype(float) >= min_price
    if max_price  is not None: mask &= df["price"].astype(float) <= max_price
    if min_beds   is not None: mask &= df["beds"].astype(int)   >= min_beds
    if max_beds   is not None: mask &= df["beds"].astype(int)   <= max_beds
    if min_baths  is not None: mask &= df["baths"].astype(float) >= min_baths
    if max_baths  is not None: mask &= df["baths"].astype(float) <= max_baths
    if min_sqm    is not None: mask &= df["sqm"].astype(float)  >= min_sqm
    if max_sqm    is not None: mask &= df["sqm"].astype(float)  <= max_sqm
    if furnished  is not None: mask &= df["furnished"] == furnished
    if neighborhood is not None:
        mask &= df["neighborhood"].str.contains(neighborhood.lower(), na=False)
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
    df = _df()
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
@app.get("/market/insights", summary="Price statistics by neighborhood")
def get_market_insights():
    df = _df().copy()
    df["price_per_sqm"] = df["price"] / df["sqm"].replace(0, np.nan)

    by_nb = (
        df.groupby("neighborhood")["price_per_sqm"]
        .agg(avg_price_per_sqm="mean", listing_count="count")
        .reset_index()
        .sort_values("avg_price_per_sqm", ascending=False)
    )

    neighborhoods = [
        {
            "neighborhood":       row["neighborhood"],
            "avg_price_per_sqm":  round(float(row["avg_price_per_sqm"]), 2),
            "listing_count":      int(row["listing_count"]),
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
