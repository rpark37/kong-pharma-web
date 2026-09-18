"""Shared helpers for parameterised date filters."""
from __future__ import annotations

from datetime import date


def date_filter(column: str, start: date | None, end: date | None) -> tuple[str, list]:
    clauses, params = [], []
    if start:
        clauses.append(f"{column} >= ?")
        params.append(start)
    if end:
        clauses.append(f"{column} <= ?")
        params.append(end)
    where = (" AND " + " AND ".join(clauses)) if clauses else ""
    return where, params
