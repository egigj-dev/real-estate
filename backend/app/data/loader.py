"""
Loads the dataset and model exactly once (singleton via lru_cache).
All routers and services call get_df() / get_model() through FastAPI Depends().
"""

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.config import DATA_PATH, MODEL_PATH

# Raw JSON column → internal name
_COL_MAP = {
    "price_eur": "price",
    "area_sqm":  "sqm",
    "bedrooms":  "beds",
    "bathrooms": "baths",
    "lat":       "latitude",
    "lng":       "longitude",
}

_FURNISHED_TRUE = {"fully_furnished", "partially_furnished"}


def _load_and_clean(path: Path) -> pd.DataFrame:
    with open(path) as f:
        raw = json.load(f)

    df = pd.DataFrame(raw).rename(columns=_COL_MAP)

    # ── numeric coercion ────────────────────────────────────────────────────
    numeric_cols = (
        "price", "sqm", "beds", "baths", "floor",
        "latitude", "longitude",
        "neighborhood_cluster", "dist_to_nearest_center",
        "distance_from_center", "price_per_sqm", "total_rooms",
        "balconies", "living_rooms",
    )
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # ── drop unusable rows ──────────────────────────────────────────────────
    df = df.dropna(subset=["price", "sqm"]).reset_index(drop=True)

    # ── fill sensible defaults ──────────────────────────────────────────────
    df["beds"]  = df["beds"].fillna(0).astype(int)
    df["baths"] = df["baths"].fillna(0)

    # ── derived columns ─────────────────────────────────────────────────────
    df["furnished"] = df["furnishing_status"].apply(
        lambda v: v in _FURNISHED_TRUE if isinstance(v, str) else False
    )
    df["furnished_numeric"] = df["furnished"].astype(float)

    df["neighborhood"] = df["neighborhood_cluster"].apply(
        lambda c: f"Cluster {int(c)}" if pd.notna(c) else "Unknown"
    )

    # ── stable string id ────────────────────────────────────────────────────
    df["id"] = df.index.astype(str)

    return df


@lru_cache(maxsize=1)
def get_df() -> pd.DataFrame:
    """Return the cached, cleaned DataFrame. Loaded once at first call."""
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_PATH.resolve()}. "
            "Set DATA_PATH env-var or place final_data.json in backend/data/."
        )
    df = _load_and_clean(DATA_PATH)
    print(f"[loader] {len(df)} listings loaded from {DATA_PATH}")
    return df


@lru_cache(maxsize=1)
def get_model() -> Any | None:
    """Return the cached sklearn model, or None if not yet trained."""
    if not MODEL_PATH.exists():
        print(f"[loader] WARNING: model not found at {MODEL_PATH} — run train_model.py")
        return None
    import joblib
    model = joblib.load(MODEL_PATH)
    print(f"[loader] Model loaded from {MODEL_PATH}")
    return model
