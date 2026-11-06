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
# Structured property features
# ---------------------------------------------------------------------------
from train_model import FEATURE_COLS, base_features

# ---------------------------------------------------------------------------
# Label thresholds
# ---------------------------------------------------------------------------
RANGE_BAND            = 0.08   # ±8 %

# ---------------------------------------------------------------------------
# Artefacts loaded lazily
# ---------------------------------------------------------------------------
_BANDS_PATH   = Path(__file__).resolve().parent / "model" / "price_bands.joblib"
_bands_cache  = None


def _get_bands() -> dict:
    """Load per-cluster error bands, or return empty dict (falls back to constants)."""
    global _bands_cache
    if _bands_cache is None:
        if _BANDS_PATH.exists():
            _bands_cache = joblib.load(_BANDS_PATH)
        else:
            _bands_cache = {}
    return _bands_cache


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _raw_rows(df):
    return df.rename(columns={"sqm": "area_sqm", "beds": "bedrooms", "baths": "bathrooms",
                              "latitude": "lat", "longitude": "lng"})


def _build_feature_matrix(df):
    rows = base_features(_raw_rows(df))
    rows["zone"] = df.get("neighborhood_cluster", 0)
    rows["zone_km"] = df.get("dist_to_nearest_center", 0)
    return rows[FEATURE_COLS].fillna(0).astype(float)


def _model_bands(kind):
    return _get_bands().get(kind, {})


def _band(kind, zone):
    bands = _model_bands(kind)
    return bands.get(int(zone)) or bands.get("global") or {}


def _input_row(features, model, cluster_id=None):
    cfg = model.zone_cfg
    cid = cluster_id if cluster_id is not None else features.get("neighborhood_cluster")
    if cid is None:
        name = features.get("zone") or features.get("neighborhood")
        cid = next((k for k, v in cfg["zone_names"].items() if str(v).casefold() == str(name).casefold()), 2)
    center = cfg["centers"][int(cid)]
    aliases = {"sqm": "area_sqm", "beds": "bedrooms", "baths": "bathrooms", "latitude": "lat", "longitude": "lng"}
    values = {aliases.get(k, k): v for k, v in features.items() if v is not None}
    defaults = dict(area_sqm=80, floor=3, bedrooms=2, bathrooms=1, living_rooms=1, balconies=0,
                    lat=center[0], lng=center[1], furnishing_status="unknown")
    for key in FEATURE_COLS:
        if key.startswith("has_"):
            defaults[key] = False
    defaults.update(values)
    return pd.DataFrame([defaults])


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _distance_label(km: float | None) -> str:
    if km is None or not math.isfinite(km): return "Distance unavailable"
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

def get_estimate(listing_id: Any, df: pd.DataFrame, model: Any = None) -> dict:
    """Serve a stored held-out estimate; never infer on an existing listing."""
    row_mask = df["id"].astype(str) == str(listing_id)
    if not row_mask.any():
        raise KeyError(f"Listing {listing_id} not found")

    idx    = df.index[row_mask][0]
    estimated = float(df.loc[idx, "estimate_eur"])

    # ── Look up cluster-specific error bands ──────────────────────────────────
    bands = _model_bands("listing")

    try:
        cluster_id = int(float(df.loc[idx, "estimate_zone"] if "estimate_zone" in df else df.loc[idx, "neighborhood_cluster"]))
    except (ValueError, TypeError, KeyError):
        cluster_id = -1

    cluster_bands = bands.get(cluster_id) or bands.get("global") or {}

    # p75 relative error → range band (how wide the "fair range" bar is)
    # Floor at 8%, cap at 35% so the UI band is always meaningful
    band_pct = float(np.clip(
        cluster_bands.get("p75_rel_error", RANGE_BAND),
        0.08, 0.35
    ))

    # Median relative error → labeling threshold
    # Floor at 10% so we don't over-flag small deviations
    threshold_pct = float(np.clip(
        cluster_bands.get("p50_rel_error", cluster_bands.get("median_rel_error", RANGE_BAND)),
        0.10, 0.30
    ))

    range_low  = round(estimated * (1 - band_pct), 2)
    range_high = round(estimated * (1 + band_pct), 2)

    # ── Label ─────────────────────────────────────────────────────────────────
    actual = float(df.loc[idx, "price"])
    ratio  = actual / estimated if estimated > 0 else 1.0

    if ratio > (1 + threshold_pct):
        label = "Overpriced"
    elif ratio < (1 - threshold_pct):
        label = "Underpriced"
    else:
        label = "Fair"

    return {
        "estimated_price": estimated,
        "range_low":       range_low,
        "range_high":      range_high,
        "label":           label,
        "band_pct":        round(band_pct * 100, 1),
        "threshold_pct":   round(threshold_pct * 100, 1),
    }


def get_suggestions_from_features(features, df, model, n=10):
    row = _input_row(features, model)
    x = model.features(row)
    estimated = float(model.predict(row)[0])
    band = _band("property", int(x.zone.iloc[0]))
    width = float(np.clip(band.get("p75_rel_error", RANGE_BAND), .08, .35))
    matrix = model.features(_raw_rows(df)).to_numpy()
    span = np.ptp(matrix, axis=0)
    span[span == 0] = 1
    distances = np.linalg.norm((matrix - x.to_numpy()[0]) / span, axis=1)
    nearest = np.argsort(distances)[:n]
    suggestions = []
    for rank, i in enumerate(nearest):
        r = df.iloc[i]
        suggestions.append(dict(id=str(r["id"]), price=float(r.price), sqm=float(r.sqm),
            beds=int(r.get("beds", 0)), baths=float(r.get("baths", 0)), floor=float(r.floor),
            address=r.get("address"), neighborhood=r.get("neighborhood"), property_type=r.get("property_type"),
            latitude=r.get("latitude"), longitude=r.get("longitude"), price_per_sqm=r.get("price_per_sqm"),
            furnished=bool(r.get("furnished", False)), match_score=round(97 - 52*rank/max(1, len(nearest)-1), 1), rank=rank+1))
    return dict(estimated_price=round(estimated, 2), range_low=round(estimated*(1-width), 2),
                range_high=round(estimated*(1+width), 2), band_pct=round(width*100, 1), suggestions=suggestions)


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

    nearest = np.argsort(dists)[:min(n, max(0, len(df) - 1))]
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

def get_price_by_zone(features, df, model):
    results = []
    for cid, name in model.zone_cfg["zone_names"].items():
        # Use the representative coordinates for each requested zone.
        row = _input_row({k: v for k, v in features.items() if k not in ("lat", "lng", "latitude", "longitude")}, model, cid)
        estimated = float(model.predict(row)[0])
        sqm = float(row.area_sqm.iloc[0])
        band = _band("property", cid)
        width = float(np.clip(band.get("p75_rel_error", RANGE_BAND), .08, .35))
        stats = model.zone_cfg["cluster_stats"][cid]
        results.append(dict(cluster_id=cid, zone_name=name, estimated_price=round(estimated, 2),
            price_per_sqm=round(estimated/sqm, 2), range_low=round(estimated*(1-width), 2),
            range_high=round(estimated*(1+width), 2), band_pct=round(width*100, 1),
            typical_error_pct=round(band.get("p50_rel_error", 0)*100, 1),
            avg_zone_price=stats["mean_price"], avg_zone_price_per_sqm=stats["mean_ppsqm"], listing_count=stats["count"]))
    return sorted(results, key=lambda r: r["estimated_price"])


def get_feature_explanation(features, cluster_id, df, model):
    x = model.features(_input_row(features, model, cluster_id)).iloc[0]
    medians = model.features(_raw_rows(df)).median()
    importance = model.feature_importances_
    total = importance.sum() or 1
    labels = {"area_sqm": "Sipërfaqja", "floor": "Kati", "bedrooms": "Dhoma gjumi",
              "bathrooms": "Banjo", "distance_from_center": "Distanca nga qendra",
              "has_elevator": "Ashensor", "has_parking_space": "Parking"}
    result = []
    for col, weight in zip(FEATURE_COLS, importance):
        if col in ("zone", "lat", "lng") or weight/total < .01:
            continue
        value, median = float(x[col]), float(medians[col])
        diff = value-median
        if col in ("zone_km", "distance_from_center"):
            diff = -diff
        label = labels.get(col, col.replace("_", " "))
        result.append(dict(feature=col, label=label, user_value=value, zone_median=median,
            unit="m²" if col == "area_sqm" else "", importance_pct=round(weight/total*100, 1),
            direction="neutral" if abs(diff) < .001 else "up" if diff > 0 else "down",
            insight=f"{label}: {value:.1f} (zona: {median:.1f})"))
    return sorted(result, key=lambda r: r["importance_pct"], reverse=True)[:7]
