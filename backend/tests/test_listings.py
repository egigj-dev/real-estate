"""
tests/test_listings.py
----------------------
Tests for:
    GET /listings          (list + filter)
    GET /listings/{id}     (detail)
    GET /filters/options   (dynamic dropdowns)
"""

import pytest


class TestListListings:
    """GET /listings — baseline behaviour"""

    def test_returns_200(self, client):
        r = client.get("/listings")
        assert r.status_code == 200

    def test_response_shape(self, client):
        body = client.get("/listings").json()
        assert "total" in body
        assert "page" in body
        assert "per_page" in body
        assert "pages" in body
        assert "listings" in body
        assert isinstance(body["listings"], list)

    def test_returns_all_rows_by_default(self, client):
        body = client.get("/listings").json()
        assert body["total"] == 10

    def test_listing_has_required_fields(self, client):
        listing = client.get("/listings").json()["listings"][0]
        required = ["id", "price", "sqm", "beds", "baths", "furnished", "neighborhood"]
        for field in required:
            assert field in listing, f"Missing field: {field}"

    def test_pagination_page_1(self, client):
        body = client.get("/listings?page=1&per_page=3").json()
        assert len(body["listings"]) == 3
        assert body["page"] == 1
        assert body["pages"] == 4   # ceil(10 / 3)

    def test_pagination_page_2(self, client):
        body = client.get("/listings?page=2&per_page=3").json()
        assert len(body["listings"]) == 3

    def test_pagination_last_page(self, client):
        body = client.get("/listings?page=4&per_page=3").json()
        assert len(body["listings"]) == 1   # 10 - 9 = 1 remaining

    def test_pagination_beyond_last_page(self, client):
        body = client.get("/listings?page=99&per_page=20").json()
        assert body["listings"] == []
        assert body["total"] == 10


class TestPriceFilter:
    def test_min_price(self, client):
        body = client.get("/listings?min_price=100000").json()
        for l in body["listings"]:
            assert l["price"] >= 100000

    def test_max_price(self, client):
        body = client.get("/listings?max_price=70000").json()
        for l in body["listings"]:
            assert l["price"] <= 70000

    def test_price_range(self, client):
        body = client.get("/listings?min_price=60000&max_price=100000").json()
        for l in body["listings"]:
            assert 60000 <= l["price"] <= 100000

    def test_impossible_price_range_returns_empty(self, client):
        body = client.get("/listings?min_price=999999&max_price=1000000").json()
        assert body["total"] == 0
        assert body["listings"] == []


class TestBedsFilter:
    def test_min_beds(self, client):
        body = client.get("/listings?min_beds=3").json()
        for l in body["listings"]:
            assert l["beds"] >= 3

    def test_max_beds(self, client):
        body = client.get("/listings?max_beds=2").json()
        for l in body["listings"]:
            assert l["beds"] <= 2

    def test_exact_beds(self, client):
        body = client.get("/listings?min_beds=2&max_beds=2").json()
        for l in body["listings"]:
            assert l["beds"] == 2


class TestSqmFilter:
    def test_min_sqm(self, client):
        body = client.get("/listings?min_sqm=100").json()
        for l in body["listings"]:
            assert l["sqm"] >= 100

    def test_max_sqm(self, client):
        body = client.get("/listings?max_sqm=60").json()
        for l in body["listings"]:
            assert l["sqm"] <= 60


class TestFurnishedFilter:
    def test_furnished_true(self, client):
        body = client.get("/listings?furnished=true").json()
        assert body["total"] > 0
        for l in body["listings"]:
            assert l["furnished"] is True

    def test_furnished_false(self, client):
        body = client.get("/listings?furnished=false").json()
        assert body["total"] > 0
        for l in body["listings"]:
            assert l["furnished"] is False


class TestNeighborhoodFilter:
    def test_cluster_0(self, client):
        body = client.get("/listings?neighborhood=Cluster 0").json()
        for l in body["listings"]:
            assert l["neighborhood"] == "Cluster 0"

    def test_case_insensitive(self, client):
        lower = client.get("/listings?neighborhood=cluster 0").json()
        upper = client.get("/listings?neighborhood=Cluster 0").json()
        assert lower["total"] == upper["total"]

    def test_unknown_neighborhood_returns_empty(self, client):
        body = client.get("/listings?neighborhood=Nowhere").json()
        assert body["total"] == 0


class TestCombinedFilters:
    def test_price_and_beds(self, client):
        body = client.get("/listings?min_price=50000&max_price=120000&min_beds=2").json()
        for l in body["listings"]:
            assert 50000 <= l["price"] <= 120000
            assert l["beds"] >= 2

    def test_all_filters_combined(self, client):
        body = client.get(
            "/listings?min_price=60000&max_price=160000"
            "&min_beds=2&max_beds=3"
            "&min_sqm=60&max_sqm=120"
            "&furnished=true"
        ).json()
        for l in body["listings"]:
            assert 60000 <= l["price"] <= 160000
            assert 2 <= l["beds"] <= 3
            assert 60 <= l["sqm"] <= 120
            assert l["furnished"] is True


class TestListingDetail:
    """GET /listings/{id}"""

    def test_existing_id_returns_200(self, client):
        r = client.get("/listings/0")
        assert r.status_code == 200

    def test_detail_has_all_summary_fields(self, client):
        l = client.get("/listings/0").json()
        for field in ["id", "price", "sqm", "beds", "baths", "furnished", "neighborhood"]:
            assert field in l

    def test_detail_has_extra_fields(self, client):
        l = client.get("/listings/0").json()
        for field in ["description", "has_elevator", "has_terrace"]:
            assert field in l

    def test_description_is_string(self, client):
        l = client.get("/listings/0").json()
        assert isinstance(l["description"], str)

    def test_nonexistent_id_returns_404(self, client):
        r = client.get("/listings/9999")
        assert r.status_code == 404

    def test_id_matches_requested(self, client):
        l = client.get("/listings/3").json()
        assert l["id"] == "3"


class TestFilterOptions:
    """GET /filters/options — skipped if endpoint not registered in this main.py"""

    def _get(self, client):
        r = client.get("/filters/options")
        if r.status_code == 404:
            pytest.skip("/filters/options not registered in this main.py version")
        return r

    def test_returns_200(self, client):
        r = self._get(client)
        assert r.status_code == 200

    def test_has_required_keys(self, client):
        body = self._get(client).json()
        for key in ["neighborhoods", "price_range", "sqm_range", "beds_range", "baths_range"]:
            assert key in body

    def test_price_range_is_valid(self, client):
        pr = self._get(client).json()["price_range"]
        assert pr["min"] < pr["max"]
        assert pr["min"] >= 0

    def test_neighborhoods_is_list(self, client):
        nb = self._get(client).json()["neighborhoods"]
        assert isinstance(nb, list)
        assert len(nb) > 0

    def test_beds_range_integers(self, client):
        br = self._get(client).json()["beds_range"]
        assert isinstance(br["min"], int)
        assert isinstance(br["max"], int)