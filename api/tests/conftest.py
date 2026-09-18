from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

import pyarrow.parquet as pq  # noqa: E402

from app import db as dbmod  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def data_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A tiny generated dataset so tests never depend on the real data directory."""
    import extract_ga4
    import generate_omop_synthetic

    d = tmp_path_factory.mktemp("data")
    (d / "ga4").mkdir()
    events, items = extract_ga4.synthetic(seed=1, users=300)
    pq.write_table(events, d / "ga4" / "events.parquet")
    pq.write_table(items, d / "ga4" / "items.parquet")
    (d / "ga4" / "SOURCE").write_text("synthetic\n")
    (d / "omop").mkdir()
    for name, table in generate_omop_synthetic.gen(seed=1, n_persons=200).items():
        pq.write_table(table, d / "omop" / f"{name}.parquet")
    (d / "atlas").mkdir()
    import pyarrow as pa

    parts = pa.Table.from_pylist([
        {"id": "FJ1", "name": "Heart", "concept_id": "FMA7088", "system": "cardiac", "min_x": -0.05, "min_y": 1.2, "min_z": -0.05, "max_x": 0.05, "max_y": 1.3, "max_z": 0.05, "cx": 0.0, "cy": 1.25, "cz": 0.0, "sx": 0.1, "sy": 0.1, "sz": 0.1, "triangles": 100},
        {"id": "FJ2", "name": "Left lung", "concept_id": "FMA7310", "system": "respiratory", "min_x": 0.0, "min_y": 1.1, "min_z": -0.1, "max_x": 0.15, "max_y": 1.35, "max_z": 0.05, "cx": 0.075, "cy": 1.225, "cz": -0.025, "sx": 0.15, "sy": 0.25, "sz": 0.15, "triangles": 200},
    ])
    pq.write_table(parts, d / "atlas" / "parts.parquet")
    concepts = pa.Table.from_pylist([{"concept_id": "FMA7088", "name": "heart", "element_id": "FJ1"}, {"concept_id": "FMA7310", "name": "left lung", "element_id": "FJ2"}])
    pq.write_table(concepts, d / "atlas" / "concepts.parquet")
    return d


@pytest.fixture(scope="session")
def client(data_dir: Path) -> TestClient:
    dbmod.set_db(dbmod.Database(data_dir))
    return TestClient(app)
