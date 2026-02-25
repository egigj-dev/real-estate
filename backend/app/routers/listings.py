"""
Listings router
---------------
GET /listings            — paginated, filtered list
GET /listings/{id}       — full detail
GET /filters/options     — dynamic dropdown values for the frontend
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends

from app.config import DEFAULT_PAGE, DEFAULT_PER_PAGE, MAX_PER_PAGE
from app.data.loader import get_df
from app.schemas import PaginatedListings, ListingDetail, FilterOptions
from app.services.listing_service import (
    filter_listings,
    get_listing_detail,
    get_filter_options,
)

router = APIRouter(prefix="/listings", tags=["Listings"])


@router.get("", response_model=PaginatedListings)
def list_listings(
    # ── free-text ─────────────────────────────────────────────────────────────
    q:             Optional[str]   = Query(default=None, description="Search in description, property type, city"),
    # ── price ─────────────────────────────────────────────────────────────────
    min_price:     Optional[float] = Query(default=None, description="Min price (EUR)"),
    max_price:     Optional[float] = Query(default=None, description="Max price (EUR)"),
    # ── beds / baths ──────────────────────────────────────────────────────────
    min_beds:      Optional[int]   = Query(default=None, ge=0),
    max_beds:      Optional[int]   = Query(default=None, ge=0),
    min_baths:     Optional[float] = Query(default=None, ge=0),
    max_baths:     Optional[float] = Query(default=None, ge=0),
    # ── size ──────────────────────────────────────────────────────────────────
    min_sqm:       Optional[float] = Query(default=None, ge=0),
    max_sqm:       Optional[float] = Query(default=None, ge=0),
    # ── amenity booleans ──────────────────────────────────────────────────────
    furnished:         Optional[bool] = Query(default=None, description="true = fully/partially furnished"),
    has_elevator:      Optional[bool] = Query(default=None),
    has_parking_space: Optional[bool] = Query(default=None),
    has_garden:        Optional[bool] = Query(default=None),
    # ── categorical ───────────────────────────────────────────────────────────
    neighborhood:  Optional[str]   = Query(default=None, description="e.g. 'Cluster 0'"),
    property_type: Optional[str]   = Query(default=None, description="e.g. 'apartment'"),
    # ── sort ──────────────────────────────────────────────────────────────────
    sort:          Optional[str]   = Query(default=None, description="'price_asc' | 'price_desc'"),
    # ── pagination ────────────────────────────────────────────────────────────
    page:     int = Query(default=DEFAULT_PAGE,     ge=1),
    per_page: int = Query(default=DEFAULT_PER_PAGE, ge=1, le=MAX_PER_PAGE),
    # ── dependency ────────────────────────────────────────────────────────────
    df=Depends(get_df),
):
    return filter_listings(
        df,
        q=q,
        min_price=min_price,     max_price=max_price,
        min_beds=min_beds,       max_beds=max_beds,
        min_baths=min_baths,     max_baths=max_baths,
        min_sqm=min_sqm,         max_sqm=max_sqm,
        furnished=furnished,
        has_elevator=has_elevator,
        has_parking_space=has_parking_space,
        has_garden=has_garden,
        neighborhood=neighborhood,
        property_type=property_type,
        sort=sort,
        page=page,
        per_page=per_page,
    )


@router.get("/{listing_id}", response_model=ListingDetail)
def listing_detail(listing_id: str, df=Depends(get_df)):
    try:
        return get_listing_detail(listing_id, df)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")


# ── filter options endpoint ───────────────────────────────────────────────────
filters_router = APIRouter(prefix="/filters", tags=["Filters"])


@filters_router.get("/options", response_model=FilterOptions)
def filter_options(df=Depends(get_df)):
    return get_filter_options(df)