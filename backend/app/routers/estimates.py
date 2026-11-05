"""
Estimates router
----------------
GET /listings/{id}/estimate  — ML price estimate + label
"""

from fastapi import APIRouter, Depends, HTTPException

from app.data.loader import get_df, get_model
from app.schemas import EstimateResponse
from app.services import ml_service

router = APIRouter(tags=["ML"])


@router.get("/listings/{listing_id}/estimate", response_model=EstimateResponse)
def estimate(listing_id: str, df=Depends(get_df), model=Depends(get_model)):
    if not (df["id"] == listing_id).any():
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Estimates unavailable: trained model and scaler are required. See backend/README.md.",
        )
    try:
        return ml_service.estimate(listing_id, df, model)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Listing '{listing_id}' not found")
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Estimates unavailable: scaler is missing.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Estimation error: {exc}")
