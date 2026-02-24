"""
Train a GradientBoosting price-estimator on the Tirana dataset
and save it to model/model.joblib.

Features used
-------------
  beds, baths, sqm, furnished_numeric,
  neighborhood_cluster, dist_to_nearest_center

Must match FEATURE_COLS in ml.py.

Run
---
  cd backend
  python train_model.py
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

DATA_PATH  = Path("data/final_data.json")
MODEL_PATH = Path("model/model.joblib")

# Must match ml.py  FEATURE_COLS
FEATURE_COLS = [
    "beds", "baths", "sqm", "furnished_numeric",
    "neighborhood_cluster", "dist_to_nearest_center",
]


def load_and_prepare() -> pd.DataFrame:
    with open(DATA_PATH) as f:
        raw = json.load(f)
    df = pd.DataFrame(raw)

    df = df.rename(columns={
        "price_eur": "price",
        "area_sqm":  "sqm",
        "bedrooms":  "beds",
        "bathrooms": "baths",
    })

    for col in ("price", "sqm", "beds", "baths",
                "neighborhood_cluster", "dist_to_nearest_center"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["price", "sqm"]).reset_index(drop=True)
    df["beds"]  = df["beds"].fillna(0)
    df["baths"] = df["baths"].fillna(0)

    _furnished_true = {"fully_furnished", "partially_furnished"}
    df["furnished_numeric"] = df["furnishing_status"].apply(
        lambda v: 1.0 if isinstance(v, str) and v in _furnished_true else 0.0
    )

    # Fill remaining nulls with median
    for col in FEATURE_COLS:
        df[col] = df[col].fillna(df[col].median())

    # Clip extreme outliers (1st / 99th percentile)
    p1, p99 = df["price"].quantile(0.01), df["price"].quantile(0.99)
    df = df[(df["price"] >= p1) & (df["price"] <= p99)]

    return df


def main():
    print("Loading data …")
    df = load_and_prepare()
    print(f"  {len(df)} usable rows after cleaning")

    X = df[FEATURE_COLS].values
    y = df["price"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42
    )

    print("Training GradientBoostingRegressor …")
    model = GradientBoostingRegressor(
        n_estimators=400,
        learning_rate=0.07,
        max_depth=5,
        subsample=0.8,
        random_state=42,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2  = r2_score(y_test, preds)
    print(f"  Test MAE : €{mae:,.0f}")
    print(f"  Test R²  : {r2:.4f}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"  Saved → {MODEL_PATH.resolve()}")


if __name__ == "__main__":
    main()
