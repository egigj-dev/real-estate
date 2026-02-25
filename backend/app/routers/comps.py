"""
Comps router
------------
GET /listings/{id}/comps  — top-5 comparable listings
"""

from fastapi import APIRouter, Depends, HTTPException

from app.config import N_COMPS
from app.data.loader import get_df
from app.schemas import CompsResponse
from app.services import ml_service

router = APIRouter(tags=["ML"])


@router.get("/listings/{listing_id}/comps", response_model=CompsResponse)
def comps(listing_id: str, n: int = N_COMPS, df=Depends(get_df)):
    try:
        return ml_service.comps(listing_id, df, n=n)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Comps error: {exc}")
