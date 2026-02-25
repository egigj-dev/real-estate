"""
Market router
-------------
GET /market/insights  — neighborhood-level price statistics
"""

from fastapi import APIRouter, Depends

from app.data.loader import get_df
from app.schemas import MarketInsights
from app.services.market_service import get_market_insights

router = APIRouter(prefix="/market", tags=["Market"])


@router.get("/insights", response_model=MarketInsights)
def market_insights(df=Depends(get_df)):
    return get_market_insights(df)
