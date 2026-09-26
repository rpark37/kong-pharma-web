"""Call every GET endpoint with default parameters and store the JSON under
app/public/data/snapshot so the GitHub Pages build works when the API is offline.

File naming: `/api/merchandise/kpis` -> `merchandise__kpis.json` (query strings ignored).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402

OUT = ROOT.parent / "app" / "public" / "data" / "snapshot"
PATHS = [
    "/api/health",
    "/api/merchandise/kpis", "/api/merchandise/daily", "/api/merchandise/funnel", "/api/merchandise/by-country", "/api/merchandise/by-device",
    "/api/merchandise/traffic-sources", "/api/merchandise/top-items", "/api/merchandise/revenue-cube",
    "/api/ares/summary", "/api/ares/records-by-domain", "/api/ares/person/age-at-first-observation", "/api/ares/person/year-of-birth",
    "/api/ares/person/sex", "/api/ares/person/race", "/api/ares/observation-period/length", "/api/ares/observation-period/cumulative",
    "/api/ares/observation-period/age-by-sex", "/api/ares/density/records-per-month", "/api/ares/density/records-per-person",
    "/api/ares/density/concepts-per-person", "/api/ares/concepts/condition/top", "/api/ares/concepts/drug/top", "/api/ares/concepts/visit/top",
    "/api/ares/concepts/measurement/top", "/api/ares/quality", "/api/ares/quality/failures",
    "/api/atlas/stats", "/api/atlas/systems", "/api/atlas/concepts",
]


def snapshot_name(path: str) -> str:
    return path.removeprefix("/api/").replace("/", "__") + ".json"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    client = TestClient(app)
    for path in PATHS:
        r = client.get(path)
        if r.status_code != 200:
            print(f"skip {path}: {r.status_code} {r.text[:80]}")
            continue
        (OUT / snapshot_name(path)).write_text(json.dumps(r.json(), default=str, separators=(",", ":")))
    # Prevalence for the top condition and drug so the Ares page has a default series.
    for domain in ("condition", "drug"):
        top = client.get(f"/api/ares/concepts/{domain}/top", params={"limit": 1}).json()
        if top:
            cid = top[0]["concept_id"]
            r = client.get(f"/api/ares/concepts/{domain}/{cid}/prevalence")
            (OUT / snapshot_name(f"/api/ares/concepts/{domain}/{cid}/prevalence")).write_text(json.dumps(r.json(), default=str, separators=(",", ":")))
    print(f"wrote snapshots to {OUT}")


if __name__ == "__main__":
    main()
