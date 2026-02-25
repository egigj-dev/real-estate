"""
tests/test_market.py
--------------------
Tests for:
    GET /market/insights
    GET /health
"""


class TestMarketInsights:
    """GET /market/insights"""

    def test_returns_200(self, client):
        r = client.get("/market/insights")
        assert r.status_code == 200

    def test_response_shape(self, client):
        body = client.get("/market/insights").json()
        assert "overall_median_price"         in body
        assert "overall_median_price_per_sqm" in body
        assert "neighborhood_count"           in body
        assert "neighborhoods"                in body

    def test_overall_median_is_positive(self, client):
        body = client.get("/market/insights").json()
        assert body["overall_median_price"] > 0
        assert body["overall_median_price_per_sqm"] > 0

    def test_neighborhoods_list_is_not_empty(self, client):
        body = client.get("/market/insights").json()
        assert len(body["neighborhoods"]) > 0

    def test_neighborhood_count_matches_list(self, client):
        body = client.get("/market/insights").json()
        assert body["neighborhood_count"] == len(body["neighborhoods"])

    def test_neighborhood_shape(self, client):
        nb = client.get("/market/insights").json()["neighborhoods"][0]
        assert "neighborhood"      in nb
        assert "avg_price_per_sqm" in nb
        assert "avg_price"         in nb
        assert "listing_count"     in nb

    def test_avg_price_per_sqm_positive(self, client):
        for nb in client.get("/market/insights").json()["neighborhoods"]:
            assert nb["avg_price_per_sqm"] > 0

    def test_listing_count_sums_to_total(self, client):
        body = client.get("/market/insights").json()
        total = sum(nb["listing_count"] for nb in body["neighborhoods"])
        assert total == 10  # all rows in fake_df

    def test_sorted_by_price_per_sqm_descending(self, client):
        nbs = client.get("/market/insights").json()["neighborhoods"]
        prices = [nb["avg_price_per_sqm"] for nb in nbs]
        assert prices == sorted(prices, reverse=True)


class TestHealth:
    """GET /health"""

    def test_returns_200(self, client):
        r = client.get("/health")
        assert r.status_code == 200

    def test_status_ok(self, client):
        body = client.get("/health").json()
        assert body["status"] == "ok"

    def test_listings_loaded(self, client):
        body = client.get("/health").json()
        assert body["listings_loaded"] == 10

    def test_model_loaded(self, client):
        body = client.get("/health").json()
        assert body["model_loaded"] is True
