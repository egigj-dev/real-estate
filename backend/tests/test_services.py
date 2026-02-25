"""
tests/test_services.py
----------------------
Unit tests for service functions directly — no HTTP layer.
These are fast and don't need the TestClient at all.
"""

import math
import pytest
import pandas as pd


class TestListingService:
    """app/services/listing_service.py"""

    def test_filter_by_price(self, fake_df):
        from app.services.listing_service import filter_listings
        result = filter_listings(fake_df, min_price=100000)
        for l in result.listings:
            assert l.price >= 100000

    def test_filter_by_beds(self, fake_df):
        from app.services.listing_service import filter_listings
        result = filter_listings(fake_df, min_beds=3, max_beds=3)
        for l in result.listings:
            assert l.beds == 3

    def test_pagination_total_correct(self, fake_df):
        from app.services.listing_service import filter_listings
        result = filter_listings(fake_df, page=1, per_page=20)
        assert result.total == 10

    def test_pagination_pages_calculated(self, fake_df):
        from app.services.listing_service import filter_listings
        result = filter_listings(fake_df, page=1, per_page=3)
        assert result.pages == math.ceil(10 / 3)

    def test_empty_result_pages_is_zero(self, fake_df):
        from app.services.listing_service import filter_listings
        result = filter_listings(fake_df, min_price=999_999_999)
        assert result.total == 0
        assert result.pages == 0
        assert result.listings == []

    def test_get_listing_detail_returns_description(self, fake_df):
        from app.services.listing_service import get_listing_detail
        detail = get_listing_detail("0", fake_df)
        assert detail.description == "Nice flat in Blloku"

    def test_get_listing_detail_raises_on_bad_id(self, fake_df):
        from app.services.listing_service import get_listing_detail
        with pytest.raises(KeyError):
            get_listing_detail("9999", fake_df)

    def test_filter_furnished_true(self, fake_df):
        from app.services.listing_service import filter_listings
        result = filter_listings(fake_df, furnished=True)
        for l in result.listings:
            assert l.furnished is True

    def test_filter_options_neighborhoods(self, fake_df):
        from app.services.listing_service import get_filter_options
        opts = get_filter_options(fake_df)
        assert "Cluster 0" in opts.neighborhoods
        assert "Cluster 1" in opts.neighborhoods
        assert "Cluster 2" in opts.neighborhoods

    def test_filter_options_price_range_valid(self, fake_df):
        from app.services.listing_service import get_filter_options
        opts = get_filter_options(fake_df)
        assert opts.price_range.min < opts.price_range.max
        assert opts.price_range.min == 45000.0
        assert opts.price_range.max == 200000.0


class TestMlService:
    """app/services/ml_service.py"""

    def test_estimate_returns_typed_response(self, fake_df, fake_model):
        from app.services.ml_service import estimate
        from app.schemas import EstimateResponse
        result = estimate("0", fake_df, fake_model)
        assert isinstance(result, EstimateResponse)

    def test_estimate_listing_id_correct(self, fake_df, fake_model):
        from app.services.ml_service import estimate
        result = estimate("5", fake_df, fake_model)
        assert result.listing_id == "5"

    def test_estimate_range_ordered(self, fake_df, fake_model):
        from app.services.ml_service import estimate
        for lid in ["0", "1", "2", "3", "4"]:
            r = estimate(lid, fake_df, fake_model)
            assert r.range_low < r.estimated_price < r.range_high, \
                f"Range not ordered for listing {lid}"

    def test_estimate_label_valid_values(self, fake_df, fake_model):
        from app.services.ml_service import estimate
        for lid in [str(i) for i in range(10)]:
            r = estimate(lid, fake_df, fake_model)
            assert r.label in ("Fair", "Overpriced", "Underpriced")

    def test_comps_returns_typed_response(self, fake_df, fake_model):
        from app.services.ml_service import comps
        from app.schemas import CompsResponse
        result = comps("0", fake_df, n=5)
        assert isinstance(result, CompsResponse)

    def test_comps_count(self, fake_df, fake_model):
        from app.services.ml_service import comps
        result = comps("0", fake_df, n=5)
        assert len(result.comps) == 5

    def test_comps_exclude_self(self, fake_df, fake_model):
        from app.services.ml_service import comps
        for lid in ["0", "1", "2"]:
            result = comps(lid, fake_df, n=5)
            ids = [c.id for c in result.comps]
            assert lid not in ids, f"Listing {lid} appears in its own comps"

    def test_comps_ids_are_unique(self, fake_df, fake_model):
        from app.services.ml_service import comps
        result = comps("0", fake_df, n=5)
        ids = [c.id for c in result.comps]
        assert len(ids) == len(set(ids))


class TestMarketService:
    """app/services/market_service.py"""

    def test_returns_typed_response(self, fake_df):
        from app.services.market_service import get_market_insights
        from app.schemas import MarketInsights
        result = get_market_insights(fake_df)
        assert isinstance(result, MarketInsights)

    def test_median_price_in_expected_range(self, fake_df):
        from app.services.market_service import get_market_insights
        result = get_market_insights(fake_df)
        assert 40000 < result.overall_median_price < 250000

    def test_three_clusters_present(self, fake_df):
        from app.services.market_service import get_market_insights
        result = get_market_insights(fake_df)
        names  = {nb.neighborhood for nb in result.neighborhoods}
        assert "Cluster 0" in names
        assert "Cluster 1" in names
        assert "Cluster 2" in names

    def test_listing_counts_sum_to_dataset(self, fake_df):
        from app.services.market_service import get_market_insights
        result = get_market_insights(fake_df)
        total  = sum(nb.listing_count for nb in result.neighborhoods)
        assert total == len(fake_df)
