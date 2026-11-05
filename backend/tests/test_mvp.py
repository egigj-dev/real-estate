"""Regression coverage for fresh-clone data, model availability and input handling."""

import json

import numpy as np
import pytest

from app.data import loader
from ml import _build_feature_matrix, get_comps

# The original session fixture patches the loader module names.
load_df = loader.get_df
load_model = loader.get_model


def test_missing_address_is_legal(client):
    assert client.get('/listings').json()['listings'][0]['address'] is None
    assert client.get('/listings/0').json()['address'] is None


def test_unresolved_address_and_explicit_address(tmp_path):
    raw = json.loads(loader.DEMO_PATH.read_text())[:2]
    raw[0].pop('address')
    raw[1]['address'] = 'Demo Block Explicit'
    path = tmp_path / 'rows.json'
    path.write_text(json.dumps(raw))
    df = loader._load_and_clean(path)
    assert df.loc[0, 'address'] is None
    assert df.loc[1, 'address'] == 'Demo Block Explicit'


def test_demo_generation_is_reproducible():
    from demo.generate import generate
    assert json.loads(loader.DEMO_PATH.read_text()) == generate()
    assert len(generate()) == 48
    assert all('SYNTHETIC DEMO DATA' in r['description'] for r in generate())


@pytest.mark.parametrize('force_demo,real_exists,source', [
    (False, False, 'demo'), (False, True, 'private'), (True, True, 'demo'),
])
def test_data_source_selection(monkeypatch, tmp_path, caplog, force_demo, real_exists, source):
    path = tmp_path / 'private.json'
    if real_exists:
        path.write_text(loader.DEMO_PATH.read_text())
    monkeypatch.setattr(loader, 'DATA_PATH', path)
    monkeypatch.setattr(loader, 'USE_DEMO_DATA', force_demo)
    load_df.cache_clear()
    try:
        df = load_df()
        assert len(df) == 48
        assert df.attrs['data_source'] == source
        if source == 'demo':
            assert 'SYNTHETIC DEMO DATA' in caplog.text
    finally:
        load_df.cache_clear()


def test_invalid_existing_data_does_not_silently_fall_back(monkeypatch, tmp_path):
    path = tmp_path / 'broken.json'
    path.write_text('invalid json')
    monkeypatch.setattr(loader, 'DATA_PATH', path)
    monkeypatch.setattr(loader, 'USE_DEMO_DATA', False)
    load_df.cache_clear()
    with pytest.raises(json.JSONDecodeError):
        load_df()
    load_df.cache_clear()


def test_missing_model_or_scaler(monkeypatch, tmp_path):
    monkeypatch.setattr(loader, 'MODEL_PATH', tmp_path / 'model.joblib')
    monkeypatch.setattr(loader, 'SCALER_PATH', tmp_path / 'scaler.joblib')
    load_model.cache_clear()
    assert load_model() is None
    (tmp_path / 'model.joblib').write_bytes(b'not loaded without scaler')
    load_model.cache_clear()
    assert load_model() is None
    load_model.cache_clear()


def test_no_model_is_503_but_unknown_id_is_404(client):
    import main
    from app.routers import estimates
    dependency = estimates.get_model
    previous = main.app.dependency_overrides.get(dependency)
    main.app.dependency_overrides[dependency] = lambda: None
    try:
        r = client.get('/listings/0/estimate')
        assert r.status_code == 503
        assert 'Estimates unavailable' in r.json()['detail']
        assert client.get('/listings/unknown/estimate').status_code == 404
    finally:
        if previous is None:
            main.app.dependency_overrides.pop(dependency)
        else:
            main.app.dependency_overrides[dependency] = previous


def test_missing_scaler_is_503(client, monkeypatch):
    import ml
    def missing():
        raise FileNotFoundError('scaler')
    monkeypatch.setattr(ml, '_get_scaler', missing)
    assert client.get('/listings/0/estimate').status_code == 503


def test_model_provenance(client, fake_model, monkeypatch):
    monkeypatch.setattr(fake_model, 'demo_model_', True, raising=False)
    assert client.get('/listings/0/estimate').json()['demo_model'] is True
    assert client.get('/health').json()['demo_model'] is True


def test_health_exposes_data_source(client, fake_df, monkeypatch):
    monkeypatch.setitem(fake_df.attrs, 'data_source', 'demo')
    assert client.get('/health').json()['data_source'] == 'demo'


@pytest.mark.parametrize('query', [
    'min_price=-1', 'max_price=-1', 'min_price=nan', 'max_price=inf',
    'min_sqm=nan', 'max_sqm=inf', 'min_baths=nan', 'max_baths=inf',
    'sort=invalid', 'page=0', 'per_page=0', 'per_page=101',
])
def test_invalid_filters_and_pagination_are_422(client, query):
    assert client.get('/listings?' + query).status_code == 422


@pytest.mark.parametrize('n', [-1, 0, 101])
def test_invalid_comps_count_is_422(client, n):
    assert client.get(f'/listings/0/comps?n={n}').status_code == 422


def test_large_comps_count_excludes_target(client):
    rows = client.get('/listings/0/comps?n=100').json()['comps']
    assert len(rows) == 9
    assert '0' not in {row['id'] for row in rows}


def test_single_listing_has_no_comps(fake_df):
    assert get_comps('0', fake_df.iloc[:1], n=5) == []


def test_inference_uses_renamed_listing_features(fake_df):
    features = _build_feature_matrix(fake_df)
    np.testing.assert_array_equal(features['area_sqm'], fake_df['sqm'])
    np.testing.assert_array_equal(features['bedrooms'], fake_df['beds'])
    np.testing.assert_array_equal(features['bathrooms'], fake_df['baths'])


def test_all_missing_features_are_finite(fake_df):
    df = fake_df.copy()
    df['floor'] = np.nan
    assert np.isfinite(_build_feature_matrix(df).to_numpy()).all()


def test_demo_comps_have_no_invented_distance():
    df = loader._load_and_clean(loader.DEMO_PATH)
    assert all(c['distance_label'] == 'Distance unavailable' for c in get_comps('0', df))


@pytest.mark.parametrize('suffix', ['', '/estimate', '/comps'])
def test_unknown_text_ids_are_404(client, suffix):
    assert client.get('/listings/not-an-id' + suffix).status_code == 404


def test_literal_search_and_reversed_range(client):
    assert client.get('/listings?q=[').status_code == 200
    assert client.get('/listings?min_price=100000&max_price=1').json()['total'] == 0


def test_location_features_do_not_depend_on_price():
    import numpy as np
    import pandas as pd
    from train_model import feature_engineer

    generator = np.random.default_rng(0)
    frame = pd.DataFrame({
        "lat": generator.uniform(41.30, 41.36, 60), "lng": generator.uniform(19.78, 19.86, 60),
        "bedrooms": 2, "bathrooms": 1, "price_per_sqm": generator.uniform(800, 4000, 60),
    })
    changed = frame.copy()
    changed["price_per_sqm"] = changed["price_per_sqm"].to_numpy()[::-1] * 3
    first, second = feature_engineer(frame.copy()), feature_engineer(changed)
    assert (first["neighborhood_cluster"] == second["neighborhood_cluster"]).all()
    assert np.allclose(first["dist_to_nearest_center"], second["dist_to_nearest_center"])
