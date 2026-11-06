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
_SCALER_PATH  = Path(__file__).resolve().parent / "model" / "scaler.joblib"
_BANDS_PATH   = Path(__file__).resolve().parent / "model" / "price_bands.joblib"
_ZONE_CFG_PATH = Path(__file__).resolve().parent / "model" / "zone_config.joblib"
_scaler_cache = None
_bands_cache  = None
_zone_cfg_cache = None


def _get_scaler():
    global _scaler_cache
    if _scaler_cache is None:
        if not _SCALER_PATH.exists():
            raise FileNotFoundError(
                f"Scaler not found at {_SCALER_PATH}. Run train_model.py first."
            )
        _scaler_cache = joblib.load(_SCALER_PATH)
    return _scaler_cache


def _get_bands() -> dict:
    """Load per-cluster error bands, or return empty dict (falls back to constants)."""
    global _bands_cache
    if _bands_cache is None:
        if _BANDS_PATH.exists():
            _bands_cache = joblib.load(_BANDS_PATH)
        else:
            _bands_cache = {}
    return _bands_cache


def _get_zone_cfg() -> dict:
    """Load zone_config saved by train_model.py, or return empty dict."""
    global _zone_cfg_cache
    if _zone_cfg_cache is None:
        if _ZONE_CFG_PATH.exists():
            _zone_cfg_cache = joblib.load(_ZONE_CFG_PATH)
        else:
            _zone_cfg_cache = {}
    return _zone_cfg_cache


def _zone_name(cluster_id: int) -> str:
    """Resolve cluster_id → human-readable zone name using saved config."""
    cfg = _get_zone_cfg()
    names = cfg.get("zone_names", {})
    # zone_names keys may be int or str depending on how joblib serialised
    return names.get(cluster_id) or names.get(str(cluster_id)) or f"Cluster {cluster_id}"


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
    Run model.predict() for the given listing and determine its price label
    using cluster-specific error bands computed at training time.

    Inference pipeline:
      raw features → StandardScaler.transform → model.predict (log space)
      → np.expm1 → EUR price

    Band & label logic:
      - Look up this listing's neighborhood_cluster
      - Use that cluster's p75 relative error as the fair range band
        (i.e. the range covers the typical model uncertainty for this zone)
      - Use the cluster's median relative error as the Fair/Overpriced threshold
        (i.e. only flag if actual price deviates beyond what the model normally
        gets wrong for this zone)
      - Floor both at sensible minimums so we never call a 3% deviation Overpriced

    Returns:
        {
            estimated_price : float,
            range_low       : float,
            range_high      : float,
            label           : "Fair" | "Overpriced" | "Underpriced",
            band_pct        : float,   # % band used (for transparency)
            threshold_pct   : float,   # % threshold used
        }
    """
    row_mask = df["id"].astype(str) == str(listing_id)
    if not row_mask.any():
        raise KeyError(f"Listing {listing_id} not found")

    idx    = df.index[row_mask][0]
    row_df = df.loc[[idx]]

    # ── ML prediction ─────────────────────────────────────────────────────────
    raw_features = _build_feature_matrix(row_df)
    scaler       = _get_scaler()
    scaled       = scaler.transform(raw_features)

    log_pred  = model.predict(scaled)[0]
    estimated = float(np.expm1(log_pred))

    # ── Look up cluster-specific error bands ──────────────────────────────────
    bands = _get_bands()

    try:
        cluster_id = int(float(df.loc[idx, "neighborhood_cluster"]))
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
        "estimated_price": round(estimated, 2),
        "range_low":       range_low,
        "range_high":      range_high,
        "label":           label,
        "band_pct":        round(band_pct * 100, 1),
        "threshold_pct":   round(threshold_pct * 100, 1),
    }


def get_suggestions_from_features(
    features: dict,
    df: pd.DataFrame,
    model: Any,
    n: int = 10,
) -> dict:
    """
    Given a set of desired property features from the user (no existing listing),
    find the n most similar listings in the dataset AND estimate a fair price
    for the described property.

    Input features dict keys (all optional, missing values filled with cluster median):
        sqm, floor, beds, baths,
        has_elevator, has_parking_space,
        neighborhood_cluster  (int — resolved from zone name before calling)
        distance_from_center  (float km — filled from cluster mean if missing)
        dist_to_nearest_center (float — filled from cluster mean if missing)

    Returns:
        {
            estimated_price: float,
            range_low: float,
            range_high: float,
            band_pct: float,
            suggestions: [
                {id, price, sqm, beds, baths, address, neighborhood,
                 property_type, latitude, longitude, price_per_sqm,
                 match_score, distance_label}
            ]
        }
    """
    # ── Resolve cluster-level defaults for missing spatial features ───────────
    cluster_id = features.get("neighborhood_cluster")

    # Build cluster-level medians from the full df to fill missing values
    if cluster_id is not None and "neighborhood_cluster" in df.columns:
        cluster_mask = df["neighborhood_cluster"] == float(cluster_id)
        cluster_df   = df[cluster_mask] if cluster_mask.any() else df
    else:
        cluster_df = df

    def cluster_median(col: str, fallback: float) -> float:
        if col in cluster_df.columns:
            v = cluster_df[col].median()
            return float(v) if pd.notna(v) else fallback
        return fallback

    # Build a synthetic single-row DataFrame with the user's features,
    # filling any missing fields with cluster medians
    sqm   = float(features.get("sqm")   or cluster_median("sqm",   80.0))
    floor = float(features.get("floor") or cluster_median("floor",  3.0))
    beds  = float(features.get("beds")  or cluster_median("beds",   2.0))
    baths = float(features.get("baths") or cluster_median("baths",  1.0))

    has_elevator      = float(bool(features.get("has_elevator",      False)))
    has_parking_space = float(bool(features.get("has_parking_space", False)))

    dist_center  = float(features.get("distance_from_center")    or cluster_median("distance_from_center",  3.0))
    dist_nearest = float(features.get("dist_to_nearest_center")  or cluster_median("dist_to_nearest_center", 0.5))
    total_rooms  = beds + baths + 1.0   # beds + baths + kitchen approximation
    nc           = float(cluster_id) if cluster_id is not None else cluster_median("neighborhood_cluster", 0.0)

    synthetic_row = pd.DataFrame([{
        "area_sqm":              sqm,
        "floor":                 floor,
        "bedrooms":              beds,
        "bathrooms":             baths,
        "has_elevator":          has_elevator,
        "has_parking_space":     has_parking_space,
        "distance_from_center":  dist_center,
        "total_rooms":           total_rooms,
        "neighborhood_cluster":  nc,
        "dist_to_nearest_center": dist_nearest,
    }])

    # ── ML price estimate for this synthetic property ─────────────────────────
    scaler   = _get_scaler()
    scaled   = scaler.transform(synthetic_row[FEATURE_COLS].astype(float))
    log_pred = model.predict(scaled)[0]
    estimated = float(np.expm1(log_pred))

    # Dynamic bands from cluster
    bands         = _get_bands()
    cluster_bands = bands.get(int(nc) if pd.notna(nc) else -1) or bands.get("global") or {}
    band_pct      = float(np.clip(cluster_bands.get("p75_rel_error", RANGE_BAND), 0.08, 0.35))

    # ── Nearest-neighbour search ──────────────────────────────────────────────
    matrix    = _build_feature_matrix(df).values   # (N, 10) ndarray
    col_min   = matrix.min(axis=0)
    col_range = np.where((matrix.max(axis=0) - col_min) == 0, 1.0,
                         matrix.max(axis=0) - col_min)
    norm      = (matrix - col_min) / col_range

    # Normalise the synthetic vector using the same col_min / col_range
    syn_vec   = synthetic_row[FEATURE_COLS].astype(float).values[0]
    syn_norm  = (syn_vec - col_min) / col_range

    dists   = np.linalg.norm(norm - syn_norm, axis=1)
    nearest = np.argsort(dists)[:n]

    # Score relative to result set: best=97%, worst=45%
    # Euclidean distance in 10D normalized space is typically 0.3-2.0, NOT 0-1,
    # so "1-dist" clips to 0 for almost everything. Use relative scaling instead.
    nearest_dists = dists[nearest]
    d_min   = nearest_dists.min()
    d_range = (nearest_dists.max() - d_min) if nearest_dists.max() > d_min else 1.0

    def _match_score(d: float) -> float:
        norm_d = (d - d_min) / d_range   # 0=best, 1=worst in result set
        return round(97.0 - norm_d * 52.0, 1)   # maps to [45, 97]

    suggestions = []
    for rank, i in enumerate(nearest):
        row       = df.iloc[i]
        match_pct = _match_score(float(dists[i]))

        suggestions.append({
            "id":             str(row["id"]),
            "price":          float(row["price"]),
            "sqm":            float(row["sqm"]),
            "beds":           int(row.get("beds", 0) or 0),
            "baths":          float(row.get("baths", 0) or 0),
            "floor":          float(row["floor"]) if pd.notna(row.get("floor")) else None,
            "address":        row.get("address"),
            "neighborhood":   row.get("neighborhood"),
            "property_type":  row.get("property_type"),
            "latitude":       float(row["latitude"])  if pd.notna(row.get("latitude"))  else None,
            "longitude":      float(row["longitude"]) if pd.notna(row.get("longitude")) else None,
            "price_per_sqm":  float(row["price_per_sqm"]) if pd.notna(row.get("price_per_sqm")) else None,
            "furnished":      bool(row.get("furnished", False)),
            "match_score":    match_pct,
            "rank":           rank + 1,
        })

    return {
        "estimated_price": round(estimated, 2),
        "range_low":       round(estimated * (1 - band_pct), 2),
        "range_high":      round(estimated * (1 + band_pct), 2),
        "band_pct":        round(band_pct * 100, 1),
        "suggestions":     suggestions,
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

def get_price_by_zone(
    features: dict,
    df: pd.DataFrame,
    model: Any,
) -> list[dict]:
    """
    Run the XGBoost model with the user's features, once per neighborhood
    cluster.  Spatial features (distance_from_center, dist_to_nearest_center)
    are filled with each cluster's median so the prediction reflects what
    that zone actually looks like, not a generic average.

    Input features dict keys (all optional):
        sqm, floor, beds, baths,
        has_elevator (bool), has_parking_space (bool)

    Returns list (one entry per cluster), sorted cheapest → most expensive:
        [
          {
            cluster_id:            int,
            zone_name:             str,
            estimated_price:       float,
            price_per_sqm:         float,
            range_low:             float,
            range_high:            float,
            band_pct:              float,
            avg_zone_price:        float,   # mean actual price in this cluster
            avg_zone_price_per_sqm: float,
            listing_count:         int,
          }
        ]
    """
    scaler = _get_scaler()
    bands  = _get_bands()

    # Resolve user inputs with sensible defaults
    sqm            = float(features.get("sqm")   or 80.0)
    floor_val      = float(features.get("floor") or 3.0)
    beds           = float(features.get("beds")  or 2.0)
    baths          = float(features.get("baths") or 1.0)
    has_elevator   = float(bool(features.get("has_elevator",      False)))
    has_parking    = float(bool(features.get("has_parking_space", False)))
    total_rooms    = beds + baths + 1.0

    # Unique clusters
    clusters = sorted(df["neighborhood_cluster"].dropna().unique())

    results = []
    for cluster_id in clusters:
        cid   = int(cluster_id)
        cmask = df["neighborhood_cluster"] == cluster_id
        cdf   = df[cmask]

        def cmedian(col: str, fallback: float) -> float:
            if col in cdf.columns:
                v = cdf[col].median()
                return float(v) if pd.notna(v) else fallback
            return fallback

        dist_center  = cmedian("distance_from_center",   3.0)
        dist_nearest = cmedian("dist_to_nearest_center", 0.5)

        # Zone name
        zone_name = _zone_name(cid)

        # Build feature row for this cluster
        row = pd.DataFrame([{
            "area_sqm":               sqm,
            "floor":                  floor_val,
            "bedrooms":               beds,
            "bathrooms":              baths,
            "has_elevator":           has_elevator,
            "has_parking_space":      has_parking,
            "distance_from_center":   dist_center,
            "total_rooms":            total_rooms,
            "neighborhood_cluster":   float(cid),
            "dist_to_nearest_center": dist_nearest,
        }])

        scaled    = scaler.transform(row[FEATURE_COLS].astype(float))
        log_pred  = model.predict(scaled)[0]
        estimated = float(np.expm1(log_pred))

        # Dynamic band for this cluster
        cluster_bands = bands.get(cid) or bands.get("global") or {}
        band_pct      = float(np.clip(
            cluster_bands.get("p75_rel_error", RANGE_BAND), 0.08, 0.35
        ))

        # Actual zone stats from data
        avg_price        = float(cdf["price"].mean())
        avg_price_per_sqm = float((cdf["price"] / cdf["sqm"].replace(0, np.nan)).mean())

        results.append({
            "cluster_id":              cid,
            "zone_name":               zone_name,
            "estimated_price":         round(estimated, 2),
            "price_per_sqm":           round(estimated / sqm, 2),
            "range_low":               round(estimated * (1 - band_pct), 2),
            "range_high":              round(estimated * (1 + band_pct), 2),
            "band_pct":                round(band_pct * 100, 1),
            "avg_zone_price":          round(avg_price, 2),
            "avg_zone_price_per_sqm":  round(avg_price_per_sqm, 2),
            "listing_count":           int(len(cdf)),
        })

    # Sort cheapest → most expensive
    results.sort(key=lambda x: x["estimated_price"])
    return results


def get_feature_explanation(
    features: dict,
    cluster_id: int,
    df: pd.DataFrame,
    model: Any,
) -> list[dict]:
    """
    For a given set of features and zone, explain what drives the predicted price.
    Uses XGBoost feature_importances_ (gain) to rank features,
    then compares each input value to the cluster median to show direction.

    Returns list of dicts sorted by importance desc:
        [{ feature, label, user_value, zone_median, unit,
           importance_pct, direction, insight }]
    """
    # Feature importance from model (gain-based)
    importances = model.feature_importances_   # array len == FEATURE_COLS
    total_imp   = importances.sum() or 1.0
    imp_pct     = {col: float(importances[i]) / total_imp * 100
                   for i, col in enumerate(FEATURE_COLS)}

    # Cluster medians
    cmask  = df["neighborhood_cluster"] == float(cluster_id) if cluster_id is not None else pd.Series(True, index=df.index)
    cdf    = df[cmask] if cmask.any() else df

    def cmed(raw_col: str, fallback: float) -> float:
        # raw_col is the FEATURE_COLS name (e.g. "area_sqm"),
        # df uses renamed cols (e.g. "sqm")
        alias = {"area_sqm": "sqm", "bedrooms": "beds", "bathrooms": "baths"}
        col   = alias.get(raw_col, raw_col)
        if col in cdf.columns:
            v = cdf[col].median()
            return float(v) if pd.notna(v) else fallback
        return fallback

    sqm   = float(features.get("sqm")   or cmed("area_sqm", 80))
    floor = float(features.get("floor") or cmed("floor", 3))
    beds  = float(features.get("beds")  or cmed("bedrooms", 2))
    baths = float(features.get("baths") or cmed("bathrooms", 1))
    has_el  = float(bool(features.get("has_elevator",      False)))
    has_pk  = float(bool(features.get("has_parking_space", False)))
    dist_c  = cmed("distance_from_center",   3.0)
    tot_r   = beds + baths + 1.0
    nc      = float(cluster_id) if cluster_id is not None else cmed("neighborhood_cluster", 0)
    dist_n  = cmed("dist_to_nearest_center", 0.5)

    user_vals = {
        "area_sqm":               sqm,
        "floor":                  floor,
        "bedrooms":               beds,
        "bathrooms":              baths,
        "has_elevator":           has_el,
        "has_parking_space":      has_pk,
        "distance_from_center":   dist_c,
        "total_rooms":            tot_r,
        "neighborhood_cluster":   nc,
        "dist_to_nearest_center": dist_n,
    }

    medians = {
        "area_sqm":               cmed("area_sqm", 80),
        "floor":                  cmed("floor", 3),
        "bedrooms":               cmed("bedrooms", 2),
        "bathrooms":              cmed("bathrooms", 1),
        "has_elevator":           cmed("has_elevator", 0),
        "has_parking_space":      cmed("has_parking_space", 0),
        "distance_from_center":   cmed("distance_from_center", 3),
        "total_rooms":            beds + baths + 1,
        "neighborhood_cluster":   nc,
        "dist_to_nearest_center": cmed("dist_to_nearest_center", 0.5),
    }

    labels = {
        "area_sqm":               "Sipërfaqja",
        "floor":                  "Kati",
        "bedrooms":               "Dhoma gjumi",
        "bathrooms":              "Banjo",
        "has_elevator":           "Ashensor",
        "has_parking_space":      "Parking",
        "distance_from_center":   "Distanca nga qendra",
        "total_rooms":            "Dhoma totale",
        "neighborhood_cluster":   "Zona",
        "dist_to_nearest_center": "Dendësia e zonës",
    }

    units = {
        "area_sqm": "m²", "floor": "", "bedrooms": "", "bathrooms": "",
        "has_elevator": "", "has_parking_space": "",
        "distance_from_center": "km", "total_rooms": "",
        "neighborhood_cluster": "", "dist_to_nearest_center": "",
    }

    # For distance features, higher = lower price (inverted effect)
    inverted = {"distance_from_center", "dist_to_nearest_center"}

    results = []
    for col in FEATURE_COLS:
        uv  = user_vals[col]
        med = medians[col]
        imp = imp_pct[col]

        if col in ("neighborhood_cluster",) or imp < 1.0:
            continue   # skip low-importance / categorical

        diff = uv - med
        if abs(diff) < 0.001:
            direction = "neutral"
        elif col in inverted:
            direction = "up" if diff < 0 else "down"
        else:
            direction = "up" if diff > 0 else "down"

        pct_diff = (diff / med * 100) if med != 0 else 0
        unit     = units[col]

        if col in ("has_elevator", "has_parking_space"):
            insight = (
                f"{'Ka' if uv else 'Nuk ka'} {labels[col].lower()} "
                f"({'mesatarja: ka' if med > 0.5 else 'mesatarja: nuk ka'})"
            )
        else:
            sign = "+" if pct_diff >= 0 else ""
            insight = (
                f"{labels[col]}: {uv:.0f}{unit} "
                f"(zona: {med:.0f}{unit}, {sign}{pct_diff:.0f}%)"
            )

        results.append({
            "feature":      col,
            "label":        labels[col],
            "user_value":   round(uv, 2),
            "zone_median":  round(med, 2),
            "unit":         unit,
            "importance_pct": round(imp, 1),
            "direction":    direction,   # "up" | "down" | "neutral"
            "insight":      insight,
        })

    results.sort(key=lambda x: x["importance_pct"], reverse=True)
    return results[:7]   # top 7 most important