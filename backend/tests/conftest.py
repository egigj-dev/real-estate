"""Synthetic API fixtures with stored held-out estimates and a fast property pipeline."""

import sys
from pathlib import Path

# Put the backend root on sys.path so `import main`, `import ml`, etc. work.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# 1. Fake DataFrame — 10 rows covering every column the app touches
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def fake_df() -> pd.DataFrame:
    rows = [
        # id   price    sqm  beds baths floor furn   furnishing_status      neighborhood  nb_clus dist_near  prop_type    lat     lng     ppsqm  rooms  description            elev   terr  park  gard  garag carpt  balc  liv  city      dist_ctr   status     furn_num
        ("0",  95000,   75,  2,   1.0,  3,    True,  "fully_furnished",    "Cluster 0",  0,       1.2,       "apartment", 41.33, 19.82,  1266.0, 3,     "Nice flat in Blloku",  True,  True,  False, False, False, False, 1, 1, "Tirana", 1.5, "for_sale", 1.0),
        ("1",  65000,   55,  1,   1.0,  2,    False, "unfurnished",        "Cluster 1",  1,       2.5,       "apartment", 41.32, 19.81,  1181.0, 2,     "Studio near center",   False, False, False, False, False, False, 0, 1, "Tirana", 2.8, "for_sale", 0.0),
        ("2", 150000,  110,  3,   2.0,  5,    True,  "fully_furnished",    "Cluster 0",  0,       1.0,       "apartment", 41.34, 19.83,  1363.0, 5,     "Spacious 3-bed",       True,  True,  True,  False, False, False, 2, 1, "Tirana", 1.0, "for_sale", 1.0),
        ("3",  45000,   40,  1,   1.0,  1,    False, "unfurnished",        "Cluster 2",  2,       4.0,       "apartment", 41.30, 19.79,  1125.0, 2,     "Affordable unit",      False, False, False, False, False, False, 0, 1, "Tirana", 4.5, "for_sale", 0.0),
        ("4", 200000,  140,  4,   2.0,  7,    True,  "fully_furnished",    "Cluster 0",  0,       0.8,       "villa",     41.35, 19.84,  1428.0, 6,     "Luxury penthouse",     True,  True,  True,  True,  True,  False, 3, 2, "Tirana", 0.8, "for_sale", 1.0),
        ("5",  80000,   70,  2,   1.0,  4,    True,  "partially_furnished","Cluster 1",  1,       2.2,       "apartment", 41.31, 19.80,  1142.0, 3,     "Partially furnished",  True,  False, False, False, False, False, 1, 1, "Tirana", 2.5, "for_sale", 1.0),
        ("6",  55000,   50,  1,   1.0,  2,    False, "unfurnished",        "Cluster 2",  2,       3.8,       "apartment", 41.29, 19.78,  1100.0, 2,     "Budget option",        False, False, False, False, False, False, 0, 1, "Tirana", 4.0, "for_sale", 0.0),
        ("7", 120000,   90,  3,   1.0,  6,    True,  "fully_furnished",    "Cluster 0",  0,       1.5,       "apartment", 41.33, 19.82,  1333.0, 4,     "3-bed with elevator",  True,  False, True,  False, False, False, 1, 1, "Tirana", 1.8, "for_sale", 1.0),
        ("8",  70000,   65,  2,   1.0,  3,    False, "unfurnished",        "Cluster 1",  1,       2.8,       "apartment", 41.32, 19.81,  1076.0, 3,     "Unfurnished 2-bed",    False, False, False, False, False, False, 0, 1, "Tirana", 3.0, "for_sale", 0.0),
        ("9", 175000,  125,  4,   2.0,  8,    True,  "fully_furnished",    "Cluster 0",  0,       0.9,       "apartment", 41.34, 19.83,  1400.0, 6,     "Premium 4-bed",        True,  True,  True,  False, False, False, 2, 2, "Tirana", 1.2, "for_sale", 1.0),
    ]
    cols = [
        "id", "price", "sqm", "beds", "baths", "floor",
        "furnished", "furnishing_status",
        "neighborhood", "neighborhood_cluster", "dist_to_nearest_center",
        "property_type", "latitude", "longitude",
        "price_per_sqm", "total_rooms", "description",
        "has_elevator", "has_terrace", "has_parking_space",
        "has_garden", "has_garage", "has_carport",
        "balconies", "living_rooms", "city", "distance_from_center",
        "property_status", "furnished_numeric",
    ]
    df = pd.DataFrame(rows, columns=cols)
    df["beds"]  = df["beds"].astype(int)
    df["baths"] = df["baths"].astype(float)
    df["estimate_eur"] = df["price"] * 0.95
    df["estimate_fold"] = np.arange(len(df)) % 5
    return df


# ---------------------------------------------------------------------------
# 2. Fast property pipeline with the production feature interface
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def fake_model(fake_df):
    from train_model import fit_pipeline
    rows = fake_df.rename(columns={"sqm": "area_sqm", "beds": "bedrooms", "baths": "bathrooms",
                                   "price": "price_eur", "latitude": "lat", "longitude": "lng"})
    return fit_pipeline(rows, n_estimators=5, early_stopping_rounds=2)



# ---------------------------------------------------------------------------
# 3. TestClient — wires fake data into the running FastAPI app
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def client(fake_df, fake_model):
    # Isolate the two models' error bands from local training artefacts.
    import ml as ml_module
    ml_module._bands_cache = {"listing": {"global": {"p50_rel_error": .15, "p75_rel_error": .25}},
                              "property": {"global": {"p50_rel_error": .2, "p75_rel_error": .3}}}

    # ── (b) Patch the loader module BEFORE importing main so that any direct
    #        calls to get_df() / get_model() in test bodies return fake data.
    import app.data.loader as loader_module

    # Save original references — we need them as keys for dependency_overrides.
    _orig_get_df    = loader_module.get_df
    _orig_get_model = loader_module.get_model

    loader_module.get_df    = lambda: fake_df   # type: ignore[method-assign]
    loader_module.get_model = lambda: fake_model  # type: ignore[method-assign]

    # ── (c) Import main (which imports from app.data.loader — already patched)
    import main as main_module

    # ── (d) Override FastAPI Depends so every router & the health endpoint
    #        receives fake data without touching the filesystem.
    main_module.app.dependency_overrides[_orig_get_df]    = lambda: fake_df
    main_module.app.dependency_overrides[_orig_get_model] = lambda: fake_model

    with TestClient(main_module.app, raise_server_exceptions=True) as c:
        yield c

    # Cleanup — restore original state so other test sessions aren't affected.
    main_module.app.dependency_overrides.clear()
    loader_module.get_df    = _orig_get_df
    loader_module.get_model = _orig_get_model