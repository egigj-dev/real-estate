"""
Estimates router
----------------
GET /listings/{id}/estimate  — ML price estimate + label
"""

from fastapi import APIRouter, Depends, HTTPException

import math

from app.data.loader import get_df, get_model
from app.schemas import EstimateResponse
from app.services import ml_service

router = APIRouter(tags=["ML"])


@router.get("/listings/{listing_id}/estimate", response_model=EstimateResponse)
def estimate(listing_id: str, df=Depends(get_df), model=Depends(get_model)):
    rows = df[df["id"].astype(str) == listing_id]
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")
    value = rows.iloc[0].get("estimate_eur")
    if model is None or value is None or not math.isfinite(float(value)):
        raise HTTPException(status_code=503, detail=(
            "Estimates unavailable: no trained model is installed." if model is None else
            "Estimates unavailable: no trained model is installed for this listing; no stored held-out estimate is available."))
    try:
        return ml_service.estimate(listing_id, df, None)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Estimation error: {exc}")
