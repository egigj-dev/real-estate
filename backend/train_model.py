"""Two log-price/m² models evaluated exclusively by grouped cross-fitting."""
import json
import sys
import re
from datetime import datetime, timezone
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupKFold, KFold, train_test_split
from xgboost import XGBRegressor
from threadpoolctl import threadpool_limits

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data/house_price.json"
MODEL_DIR = BASE_DIR / "model"
TIRANA_LAT, TIRANA_LNG = 41.3275, 19.8187
N_CLUSTERS = 6
COUNTS = ["bedrooms", "bathrooms", "living_rooms", "balconies"]
FURNISHING = ["fully_furnished", "partially_furnished", "unfurnished"]
FEATURE_COLS = ["area_sqm", "floor", *COUNTS, "has_elevator", "has_parking_space",
                "has_terrace", "has_garden", "has_garage", "has_carport",
                *["furn_" + x for x in FURNISHING], "distance_from_center",
                "total_rooms", "lat", "lng", "zone", "zone_km"]
METHOD = "grouped 5-fold cross-fitting; duplicates and identical descriptions share a group"

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



def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2-lat1)/2)**2 + cos(lat1)*cos(lat2)*sin((lon2-lon1)/2)**2
    return 6371 * 2 * atan2(sqrt(a), sqrt(max(0, 1-a)))


def clean_description(value):
    """Remove entire numeric expressions, including decimal/thousands separators."""
    return re.sub(r"\d+(?:[.,]\d+)*", " ", "" if pd.isna(value) else str(value).lower())


def normalized_description(value):
    return re.sub(r"[\W_]+", " ", clean_description(value), flags=re.UNICODE).strip()


def duplicate_groups(df):
    """Union both duplicate keys transitively; IDs follow input order, not prices."""
    parent = list(range(len(df)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    seen = {}
    for i, (_, row) in enumerate(df.iterrows()):
        exact = tuple(round(float(row[c]), d) if pd.notna(row[c]) else None
                      for c, d in [("price_eur", 0), ("area_sqm", 1), ("lat", 4), ("lng", 4), ("floor", 16)])
        keys = [("exact", exact)]
        text = normalized_description(row.get("description", ""))
        if len(text) >= 40:
            keys.append(("text", text))
        for key in keys:
            if key in seen:
                parent[root(i)] = root(seen[key])
            else:
                seen[key] = i
    return pd.Series(pd.factorize([root(i) for i in range(len(df))])[0], index=df.index)


def cross_folds(df, groups=None):
    groups = duplicate_groups(df) if groups is None else groups
    return list(GroupKFold(5).split(df, groups=groups))

def _auto_zone_names(n: int) -> dict:
    templates = {
        3: ["Periferia", "Zona e Mesme", "Qendra & Blloku"],
        4: ["Periferia", "Zonë Periferike", "Zona e Mesme", "Qendra & Blloku"],
        5: ["Periferia", "Zonë Periferike", "Zona e Mesme", "Zonë Qendrore", "Qendra & Blloku"],
        6: ["Periferia A", "Periferia B", "Zona e Mesme A", "Zona e Mesme B", "Qendra A", "Qendra & Blloku"],
    }
    names = templates.get(n, [f"Zonë {i}" for i in range(n)])
    return {i: names[i] for i in range(n)}



def load_raw(path=DATA_PATH):
    df = pd.read_json(path).rename(columns=RENAME)
    return df.loc[:, ~df.columns.duplicated()][KEEP_COLS].copy()


def clean(df):
    """Apply the project's DataCleaner: label fixes, validity filters, duplicate and outlier removal.

    The outlier rule uses statistics over all listings. It decides which listings
    count as valid data, so the reported metrics describe listings that pass it.
    """
    sys.path.insert(0, str(BASE_DIR))
    from data_cleaner import DataCleaner

    df = df.copy()
    description = df["description"].copy()
    df["description"] = df["description"].astype(str)
    out = (DataCleaner(df)
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
    # The cleaner keeps the original index, so descriptions realign by label.
    out["description"] = description.loc[out.index]
    return out.reset_index(drop=True)


def base_features(rows):
    df = rows.copy()
    for col in FEATURE_COLS:
        if col not in df:
            df[col] = np.nan
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["total_rooms"] = df[COUNTS].fillna(0).clip(lower=0).sum(axis=1)
    df["distance_from_center"] = [haversine_km(TIRANA_LAT, TIRANA_LNG, a, b)
                                  for a, b in zip(df.lat, df.lng)]
    furn = rows.get("furnishing_status", pd.Series("unknown", index=rows.index))
    for value in FURNISHING:
        df["furn_" + value] = (furn == value).astype(float)
    return df


class TextModel:
    def fit(self, rows, y):
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=3,
                                        max_features=30000, sublinear_tf=True)
        self.mean = float(np.mean(y))
        self.ridge = None
        try:
            x = self.vectorizer.fit_transform(rows.get("description", pd.Series("", index=rows.index)).map(clean_description))
        except ValueError as exc:
            if not any(t in str(exc) for t in ["empty vocabulary", "no terms remain", "After pruning", "max_df corresponds"]):
                raise
            return self
        self.ridge = Ridge(alpha=3, solver="lsqr").fit(x, y)
        return self

    def predict(self, rows):
        if self.ridge is None:
            return np.full(len(rows), self.mean)
        text = rows.get("description", pd.Series("", index=rows.index)).map(clean_description)
        return self.ridge.predict(self.vectorizer.transform(text))


class Pipeline:
    def features(self, rows):
        df = base_features(rows)
        raw = self.kmeans.predict(df[["lat", "lng"]])
        df["zone"] = [self.mapping[int(z)] for z in raw]
        df["zone_km"] = [haversine_km(a, b, *self.kmeans.cluster_centers_[z])
                         for a, b, z in zip(df.lat, df.lng, raw)]
        return df[FEATURE_COLS].fillna(self.medians).astype(float)

    def predict(self, rows, kind="property"):
        x = self.features(rows)
        if kind == "listing":
            x["text_prediction"] = self.text.predict(rows)
        return np.exp(self.models[kind].predict(x)).astype(float) * rows.area_sqm.to_numpy()

    @property
    def feature_importances_(self):
        return self.models["property"].feature_importances_


@threadpool_limits.wrap(limits=4)
def fit_pipeline(train_rows, **overrides):
    """Fit every learned component using these rows only, including inner text OOF."""
    rows = train_rows.reset_index(drop=True)
    result = Pipeline()
    result.kmeans = KMeans(n_clusters=6, random_state=42, n_init=10).fit(rows[["lat", "lng"]])
    raw = result.kmeans.labels_
    y = np.log(rows.price_eur.to_numpy() / rows.area_sqm.to_numpy())
    ranked = pd.Series(np.exp(y)).groupby(raw).median().sort_values().index
    result.mapping = {int(old): rank for rank, old in enumerate(ranked)}
    result.medians = base_features(rows)[FEATURE_COLS].median().fillna(0)
    x = result.features(rows)
    groups = rows["_group"] if "_group" in rows else duplicate_groups(rows)
    count = min(5, groups.nunique())
    splits = (GroupKFold(count).split(rows, groups=groups) if count >= 2
              else KFold(min(5, len(rows)), shuffle=True, random_state=42).split(rows))
    text_oof = np.empty(len(rows))
    for a, b in splits:
        text_oof[b] = TextModel().fit(rows.iloc[a], y[a]).predict(rows.iloc[b])
    result.text = TextModel().fit(rows, y)
    params = dict(learning_rate=0.05, n_estimators=1500, early_stopping_rounds=60,
                  max_depth=5, min_child_weight=3, subsample=0.8, colsample_bytree=0.7,
                  reg_lambda=2, reg_alpha=0.1, random_state=42, tree_method="hist", n_jobs=4)
    params.update(overrides)
    a, b = train_test_split(np.arange(len(rows)), test_size=0.1, random_state=42)
    result.models = {}
    for kind in ["property", "listing"]:
        features = x.copy()
        if kind == "listing":
            features["text_prediction"] = text_oof
        result.models[kind] = XGBRegressor(**params).fit(
            features.iloc[a], y[a], eval_set=[(features.iloc[b], y[b])], verbose=False)
    result.zone_cfg = {"n_clusters": 6, "centers": result.kmeans.cluster_centers_[ranked].tolist(),
                       "price_sorted_mapping": result.mapping, "zone_names": _auto_zone_names(6), "cluster_stats": {}}
    for z in range(6):
        subset = rows.loc[x.zone == z]
        result.zone_cfg["cluster_stats"][z] = dict(count=len(subset), mean_price=float(subset.price_eur.mean()),
            median_price=float(subset.price_eur.median()), mean_ppsqm=float((subset.price_eur/subset.area_sqm).mean()),
            median_ppsqm=float((subset.price_eur/subset.area_sqm).median()), mean_lat=float(subset.lat.mean()),
            mean_lng=float(subset.lng.mean()), mean_dist_center=float(x.loc[x.zone == z, "distance_from_center"].mean()))
    return result


def cross_fit(rows, **overrides):
    """Return predictions, fold-local zone IDs and fold IDs without a full-data fit."""
    rows = rows.reset_index(drop=True).copy()
    rows["_group"] = duplicate_groups(rows)
    predictions = {kind: np.empty(len(rows)) for kind in ["property", "listing"]}
    zones, folds = np.empty(len(rows), dtype=int), np.empty(len(rows), dtype=int)
    for fold, (a, b) in enumerate(cross_folds(rows, rows._group)):
        print(f"Cross-fitting fold {fold + 1}/5", flush=True)
        pipeline = fit_pipeline(rows.iloc[a], **overrides)
        for kind in predictions:
            predictions[kind][b] = pipeline.predict(rows.iloc[b], kind)
        zones[b] = pipeline.features(rows.iloc[b]).zone
        folds[b] = fold
    return predictions, zones, folds


def metrics(actual, predicted):
    error = np.abs(predicted - actual) / actual
    return dict(mae_eur=float(mean_absolute_error(actual, predicted)), median_ape_pct=float(np.median(error)*100),
                mape_pct=float(error.mean()*100), r2=float(r2_score(actual, predicted)),
                share_within_10_pct=float((error <= .1).mean()), share_within_20_pct=float((error <= .2).mean()), n=len(actual))


def error_bands(actual, predicted, zones):
    error = np.abs(predicted - actual) / actual
    def band(values):
        return {f"p{p}_rel_error": float(np.percentile(values, p)) for p in [50, 75, 90]}
    return {"global": band(error), **{int(z): band(error[zones == z]) for z in np.unique(zones)}}


def main():
    rows = clean(load_raw())
    predictions, zones, folds = cross_fit(rows)
    actual = rows.price_eur.to_numpy()
    report = {kind: metrics(actual, value) for kind, value in predictions.items()}
    report.update(method=METHOD, group_count=int(duplicate_groups(rows).nunique()), training_date=datetime.now(timezone.utc).isoformat())
    bands = {kind: error_bands(actual, value, zones) for kind, value in predictions.items()}
    print("Fitting serving pipeline", flush=True)
    pipeline = fit_pipeline(rows)
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(pipeline, MODEL_DIR / "model.joblib")
    joblib.dump(pipeline.zone_cfg, MODEL_DIR / "zone_config.joblib")
    joblib.dump(bands, MODEL_DIR / "price_bands.joblib")
    (MODEL_DIR / "scaler.joblib").unlink(missing_ok=True)
    (MODEL_DIR / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    x = pipeline.features(rows)
    rows["neighborhood_cluster"] = x.zone.astype(int)
    rows["dist_to_nearest_center"] = x.zone_km
    rows["distance_from_center"] = x.distance_from_center
    rows["total_rooms"] = x.total_rooms
    rows["price_per_sqm"] = rows.price_eur / rows.area_sqm
    rows["neighborhood"] = rows.neighborhood_cluster.map(pipeline.zone_cfg["zone_names"])
    rows["estimate_eur"] = predictions["listing"]
    rows["estimate_fold"] = folds
    rows["estimate_zone"] = zones  # Bands use the held-out fold's price-ranked zone.
    # Preserve existing offline area annotations by the row's stable raw attributes.
    final = BASE_DIR / "data/final_data.json"
    if final.exists():
        old = pd.read_json(final)
        if "area_name" in old:
            keys = ["price_eur", "area_sqm", "lat", "lng", "floor"]
            areas = old.drop_duplicates(keys).set_index(keys).area_name
            rows["area_name"] = pd.MultiIndex.from_frame(rows[keys]).map(areas)
    rows.to_json(final, orient="records")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    # Persist importable class names even when invoked as a script.
    from train_model import main as train_main
    train_main()
