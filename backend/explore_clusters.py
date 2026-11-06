"""
explore_clusters.py
-------------------
Diagnostic script — compares clustering strategies without touching your
production model.  Run BEFORE re-training:

    python explore_clusters.py

What it tests
-------------
  A. k=3,4,5,6  KMeans on (lat, lng, price_per_sqm)
     — each variant also re-labels cluster IDs by ascending median
       price_per_sqm so IDs are ordinal (cheapest=0 → most expensive=k-1)

  B. Hierarchical 3×2  (fit k=3 first, then k=2 within each parent cluster)
     — gives 6 stable sub-zones without going to k=6 flat KMeans

For each variant it prints:
  · Silhouette score         (cluster compactness/separation — higher = better)
  · RMSE on a quick XGBoost  (fewer estimators but same features — lower = better)
  · Cluster size distribution
  · Mean price_per_sqm per cluster (so you can name them)

The fastest route to a decision: look at the RMSE column.

Usage
-----
  # From the backend/ directory (same place you run uvicorn):
  python explore_clusters.py

Requirements: same as requirements.txt (no extras needed).
"""

import json
import warnings
from math import radians, sin, cos, sqrt, atan2
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial.distance import cdist
from sklearn.cluster import KMeans
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, silhouette_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")

BASE_DIR  = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "final_data.json"   # use cleaned data

TIRANA_LAT = 41.3275
TIRANA_LNG = 19.8187

FEATURE_COLS = [
    "area_sqm", "floor", "bedrooms", "bathrooms",
    "has_elevator", "has_parking_space",
    "distance_from_center", "total_rooms",
    "neighborhood_cluster", "dist_to_nearest_center",
]

COL_ALIAS = {          # final_data.json uses renamed cols
    "area_sqm":  "sqm",
    "bedrooms":  "beds",
    "bathrooms": "baths",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return 6371 * 2 * atan2(sqrt(a), sqrt(1-a))


def load_df() -> pd.DataFrame:
    with open(DATA_PATH) as f:
        raw = json.load(f)
    df = pd.DataFrame(raw)

    # Rename back to training column names
    rev = {v: k for k, v in {
        "price_eur": "price", "area_sqm": "sqm",
        "bedrooms": "beds", "bathrooms": "baths",
        "lat": "latitude", "lng": "longitude",
    }.items()}
    # final_data uses renamed cols, restore what we need
    rename = {}
    if "sqm" in df.columns:    rename["sqm"]       = "area_sqm"
    if "beds" in df.columns:   rename["beds"]      = "bedrooms"
    if "baths" in df.columns:  rename["baths"]     = "bathrooms"
    if "price" in df.columns:  rename["price"]     = "price_eur"
    if "latitude" in df.columns:  rename["latitude"]  = "lat"
    if "longitude" in df.columns: rename["longitude"] = "lng"
    df = df.rename(columns=rename)

    for col in ["price_eur","area_sqm","bedrooms","bathrooms","floor",
                "lat","lng","has_elevator","has_parking_space","total_rooms"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["price_eur","area_sqm","lat","lng"]).reset_index(drop=True)
    df["bedrooms"]  = df["bedrooms"].fillna(0)
    df["bathrooms"] = df["bathrooms"].fillna(1)
    df["total_rooms"] = df.get("total_rooms", df["bedrooms"] + df["bathrooms"])
    df["floor"] = df["floor"].fillna(3)
    df["has_elevator"]      = df.get("has_elevator",      pd.Series(0, index=df.index)).fillna(0)
    df["has_parking_space"] = df.get("has_parking_space", pd.Series(0, index=df.index)).fillna(0)

    df["price_per_sqm"] = df["price_eur"] / df["area_sqm"].replace(0, np.nan)
    df["distance_from_center"] = df.apply(
        lambda r: haversine_km(TIRANA_LAT, TIRANA_LNG, r["lat"], r["lng"]), axis=1)

    print(f"Loaded {len(df):,} listings")
    return df


def cluster_features(df: pd.DataFrame):
    """Return normalized (lat, lng, price_per_sqm) array used for clustering."""
    coords = df[["lat","lng"]].values
    prices = df["price_per_sqm"].fillna(df["price_per_sqm"].median()).values

    cn = (coords - coords.min(0)) / (coords.max(0) - coords.min(0) + 1e-9)
    pn = (prices - prices.min()) / (prices.max() - prices.min() + 1e-9)
    return np.column_stack([cn[:,0], cn[:,1], pn * 0.7])


def sort_clusters_by_price(df: pd.DataFrame, cluster_col: str) -> pd.DataFrame:
    """Re-label cluster IDs so 0=cheapest median price_per_sqm, N=most expensive.
    This makes the continuous numeric encoding meaningful for the model."""
    medians = (df.groupby(cluster_col)["price_per_sqm"]
                 .median().sort_values())
    mapping = {old: new for new, old in enumerate(medians.index)}
    df[cluster_col] = df[cluster_col].map(mapping)
    return df, mapping


def fit_and_eval(df: pd.DataFrame, cluster_col: str, label: str) -> dict:
    """Quick XGBoost train/eval on a clustered dataframe."""
    tmp = df.copy()
    for col in FEATURE_COLS:
        if col not in tmp.columns:
            tmp[col] = 0.0
        tmp[col] = pd.to_numeric(tmp[col], errors="coerce")
        tmp[col] = tmp[col].fillna(tmp[col].median())

    X = tmp[FEATURE_COLS].astype(float)
    y = np.log1p(tmp["price_eur"])
    mask = ~(X.isnull().any(axis=1) | y.isnull())
    X, y = X[mask], y[mask]

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    sc = StandardScaler()
    X_tr = pd.DataFrame(sc.fit_transform(X_tr), columns=FEATURE_COLS)
    X_te = pd.DataFrame(sc.transform(X_te),      columns=FEATURE_COLS)

    # Fewer estimators than production (faster exploration)
    model = XGBRegressor(
        n_estimators=500, max_depth=7, learning_rate=0.02,
        subsample=0.8, colsample_bytree=0.7,
        reg_lambda=2.0, reg_alpha=0.1,
        tree_method="hist", random_state=42,
        verbosity=0, early_stopping_rounds=30,
    )
    model.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)

    y_pred = np.expm1(model.predict(X_te))
    y_true = np.expm1(y_te)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae  = mean_absolute_error(y_true, y_pred)
    r2   = r2_score(y_true, y_pred)

    return {"label": label, "rmse": rmse, "mae": mae, "r2": r2}


# ─── Strategy A: flat KMeans k=3..6 ──────────────────────────────────────────

def test_flat_kmeans(df: pd.DataFrame, k: int) -> dict:
    feats = cluster_features(df)
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(feats)

    df2 = df.copy()
    df2["neighborhood_cluster"] = labels.astype(float)

    # dist to nearest KMeans centroid
    dists = cdist(feats, km.cluster_centers_)
    df2["dist_to_nearest_center"] = dists.min(1)

    # Re-sort cluster IDs by ascending price so encoding is ordinal
    df2, mapping = sort_clusters_by_price(df2, "neighborhood_cluster")

    # Silhouette (expensive for large N — sample 2000)
    sample = min(2000, len(df2))
    sil = silhouette_score(feats[:sample], df2["neighborhood_cluster"].values[:sample])

    metrics = fit_and_eval(df2, "neighborhood_cluster", f"Flat KMeans k={k}")

    # Cluster stats
    stats = (df2.groupby("neighborhood_cluster")["price_per_sqm"]
               .agg(["count","median"])
               .rename(columns={"count":"n","median":"med_ppsqm"}))

    return {**metrics, "silhouette": round(sil, 4), "k": k,
            "strategy": "flat", "cluster_stats": stats}


# ─── Strategy B: hierarchical 3×2 ────────────────────────────────────────────

def test_hierarchical(df: pd.DataFrame) -> dict:
    """Fit k=3 parent clusters, then k=2 within each → 6 sub-clusters.
    Sub-cluster IDs are sorted by price across all 6 groups.
    """
    feats = cluster_features(df)
    parent_km = KMeans(n_clusters=3, random_state=42, n_init=10)
    parents   = parent_km.fit_predict(feats)

    df2     = df.copy()
    df2["parent_cluster"]       = parents.astype(float)
    df2["neighborhood_cluster"] = -1.0

    sub_id = 0
    sub_centers = []
    for p in sorted(np.unique(parents)):
        mask = parents == p
        sub_feats = feats[mask]
        child_km  = KMeans(n_clusters=2, random_state=42, n_init=10)
        child_labels = child_km.fit_predict(sub_feats)
        # mask indices in the full df
        parent_indices = np.where(mask)[0]
        for cid in [0, 1]:
            global_id = sub_id
            target_indices = parent_indices[child_labels == cid]
            df2.iloc[target_indices, df2.columns.get_loc("neighborhood_cluster")] = float(global_id)
            sub_centers.append(child_km.cluster_centers_[cid])
            sub_id += 1

    # Sort all 6 sub-cluster IDs by median price_per_sqm
    df2, mapping = sort_clusters_by_price(df2, "neighborhood_cluster")

    # dist to nearest sub-cluster centroid (use parent centroids — good enough)
    parent_dists = cdist(feats, parent_km.cluster_centers_)
    df2["dist_to_nearest_center"] = parent_dists.min(1)

    sample = min(2000, len(df2))
    sil = silhouette_score(feats[:sample], df2["neighborhood_cluster"].values[:sample].astype(int))

    metrics = fit_and_eval(df2, "neighborhood_cluster", "Hierarchical 3×2 (6 zones)")

    stats = (df2.groupby("neighborhood_cluster")["price_per_sqm"]
               .agg(["count","median"])
               .rename(columns={"count":"n","median":"med_ppsqm"}))

    return {**metrics, "silhouette": round(sil, 4), "k": 6,
            "strategy": "hierarchical_3x2", "cluster_stats": stats}


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 65)
    print("  Cluster strategy explorer")
    print("=" * 65)

    df = load_df()

    results = []

    print("\n── Testing flat KMeans k=3 (current baseline) ──")
    results.append(test_flat_kmeans(df, 3))

    print("── Testing flat KMeans k=4 ──")
    results.append(test_flat_kmeans(df, 4))

    print("── Testing flat KMeans k=5 ──")
    results.append(test_flat_kmeans(df, 5))

    print("── Testing flat KMeans k=6 ──")
    results.append(test_flat_kmeans(df, 6))

    print("── Testing hierarchical 3×2 (6 sub-zones) ──")
    results.append(test_hierarchical(df))

    # ── Summary table ─────────────────────────────────────────────────────────
    print("\n")
    print("=" * 65)
    print(f"  {'Strategy':<32} {'RMSE':>10} {'MAE':>10} {'R²':>7} {'Sil':>7}")
    print("=" * 65)

    best_rmse = min(r["rmse"] for r in results)
    for r in results:
        mark = " ◄ best" if r["rmse"] == best_rmse else ""
        print(f"  {r['label']:<32} "
              f"€{r['rmse']:>9,.0f} "
              f"€{r['mae']:>9,.0f} "
              f"{r['r2']:>7.4f} "
              f"{r['silhouette']:>7.4f}"
              f"{mark}")

    print("=" * 65)

    # ── Cluster breakdown for each strategy ───────────────────────────────────
    print("\n── Cluster price breakdown (ID → sorted cheapest first) ──\n")
    for r in results:
        print(f"  {r['label']}  (k={r['k']})")
        print(f"  {'Zone ID':<10} {'Count':>8} {'Median €/m²':>14}")
        print(f"  {'-'*35}")
        for zid, row in r["cluster_stats"].iterrows():
            print(f"  {int(zid):<10} {int(row['n']):>8,} {row['med_ppsqm']:>14.0f}")
        print()

    # ── Recommendation ────────────────────────────────────────────────────────
    best = min(results, key=lambda r: r["rmse"])
    print("─" * 65)
    print(f"  RECOMMENDATION  →  {best['label']}")
    print(f"  RMSE {best['rmse']:,.0f} € · R² {best['r2']:.4f} · Silhouette {best['silhouette']:.4f}")
    print()
    print("  To use this strategy, open train_model.py and set:")
    if best["strategy"] == "flat":
        print(f"    N_CLUSTERS = {best['k']}    (and HIERARCHICAL = False)")
    else:
        print(f"    HIERARCHICAL = True    (3 parent clusters × 2 sub-clusters)")
    print()
    print("  Also note: all strategies now SORT cluster IDs by price,")
    print("  so ID 0 = cheapest zone, ID N-1 = most expensive.")
    print("  This makes the continuous encoding meaningful for XGBoost.")
    print("─" * 65)


if __name__ == "__main__":
    main()