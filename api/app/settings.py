from __future__ import annotations

import os
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("KONG_DATA_DIR", API_ROOT / "data"))
CORS_ORIGINS = [o.strip() for o in os.environ.get("API_CORS_ORIGINS", "http://localhost:4200,http://127.0.0.1:4200").split(",") if o.strip()]
