"""Human Atlas catalogue endpoints (BodyParts3D via human-atlas, CC BY 4.0)."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..db import get_db

router = APIRouter(prefix="/api/atlas", tags=["atlas"])


@router.get("/stats")
def stats() -> dict:
    db = get_db()
    db.require("atlas_parts", "atlas_concepts")
    row = db.one("SELECT COUNT(*) AS parts, COUNT(DISTINCT system) AS systems, SUM(triangles) AS triangles, MIN(min_y) AS min_y, MAX(max_y) AS max_y FROM atlas_parts")
    row["concepts"] = db.one("SELECT COUNT(DISTINCT concept_id) AS n FROM atlas_concepts")["n"]
    row["attribution"] = "BodyParts3D, © The Database Center for Life Science, CC BY 4.0; packaged by ashemag/human-atlas"
    return row


@router.get("/systems")
def systems() -> list[dict]:
    db = get_db()
    db.require("atlas_parts")
    return db.rows("SELECT system, COUNT(*) AS parts, SUM(sx * sy * sz) AS volume, SUM(triangles) AS triangles FROM atlas_parts GROUP BY 1 ORDER BY parts DESC")


@router.get("/parts")
def parts(system: str | None = None, limit: int = Query(5000, ge=1, le=5000)) -> list[dict]:
    db = get_db()
    db.require("atlas_parts")
    where = "WHERE system = ?" if system else ""
    return db.rows(f"SELECT id, name, concept_id, system, cx, cy, cz, sx, sy, sz, triangles FROM atlas_parts {where} ORDER BY id LIMIT ?", ([system] if system else []) + [limit])


@router.get("/concepts")
def concepts(q: str = Query("", max_length=80), limit: int = Query(80, ge=1, le=500)) -> list[dict]:
    db = get_db()
    db.require("atlas_concepts")
    term = f"%{q.lower()}%"
    return db.rows(
        """
        SELECT concept_id, ANY_VALUE(name) AS name, LIST(element_id) AS elements, COUNT(*) AS pieces
        FROM atlas_concepts WHERE LOWER(name) LIKE ? OR LOWER(concept_id) LIKE ?
        GROUP BY concept_id ORDER BY LENGTH(ANY_VALUE(name)), name LIMIT ?
        """,
        [term, term, limit],
    )
