"""
Pydantic response models.
These are the contracts between backend and frontend.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Listing
# ---------------------------------------------------------------------------

class ListingSummary(BaseModel):
    id:                   str
    price:                float
    sqm:                  float
    beds:                 int
    baths:                Optional[float]
    floor:                Optional[float]
    furnished:            bool
    furnishing_status:    Optional[str]
    neighborhood:         Optional[str]
    neighborhood_cluster: Optional[float]
    property_type:        Optional[str]
    latitude:             Optional[float]
    longitude:            Optional[float]
    price_per_sqm:        Optional[float]
    total_rooms:          Optional[float]


class ListingDetail(ListingSummary):
    description:           Optional[str]
    property_status:       Optional[str]
    has_elevator:          Optional[bool]
    has_parking_space:     Optional[bool]
    has_carport:           Optional[bool]
    has_garage:            Optional[bool]
    has_garden:            Optional[bool]
    has_terrace:           Optional[bool]
    balconies:             Optional[float]
    living_rooms:          Optional[float]
    city:                  Optional[str]
    dist_to_nearest_center: Optional[float]
    distance_from_center:  Optional[float]


# ---------------------------------------------------------------------------
# Paginated listings
# ---------------------------------------------------------------------------

class PaginatedListings(BaseModel):
    total:    int
    page:     int
    per_page: int
    pages:    int
    listings: list[ListingSummary]


# ---------------------------------------------------------------------------
# ML Estimate
# ---------------------------------------------------------------------------

class EstimateResponse(BaseModel):
    listing_id:      str
    estimated_price: float
    range_low:       float
    range_high:      float
    label:           str          # "Fair" | "Overpriced" | "Underpriced"


# ---------------------------------------------------------------------------
# Comps
# ---------------------------------------------------------------------------

class CompItem(BaseModel):
    id:                str
    price:             float
    sqm:               float
    rooms:             int
    distance_label:    str
    similarity_reason: str


class CompsResponse(BaseModel):
    listing_id: str
    comps:      list[CompItem]


# ---------------------------------------------------------------------------
# Market insights
# ---------------------------------------------------------------------------

class NeighborhoodInsight(BaseModel):
    neighborhood:      str
    avg_price_per_sqm: float
    avg_price:         float
    listing_count:     int


class MarketInsights(BaseModel):
    overall_median_price:         float
    overall_median_price_per_sqm: float
    neighborhood_count:           int
    neighborhoods:                list[NeighborhoodInsight]


# ---------------------------------------------------------------------------
# Filter options  (for dynamic dropdowns)
# ---------------------------------------------------------------------------

class RangeOption(BaseModel):
    min: float
    max: float

class IntRangeOption(BaseModel):
    min: int
    max: int

class FilterOptions(BaseModel):
    neighborhoods:    list[str]
    property_types:   list[str]
    furnished_options: list[str]
    price_range:      RangeOption
    sqm_range:        RangeOption
    beds_range:       IntRangeOption
    baths_range:      RangeOption
