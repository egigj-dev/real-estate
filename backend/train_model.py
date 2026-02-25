"""
train_model.py
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
# Paths
# ---------------------------------------------------------------------------
BASE_DIR    = Path(__file__).resolve().parent
DATA_PATH   = BASE_DIR / "data" / "house_price.json"
MODEL_DIR   = BASE_DIR / "model"
MODEL_PATH  = MODEL_DIR / "model.joblib"
SCALER_PATH = MODEL_DIR / "scaler.joblib"

# ---------------------------------------------------------------------------
# Feature columns  — MUST match ml.py FEATURE_COLS
# ---------------------------------------------------------------------------
FEATURE_COLS = [
    "area_sqm", "floor", "bedrooms", "bathrooms",
    "has_elevator", "has_parking_space",
    "distance_from_center", "total_rooms",
    "neighborhood_cluster", "dist_to_nearest_center",
]

# ---------------------------------------------------------------------------
# Column rename map  (raw JSON → clean names)
# ---------------------------------------------------------------------------
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
    "main_property_location_city_zone_formatted_address":   "address",
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
    "description", "address", "price_eur", "area_sqm", "floor",
    "bedrooms", "bathrooms", "balconies", "living_rooms",
    "furnishing_status", "has_elevator", "has_parking_space",
    "has_garage", "has_carport", "has_terrace", "has_garden",
    "city", "property_type", "property_status", "price_currency",
    "lat", "lng",
]

TIRANA_LAT = 41.3275
TIRANA_LNG = 19.8187


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371 * 2 * atan2(sqrt(a), sqrt(1 - a))


# ---------------------------------------------------------------------------
# Step 1 — Load & rename
# ---------------------------------------------------------------------------
def load_raw(path: Path) -> pd.DataFrame:
    print(f"Loading {path} ...")
    df = pd.read_json(path).rename(columns=RENAME)
    df = df.drop_duplicates()
    keep = [c for c in KEEP_COLS if c in df.columns]
    df = df[keep].copy()
    df = df.loc[:, ~df.columns.duplicated()]  # remove duplicate cols
    print(f"  Raw rows: {len(df):,}  |  columns: {df.shape[1]}")
    return df


# ---------------------------------------------------------------------------
# Step 2 — DataCleaner chain  (exact notebook calls)
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
# Step 3 — Feature engineering
# ---------------------------------------------------------------------------
def feature_engineer(df: pd.DataFrame) -> pd.DataFrame:
    print("\nFeature engineering ...")

    # total_rooms
    room_cols = [c for c in ["bedrooms", "bathrooms", "living_rooms", "kitchens", "balconies"]
                 if c in df.columns]
    df["total_rooms"] = df[room_cols].sum(axis=1)

    # KMeans clustering on (lat, lng, price_per_sqm) — price weight=0.7
    coords = df[["lat", "lng"]].values
    prices = df["price_per_sqm"].values

    coords_norm = (coords - coords.min(axis=0)) / (coords.max(axis=0) - coords.min(axis=0) + 1e-9)
    prices_norm = (prices - prices.min()) / (prices.max() - prices.min() + 1e-9)

    features = np.column_stack([coords_norm[:, 0], coords_norm[:, 1], prices_norm * 0.7])

    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    df["neighborhood_cluster"] = kmeans.fit_predict(features)

    centers = kmeans.cluster_centers_
    distances = cdist(features, centers, metric="euclidean")
    df["dist_to_nearest_center"] = distances.min(axis=1)

    # distance_from_center (Haversine to Tirana center)
    df["distance_from_center"] = df.apply(
        lambda r: haversine_km(TIRANA_LAT, TIRANA_LNG, r["lat"], r["lng"])
        if pd.notna(r["lat"]) and pd.notna(r["lng"]) else np.nan,
        axis=1,
    )

    print(f"  Clusters: {df['neighborhood_cluster'].value_counts().to_dict()}")
    print(f"  Distance from center - mean: {df['distance_from_center'].mean():.2f} km")
    return df


# ---------------------------------------------------------------------------
# Step 4 — Encode  (matches notebook ColumnTransformer exactly)
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
    all_features = numerical + cat_names

    df_encoded = pd.DataFrame(X_full, columns=all_features, index=df.index)
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

    scaler = StandardScaler()
    X_train_s = pd.DataFrame(scaler.fit_transform(X_train), columns=feature_cols, index=X_train.index)
    X_test_s  = pd.DataFrame(scaler.transform(X_test),      columns=feature_cols, index=X_test.index)

    return X_train_s, X_test_s, y_train, y_test, scaler


# ---------------------------------------------------------------------------
# Step 6 — Train XGBoost (tuned params from notebook Cell 37/38)
# ---------------------------------------------------------------------------
def train(X_train, X_test, y_train, y_test):
    print("\nTraining XGBoost ...")

    X_tr, X_val, y_tr, y_val = train_test_split(
        X_train, y_train, test_size=0.1, random_state=42
    )

    model = XGBRegressor(
        subsample=0.8,
        reg_lambda=2.0,
        reg_alpha=0.1,
        n_estimators=2000,
        max_depth=7,
        learning_rate=0.01,
        colsample_bytree=0.7,
        tree_method="hist",   # swap to device="cuda" if GPU available
        random_state=42,
        verbosity=0,
        early_stopping_rounds=50,
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
    print(f"  Test R2   : {r2:.4f}")
    return model


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found.")
        print("Place house_price.json in backend/data/ and re-run.")
        sys.exit(1)

    df     = load_raw(DATA_PATH)
    df     = clean(df)
    df     = feature_engineer(df)
    df_enc = encode(df)
    y      = df["price_eur"].copy()

    X_train, X_test, y_train, y_test, scaler = scale_and_split(df_enc, y)
    model = train(X_train, X_test, y_train, y_test)

    # Save model + scaler
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model,  MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"\nSaved -> {MODEL_PATH}")
    print(f"Saved -> {SCALER_PATH}")

    # Save the processed dataset for the API (final_data.json)
    final_path = BASE_DIR / "data" / "final_data.json"
    df.to_json(final_path, orient="records")
    print(f"Saved -> {final_path}")


if __name__ == "__main__":
    main()