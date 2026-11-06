"""Keyword parsing of free-text property requests."""

import pytest

from app.routers.chat import _keyword_parse


@pytest.mark.parametrize("text, beds", [
    ("apartament 1+1 ne Komunen e Parisit", 1),
    ("apartament 2+1 ne Bllok me ashensor", 2),
    ("kerkoj 3 + 1 me parkim", 3),
])
def test_albanian_n_plus_one_means_n_bedrooms(text, beds):
    assert _keyword_parse(text)["beds"] == beds
