"""
market_service.py
-----------------
Aggregation logic for the market insights endpoint.
"""

import math

import numpy as np
import pandas as pd

from app.schemas import MarketInsights, NeighborhoodInsight


def get_market_insights(df: pd.DataFrame) -> MarketInsights:
    tmp = df.copy()
    tmp["price_per_sqm"] = tmp["price"] / tmp["sqm"].replace(0, np.nan)

    by_nb = (
        tmp.groupby("neighborhood")
        .agg(
            avg_price_per_sqm=("price_per_sqm", "mean"),
            avg_price=("price", "mean"),
            listing_count=("price", "count"),
        )
        .reset_index()
        .sort_values("avg_price_per_sqm", ascending=False)
    )

    neighborhoods = [
        NeighborhoodInsight(
            neighborhood=row["neighborhood"],
            avg_price_per_sqm=round(float(row["avg_price_per_sqm"]), 2),
            avg_price=round(float(row["avg_price"]), 2),
            listing_count=int(row["listing_count"]),
        )
        for _, row in by_nb.iterrows()
        if not math.isnan(row["avg_price_per_sqm"])
    ]

    return MarketInsights(
        overall_median_price=round(float(tmp["price"].median()), 2),
        overall_median_price_per_sqm=round(float(tmp["price_per_sqm"].median(skipna=True)), 2),
        neighborhood_count=len(neighborhoods),
        neighborhoods=neighborhoods,
    )
