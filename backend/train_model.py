"""Train and evaluate with grouped held-out listings and location-only zones."""

import json
from datetime import datetime, timezone
import sys
import warnings
from math import radians, sin, cos, sqrt, atan2
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")

N_CLUSTERS = 6

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


def duplicate_groups(df: pd.DataFrame) -> pd.Series:
    """Stable duplicate keys, including rounded coordinates and listing attributes."""
    keys = df[["price_eur", "area_sqm", "lat", "lng", "floor"]].copy()
    for col, decimals in [("price_eur", 0), ("area_sqm", 1), ("lat", 4), ("lng", 4)]:
        keys[col] = keys[col].round(decimals)
    return pd.Series(pd.factorize(pd.MultiIndex.from_frame(keys))[0], index=df.index)


def grouped_split(df: pd.DataFrame):
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_pos, test_pos = next(splitter.split(df, groups=duplicate_groups(df)))
    return df.index[train_pos], df.index[test_pos]


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
def feature_engineer(df: pd.DataFrame, train_index) -> tuple:
    df = df.copy()
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

    km = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10)
    km.fit(df.loc[train_index, ["lat", "lng"]])
    raw_labels = km.predict(df[["lat", "lng"]])
    training = df.loc[train_index].copy()
    training["raw_cluster"] = km.predict(training[["lat", "lng"]])
    medians = training.groupby("raw_cluster")["price_per_sqm"].median().sort_values()
    mapping = {int(old): new for new, old in enumerate(medians.index)}
    df["neighborhood_cluster"] = [mapping[int(label)] for label in raw_labels]
    centers = km.cluster_centers_[medians.index.to_numpy()]
    df["dist_to_nearest_center"] = [
        haversine_km(lat, lng, *centers[int(cid)])
        for lat, lng, cid in df[["lat", "lng", "neighborhood_cluster"]].itertuples(index=False, name=None)
    ]
    n_clusters = N_CLUSTERS

    # Zone names from price rank
    zone_names = _auto_zone_names(n_clusters)

    df["neighborhood"] = df["neighborhood_cluster"].apply(
        lambda c: zone_names.get(int(c), f"Zona {int(c)}") if pd.notna(c) else "E panjohur"
    )

    # Build cluster stats for zone_config
    cluster_stats = {}
    training = df.loc[train_index]
    for cid in sorted(training["neighborhood_cluster"].unique()):
        cdf = training[training["neighborhood_cluster"] == cid]
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
        "centers":              centers.tolist(),
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
# Step 4 — Scale the fixed feature columns using training rows only
# ---------------------------------------------------------------------------
def scale_and_split(df: pd.DataFrame, train_index, test_index):
    X = df[FEATURE_COLS].astype(float)
    y = df["price_eur"]
    if X.isna().any().any() or y.isna().any():
        raise ValueError("Cleaned model features and targets must be complete")
    scaler = StandardScaler()
    X_train = pd.DataFrame(scaler.fit_transform(X.loc[train_index]), columns=FEATURE_COLS, index=train_index)
    X_test = pd.DataFrame(scaler.transform(X.loc[test_index]), columns=FEATURE_COLS, index=test_index)
    return X_train, X_test, y.loc[train_index], y.loc[test_index], scaler


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
    train_index, test_index = grouped_split(df)
    df, zone_cfg = feature_engineer(df, train_index)
    X_train, X_test, y_train, y_test, scaler = scale_and_split(df, train_index, test_index)
    model       = train(X_train, X_test, y_train, y_test)
    price_bands = compute_price_bands(df.loc[test_index], model, scaler)

    predictions = np.expm1(model.predict(X_test))
    rel_error = np.abs(predictions - y_test.to_numpy()) / y_test.to_numpy()
    metrics = {
        "mae_eur": float(mean_absolute_error(y_test, predictions)),
        "median_ape_pct": float(np.median(rel_error) * 100),
        "mape_pct": float(np.mean(rel_error) * 100),
        "r2": float(r2_score(y_test, predictions)),
        "share_within_10_pct": float(np.mean(rel_error <= 0.10)),
        "share_within_20_pct": float(np.mean(rel_error <= 0.20)),
        "n_train": len(train_index),
        "n_test": len(test_index),
        "split": "GroupShuffleSplit(test_size=0.2, random_state=42), grouped by price rounded to euros, area to 0.1 sqm, lat/lng to 4 decimals, and floor; 10% of training rows reserved for early stopping",
        "training_date": datetime.now(timezone.utc).isoformat(),
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    (MODEL_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
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