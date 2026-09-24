"""One read-only DuckDB connection with views over the Parquet files in the data directory.

Analogy: DuckDB is a spreadsheet engine that lives inside the process. The Parquet files are
the sheets on disk; the views below are named tabs so the routers can write plain SQL.
"""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Iterable

import duckdb

from .settings import DATA_DIR

VIEWS: dict[str, str] = {
    "ga4_events": "ga4/events.parquet",
    "ga4_items": "ga4/items.parquet",
    "omop_person": "omop/person.parquet",
    "omop_observation_period": "omop/observation_period.parquet",
    "omop_condition_occurrence": "omop/condition_occurrence.parquet",
    "omop_drug_exposure": "omop/drug_exposure.parquet",
    "omop_visit_occurrence": "omop/visit_occurrence.parquet",
    "omop_measurement": "omop/measurement.parquet",
    "omop_concept": "omop/concept.parquet",
    "omop_dq_results": "omop/dq_results.parquet",
    "atlas_parts": "atlas/parts.parquet",
    "atlas_concepts": "atlas/concepts.parquet",
}


class Database:
    def __init__(self, data_dir: Path = DATA_DIR) -> None:
        self.data_dir = Path(data_dir)
        self._conn = duckdb.connect(database=":memory:")
        self._lock = threading.Lock()
        self.available: set[str] = set()
        self.refresh()

    def refresh(self) -> None:
        """(Re)create views for every Parquet file that exists."""
        self.available.clear()
        for view, rel in VIEWS.items():
            path = self.data_dir / rel
            if path.exists():
                escaped = str(path).replace("'", "''")
                self._conn.execute(f"CREATE OR REPLACE VIEW {view} AS SELECT * FROM read_parquet('{escaped}')")
                self.available.add(view)
            else:
                self._conn.execute(f"DROP VIEW IF EXISTS {view}")

    def require(self, *views: str) -> None:
        missing = [v for v in views if v not in self.available]
        if missing:
            from fastapi import HTTPException

            raise HTTPException(status_code=503, detail=f"dataset not available: {', '.join(missing)}. Run the scripts in api/scripts to generate it.")

    def rows(self, sql: str, params: Iterable[Any] | None = None) -> list[dict[str, Any]]:
        with self._lock:
            cur = self._conn.cursor()
            try:
                result = cur.execute(sql, list(params or []))
                columns = [d[0] for d in result.description]
                return [dict(zip(columns, row)) for row in result.fetchall()]
            finally:
                cur.close()

    def one(self, sql: str, params: Iterable[Any] | None = None) -> dict[str, Any]:
        rows = self.rows(sql, params)
        return rows[0] if rows else {}


_db: Database | None = None


def get_db() -> Database:
    global _db
    if _db is None:
        _db = Database()
    return _db


def set_db(db: Database | None) -> None:
    global _db
    _db = db
