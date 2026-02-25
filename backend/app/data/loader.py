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

# Tirana city centre coordinates
_CENTRE_LAT = 41.3275
_CENTRE_LNG = 19.8187

# Zone names assigned by ranking clusters from closest → furthest from centre.
# KMeans cluster IDs (0/1/2) are arbitrary, so we sort by mean distance.
_ZONE_NAMES = ["Qendra & Blloku", "Komuna e Parisit", "Periferia"]


def _assign_zone_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    Replace 'Cluster X' labels with real Tirana zone names.

    Strategy: compute each cluster's mean distance from the city centre,
    sort ascending, then assign zone names in that order so the innermost
    cluster always gets 'Qendra & Blloku' regardless of KMeans run order.
    """
    if "neighborhood_cluster" not in df.columns:
        df["neighborhood"] = "E panjohur"
        return df

    if "distance_from_center" in df.columns:
        mean_dist = (
            df.groupby("neighborhood_cluster")["distance_from_center"]
            .mean()
            .sort_values()          # closest first
        )
    else:
        # Fallback: compute haversine distance from coordinates
        if {"latitude", "longitude"}.issubset(df.columns):
            df["_dist_tmp"] = df.apply(
                lambda r: _haversine(
                    _CENTRE_LAT, _CENTRE_LNG,
                    r["latitude"], r["longitude"]
                ) if pd.notna(r["latitude"]) else np.nan,
                axis=1,
            )
            mean_dist = (
                df.groupby("neighborhood_cluster")["_dist_tmp"]
                .mean()
                .sort_values()
            )
            df.drop(columns=["_dist_tmp"], inplace=True)
        else:
            # No location data — fall back to cluster number order
            clusters = sorted(df["neighborhood_cluster"].dropna().unique())
            mean_dist = pd.Series(range(len(clusters)), index=clusters)

    # Build mapping: cluster_id → zone name
    zone_map = {
        float(cluster_id): _ZONE_NAMES[i] if i < len(_ZONE_NAMES) else f"Zonë {i+1}"
        for i, cluster_id in enumerate(mean_dist.index)
    }

    df["neighborhood"] = df["neighborhood_cluster"].apply(
        lambda c: zone_map.get(float(c), "E panjohur") if pd.notna(c) else "E panjohur"
    )
    return df


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(max(0.0, min(1.0, a))))


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

    # ── meaningful zone names (replaces "Cluster X") ─────────────────────
    df = _assign_zone_names(df)

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