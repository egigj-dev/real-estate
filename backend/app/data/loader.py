"""
Loads the dataset and model exactly once (singleton via lru_cache).
All routers and services call get_df() / get_model() through FastAPI Depends().
"""

import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import DATA_PATH, DEMO_PATH, USE_DEMO_DATA, MODEL_PATH, SCALER_PATH

logger = logging.getLogger(__name__)

# Raw JSON column → internal name
_COL_MAP = {
    "price_eur": "price",
    "area_sqm":  "sqm",
    "bedrooms":  "beds",
    "bathrooms": "baths",
    "lat":       "latitude",
    "lng":       "longitude",
}

_FURNISHED_TRUE = {"fully_furnished", "partially_furnished"}

# Known Tirana zone/neighbourhood keywords (lowercase).
# Ordered so more specific names are matched before shorter ones.
_TIRANA_ZONES = [
    "komuna e parisit", "kodra e diellit", "fusha e aviacionit",
    "kopshti botanik", "kopshti zoologjik",
    "myslym shyri", "myslym keta",
    "don bosco", "don bosko",
    "bulevardi i ri", "unaza e re",
    "liqeni artificial",
    "ali demi", "blloku", "bllok",
    "kombinat", "kashar", "kinostudio",
    "selvia", "xhamlliku",
    "laprake", "paskuqan", "yzberisht",
    "mezez", "sauk", "fresk",
    "astir", "mivita", "porcelan",
    "farke", "farkë", "unaza",
    "kamez", "kamëz",
]

# Words that indicate a floor/position match, not a zone — used to reject
# false positives from regex captures.
_ADDR_REJECTS = re.compile(
    r'^(katin|pallat|ndërtesën?|ndertesen?|siperfaqe|nje nga|banesat|'
    r'rrugës|ndërtimit|shitjes|apartament)',
    re.IGNORECASE,
)

# Compiled patterns (priority order)
_ADDR_PATTERNS = [
    # Explicit "Adresa: X"
    re.compile(r'[Aa]dresa\s*[:\-]\s*([^\n]{3,80})'),
    # "Zona/Rruga: X"
    re.compile(r'[Zz]ona\s*/?\s*[Rr]ruga\s*[:\-]\s*([^\n]{3,60})'),
    # "Zona: X"
    re.compile(r'[Zz]ona\s*[:\-]\s*([^\n]{3,60})'),
    # "Lokacioni: X" / "Lokacion: X"
    re.compile(r'[Ll]okacion[i]?\s*[:\-]\s*([^\n]{3,60})'),
    # "Ndodhet tek X"  (tek = at/near — more specific than "ne" = in)
    re.compile(r'[Nn]dodhet\s+tek\s+([A-ZÇËÜa-zçëü][A-ZÇËÜa-zçëü\s\-]{2,50})', re.UNICODE),
    # "Rruga X" / "Bulevardi X"
    re.compile(r'\b((?:[Bb]ulevardi|[Rr]ruga|[Rr]r\.)\s+[A-ZÇËÜa-zçëü][A-ZÇËÜa-zçëü\s\-]{2,50})', re.UNICODE),
]


def _extract_address(description: str) -> str | None:
    """
    Try to extract a human-readable address / zone label from the listing
    description. Returns None if nothing useful is found.
    """
    if not isinstance(description, str) or not description.strip():
        return None

    text = description.strip()

    # Priority 1-6: regex patterns
    for pat in _ADDR_PATTERNS:
        m = pat.search(text)
        if m:
            result = m.group(1).strip().rstrip(",.:; \t")
            if len(result) >= 3 and not _ADDR_REJECTS.match(result):
                return result[:80]

    # Priority 7: scan for known Tirana zone keywords
    text_lower = text.lower()
    for zone in _TIRANA_ZONES:
        if zone in text_lower:
            idx = text_lower.index(zone)
            # Title-case the extracted span for consistent display
            return text[idx: idx + len(zone)].strip().title()

    return None


def _load_and_clean(path: Path) -> pd.DataFrame:
    with open(path) as f:
        raw = json.load(f)

    df = pd.DataFrame(raw).rename(columns=_COL_MAP)

    # ── numeric coercion ────────────────────────────────────────────────────
    numeric_cols = (
        "price", "sqm", "beds", "baths", "floor",
        "latitude", "longitude",
        "neighborhood_cluster", "dist_to_nearest_center",
        "distance_from_center", "price_per_sqm", "total_rooms",
        "balconies", "living_rooms",
    )
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # ── drop unusable rows ──────────────────────────────────────────────────
    df = df.dropna(subset=["price", "sqm"]).reset_index(drop=True)

    # ── fill sensible defaults ──────────────────────────────────────────────
    df["beds"]  = df["beds"].fillna(0).astype(int)
    df["baths"] = df["baths"].fillna(0)

    # ── derived columns ─────────────────────────────────────────────────────
    df["furnished"] = df["furnishing_status"].apply(
        lambda v: v in _FURNISHED_TRUE if isinstance(v, str) else False
    )
    df["furnished_numeric"] = df["furnished"].astype(float)

    df["neighborhood"] = df["neighborhood_cluster"].apply(
        lambda c: f"Cluster {int(c)}" if pd.notna(c) else "Unknown"
    )

    # ── address extracted from description text ──────────────────────────────
    extracted = df["description"].apply(_extract_address)
    df["address"] = df.get("address", extracted).replace(r"^\s*$", None, regex=True).fillna(extracted)

    # ── stable string id ────────────────────────────────────────────────────
    df["id"] = df.index.astype(str)

    return df


@lru_cache(maxsize=1)
def get_df() -> pd.DataFrame:
    """Return the cached, cleaned DataFrame. Loaded once at first call."""
    is_demo = USE_DEMO_DATA or not DATA_PATH.exists()
    path = DEMO_PATH if is_demo else DATA_PATH
    df = _load_and_clean(path)
    df.attrs["data_source"] = "demo" if is_demo else "private"
    if is_demo:
        logger.warning("SYNTHETIC DEMO DATA in use: %s (%s listings)", path, len(df))
    else:
        logger.info("Loaded %s private listings from %s", len(df), path)
    return df


@lru_cache(maxsize=1)
def get_model() -> Any | None:
    """Return the cached sklearn model, or None if not yet trained."""
    if not MODEL_PATH.exists() or not SCALER_PATH.exists():
        logger.warning("Estimates unavailable: model/scaler pair missing at %s / %s", MODEL_PATH, SCALER_PATH)
        return None
    import joblib
    model = joblib.load(MODEL_PATH)
    print(f"[loader] Model loaded from {MODEL_PATH}")
    return model
