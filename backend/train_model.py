"""
train_model.py
==============
Run:  python train_model.py

Clustering strategy
-------------------
Two knobs at the top of this file:

  N_CLUSTERS   = 3     (or 4, 5, 6 — see explore_clusters.py for RMSE comparison)
  HIERARCHICAL = False (True = 3 parent zones × 2 sub-zones = 6 total)

Key fix: cluster IDs are RE-LABELLED after KMeans so that
  ID 0 = cheapest median €/m² zone  →  ID N-1 = most expensive

This makes neighborhood_cluster a meaningful ordinal feature for XGBoost
instead of random integers.  A zone_config.joblib is saved so ml.py can
resolve cluster_id → zone name consistently without string matching.
"""

import sys
import warnings
from math import radians, sin, cos, sqrt, atan2
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.spatial.distance import cdist
from sklearn.cluster import KMeans
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# KNOBS — set after running explore_clusters.py
# ---------------------------------------------------------------------------
N_CLUSTERS   = 3      # flat KMeans k
HIERARCHICAL = True   # 3 parent x 2 sub = 6 total zones
# ---------------------------------------------------------------------------

BASE_DIR    = Path(__file__).resolve().parent
DATA_PATH   = BASE_DIR / "data" / "house_price.json"
MODEL_DIR   = BASE_DIR / "model"
MODEL_PATH  = MODEL_DIR / "model.joblib"
SCALER_PATH = MODEL_DIR / "scaler.joblib"
ZONE_CFG    = MODEL_DIR / "zone_config.joblib"

TIRANA_LAT = 41.3275
TIRANA_LNG = 19.8187

FEATURE_COLS = [
    "area_sqm", "floor", "bedrooms", "bathrooms",
    "has_elevator", "has_parking_space",
    "distance_from_center", "total_rooms",
    "neighborhood_cluster", "dist_to_nearest_center",
]

RENAME = {
    "main_property_description_text_content_original_text": "description",
    "main_property_floor":                                  "floor",
    "main_property_furnishing_status":                      "furnishing_status",
    "main_property_has_carport":                            "has_carport",
    "main_property_has_elevator":                           "has_elevator",
    "main_property_has_garage":                             "has_garage",
    "main_property_has_garden":                             "has_garden",
    "main_property_has_parking_space":                      "has_parking_space",
    "main_property_has_terrace":                            "has_terrace",
    "main_property_location_city_zone_city_city_name":      "city",
    "main_property_price_currency":                         "price_currency",
    "main_property_property_composition_balconies":         "balconies",
    "main_property_property_composition_bathrooms":         "bathrooms",
    "main_property_property_composition_bedrooms":          "bedrooms",
    "main_property_property_composition_kitchens":          "kitchens",
    "main_property_property_composition_living_rooms":      "living_rooms",
    "main_property_property_status":                        "property_status",
    "main_property_property_type":                          "property_type",
    "price_in_euro":                                        "price_eur",
    "main_property_property_square":                        "area_sqm",
    "main_property_location_lat":                           "lat",
    "main_property_location_lng":                           "lng",
}

KEEP_COLS = [
    "description", "price_eur", "area_sqm", "floor",
    "bedrooms", "bathrooms", "balconies", "living_rooms",
    "furnishing_status", "has_elevator", "has_parking_space",
    "has_garage", "has_carport", "has_terrace", "has_garden",
    "city", "property_type", "property_status", "price_currency",
    "lat", "lng",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return 6371 * 2 * atan2(sqrt(a), sqrt(1-a))


def _cluster_features(df: pd.DataFrame) -> np.ndarray:
    coords = df[["lat","lng"]].values
    prices = df["price_per_sqm"].fillna(df["price_per_sqm"].median()).values
    cn = (coords - coords.min(0)) / (coords.max(0) - coords.min(0) + 1e-9)
    pn = (prices - prices.min()) / (prices.max() - prices.min() + 1e-9)
    return np.column_stack([cn[:,0], cn[:,1], pn * 0.7])


def _sort_by_price(df: pd.DataFrame, col: str) -> tuple:
    """Re-label so ID 0 = cheapest, ID N-1 = most expensive."""
    medians = df.groupby(col)["price_per_sqm"].median().sort_values()
    mapping = {int(old): int(new) for new, old in enumerate(medians.index)}
    df[col] = df[col].map(mapping)
    return df, mapping


def _auto_zone_names(n: int) -> dict:
    templates = {
        3: ["Periferia", "Zona e Mesme", "Qendra & Blloku"],
        4: ["Periferia", "Zonë Periferike", "Zona e Mesme", "Qendra & Blloku"],
        5: ["Periferia", "Zonë Periferike", "Zona e Mesme", "Zonë Qendrore", "Qendra & Blloku"],
        6: ["Periferia A", "Periferia B", "Zona e Mesme A", "Zona e Mesme B", "Qendra A", "Qendra & Blloku"],
    }
    names = templates.get(n, [f"Zonë {i}" for i in range(n)])
    return {i: names[i] for i in range(n)}


# ---------------------------------------------------------------------------
# Step 1 — Load
# ---------------------------------------------------------------------------
def load_raw(path: Path) -> pd.DataFrame:
    print(f"Loading {path} ...")
    df = pd.read_json(path).rename(columns=RENAME)
    df = df.drop_duplicates()
    keep = [c for c in KEEP_COLS if c in df.columns]
    df = df[keep].copy()
    df = df.loc[:, ~df.columns.duplicated()]
    print(f"  Raw rows: {len(df):,}  |  columns: {df.shape[1]}")
    return df


# ---------------------------------------------------------------------------
# Step 2 — Clean
# ---------------------------------------------------------------------------
def clean(df: pd.DataFrame) -> pd.DataFrame:
    print("\nCleaning ...")
    sys.path.insert(0, str(BASE_DIR))
    from data_cleaner import DataCleaner

    description_col = df["description"].copy()
    df["description"] = df["description"].astype(str)

    cleaner = DataCleaner(df)
    df = (cleaner
          .standardize_formats()
          .handle_missing()
          .check_impossible_values()
          .filter_location()
          .extract_areas()
          .extract_prices()
          .remove_duplicates()
          .remove_outliers(method="delete")
          .validate_ranges()
          .finalize())

    df["description"] = description_col
    print(f"  Clean rows: {len(df):,}")
    return df


# ---------------------------------------------------------------------------
# Step 3 — Feature engineering + clustering
# ---------------------------------------------------------------------------
def feature_engineer(df: pd.DataFrame) -> tuple:
    print("\nFeature engineering ...")

    room_cols = [c for c in ["bedrooms","bathrooms","living_rooms","kitchens","balconies"]
                 if c in df.columns]
    df["total_rooms"] = df[room_cols].sum(axis=1)

    df["distance_from_center"] = df.apply(
        lambda r: haversine_km(TIRANA_LAT, TIRANA_LNG, r["lat"], r["lng"])
        if pd.notna(r.get("lat")) and pd.notna(r.get("lng")) else np.nan,
        axis=1,
    )

    df["price_per_sqm"] = df["price_eur"] / df["area_sqm"].replace(0, np.nan)

    cf = _cluster_features(df)

    if HIERARCHICAL:
        parent_km = KMeans(n_clusters=3, random_state=42, n_init=10)
        parents   = parent_km.fit_predict(cf)
        df["neighborhood_cluster"] = -1.0
        sub_id = 0
        centers_list = []
        for p in sorted(np.unique(parents)):
            mask     = parents == p
            child_km = KMeans(n_clusters=2, random_state=42, n_init=10)
            child_lb = child_km.fit_predict(cf[mask])
            parent_indices = np.where(mask)[0]
            for cid in [0, 1]:
                target_indices = parent_indices[child_lb == cid]
                df.iloc[target_indices, df.columns.get_loc("neighborhood_cluster")] = float(sub_id)
                centers_list.append(child_km.cluster_centers_[cid])
                sub_id += 1
        centers    = np.array(centers_list)
        n_clusters = 6
        print(f"  Hierarchical 3×2 = {n_clusters} zones")
    else:
        km = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10)
        df["neighborhood_cluster"] = km.fit_predict(cf).astype(float)
        centers    = km.cluster_centers_
        n_clusters = N_CLUSTERS
        print(f"  Flat KMeans k={n_clusters}")

    dists = cdist(cf, centers)
    df["dist_to_nearest_center"] = dists.min(1)

    # Re-sort cluster IDs by ascending median price_per_sqm
    df, mapping = _sort_by_price(df, "neighborhood_cluster")

    # Zone names from price rank
    zone_names = _auto_zone_names(n_clusters)

    df["neighborhood"] = df["neighborhood_cluster"].apply(
        lambda c: zone_names.get(int(c), f"Zona {int(c)}") if pd.notna(c) else "E panjohur"
    )

    # Build cluster stats for zone_config
    cluster_stats = {}
    for cid in sorted(df["neighborhood_cluster"].unique()):
        cdf = df[df["neighborhood_cluster"] == cid]
        cluster_stats[int(cid)] = {
            "count":           int(len(cdf)),
            "mean_price":      float(cdf["price_eur"].mean()),
            "median_price":    float(cdf["price_eur"].median()),
            "mean_ppsqm":      float(cdf["price_per_sqm"].mean()),
            "median_ppsqm":    float(cdf["price_per_sqm"].median()),
            "mean_lat":        float(cdf["lat"].mean()),
            "mean_lng":        float(cdf["lng"].mean()),
            "mean_dist_center":float(cdf["distance_from_center"].mean()),
        }

    zone_cfg = {
        "n_clusters":           n_clusters,
        "hierarchical":         HIERARCHICAL,
        "price_sorted_mapping": mapping,
        "cluster_stats":        cluster_stats,
        "zone_names":           zone_names,
    }

    print(f"  Zone distribution (ID sorted cheapest → most expensive):")
    for zid in sorted(zone_names):
        s = cluster_stats[zid]
        print(f"    [{zid}] {zone_names[zid]:<25} "
              f"{s['count']:>5} listings · "
              f"median {s['median_ppsqm']:,.0f} €/m² · "
              f"centre {s['mean_dist_center']:.1f} km")

    return df, zone_cfg


# ---------------------------------------------------------------------------
# Step 4 — Encode
# ---------------------------------------------------------------------------
def encode(df: pd.DataFrame) -> pd.DataFrame:
    print("\nEncoding ...")

    numerical = [
        "area_sqm", "floor", "bedrooms", "bathrooms", "balconies", "living_rooms",
        "has_elevator", "has_parking_space", "has_garage", "has_carport",
        "has_terrace", "has_garden",
        "lat", "lng", "distance_from_center", "dist_to_nearest_center",
        "neighborhood_cluster", "total_rooms",
    ]
    categorical = ["furnishing_status", "property_type", "property_status"]

    numerical   = [c for c in numerical   if c in df.columns]
    categorical = [c for c in categorical if c in df.columns]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", numerical),
            ("cat", OneHotEncoder(sparse_output=False, handle_unknown="ignore", drop="first"), categorical),
        ],
        remainder="drop",
    )

    X_full    = preprocessor.fit_transform(df)
    cat_names = list(preprocessor.named_transformers_["cat"].get_feature_names_out(categorical))

    df_encoded = pd.DataFrame(X_full, columns=numerical + cat_names, index=df.index)
    print(f"  Encoded shape: {df_encoded.shape}")
    return df_encoded


# ---------------------------------------------------------------------------
# Step 5 — Scale + split
# ---------------------------------------------------------------------------
def scale_and_split(df_encoded: pd.DataFrame, y: pd.Series):
    print("\nScaling ...")
    feature_cols = [c for c in FEATURE_COLS if c in df_encoded.columns]
    X = df_encoded[feature_cols].copy()

    mask = ~(X.isnull().any(axis=1) | y.isnull())
    X, y = X[mask], y[mask]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"  Train: {len(X_train):,}  |  Test: {len(X_test):,}")

    scaler    = StandardScaler()
    X_train_s = pd.DataFrame(scaler.fit_transform(X_train), columns=feature_cols, index=X_train.index)
    X_test_s  = pd.DataFrame(scaler.transform(X_test),      columns=feature_cols, index=X_test.index)

    return X_train_s, X_test_s, y_train, y_test, scaler


# ---------------------------------------------------------------------------
# Step 6 — Train
# ---------------------------------------------------------------------------
def train(X_train, X_test, y_train, y_test):
    print("\nTraining XGBoost ...")

    X_tr, X_val, y_tr, y_val = train_test_split(
        X_train, y_train, test_size=0.1, random_state=42
    )

    model = XGBRegressor(
        subsample=0.8, reg_lambda=2.0, reg_alpha=0.1,
        n_estimators=2000, max_depth=7, learning_rate=0.01,
        colsample_bytree=0.7, tree_method="hist",
        random_state=42, verbosity=0, early_stopping_rounds=50,
    )

    model.fit(
        X_tr, np.log1p(y_tr),
        eval_set=[(X_val, np.log1p(y_val))],
        verbose=100,
    )

    print(f"  Best iteration: {model.best_iteration}")

    y_pred = np.expm1(model.predict(X_test))
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae  = mean_absolute_error(y_test, y_pred)
    r2   = r2_score(y_test, y_pred)
    print(f"\n  Test RMSE : EUR {rmse:,.0f}")
    print(f"  Test MAE  : EUR {mae:,.0f}")
    print(f"  Test R²   : {r2:.4f}")
    return model


# ---------------------------------------------------------------------------
# Step 7 — Per-cluster error bands
# ---------------------------------------------------------------------------
def compute_price_bands(df: pd.DataFrame, model, scaler) -> dict:
    print("\nComputing price bands ...")
    tmp = df.copy()
    for col in FEATURE_COLS:
        if col not in tmp.columns:
            tmp[col] = 0.0
        tmp[col] = pd.to_numeric(tmp[col], errors="coerce").fillna(0)

    X = pd.DataFrame(
        scaler.transform(tmp[FEATURE_COLS].astype(float)),
        columns=FEATURE_COLS, index=tmp.index,
    )
    y_pred  = np.expm1(model.predict(X))
    y_true  = df["price_eur"].values
    rel_err = np.abs(y_pred - y_true) / np.where(y_true > 0, y_true, 1)

    bands = {}
    for cid in sorted(df["neighborhood_cluster"].unique()):
        mask = df["neighborhood_cluster"] == cid
        e    = rel_err[mask.values]
        bands[int(cid)] = {
            "p50_rel_error": float(np.percentile(e, 50)),
            "p75_rel_error": float(np.percentile(e, 75)),
            "p90_rel_error": float(np.percentile(e, 90)),
        }
        print(f"  Zone {int(cid)}: p50={bands[int(cid)]['p50_rel_error']:.3f}  "
              f"p75={bands[int(cid)]['p75_rel_error']:.3f}")

    bands["global"] = {
        "p50_rel_error": float(np.percentile(rel_err, 50)),
        "p75_rel_error": float(np.percentile(rel_err, 75)),
        "p90_rel_error": float(np.percentile(rel_err, 90)),
    }
    return bands


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found.")
        sys.exit(1)

    df           = load_raw(DATA_PATH)
    df           = clean(df)
    df, zone_cfg = feature_engineer(df)
    df_enc       = encode(df)
    y            = df["price_eur"].copy()

    X_train, X_test, y_train, y_test, scaler = scale_and_split(df_enc, y)
    model       = train(X_train, X_test, y_train, y_test)
    price_bands = compute_price_bands(df, model, scaler)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model,       MODEL_PATH)
    joblib.dump(scaler,      SCALER_PATH)
    joblib.dump(zone_cfg,    ZONE_CFG)
    joblib.dump(price_bands, MODEL_DIR / "price_bands.joblib")

    print(f"\nSaved → {MODEL_PATH}")
    print(f"Saved → {SCALER_PATH}")
    print(f"Saved → {ZONE_CFG}")

    final_path = BASE_DIR / "data" / "final_data.json"
    df.to_json(final_path, orient="records")
    print(f"Saved → {final_path}")

    print("\n── Zone config ──")
    for zid, name in zone_cfg["zone_names"].items():
        s = zone_cfg["cluster_stats"][zid]
        print(f"  [{zid}] {name:<25} "
              f"{s['count']:>5} listings · "
              f"median {s['median_ppsqm']:,.0f} €/m² · "
              f"dist {s['mean_dist_center']:.1f} km")


if __name__ == "__main__":
    main()