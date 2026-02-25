"""
ml_service.py
-------------
Thin wrapper around the core ML logic in ml/ml.py.
Converts raw dicts → Pydantic response models.
Keeps routers completely free of ML internals.
"""

from typing import Any

import pandas as pd

from app.schemas import EstimateResponse, CompItem, CompsResponse

# ml.py lives at the project root (backend/ml.py)
from ml import get_estimate as _get_estimate, get_comps as _get_comps


def estimate(listing_id: str, df: pd.DataFrame, model: Any) -> EstimateResponse:
    result = _get_estimate(listing_id, df, model)
    return EstimateResponse(listing_id=listing_id, **result)


def comps(listing_id: str, df: pd.DataFrame, n: int = 5) -> CompsResponse:
    raw = _get_comps(listing_id, df, n=n)
    items = [
        CompItem(
            id=str(c["id"]),
            price=c["price"],
            sqm=c["sqm"],
            rooms=c["rooms"],
            distance_label=c["distance_label"],
            similarity_reason=c["similarity_reason"],
        )
        for c in raw
    ]
    return CompsResponse(listing_id=listing_id, comps=items)
