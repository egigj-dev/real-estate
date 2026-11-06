"""Grouped nested cross-fitting regression checks on a 400-row sample."""
import numpy as np
import pytest
from sklearn.cluster import KMeans
from threadpoolctl import threadpool_limits
from train_model import (clean, load_raw, duplicate_groups, cross_folds, cross_fit,
                         fit_pipeline, clean_description, FEATURE_COLS)

FAST = dict(n_estimators=8, early_stopping_rounds=3, n_jobs=1)

@pytest.fixture(scope="module")
def rows():
    return clean(load_raw()).sample(400, random_state=42).reset_index(drop=True)


def test_duplicate_listings_never_straddle_split(rows):
    original = rows.iloc[:100].copy()
    copies = original.copy()
    copies["price_eur"] = copies.price_eur.round() + .01
    copies["area_sqm"] = copies.area_sqm.round(1) + .001
    copies["lat"] = copies.lat.round(4) + .000001
    copies["lng"] = copies.lng.round(4) + .000001
    import pandas as pd
    combined = pd.concat([original, copies], ignore_index=True)
    groups = duplicate_groups(combined)
    np.testing.assert_array_equal(groups[:100], groups[100:])
    for a, b in cross_folds(combined):
        assert set(groups.iloc[a]).isdisjoint(groups.iloc[b])


def test_description_groups_are_transitive(rows):
    df = rows.copy()
    text = "A spacious apartment with beautiful views and a private terrace for sale"
    df.loc[0, "description"] = text + " 1.200!"
    df.loc[1, "description"] = text.upper() + " 1,5."
    # Third row joins via an exact duplicate of row 1, with different text.
    for col in ["price_eur", "area_sqm", "lat", "lng", "floor"]:
        df.loc[2, col] = df.loc[1, col]
    df.loc[2, "description"] = "different"
    groups = duplicate_groups(df)
    assert groups[0] == groups[1] == groups[2]
    for a, b in cross_folds(df):
        assert set(groups.iloc[a]).isdisjoint(groups.iloc[b])


def test_held_out_price_perturbation(rows):
    _, held = cross_folds(rows)[0]
    first, _, folds = cross_fit(rows, **FAST)
    changed = rows.copy()
    changed.loc[held, "price_eur"] *= 3
    second, _, folds2 = cross_fit(changed, **FAST)
    np.testing.assert_array_equal(folds, folds2)
    for kind in first:
        np.testing.assert_allclose(first[kind][held], second[kind][held], rtol=0, atol=1e-9)


@threadpool_limits.wrap(limits=4)
def test_zones_and_vocabulary_only_fit_training_rows(rows):
    train, held = cross_folds(rows)[0]
    changed = rows.copy()
    changed.loc[held, "description"] = "heldoutuniquetoken " * 10
    pipeline = fit_pipeline(changed.iloc[train], **FAST)
    expected = KMeans(6, random_state=42, n_init=10).fit(rows.iloc[train][["lat", "lng"]])
    np.testing.assert_array_equal(pipeline.kmeans.cluster_centers_, expected.cluster_centers_)
    assert "heldoutuniquetoken" not in pipeline.text.vectorizer.vocabulary_
    changed.loc[held, ["lat", "lng"]] += 1
    changed.loc[held, "price_eur"] *= 3
    other = fit_pipeline(changed.iloc[train], **FAST)
    np.testing.assert_array_equal(pipeline.kmeans.cluster_centers_, other.kmeans.cluster_centers_)
    assert pipeline.zone_cfg == other.zone_cfg


def test_description_cleaner_removes_all_digits():
    result = clean_description("Floor 12, price 1.200 euro, 1,5 baths, ٣ rooms")
    assert not any(c.isdigit() for c in result)
    assert "200" not in result and result == result.lower()


def test_features_keep_raw_missing_codes_and_exclude_description(rows):
    pipeline = fit_pipeline(rows, **FAST)
    changed = rows.iloc[:1].copy()
    changed.loc[:, ["bedrooms", "bathrooms", "living_rooms", "balconies"]] = [-1, 2, -1, 1]
    features = pipeline.features(changed)
    assert features.bedrooms.iloc[0] == -1
    assert features.total_rooms.iloc[0] == 3
    assert list(features.columns) == FEATURE_COLS
    first = pipeline.predict(changed)
    changed["description"] = "an entirely different description"
    np.testing.assert_array_equal(first, pipeline.predict(changed))


def test_inner_text_predictions_exclude_their_groups(rows, monkeypatch):
    from train_model import TextModel
    data = rows.copy()
    data["_group"] = duplicate_groups(data)
    original_fit, original_predict = TextModel.fit, TextModel.predict
    inner_predictions = []
    def fit(self, frame, y):
        self.fit_groups = set(frame._group)
        return original_fit(self, frame, y)
    def predict(self, frame):
        assert self.fit_groups.isdisjoint(set(frame._group))
        inner_predictions.extend(frame.index)
        return original_predict(self, frame)
    monkeypatch.setattr(TextModel, "fit", fit)
    monkeypatch.setattr(TextModel, "predict", predict)
    fit_pipeline(data, **FAST)
    assert sorted(inner_predictions) == list(range(len(data)))
