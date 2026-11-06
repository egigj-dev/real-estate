"""
loader.py — loads dataset + model once (lru_cache singleton).

area_name is read directly from final_data.json (baked in by assign_areas.py).
No Overpass calls or PIP computation happen at runtime.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import DATA_PATH, MODEL_PATH

_COL_MAP = {
    "price_eur": "price", "area_sqm": "sqm",
    "bedrooms":  "beds",  "bathrooms": "baths",
    "lat": "latitude",    "lng": "longitude",
}
_FURNISHED_TRUE = {"fully_furnished", "partially_furnished"}
_ZONE_CFG_PATH  = MODEL_PATH.parent / "zone_config.joblib"


def _load_zone_cfg() -> dict:
    if _ZONE_CFG_PATH.exists():
        import joblib
        return joblib.load(_ZONE_CFG_PATH)
    return {}


def _apply_zone_names(df: pd.DataFrame, zone_cfg: dict) -> pd.DataFrame:
    zone_names = zone_cfg.get("zone_names", {})
    def resolve(row):
        nb = row.get("neighborhood")
        if isinstance(nb, str) and nb and nb not in ("E panjohur", "Unknown"):
            return nb
        cid = row.get("neighborhood_cluster")
        if pd.notna(cid):
            i = int(cid)
            return zone_names.get(i) or zone_names.get(str(i)) or f"Zona {i}"
        return "E panjohur"
    df["neighborhood"] = df.apply(resolve, axis=1)
    return df


def _load_and_clean(path: Path) -> pd.DataFrame:
    with open(path) as f:
        raw = json.load(f)

    df = pd.DataFrame(raw).rename(columns=_COL_MAP)

    for col in ("price","sqm","beds","baths","floor",
                "latitude","longitude",
                "neighborhood_cluster","dist_to_nearest_center",
                "distance_from_center","price_per_sqm","total_rooms",
                "balconies","living_rooms"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["price","sqm"]).reset_index(drop=True)
    df["beds"]  = df["beds"].fillna(0).astype(int)
    df["baths"] = df["baths"].fillna(0)

    df["furnished"] = df["furnishing_status"].apply(
        lambda v: v in _FURNISHED_TRUE if isinstance(v, str) else False)
    df["furnished_numeric"] = df["furnished"].astype(float)

    df = _apply_zone_names(df, _load_zone_cfg())

    # area_name: read from file if present (baked in by assign_areas.py)
    if "area_name" not in df.columns or df["area_name"].isna().all():
        print("[loader] WARNING: area_name not in data — run assign_areas.py first")
        df["area_name"] = df["neighborhood"]   # fallback to KMeans zones
    else:
        missing = df["area_name"].isna().sum()
        if missing:
            df["area_name"] = df["area_name"].fillna(df["neighborhood"])
        print(f"[loader] area_name: {df['area_name'].nunique()} unique areas "
              f"({missing} filled from neighborhood)")

    df["id"] = df.index.astype(str)
    return df


@lru_cache(maxsize=1)
def get_df() -> pd.DataFrame:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH.resolve()}")
    df = _load_and_clean(DATA_PATH)
    n_zones = df["neighborhood"].nunique()
    n_areas = df["area_name"].nunique()
    print(f"[loader] {len(df):,} listings · {n_zones} ML zones · {n_areas} OSM areas")
    return df


@lru_cache(maxsize=1)
def get_model() -> Any | None:
    if not MODEL_PATH.exists():
        print(f"[loader] WARNING: model not found at {MODEL_PATH}")
        return None
    import joblib
    return joblib.load(MODEL_PATH)