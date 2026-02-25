"""
listing_service.py
------------------
Pure business logic for filtering, paginating, and serialising listings.
No HTTP concerns here — just DataFrame operations.
"""

import math
from typing import Any, Optional

import numpy as np
import pandas as pd

from app.schemas import ListingSummary, ListingDetail, PaginatedListings, FilterOptions

# Columns returned in summary (card) view
_SUMMARY_COLS = [
    "id", "price", "sqm", "beds", "baths", "floor",
    "furnished", "furnishing_status",
    "neighborhood", "neighborhood_cluster",
    "property_type", "latitude", "longitude",
    "price_per_sqm", "total_rooms",
]

# Extra columns returned in detail view
_DETAIL_EXTRA_COLS = [
    "description", "property_status",
    "has_elevator", "has_parking_space", "has_carport",
    "has_garage", "has_garden", "has_terrace",
    "balconies", "living_rooms", "city",
    "dist_to_nearest_center", "distance_from_center",
]


def _safe(val: Any) -> Any:
    """Coerce numpy scalars; replace NaN / inf with None for JSON."""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, np.integer):
        return int(val)
    if isinstance(val, np.floating):
        v = float(val)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(val, np.bool_):
        return bool(val)
    return val


def _row_to_dict(row: pd.Series, cols: list[str]) -> dict:
    return {col: _safe(row.get(col)) for col in cols if col in row.index}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def filter_listings(
    df: pd.DataFrame,
    # free-text
    q:                 Optional[str]   = None,
    # price
    min_price:         Optional[float] = None,
    max_price:         Optional[float] = None,
    # beds / baths
    min_beds:          Optional[int]   = None,
    max_beds:          Optional[int]   = None,
    min_baths:         Optional[float] = None,
    max_baths:         Optional[float] = None,
    # size
    min_sqm:           Optional[float] = None,
    max_sqm:           Optional[float] = None,
    # amenities
    furnished:         Optional[bool]  = None,
    has_elevator:      Optional[bool]  = None,
    has_parking_space: Optional[bool]  = None,
    has_garden:        Optional[bool]  = None,
    # categorical
    neighborhood:      Optional[str]   = None,
    property_type:     Optional[str]   = None,
    # sort
    sort:              Optional[str]   = None,
    # pagination
    page:              int = 1,
    per_page:          int = 20,
) -> PaginatedListings:

    mask = pd.Series(True, index=df.index)

    # ── free-text search across description + property_type + city ────────────
    if q:
        q_lower = q.lower()
        hay = (
            df.get("description",    pd.Series("", index=df.index)).fillna("") + " " +
            df.get("property_type",  pd.Series("", index=df.index)).fillna("") + " " +
            df.get("city",           pd.Series("", index=df.index)).fillna("") + " " +
            df.get("neighborhood",   pd.Series("", index=df.index)).fillna("")
        ).str.lower()
        mask &= hay.str.contains(q_lower, na=False, regex=False)

    # ── numeric filters ───────────────────────────────────────────────────────
    if min_price     is not None: mask &= df["price"].astype(float) >= min_price
    if max_price     is not None: mask &= df["price"].astype(float) <= max_price
    if min_beds      is not None: mask &= df["beds"].astype(int)    >= min_beds
    if max_beds      is not None: mask &= df["beds"].astype(int)    <= max_beds
    if min_baths     is not None: mask &= df["baths"].astype(float) >= min_baths
    if max_baths     is not None: mask &= df["baths"].astype(float) <= max_baths
    if min_sqm       is not None: mask &= df["sqm"].astype(float)   >= min_sqm
    if max_sqm       is not None: mask &= df["sqm"].astype(float)   <= max_sqm

    # ── boolean amenity filters ───────────────────────────────────────────────
    if furnished is not None:
        mask &= df["furnished"] == furnished
    if has_elevator is not None and "has_elevator" in df.columns:
        mask &= df["has_elevator"].astype(bool) == has_elevator
    if has_parking_space is not None and "has_parking_space" in df.columns:
        mask &= df["has_parking_space"].astype(bool) == has_parking_space
    if has_garden is not None and "has_garden" in df.columns:
        mask &= df["has_garden"].astype(bool) == has_garden

    # ── categorical filters ───────────────────────────────────────────────────
    if neighborhood is not None:
        mask &= df["neighborhood"].str.lower() == neighborhood.lower()
    if property_type is not None:
        mask &= df["property_type"].str.lower() == property_type.lower()

    filtered = df[mask].copy()

    # ── sort ──────────────────────────────────────────────────────────────────
    if sort == "price_asc":
        filtered = filtered.sort_values("price", ascending=True)
    elif sort == "price_desc":
        filtered = filtered.sort_values("price", ascending=False)

    total  = len(filtered)
    offset = (page - 1) * per_page
    page_df = filtered.iloc[offset: offset + per_page]

    listings = [
        ListingSummary(**_row_to_dict(row, _SUMMARY_COLS))
        for _, row in page_df.iterrows()
    ]

    return PaginatedListings(
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
        listings=listings,
    )


def get_listing_detail(listing_id: str, df: pd.DataFrame) -> ListingDetail:
    mask = df["id"] == listing_id
    if not mask.any():
        raise KeyError(listing_id)
    row  = df[mask].iloc[0]
    data = _row_to_dict(row, _SUMMARY_COLS + _DETAIL_EXTRA_COLS)
    return ListingDetail(**data)


def get_filter_options(df: pd.DataFrame) -> FilterOptions:
    neighborhoods  = sorted(df["neighborhood"].dropna().unique().tolist())
    property_types = sorted(df["property_type"].dropna().unique().tolist()) if "property_type" in df.columns else []
    furnished_opts = sorted(df["furnishing_status"].dropna().unique().tolist()) if "furnishing_status" in df.columns else []

    return FilterOptions(
        neighborhoods=neighborhoods,
        property_types=property_types,
        furnished_options=furnished_opts,
        price_range={"min": float(df["price"].min()), "max": float(df["price"].max())},
        sqm_range={"min": float(df["sqm"].min()),     "max": float(df["sqm"].max())},
        beds_range={"min": int(df["beds"].min()),      "max": int(df["beds"].max())},
        baths_range={"min": float(df["baths"].min()),  "max": float(df["baths"].max())},
    )