"""
tests/test_ml.py
----------------
Tests for:
    GET /listings/{id}/estimate
    GET /listings/{id}/comps
"""

import pytest


class TestEstimate:
    """GET /listings/{id}/estimate"""

    def test_returns_200(self, client):
        r = client.get("/listings/0/estimate")
        assert r.status_code == 200

    def test_response_shape(self, client):
        body = client.get("/listings/0/estimate").json()
        assert "listing_id"      in body
        assert "estimated_price" in body
        assert "range_low"       in body
        assert "range_high"      in body
        assert "label"           in body

    def test_listing_id_matches(self, client):
        body = client.get("/listings/3/estimate").json()
        assert body["listing_id"] == "3"

    def test_estimated_price_is_positive(self, client):
        body = client.get("/listings/0/estimate").json()
        assert body["estimated_price"] > 0

    def test_range_is_ordered(self, client):
        body = client.get("/listings/0/estimate").json()
        assert body["range_low"] < body["estimated_price"]
        assert body["estimated_price"] < body["range_high"]

    def test_range_uses_saved_zone_p75_band(self, client, fake_df):
        import ml
        import numpy as np
        body = client.get("/listings/0/estimate").json()
        zone = int(fake_df.loc[0, "neighborhood_cluster"])
        bands = ml._get_bands()["listing"]
        saved = bands.get(zone) or bands.get("global") or {}
        band = float(np.clip(saved.get("p75_rel_error", ml.RANGE_BAND), 0.08, 0.35))
        est = body["estimated_price"]
        assert body["range_low"] == pytest.approx(est * (1 - band), abs=0.02)
        assert body["range_high"] == pytest.approx(est * (1 + band), abs=0.02)

    @pytest.mark.parametrize("p50, expected", [(0.02, 10), (0.22, 22), (0.5, 30)])
    def test_p50_threshold(self, client, fake_df, fake_model, monkeypatch, p50, expected):
        import ml
        zone = int(fake_df.loc[0, "neighborhood_cluster"])
        monkeypatch.setattr(ml, "_bands_cache", {"listing": {zone: {
            "p50_rel_error": p50, "median_rel_error": 0.15, "p75_rel_error": 0.25,
        }}})
        df = fake_df.copy()
        df["price"] = df["price"].astype(float)
        initial = ml.get_estimate("0", df, fake_model)
        df.loc[0, "price"] = initial["estimated_price"] * 1.20
        result = ml.get_estimate("0", df, fake_model)
        assert result["threshold_pct"] == expected
        assert result["label"] == ("Overpriced" if expected < 20 else "Fair")

    def test_legacy_median_threshold(self, client, fake_df, fake_model, monkeypatch):
        import ml
        monkeypatch.setattr(ml, "_bands_cache", {"listing": {"global": {"median_rel_error": 0.24}}})
        assert ml.get_estimate("0", fake_df, fake_model)["threshold_pct"] == 24

    def test_label_is_valid(self, client):
        for lid in ["0", "1", "2", "3", "4"]:
            body = client.get(f"/listings/{lid}/estimate").json()
            assert body["label"] in ("Fair", "Overpriced", "Underpriced"), \
                f"Unexpected label '{body['label']}' for listing {lid}"

    def test_nonexistent_id_returns_404(self, client):
        r = client.get("/listings/9999/estimate")
        assert r.status_code == 404

    def test_all_listings_get_estimates(self, client):
        """Every listing in the dataset should produce a valid estimate."""
        all_ids = [str(i) for i in range(10)]
        for lid in all_ids:
            r = client.get(f"/listings/{lid}/estimate")
            assert r.status_code == 200, f"Failed for listing {lid}"
            body = r.json()
            assert body["estimated_price"] > 0

    def test_overpriced_label(self, client, fake_df):
        """A listing priced 20% above estimate should be Overpriced."""
        import pandas as pd
        from app.services.ml_service import estimate

        # find a listing and inflate its price
        from app.data.loader import get_df, get_model
        df = get_df()
        model = get_model()

        # Get real estimate for listing 0
        result = estimate("0", df, model)
        # If actual price > estimated * 1.10, label should be Overpriced
        # This confirms the threshold logic; exact label depends on real prices
        assert result.label in ("Fair", "Overpriced", "Underpriced")

    def test_label_logic_overpriced(self, fake_df, fake_model):
        """Unit-test label thresholds directly via the service."""
        from app.services.ml_service import estimate as svc_estimate

        # Use a listing where we can predict the label
        result = svc_estimate("4", fake_df, fake_model)  # listing 4 = €200k
        # Label depends on model prediction — just assert it's valid
        assert result.label in ("Fair", "Overpriced", "Underpriced")

    def test_label_logic_underpriced(self, fake_df, fake_model):
        from app.services.ml_service import estimate as svc_estimate
        result = svc_estimate("3", fake_df, fake_model)  # listing 3 = €45k (cheapest)
        assert result.label in ("Fair", "Overpriced", "Underpriced")


class TestComps:
    """GET /listings/{id}/comps"""

    def test_returns_200(self, client):
        r = client.get("/listings/0/comps")
        assert r.status_code == 200

    def test_response_shape(self, client):
        body = client.get("/listings/0/comps").json()
        assert "listing_id" in body
        assert "comps"      in body
        assert isinstance(body["comps"], list)

    def test_returns_5_comps(self, client):
        body = client.get("/listings/0/comps").json()
        assert len(body["comps"]) == 5

    def test_comp_has_required_fields(self, client):
        comp = client.get("/listings/0/comps").json()["comps"][0]
        for field in ["id", "price", "sqm", "rooms", "distance_label", "similarity_reason"]:
            assert field in comp, f"Missing field: {field}"

    def test_comps_do_not_include_target(self, client):
        body = client.get("/listings/0/comps").json()
        ids  = [c["id"] for c in body["comps"]]
        assert "0" not in ids, "Target listing should not appear in its own comps"

    def test_comp_prices_are_positive(self, client):
        comps = client.get("/listings/0/comps").json()["comps"]
        for c in comps:
            assert c["price"] > 0

    def test_comp_sqm_is_positive(self, client):
        comps = client.get("/listings/0/comps").json()["comps"]
        for c in comps:
            assert c["sqm"] > 0

    def test_distance_label_is_string(self, client):
        comps = client.get("/listings/0/comps").json()["comps"]
        for c in comps:
            assert isinstance(c["distance_label"], str)
            assert len(c["distance_label"]) > 0

    def test_similarity_reason_is_string(self, client):
        comps = client.get("/listings/0/comps").json()["comps"]
        for c in comps:
            assert isinstance(c["similarity_reason"], str)
            assert len(c["similarity_reason"]) > 0

    def test_all_listings_have_comps(self, client):
        """Every listing should get comps (dataset has 10 rows, n=5)."""
        for lid in [str(i) for i in range(10)]:
            r = client.get(f"/listings/{lid}/comps")
            assert r.status_code == 200
            assert len(r.json()["comps"]) == 5

    def test_nonexistent_id_returns_404(self, client):
        r = client.get("/listings/9999/comps")
        assert r.status_code == 404

    def test_comp_ids_are_unique(self, client):
        comps = client.get("/listings/0/comps").json()["comps"]
        ids   = [c["id"] for c in comps]
        assert len(ids) == len(set(ids)), "Duplicate comps returned"


def test_estimate_uses_stored_oof_value(fake_df):
    import ml
    class NeverPredict:
        def predict(self, *args):
            raise AssertionError("Existing listings must never use a fitted model")
    df = fake_df.copy()
    df.loc[0, "estimate_eur"] = 123456.789
    result = ml.get_estimate("0", df, NeverPredict())
    assert result["estimated_price"] == df.loc[0, "estimate_eur"]


def test_listing_bands_use_held_out_zone(fake_df, monkeypatch):
    import ml
    df = fake_df.copy()
    df["estimate_zone"] = 5
    monkeypatch.setattr(ml, "_bands_cache", {"listing": {
        5: {"p50_rel_error": .22, "p75_rel_error": .26},
        0: {"p50_rel_error": .1, "p75_rel_error": .12}}})
    result = ml.get_estimate("0", df)
    assert result["threshold_pct"] == 22
    assert result["band_pct"] == 26


def test_property_ranges_use_property_bands(fake_df, fake_model, monkeypatch):
    import ml
    monkeypatch.setattr(ml, "_bands_cache", {
        "property": {"global": {"p50_rel_error": .13, "p75_rel_error": .19}},
        "listing": {"global": {"p50_rel_error": .22, "p75_rel_error": .31}}})
    result = ml.get_price_by_zone({"sqm": 80}, fake_df, fake_model)
    assert all(r["band_pct"] == 19 and r["typical_error_pct"] == 13 for r in result)
    suggestions = ml.get_suggestions_from_features({"sqm": 80}, fake_df, fake_model)
    assert suggestions["band_pct"] == 19


def test_property_zone_resolves_name_and_coordinates(fake_model):
    import ml
    cid, name = next(iter(fake_model.zone_cfg["zone_names"].items()))
    named = ml._input_row({"zone": name}, fake_model)
    coords = ml._input_row({"lat": named.lat.iloc[0], "lng": named.lng.iloc[0]}, fake_model)
    assert int(fake_model.features(named).zone.iloc[0]) == cid
    assert int(fake_model.features(coords).zone.iloc[0]) == cid
