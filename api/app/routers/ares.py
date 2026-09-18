"""Ares-style data characterization over the synthetic OMOP dataset."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..db import get_db

router = APIRouter(prefix="/api/ares", tags=["ares"])

DOMAINS = {
    "condition": ("omop_condition_occurrence", "condition_concept_id", "condition_start_date"),
    "drug": ("omop_drug_exposure", "drug_concept_id", "drug_exposure_start_date"),
    "visit": ("omop_visit_occurrence", "visit_concept_id", "visit_start_date"),
    "measurement": ("omop_measurement", "measurement_concept_id", "measurement_date"),
}


@router.get("/summary")
def summary() -> dict:
    db = get_db()
    db.require("omop_person", "omop_observation_period", "omop_dq_results")
    counts = {d: db.one(f"SELECT COUNT(*) AS n FROM {t}")["n"] for d, (t, _, _) in DOMAINS.items()}
    persons = db.one("SELECT COUNT(*) AS n FROM omop_person")["n"]
    dq = db.one("SELECT COUNT(*) AS checks, SUM(failed) AS failed FROM omop_dq_results")
    period = db.one("SELECT MIN(observation_period_start_date) AS start, MAX(observation_period_end_date) AS end FROM omop_observation_period")
    return {"persons": persons, "records": sum(counts.values()), "records_by_domain": counts, "checks": dq["checks"], "checks_failed": dq["failed"], "quality_pct": (1 - (dq["failed"] or 0) / dq["checks"]) * 100 if dq["checks"] else 0, "period_start": period["start"], "period_end": period["end"], "source": "synthetic OMOP-like sample (seed 42)"}


@router.get("/records-by-domain")
def records_by_domain() -> list[dict]:
    db = get_db()
    out = []
    for d, (t, _, _) in DOMAINS.items():
        db.require(t)
        r = db.one(f"SELECT COUNT(*) AS records, COUNT(DISTINCT person_id) AS persons FROM {t}")
        out.append({"domain": d, **r})
    return out


@router.get("/person/age-at-first-observation")
def age_at_first_observation() -> list[dict]:
    db = get_db()
    db.require("omop_person", "omop_observation_period")
    return db.rows(
        """
        SELECT age, COUNT(*) AS persons FROM (
          SELECT EXTRACT(year FROM MIN(op.observation_period_start_date)) - p.year_of_birth AS age
          FROM omop_person p JOIN omop_observation_period op USING (person_id) GROUP BY p.person_id, p.year_of_birth)
        WHERE age >= 0 GROUP BY 1 ORDER BY 1
        """
    )


@router.get("/person/year-of-birth")
def year_of_birth() -> list[dict]:
    db = get_db()
    db.require("omop_person")
    return db.rows("SELECT year_of_birth AS year, COUNT(*) AS persons FROM omop_person GROUP BY 1 ORDER BY 1")


@router.get("/person/sex")
def sex() -> list[dict]:
    db = get_db()
    db.require("omop_person")
    return db.rows("SELECT gender AS sex, COUNT(*) AS persons FROM omop_person GROUP BY 1 ORDER BY 2 DESC")


@router.get("/person/race")
def race() -> list[dict]:
    db = get_db()
    db.require("omop_person")
    return db.rows("SELECT race, COUNT(*) AS persons FROM omop_person GROUP BY 1 ORDER BY 2 DESC")


@router.get("/observation-period/length")
def observation_length() -> list[dict]:
    db = get_db()
    db.require("omop_observation_period")
    return db.rows(
        """
        SELECT CAST(FLOOR(days / 365.25) AS INTEGER) AS years, COUNT(*) AS persons FROM (
          SELECT DATEDIFF('day', observation_period_start_date, observation_period_end_date) AS days FROM omop_observation_period)
        GROUP BY 1 ORDER BY 1
        """
    )


@router.get("/observation-period/cumulative")
def observation_cumulative() -> list[dict]:
    db = get_db()
    db.require("omop_observation_period")
    return db.rows(
        """
        WITH d AS (SELECT DATEDIFF('day', observation_period_start_date, observation_period_end_date) / 365.25 AS years FROM omop_observation_period),
        b AS (SELECT ROUND(years * 4) / 4 AS years, COUNT(*) AS n FROM d GROUP BY 1)
        SELECT years, SUM(n) OVER (ORDER BY years DESC) / (SELECT SUM(n) FROM b) AS pct_persons_at_least FROM b ORDER BY years
        """
    )


@router.get("/observation-period/age-by-sex")
def age_by_sex() -> list[dict]:
    db = get_db()
    db.require("omop_person", "omop_observation_period")
    return db.rows(
        """
        SELECT CAST(FLOOR(age / 10) * 10 AS INTEGER) AS age_band, gender AS sex, COUNT(*) AS persons FROM (
          SELECT p.gender, EXTRACT(year FROM MAX(op.observation_period_end_date)) - p.year_of_birth AS age
          FROM omop_person p JOIN omop_observation_period op USING (person_id) GROUP BY p.person_id, p.gender, p.year_of_birth)
        WHERE age >= 0 GROUP BY 1, 2 ORDER BY 1, 2
        """
    )


@router.get("/density/records-per-month")
def records_per_month() -> list[dict]:
    db = get_db()
    parts = []
    for d, (t, _, dcol) in DOMAINS.items():
        db.require(t)
        parts.append(f"SELECT '{d}' AS domain, date_trunc('month', {dcol}) AS month, COUNT(*) AS records FROM {t} GROUP BY 1, 2")
    parts.append("SELECT 'observation_period' AS domain, date_trunc('month', observation_period_start_date) AS month, COUNT(*) AS records FROM omop_observation_period GROUP BY 1, 2")
    return db.rows(" UNION ALL ".join(parts) + " ORDER BY domain, month")


@router.get("/density/records-per-person")
def records_per_person() -> list[dict]:
    db = get_db()
    parts = []
    for d, (t, _, _) in DOMAINS.items():
        db.require(t)
        parts.append(f"SELECT '{d}' AS domain, person_id, COUNT(*) AS n FROM {t} GROUP BY 1, 2")
    return db.rows(
        f"""
        SELECT domain, LEAST(n, 60) AS records, COUNT(*) AS persons FROM ({' UNION ALL '.join(parts)})
        GROUP BY 1, 2 ORDER BY 1, 2
        """
    )


@router.get("/density/concepts-per-person")
def concepts_per_person() -> list[dict]:
    db = get_db()
    parts = []
    for d, (t, ccol, _) in DOMAINS.items():
        db.require(t)
        parts.append(f"SELECT '{d}' AS domain, person_id, COUNT(DISTINCT {ccol}) AS n FROM {t} GROUP BY 1, 2")
    return db.rows(f"SELECT domain, n AS concepts, COUNT(*) AS persons FROM ({' UNION ALL '.join(parts)}) GROUP BY 1, 2 ORDER BY 1, 2")


@router.get("/concepts/{domain}/top")
def top_concepts(domain: str, limit: int = Query(15, ge=1, le=100)) -> list[dict]:
    if domain not in DOMAINS:
        raise HTTPException(404, f"unknown domain {domain}")
    t, ccol, _ = DOMAINS[domain]
    db = get_db()
    db.require(t, "omop_concept", "omop_person")
    return db.rows(
        f"""
        SELECT c.concept_id, c.concept_name, COUNT(*) AS records, COUNT(DISTINCT o.person_id) AS persons,
               COUNT(DISTINCT o.person_id) * 1000.0 / (SELECT COUNT(*) FROM omop_person) AS per_1000_persons
        FROM {t} o JOIN omop_concept c ON c.concept_id = o.{ccol}
        GROUP BY 1, 2 ORDER BY records DESC LIMIT ?
        """,
        [limit],
    )


@router.get("/concepts/{domain}/{concept_id}/prevalence")
def concept_prevalence(domain: str, concept_id: int) -> list[dict]:
    if domain not in DOMAINS:
        raise HTTPException(404, f"unknown domain {domain}")
    t, ccol, dcol = DOMAINS[domain]
    db = get_db()
    db.require(t)
    return db.rows(
        f"""
        SELECT date_trunc('month', {dcol}) AS month, COUNT(*) AS records, COUNT(DISTINCT person_id) AS persons
        FROM {t} WHERE {ccol} = ? GROUP BY 1 ORDER BY 1
        """,
        [concept_id],
    )


@router.get("/quality")
def quality() -> list[dict]:
    db = get_db()
    db.require("omop_dq_results")
    return db.rows(
        """
        SELECT category, context, cdm_table, COUNT(*) AS checks, SUM(failed) AS failed, COUNT(*) - SUM(failed) AS passed
        FROM omop_dq_results GROUP BY 1, 2, 3 ORDER BY 1, 2, 3
        """
    )


@router.get("/quality/failures")
def quality_failures(limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    db = get_db()
    db.require("omop_dq_results")
    return db.rows("SELECT cdm_table, check_name, category, context, pct_violated_rows FROM omop_dq_results WHERE failed = 1 ORDER BY pct_violated_rows DESC LIMIT ?", [limit])
