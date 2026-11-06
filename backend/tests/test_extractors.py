"""Price parsing from Albanian listing descriptions."""

import pytest

from extractors import PriceExtractor, parse_number


@pytest.mark.parametrize("raw, value", [
    ("1.200", 1200.0), ("1,200", 1200.0), ("1 200", 1200.0),
    ("120.000", 120000.0), ("1,5", 1.5), ("950", 950.0),
])
def test_parse_number_handles_thousand_separators(raw, value):
    assert parse_number(raw) == value


@pytest.mark.parametrize("text, value", [
    ("Cmimi 1,200 €/m2", 1200.0),
    ("cmimi 1.450 euro/m²", 1450.0),
    ("vetem 980 € per m2", 980.0),
])
def test_per_square_metre_rates(text, value):
    assert PriceExtractor().extract(text) == (value, "per_sqm")


def test_implausible_per_square_metre_rate_is_ignored():
    assert PriceExtractor().extract("1,2 €/m2 shpenzime mirembajtje") == (None, None)


def test_total_price_with_thousand_separators():
    assert PriceExtractor().extract("Cmimi: € 125.000") == (125000.0, "total")
