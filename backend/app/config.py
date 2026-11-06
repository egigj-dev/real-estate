"""
Central configuration.
All paths, CORS origins, and tuneable constants live here.
Override with environment variables where noted.
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR   = Path(__file__).resolve().parent.parent        # backend/
DATA_PATH  = Path(os.getenv("DATA_PATH",  str(BASE_DIR / "data/final_data.json")))
DEMO_PATH  = BASE_DIR / "demo/listings.json"
USE_DEMO_DATA = os.getenv("USE_DEMO_DATA", "").strip().lower() in {"1", "true", "yes", "on"}
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(BASE_DIR / "model/model.joblib")))



# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ORIGINS: list[str] = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
).split(",")

# ---------------------------------------------------------------------------
# Pagination defaults
# ---------------------------------------------------------------------------
DEFAULT_PAGE     = 1
DEFAULT_PER_PAGE = 20
MAX_PER_PAGE     = 500

# ---------------------------------------------------------------------------
# ML constants   (kept in sync with ml/ml.py)
# ---------------------------------------------------------------------------
OVERPRICED_THRESHOLD   = 1.10   # actual > estimated × 1.10
UNDERPRICED_THRESHOLD  = 0.90   # actual < estimated × 0.90
RANGE_BAND             = 0.08   # ±8 %
N_COMPS                = 5