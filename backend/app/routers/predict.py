"""
Predict router  —  POST /predict/by-zone
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel

from app.data.loader import get_df, get_model
from ml import get_price_by_zone, get_feature_explanation

router = APIRouter(tags=["Predict"])

# ── Growth rate methodology ───────────────────────────────────────────────────
# Source: Albanian INSTAT housing price index + World Bank Albania property data
# 2018-2024 avg annual nominal appreciation by zone type:
#   Qendra / premium urban:  ~7-8% (demand > supply, gentrification pressure)
#   Mixed mid-ring:          ~5-6%
#   Periphery / suburban:    ~4-5%
# We use conservative midpoints. These are estimates, not guarantees.
# Growth rates keyed on substrings of zone names produced by train_model.py:
#   "Qendra & Blloku", "Qendra A"          → 7.5%
#   "Zona e Mesme A",  "Zona e Mesme B"    → 5.5%
#   "Periferia A",     "Periferia B"       → 4.5%
# Source: INSTAT + World Bank Albania 2018-2024 nominal appreciation.
_GROWTH_BY_ZONE_NAME = {
    "qendra":   0.075,   # Qendra & Blloku / Qendra A
    "blloku":   0.075,
    "zona e mesme": 0.055,  # Zona e Mesme A / B
    "mesme":    0.055,
    "periferia":0.045,   # Periferia A / B
    "periferik":0.045,
}
_GROWTH_DEFAULT = 0.055

def _growth_for_zone(zone_name: str) -> float:
    zl = zone_name.lower()
    for kw, rate in _GROWTH_BY_ZONE_NAME.items():
        if kw in zl:
            return rate
    return _GROWTH_DEFAULT


class PredictRequest(BaseModel):
    living_rooms: Optional[int] = None
    balconies: Optional[int] = None
    furnishing_status: Optional[str] = None
    has_terrace: Optional[bool] = None
    has_garden: Optional[bool] = None
    has_garage: Optional[bool] = None
    has_carport: Optional[bool] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    zone: Optional[str] = None
    sqm:               Optional[float] = None
    floor:             Optional[float] = None
    beds:              Optional[int]   = None
    baths:             Optional[float] = None
    has_elevator:      Optional[bool]  = False
    has_parking_space: Optional[bool]  = False


class FeatureInsight(BaseModel):
    feature:        str
    label:          str
    user_value:     float
    zone_median:    float
    unit:           str
    importance_pct: float
    direction:      str
    insight:        str


class FuturePrice(BaseModel):
    years:       int
    price:       float
    growth_rate: float   # annual %


class ZonePrediction(BaseModel):
    cluster_id:              int
    zone_name:               str
    estimated_price:         float
    price_per_sqm:           float
    range_low:               float
    range_high:              float
    typical_error_pct:       float
    band_pct:                float
    avg_zone_price:          float
    avg_zone_price_per_sqm:  float
    listing_count:           int
    future_prices:           list[FuturePrice]


class PredictResponse(BaseModel):
    zones:            list[ZonePrediction]
    sqm:              float
    # Single common feature importance (model-level, not per-zone)
    feature_insights: list[FeatureInsight]
    growth_note:      str


@router.post("/predict/by-zone", response_model=PredictResponse)
def predict_by_zone(body: PredictRequest, df=Depends(get_df), model=Depends(get_model)):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    features = body.model_dump(exclude_none=True)

    try:
        zones = get_price_by_zone(features=features, df=df, model=model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # ── Feature importance: one shared view using overall median cluster ───────
    # Pick the middle zone (index 1) as representative, or fall back to 0
    rep_cluster = zones[1]["cluster_id"] if len(zones) > 1 else zones[0]["cluster_id"]
    try:
        common_insights = get_feature_explanation(
            features=features, cluster_id=rep_cluster, df=df, model=model,
        )
    except Exception:
        common_insights = []

    # ── Per-zone: only future prices (no per-zone feature bars) ──────────────
    enriched = []
    for zone in zones:
        rate   = _growth_for_zone(zone["zone_name"])
        future = [
            FuturePrice(
                years=yr,
                price=round(zone["estimated_price"] * ((1 + rate) ** yr), 2),
                growth_rate=round(rate * 100, 1),
            )
            for yr in [2, 5]
        ]
        enriched.append(ZonePrediction(**zone, future_prices=future))

    growth_note = (
        "Normat e rritjes vijnë nga të dhënat e INSTAT dhe Bankës Botërore "
        "për tregun shqiptar 2018-2024: Qendra & Blloku ~7.5%/vit, "
        "Zona e Mesme ~5.5%/vit, Periferia ~4.5%/vit (mesatare nominale). "
        "Nuk janë garanci kthimi."
    )

    return PredictResponse(
        zones=enriched,
        sqm=body.sqm or 80.0,
        feature_insights=[FeatureInsight(**i) for i in common_insights],
        growth_note=growth_note,
    )