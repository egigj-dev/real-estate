"""
Train a GradientBoosting price-estimator on the Tirana dataset
and save it to model/model.joblib.

Features used
-------------
  beds, baths, sqm, furnished_numeric  (all numeric, no encoding needed)

Run
---
  cd backend
  python train_model.py
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

DATA_PATH  = Path("data/tirana_house_prices.json")
MODEL_PATH = Path("model/model.joblib")

# Must match ml.py  FEATURE_COLS
FEATURE_COLS = ["beds", "baths", "sqm", "furnished_numeric"]


def load_and_prepare() -> pd.DataFrame:
    df = pd.read_json(DATA_PATH)
    df = df.rename(columns={
        "price_in_euro":                                        "price",
        "main_property_property_composition_bedrooms":          "beds",
        "main_property_property_composition_bathrooms":         "baths",
        "main_property_property_square":                        "sqm",
        "main_property_furnishing_status":                      "furnishing_status",
    })

    for col in ("price", "sqm", "beds", "baths"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in ("beds", "baths"):
        df[col] = df[col].replace(-1, np.nan)

    df = df.dropna(subset=["price", "sqm", "beds", "baths"]).reset_index(drop=True)

    _furnished_true = {"fully_furnished", "partially_furnished"}
    df["furnished_numeric"] = df["furnishing_status"].apply(
        lambda v: 1.0 if isinstance(v, str) and v in _furnished_true else 0.0
    )

    # Drop extreme outliers (beyond 1st/99th percentile) for cleaner training
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
    mae  = mean_absolute_error(y_test, preds)
    r2   = r2_score(y_test, preds)
    print(f"  Test MAE : €{mae:,.0f}")
    print(f"  Test R²  : {r2:.4f}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"  Saved → {MODEL_PATH.resolve()}")


if __name__ == "__main__":
    main()
