"""
ML utilities: price estimation and comparable listings.

Expected columns (after main.py normalisation):
    id, price, beds, baths, sqm, furnished,
    neighborhood_cluster, dist_to_nearest_center,
    latitude (optional), longitude (optional)

Expected model:
    A sklearn-compatible regressor saved with joblib.
    Input shape: (n, 6) →
        [beds, baths, sqm, furnished_numeric,
         neighborhood_cluster, dist_to_nearest_center]
    If your model uses different features adjust FEATURE_COLS below.
"""

import math
from typing import Any

import numpy as np
import pandas as pd

# Columns fed into model.predict(). Must match what the model was trained on.
FEATURE_COLS = [
    "beds", "baths", "sqm", "furnished_numeric",
    "neighborhood_cluster", "dist_to_nearest_center",
]

# Thresholds for Fair / Overpriced / Underpriced labels
OVERPRICED_THRESHOLD = 1.10   # actual > estimated × 1.10
UNDERPRICED_THRESHOLD = 0.90  # actual < estimated × 0.90

# Symmetric confidence band returned as range_low / range_high
RANGE_BAND = 0.08  # ±8 %


def _furnished_numeric(df: pd.DataFrame) -> pd.Series:
    """Convert furnished column (bool, 0/1, or 'Yes'/'No') to 0.0 / 1.0."""
    col = df["furnished"]
    if pd.api.types.is_bool_dtype(col):
        return col.astype(float)
    if pd.api.types.is_numeric_dtype(col):
        return col.astype(float)
    return col.str.strip().str.lower().map({"yes": 1.0, "true": 1.0, "1": 1.0}).fillna(0.0)


def _build_feature_matrix(df: pd.DataFrame) -> np.ndarray:
    """Return a (n, len(FEATURE_COLS)) float array for model inference / similarity."""
    tmp = df.copy()
    tmp["furnished_numeric"] = _furnished_numeric(df)
    # Fill any remaining nulls with column median so distance/predict never sees NaN
    for col in FEATURE_COLS:
        if col in tmp.columns:
            tmp[col] = pd.to_numeric(tmp[col], errors="coerce")
            tmp[col] = tmp[col].fillna(tmp[col].median())
    return tmp[FEATURE_COLS].astype(float).values


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _distance_label(km: float | None) -> str:
    if km is None:
        return "Nearby"
    if km < 1:
        return "< 1 km"
    if km < 3:
        return "1–3 km"
    if km < 7:
        return "3–7 km"
    return "> 7 km"


def _similarity_reason(target: pd.Series, comp: pd.Series) -> str:
    """Build a short human-readable explanation of why comp is similar."""
    parts: list[str] = []

    bed_diff = abs(int(target.get("beds", 0)) - int(comp.get("beds", 0)))
    if bed_diff == 0:
        parts.append("same number of bedrooms")
    elif bed_diff == 1:
        parts.append("similar bedroom count")

    sqm_diff_pct = abs(float(target.get("sqm", 0)) - float(comp.get("sqm", 0))) / max(float(target.get("sqm", 1)), 1)
    if sqm_diff_pct < 0.10:
        parts.append("very similar size")
    elif sqm_diff_pct < 0.20:
        parts.append("similar size")

    try:
        if int(target.get("neighborhood_cluster", -1)) == int(comp.get("neighborhood_cluster", -2)):
            parts.append("same neighborhood cluster")
    except (TypeError, ValueError):
        pass

    if not parts:
        parts.append("comparable overall features")

    return ", ".join(parts).capitalize()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_estimate(listing_id: Any, df: pd.DataFrame, model: Any) -> dict:
    """
    Run model.predict() for the given listing.

    Returns:
        {
            estimated_price: float,
            range_low:        float,
            range_high:       float,
            label:            "Fair" | "Overpriced" | "Underpriced",
        }
    """
    row_mask = df["id"].astype(str) == str(listing_id)
    if not row_mask.any():
        raise KeyError(f"Listing {listing_id} not found")

    idx = df.index[row_mask][0]
    row_df = df.loc[[idx]]

    features = _build_feature_matrix(row_df)
    estimated: float = float(model.predict(features)[0])

    range_low = round(estimated * (1 - RANGE_BAND), 2)
    range_high = round(estimated * (1 + RANGE_BAND), 2)

    actual_price = float(df.loc[idx, "price"])
    ratio = actual_price / estimated if estimated > 0 else 1.0

    if ratio > OVERPRICED_THRESHOLD:
        label = "Overpriced"
    elif ratio < UNDERPRICED_THRESHOLD:
        label = "Underpriced"
    else:
        label = "Fair"

    return {
        "estimated_price": round(estimated, 2),
        "range_low": range_low,
        "range_high": range_high,
        "label": label,
    }


def get_comps(listing_id: Any, df: pd.DataFrame, n: int = 5) -> list[dict]:
    """
    Find the top-n most similar listings using Euclidean distance
    on normalised feature vectors.

    Returns a list of dicts with:
        id, price, sqm, rooms, distance_label, similarity_reason
    """
    row_mask = df["id"].astype(str) == str(listing_id)
    if not row_mask.any():
        raise KeyError(f"Listing {listing_id} not found")

    idx = df.index[row_mask][0]
    target = df.loc[idx]

    matrix = _build_feature_matrix(df)

    # Normalise each feature column to [0, 1] to avoid sqm dominating
    col_min = matrix.min(axis=0)
    col_max = matrix.max(axis=0)
    col_range = np.where(col_max - col_min == 0, 1.0, col_max - col_min)
    norm_matrix = (matrix - col_min) / col_range

    target_vec = norm_matrix[df.index.get_loc(idx)]
    distances = np.linalg.norm(norm_matrix - target_vec, axis=1)

    # Exclude the listing itself
    distances[df.index.get_loc(idx)] = np.inf

    nearest_indices = np.argsort(distances)[:n]
    comps = []

    has_coords = {"latitude", "longitude"}.issubset(df.columns)

    for i in nearest_indices:
        comp_row = df.iloc[i]

        if has_coords:
            try:
                km = _haversine_km(
                    float(target.get("latitude", 0)),
                    float(target.get("longitude", 0)),
                    float(comp_row.get("latitude", 0)),
                    float(comp_row.get("longitude", 0)),
                )
                dist_label = _distance_label(km)
            except (TypeError, ValueError):
                dist_label = _distance_label(None)
        else:
            dist_label = _distance_label(None)

        comps.append({
            "id": comp_row["id"],
            "price": float(comp_row["price"]),
            "sqm": float(comp_row["sqm"]),
            "rooms": int(comp_row.get("beds", 0)) + int(comp_row.get("baths", 0)),
            "distance_label": dist_label,
            "similarity_reason": _similarity_reason(target, comp_row),
        })

    return comps
