"""Write the OpenAPI document to api/openapi.json (used to keep the Angular models in sync)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402

(ROOT / "openapi.json").write_text(json.dumps(app.openapi(), indent=2) + "\n")
print("wrote openapi.json")
