"""Download the human-atlas catalogue (BodyParts3D, CC BY 4.0) and build the Atlas datasets.

Writes data/atlas/parts.parquet, data/atlas/concepts.parquet, and trimmed JSON for the Angular
app under app/public/data/atlas so the page works without the API.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

COMMIT = "1c38bf35c254a891200d3cedecfd57abebe83d8d"
URL = f"https://raw.githubusercontent.com/ashemag/human-atlas/{COMMIT}/public/models/atlas.json"
API_ROOT = Path(__file__).resolve().parent.parent
OUT = Path(os.environ.get("KONG_DATA_DIR", API_ROOT / "data")) / "atlas"
APP_OUT = API_ROOT.parent / "app" / "public" / "data" / "atlas"


def load(path: str | None) -> dict:
    if path:
        return json.loads(Path(path).read_text())
    cache = OUT / "atlas.json"
    if cache.exists():
        return json.loads(cache.read_text())
    print(f"downloading {URL}")
    with urllib.request.urlopen(URL, timeout=60) as r:
        raw = r.read()
    OUT.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(raw)
    return json.loads(raw)


def main() -> None:
    atlas = load(sys.argv[1] if len(sys.argv) > 1 else None)
    OUT.mkdir(parents=True, exist_ok=True)
    APP_OUT.mkdir(parents=True, exist_ok=True)
    parts = atlas["parts"]
    rows = []
    for p in parts:
        (x0, y0, z0), (x1, y1, z1) = p["bounds"]
        rows.append({
            "id": p["id"], "name": p["name"], "concept_id": p["conceptId"], "system": p["system"],
            "min_x": x0, "min_y": y0, "min_z": z0, "max_x": x1, "max_y": y1, "max_z": z1,
            "cx": (x0 + x1) / 2, "cy": (y0 + y1) / 2, "cz": (z0 + z1) / 2,
            "sx": x1 - x0, "sy": y1 - y0, "sz": z1 - z0,
            "triangles": p.get("indexCount", 0) // 3,
        })
    parts_table = pa.Table.from_pylist(rows)
    pq.write_table(parts_table, OUT / "parts.parquet", compression="zstd")

    concept_rows = [{"concept_id": c["id"], "name": c["name"], "element_id": e} for c in atlas["concepts"] for e in c["elements"]]
    pq.write_table(pa.Table.from_pylist(concept_rows), OUT / "concepts.parquet", compression="zstd")

    # Trimmed JSON for the static app. Columns: id, name, conceptId, system, cx, cy, cz, sx, sy, sz,
    # then the geometry locator [chunk, positions, normals, indices, vertexCount, indexCount] used by the
    # three.js viewer to slice each structure out of the binary chunks.
    compact = {
        "version": atlas.get("version"), "source": atlas.get("source"), "scope": atlas.get("scope"), "triangles": atlas.get("triangles"),
        "columns": ["id", "name", "conceptId", "system", "cx", "cy", "cz", "sx", "sy", "sz", "geom"],
        "chunks": [{"file": c["url"].rsplit("/", 1)[-1], "bytes": c["bytes"], "gzip": (c.get("gzip") or "").rsplit("/", 1)[-1] or None, "gzipBytes": c.get("gzipBytes")} for c in atlas["chunks"]],
        "parts": [[r["id"], r["name"], r["concept_id"], r["system"], round(r["cx"], 5), round(r["cy"], 5), round(r["cz"], 5), round(r["sx"], 5), round(r["sy"], 5), round(r["sz"], 5),
                   [p["chunk"], p["positions"], p["normals"], p["indices"], p["vertexCount"], p["indexCount"]]] for r, p in zip(rows, parts)],
    }
    (APP_OUT / "parts.json").write_text(json.dumps(compact, separators=(",", ":")))
    (APP_OUT / "concepts.json").write_text(json.dumps([[c["id"], c["name"], c["elements"]] for c in atlas["concepts"]], separators=(",", ":")))
    print(f"parts {len(rows)}, concepts {len(atlas['concepts'])} -> {OUT} and {APP_OUT}")


if __name__ == "__main__":
    main()
