"""Regression checks for evaluation isolation and location-only features."""
import numpy as np
import pandas as pd

from train_model import duplicate_groups, feature_engineer, grouped_split, haversine_km


def listings():
    rng = np.random.default_rng(42)
    return pd.DataFrame({
        "price_eur": rng.uniform(50000, 250000, 120),
        "area_sqm": rng.uniform(40, 150, 120),
        "lat": rng.uniform(41.29, 41.36, 120),
        "lng": rng.uniform(19.77, 19.86, 120),
        "floor": rng.integers(1, 10, 120),
        "bedrooms": 2, "bathrooms": 1, "living_rooms": 1,
    })


def test_duplicate_listings_never_straddle_split():
    df = listings()
    copies = df.copy()
    copies["price_eur"] = copies["price_eur"].round() + 0.01
    copies["area_sqm"] = copies["area_sqm"].round(1) + 0.001
    copies["lat"] = copies["lat"].round(4) + 0.000001
    copies["lng"] = copies["lng"].round(4) + 0.000001
    df = pd.concat([df, copies], ignore_index=True)
    train, test = grouped_split(df)
    groups = duplicate_groups(df)
    assert set(groups.loc[train]).isdisjoint(groups.loc[test])
    assert len(train) + len(test) == len(df)
    assert groups.nunique() == 120


def test_zones_independent_of_price_and_test_rows():
    df = listings()
    train, test = grouped_split(df)
    first, cfg = feature_engineer(df, train)
    changed = df.copy()
    # A random common multiplier preserves the explicitly required price ranks.
    changed["price_eur"] *= np.random.default_rng(7).uniform(2, 20)
    second, cfg2 = feature_engineer(changed, train)
    np.testing.assert_array_equal(first.neighborhood_cluster, second.neighborhood_cluster)
    np.testing.assert_allclose(cfg["centers"], cfg2["centers"])
    np.testing.assert_allclose(first.dist_to_nearest_center, second.dist_to_nearest_center)
    changed.loc[test, "price_eur"] *= 100
    changed.loc[test, ["lat", "lng"]] += 1
    _, cfg3 = feature_engineer(changed, train)
    assert cfg2 == cfg3
    assert sum(s["count"] for s in cfg["cluster_stats"].values()) == len(train)
    for row in first.itertuples():
        center = cfg["centers"][row.neighborhood_cluster]
        assert np.isclose(row.dist_to_nearest_center, haversine_km(row.lat, row.lng, *center))
