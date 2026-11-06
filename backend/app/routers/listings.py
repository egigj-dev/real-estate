"""
Listings router
GET /listings            — paginated, filtered list
GET /listings/{id}       — full detail
GET /filters/options     — dynamic dropdown values
GET /areas               — OSM sub-area polygons for frontend map
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from app.config import DEFAULT_PAGE, DEFAULT_PER_PAGE, MAX_PER_PAGE
from app.data.loader import get_df
from app.schemas import PaginatedListings, ListingDetail, FilterOptions
from app.services.listing_service import filter_listings, get_listing_detail, get_filter_options

router = APIRouter(prefix="/listings", tags=["Listings"])


@router.get("", response_model=PaginatedListings)
def list_listings(
    q:                 Optional[str]   = Query(default=None),
    min_price:         Optional[float] = Query(default=None),
    max_price:         Optional[float] = Query(default=None),
    min_beds:          Optional[int]   = Query(default=None, ge=0),
    max_beds:          Optional[int]   = Query(default=None, ge=0),
    min_baths:         Optional[float] = Query(default=None, ge=0),
    max_baths:         Optional[float] = Query(default=None, ge=0),
    min_sqm:           Optional[float] = Query(default=None, ge=0),
    max_sqm:           Optional[float] = Query(default=None, ge=0),
    furnished:         Optional[bool]  = Query(default=None),
    has_elevator:      Optional[bool]  = Query(default=None),
    has_parking_space: Optional[bool]  = Query(default=None),
    has_garden:        Optional[bool]  = Query(default=None),
    neighborhood:      Optional[str]   = Query(default=None),   # KMeans zone (legacy)
    area_name:         Optional[str]   = Query(default=None),   # OSM sub-area (new)
    property_type:     Optional[str]   = Query(default=None),
    sort:              Optional[str]   = Query(default=None),
    page:    int = Query(default=DEFAULT_PAGE,     ge=1),
    per_page:int = Query(default=DEFAULT_PER_PAGE, ge=1, le=MAX_PER_PAGE),
    df=Depends(get_df),
):
    return filter_listings(
        df, q=q,
        min_price=min_price, max_price=max_price,
        min_beds=min_beds,   max_beds=max_beds,
        min_baths=min_baths, max_baths=max_baths,
        min_sqm=min_sqm,     max_sqm=max_sqm,
        furnished=furnished,
        has_elevator=has_elevator,
        has_parking_space=has_parking_space,
        has_garden=has_garden,
        neighborhood=neighborhood,
        area_name=area_name,
        property_type=property_type,
        sort=sort,
        page=page, per_page=per_page,
    )


@router.get("/{listing_id}", response_model=ListingDetail)
def listing_detail(listing_id: str, df=Depends(get_df)):
    try:
        return get_listing_detail(listing_id, df)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")


# ── Filter options ────────────────────────────────────────────────────────────
filters_router = APIRouter(prefix="/filters", tags=["Filters"])

@filters_router.get("/options", response_model=FilterOptions)
def filter_options(df=Depends(get_df)):
    return get_filter_options(df)


# ── OSM areas endpoint ────────────────────────────────────────────────────────
areas_router = APIRouter(tags=["Areas"])

@areas_router.get("/areas")
def get_osm_areas():
    """
    Returns list of OSM sub-area polygons for frontend display.
    Each item: { name, osm_id, admin_level, bbox, polygon }
    polygon is a list of [lat, lon] pairs.
    """
    try:
        from app.data.areas import get_areas
        areas = get_areas()
        # Convert polygon tuples to lists for JSON serialisation
        return [
            {**a, "polygon": [[p[0], p[1]] for p in a["polygon"]]}
            for a in areas
        ]
    except Exception as e:
        return []