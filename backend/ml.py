"""
ML utilities: price estimation and comparable listings
"""

import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Feature columns — order matters for scaler
# ---------------------------------------------------------------------------
FEATURE_COLS = [
    "area_sqm", "floor", "bedrooms", "bathrooms",
    "has_elevator", "has_parking_space",
    "distance_from_center", "total_rooms",
    "neighborhood_cluster", "dist_to_nearest_center",
]

# ---------------------------------------------------------------------------
# Label thresholds
# ---------------------------------------------------------------------------
OVERPRICED_THRESHOLD  = 1.10   # actual > estimated × 1.10
UNDERPRICED_THRESHOLD = 0.90   # actual < estimated × 0.90
RANGE_BAND            = 0.08   # ±8 %

# ---------------------------------------------------------------------------
# Scaler path (loaded lazily so ml.py can be imported without the file)
# ---------------------------------------------------------------------------
_SCALER_PATH = Path(__file__).resolve().parent / "model" / "scaler.joblib"
_scaler_cache = None


def _get_scaler():
    global _scaler_cache
    if _scaler_cache is None:
        if not _SCALER_PATH.exists():
            raise FileNotFoundError(
                f"Scaler not found at {_SCALER_PATH}. Run train_model.py first."
            )
        _scaler_cache = joblib.load(_SCALER_PATH)
    return _scaler_cache


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _build_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Return a (n, 10) float DataFrame, NaNs filled with column median.

    Returning a DataFrame (not a bare numpy array) preserves column names so
    that StandardScaler.transform() doesn't emit a 'no feature names' warning
    when the scaler was originally fitted on a named DataFrame.
    """
    tmp = df.copy()
    for col in FEATURE_COLS:
        if col in tmp.columns:
            tmp[col] = pd.to_numeric(tmp[col], errors="coerce")
            tmp[col] = tmp[col].fillna(tmp[col].median())
        else:
            tmp[col] = 0.0
    return tmp[FEATURE_COLS].astype(float)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _distance_label(km: float | None) -> str:
    if km is None:   return "Nearby"
    if km < 1:       return "< 1 km"
    if km < 3:       return "1-3 km"
    if km < 7:       return "3-7 km"
    return "> 7 km"


def _similarity_reason(target: pd.Series, comp: pd.Series) -> str:
    parts: list[str] = []

    bed_diff = abs(int(target.get("beds", 0) or 0) - int(comp.get("beds", 0) or 0))
    if bed_diff == 0:
        parts.append("same number of bedrooms")
    elif bed_diff == 1:
        parts.append("similar bedroom count")

    sqm_t = float(target.get("sqm", 1) or 1)
    sqm_c = float(comp.get("sqm", 1) or 1)
    sqm_diff_pct = abs(sqm_t - sqm_c) / max(sqm_t, 1)
    if sqm_diff_pct < 0.10:
        parts.append("very similar size")
    elif sqm_diff_pct < 0.20:
        parts.append("similar size")

    try:
        if int(target.get("neighborhood_cluster", -1)) == int(comp.get("neighborhood_cluster", -2)):
            parts.append("same neighborhood cluster")
    except (TypeError, ValueError):
        pass

    return (", ".join(parts) or "comparable overall features").capitalize()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_estimate(listing_id: Any, df: pd.DataFrame, model: Any) -> dict:
    """
    Run model.predict() for the given listing.

    Inference pipeline:
      raw features → StandardScaler.transform → model.predict (log space)
      → np.expm1 → EUR price

    Returns:
        {
            estimated_price : float,
            range_low       : float,
            range_high      : float,
            label           : "Fair" | "Overpriced" | "Underpriced",
        }
    """
    row_mask = df["id"].astype(str) == str(listing_id)
    if not row_mask.any():
        raise KeyError(f"Listing {listing_id} not found")

    idx    = df.index[row_mask][0]
    row_df = df.loc[[idx]]

    raw_features = _build_feature_matrix(row_df)         # (1, 10) DataFrame
    scaler       = _get_scaler()
    scaled       = scaler.transform(raw_features)        # (1, 10) ndarray

    log_pred     = model.predict(scaled)[0]
    estimated    = float(np.expm1(log_pred))

    range_low  = round(estimated * (1 - RANGE_BAND), 2)
    range_high = round(estimated * (1 + RANGE_BAND), 2)

    actual = float(df.loc[idx, "price"])
    ratio  = actual / estimated if estimated > 0 else 1.0

    if ratio > OVERPRICED_THRESHOLD:
        label = "Overpriced"
    elif ratio < UNDERPRICED_THRESHOLD:
        label = "Underpriced"
    else:
        label = "Fair"

    return {
        "estimated_price": round(estimated, 2),
        "range_low":       range_low,
        "range_high":      range_high,
        "label":           label,
    }


def get_comps(listing_id: Any, df: pd.DataFrame, n: int = 5) -> list[dict]:
    """
    Find the top-n most similar listings using Euclidean distance
    on normalised feature vectors (no scaler — raw features are fine for distance).

    Returns a list of dicts with:
        id, price, sqm, rooms, distance_label, similarity_reason
    """
    row_mask = df["id"].astype(str) == str(listing_id)
    if not row_mask.any():
        raise KeyError(f"Listing {listing_id} not found")

    idx    = df.index[row_mask][0]
    target = df.loc[idx]

    matrix  = _build_feature_matrix(df).values  # (n, 10) ndarray for distance math

    # Normalise to [0, 1] so no single feature dominates
    col_min   = matrix.min(axis=0)
    col_range = np.where((matrix.max(axis=0) - col_min) == 0, 1.0, matrix.max(axis=0) - col_min)
    norm      = (matrix - col_min) / col_range

    target_vec = norm[df.index.get_loc(idx)]
    dists      = np.linalg.norm(norm - target_vec, axis=1)
    dists[df.index.get_loc(idx)] = np.inf   # exclude self

    nearest = np.argsort(dists)[:n]
    has_coords = {"latitude", "longitude"}.issubset(df.columns)

    comps = []
    for i in nearest:
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
            "id":                str(comp_row["id"]),
            "price":             float(comp_row["price"]),
            "sqm":               float(comp_row["sqm"]),
            "rooms":             int(comp_row.get("beds", 0) or 0) + int(comp_row.get("baths", 0) or 0),
            "distance_label":    dist_label,
            "similarity_reason": _similarity_reason(target, comp_row),
        })

    return comps