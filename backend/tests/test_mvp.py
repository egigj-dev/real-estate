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


@pytest.mark.parametrize('kind', ['file', 'directory'])
def test_missing_model(monkeypatch, tmp_path, kind):
    monkeypatch.setattr(loader, 'MODEL_PATH', tmp_path / 'missing' / kind)
    if kind == 'directory':
        loader.MODEL_PATH.mkdir(parents=True)
    load_model.cache_clear()
    try:
        assert load_model() is None
    finally:
        load_model.cache_clear()


def test_health_exposes_data_source(client, fake_df, monkeypatch):
    monkeypatch.setitem(fake_df.attrs, 'data_source', 'demo')
    assert client.get('/health').json()['data_source'] == 'demo'


@pytest.mark.parametrize('query', ['page=0', 'per_page=0', 'per_page=501', 'min_beds=-1'])
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


@pytest.mark.parametrize('model_exists', [False, True])
def test_fresh_clone_endpoints(tmp_path, model_exists):
    # A subprocess avoids the session fixture's patched loader and exercises
    # environment configuration, real startup, and every fallback endpoint.
    import os
    import subprocess
    import sys
    script = r'''
import socket
socket.create_connection = lambda *a, **k: (_ for _ in ()).throw(AssertionError("Network forbidden"))
from fastapi.testclient import TestClient
from main import app
import app.data.loader as loader
if MODEL_EXISTS:
    app.dependency_overrides[loader.get_model] = lambda: object()
with TestClient(app) as client:
    health = client.get('/health').json()
    assert health['data_source'] == 'demo'
    assert 'model_metrics' in health
    if not MODEL_EXISTS:
        assert health['model_metrics'] is None
    assert health['model_loaded'] == MODEL_EXISTS
    for path in ['/listings', '/listings/0', '/filters/options', '/areas', '/listings/0/comps', '/market/insights']:
        response = client.get(path)
        assert response.status_code == 200, (path, response.text)
    response = client.get('/listings/0/estimate')
    assert response.status_code == 503, response.text
    assert 'no trained model is installed' in response.json()['detail']
    assert client.get('/listings/missing/estimate').status_code == 404
    if not MODEL_EXISTS:
        for path in ['/predict/by-zone', '/suggest']:
            response = client.post(path, json={})
            assert response.status_code == 503, response.text
            assert 'no trained model is installed' in response.json()['detail']
'''
    env = dict(os.environ, DATA_PATH=str(tmp_path / 'missing.json'),
               MODEL_PATH=str(tmp_path / 'missing-model'), USE_DEMO_DATA='0')
    result = subprocess.run([sys.executable, '-c', 'MODEL_EXISTS = ' + repr(model_exists) + '\n' + script],
                            env=env, capture_output=True, text=True, timeout=90)
    assert result.returncode == 0, result.stdout + result.stderr


def test_local_private_data_and_trained_model():
    import os
    import subprocess
    import sys
    from app.config import BASE_DIR
    data = BASE_DIR / 'data/final_data.json'
    model = BASE_DIR / 'model/model.joblib'
    if not data.is_file() or not model.is_file():
        pytest.skip('Private data and trained artefacts are not installed')
    script = r'''
import socket
socket.create_connection = lambda *a, **k: (_ for _ in ()).throw(AssertionError("Network forbidden"))
from fastapi.testclient import TestClient
from main import app
with TestClient(app) as client:
    health = client.get('/health').json()
    assert health['data_source'] == 'private'
    assert health['model_loaded']
    assert health['model_metrics'] is not None
    for path in ['/listings', '/filters/options', '/areas', '/market/insights', '/listings/0/comps', '/listings/0/estimate']:
        response = client.get(path)
        assert response.status_code == 200, (path, response.text)
    for path in ['/predict/by-zone', '/suggest']:
        response = client.post(path, json={'sqm': 80, 'beds': 2, 'baths': 1})
        assert response.status_code == 200, (path, response.text)
'''
    result = subprocess.run([sys.executable, '-c', script], capture_output=True,
                            text=True, timeout=90,
                            env=dict(os.environ, DATA_PATH=str(data), MODEL_PATH=str(model), USE_DEMO_DATA='0'))
    assert result.returncode == 0, result.stdout + result.stderr
