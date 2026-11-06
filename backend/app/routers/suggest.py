"""
Suggest router — POST /suggest
Finds listings that best match described property features.

Area → cluster resolution
--------------------------
Users pick an OSM area name (e.g. "Blloku", "Komuna e Parisit").
We map it to a neighborhood_cluster by finding which cluster_id appears
most among listings in that area.  KMeans stays internal to ML.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import pandas as pd

from app.data.loader import get_df, get_model
from ml import get_suggestions_from_features

router = APIRouter(tags=["Suggest"])


class SuggestRequest(BaseModel):
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
    has_elevator:      Optional[bool]  = None
    has_parking_space: Optional[bool]  = None
    neighborhood:      Optional[str]   = None  # OSM area name
    n:                 int = 10


def _resolve_cluster(area_name: str | None, df: pd.DataFrame) -> int | None:
    """
    Map an OSM area name → neighborhood_cluster integer.

    Order of attempts:
    1. Exact match on area_name column
    2. Exact match on neighborhood column (KMeans zone name fallback)
    3. Partial/contains on area_name
    4. Partial/contains on neighborhood
    Returns most-common cluster_id among matched listings.
    """
    if not area_name:
        return None
    if "neighborhood_cluster" not in df.columns:
        return None

    nl = area_name.strip().lower()

    def most_common_cluster(mask) -> int | None:
        if not mask.any():
            return None
        return int(df.loc[mask, "neighborhood_cluster"].mode().iloc[0])

    # 1. Exact area_name
    if "area_name" in df.columns:
        result = most_common_cluster(df["area_name"].str.lower() == nl)
        if result is not None:
            return result

    # 2. Exact neighborhood
    if "neighborhood" in df.columns:
        result = most_common_cluster(df["neighborhood"].str.lower() == nl)
        if result is not None:
            return result

    # 3. Contains area_name
    if "area_name" in df.columns:
        result = most_common_cluster(
            df["area_name"].str.lower().str.contains(nl, regex=False, na=False))
        if result is not None:
            return result

    # 4. Contains neighborhood
    if "neighborhood" in df.columns:
        result = most_common_cluster(
            df["neighborhood"].str.lower().str.contains(nl, regex=False, na=False))
        if result is not None:
            return result

    return None


@router.post("/suggest")
def suggest(body: SuggestRequest, df=Depends(get_df), model=Depends(get_model)):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    cluster_id = _resolve_cluster(body.neighborhood, df)

    features = body.model_dump(exclude_none=True, exclude={"n"})
    features["neighborhood_cluster"] = cluster_id

    try:
        result = get_suggestions_from_features(features, df, model, n=body.n)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {**result, "neighborhood": body.neighborhood}