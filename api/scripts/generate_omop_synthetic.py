"""Generate a small synthetic OMOP CDM-like dataset for the Ares-style reports.

Seeded (42) so the numbers are stable across machines. Nothing here is real patient data.
Output: data/omop/{person,observation_period,condition_occurrence,drug_exposure,visit_occurrence,
measurement,concept,dq_results}.parquet
"""
from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

OUT = Path(os.environ.get("KONG_DATA_DIR", Path(__file__).resolve().parent.parent / "data")) / "omop"

CONDITIONS = [(320128, "Essential hypertension", 0.18), (201826, "Type 2 diabetes mellitus", 0.09), (432867, "Hyperlipidemia", 0.12), (4329847, "Myocardial infarction", 0.02), (255848, "Pneumonia", 0.05), (313217, "Atrial fibrillation", 0.03), (4182210, "Dementia", 0.02), (437663, "Fever", 0.06), (378253, "Headache", 0.08), (257628, "Chronic obstructive lung disease", 0.03), (443392, "Malignant neoplastic disease", 0.03), (440383, "Depressive disorder", 0.06), (81893, "Ulcerative colitis", 0.01), (4112343, "Viral sinusitis", 0.1), (75860, "Constipation", 0.04), (192671, "Gastrointestinal hemorrhage", 0.01), (317576, "Coronary arteriosclerosis", 0.03), (4110056, "Anxiety disorder", 0.04)]
DRUGS = [(1503297, "metformin", 0.14), (1308216, "lisinopril", 0.16), (1545958, "atorvastatin", 0.15), (1112807, "aspirin", 0.12), (1125315, "acetaminophen", 0.1), (1177480, "ibuprofen", 0.08), (1713332, "amoxicillin", 0.07), (1310149, "warfarin", 0.03), (1502826, "insulin glargine", 0.03), (1124300, "diclofenac", 0.03), (740910, "phenobarbital", 0.005), (1118084, "celecoxib", 0.02), (19010482, "omeprazole", 0.06), (1136980, "sertraline", 0.04)]
VISIT_TYPES = [(9202, "Outpatient Visit", 0.78), (9203, "Emergency Room Visit", 0.12), (9201, "Inpatient Visit", 0.1)]
MEASUREMENTS = [(3004249, "Systolic blood pressure", 120, 15, "mmHg"), (3012888, "Diastolic blood pressure", 78, 10, "mmHg"), (3004501, "Glucose [Mass/volume] in Serum or Plasma", 98, 22, "mg/dL"), (3027114, "Cholesterol [Mass/volume] in Serum or Plasma", 190, 35, "mg/dL"), (3025315, "Body weight", 78, 16, "kg"), (3013762, "Body height", 170, 10, "cm"), (3020891, "Body temperature", 36.8, 0.4, "Cel"), (3004327, "Hemoglobin A1c", 5.8, 0.9, "%")]
GENDER = [(8507, "MALE"), (8532, "FEMALE")]
RACE = [(8527, "White", 0.6), (8516, "Black or African American", 0.14), (8515, "Asian", 0.08), (8657, "American Indian or Alaska Native", 0.01), (0, "No matching concept", 0.17)]
DOMAIN_ROWS = [("Condition", CONDITIONS), ("Drug", DRUGS)]
CATEGORIES = ["Conformance", "Completeness", "Plausibility"]
CONTEXTS = ["Verification", "Validation"]


def gen(seed: int = 42, n_persons: int = 5000) -> dict[str, pa.Table]:
    rng = np.random.default_rng(seed)
    start = date(2015, 1, 1)
    end = date(2024, 12, 31)
    span = (end - start).days

    person_ids = np.arange(1, n_persons + 1)
    gender_idx = rng.integers(0, 2, n_persons)
    yob = np.clip(rng.normal(1968, 18, n_persons).astype(int), 1925, 2020)
    race_p = np.array([r[2] for r in RACE]); race_p /= race_p.sum()
    race_idx = rng.choice(len(RACE), n_persons, p=race_p)
    person = pa.table({
        "person_id": person_ids,
        "gender_concept_id": np.array([GENDER[i][0] for i in gender_idx]),
        "gender": np.array([GENDER[i][1] for i in gender_idx]),
        "year_of_birth": yob,
        "race_concept_id": np.array([RACE[i][0] for i in race_idx]),
        "race": np.array([RACE[i][1] for i in race_idx]),
    })

    op_start = np.array([start + timedelta(days=int(d)) for d in rng.integers(0, span - 365, n_persons)])
    op_len = np.clip(rng.exponential(1100, n_persons).astype(int) + 30, 30, span)
    op_end = np.array([min(end, s + timedelta(days=int(l))) for s, l in zip(op_start, op_len)])
    observation_period = pa.table({"person_id": person_ids, "observation_period_start_date": pa.array(list(op_start), pa.date32()), "observation_period_end_date": pa.array(list(op_end), pa.date32())})

    def dates_in_period(pid_idx: np.ndarray) -> list[date]:
        out = []
        for i in pid_idx:
            s, e = op_start[i], op_end[i]
            out.append(s + timedelta(days=int(rng.integers(0, max(1, (e - s).days)))))
        return out

    def occurrences(rows: list, rate: float, name_prefix: str, id_col: str, date_col: str) -> pa.Table:
        counts = rng.poisson(rate * op_len / 365.0)
        idx = np.repeat(np.arange(n_persons), counts)
        p = np.array([r[2] for r in rows]); p /= p.sum()
        choice = rng.choice(len(rows), len(idx), p=p)
        return pa.table({
            "person_id": person_ids[idx],
            id_col: np.array([rows[c][0] for c in choice]),
            date_col: pa.array(dates_in_period(idx), pa.date32()),
        })

    condition = occurrences(CONDITIONS, 4.0, "condition", "condition_concept_id", "condition_start_date")
    drug = occurrences(DRUGS, 6.0, "drug", "drug_concept_id", "drug_exposure_start_date")
    visit = occurrences(VISIT_TYPES, 5.0, "visit", "visit_concept_id", "visit_start_date")

    m_counts = rng.poisson(8.0 * op_len / 365.0)
    m_idx = np.repeat(np.arange(n_persons), m_counts)
    m_choice = rng.integers(0, len(MEASUREMENTS), len(m_idx))
    m_values = np.array([rng.normal(MEASUREMENTS[c][2], MEASUREMENTS[c][3]) for c in m_choice]).round(1)
    measurement = pa.table({
        "person_id": person_ids[m_idx],
        "measurement_concept_id": np.array([MEASUREMENTS[c][0] for c in m_choice]),
        "measurement_date": pa.array(dates_in_period(m_idx), pa.date32()),
        "value_as_number": m_values,
        "unit": np.array([MEASUREMENTS[c][4] for c in m_choice]),
    })

    concept_rows = []
    for cid, name, _ in CONDITIONS: concept_rows.append((cid, name, "Condition"))
    for cid, name, _ in DRUGS: concept_rows.append((cid, name, "Drug"))
    for cid, name, _ in VISIT_TYPES: concept_rows.append((cid, name, "Visit"))
    for cid, name, *_ in MEASUREMENTS: concept_rows.append((cid, name, "Measurement"))
    for cid, name in GENDER: concept_rows.append((cid, name, "Gender"))
    for cid, name, _ in RACE: concept_rows.append((cid, name, "Race"))
    concept = pa.table({"concept_id": [c[0] for c in concept_rows], "concept_name": [c[1] for c in concept_rows], "domain_id": [c[2] for c in concept_rows]})

    checks = []
    tables = ["PERSON", "OBSERVATION_PERIOD", "CONDITION_OCCURRENCE", "DRUG_EXPOSURE", "VISIT_OCCURRENCE", "MEASUREMENT"]
    names = ["cdmTable", "cdmField", "isRequired", "cdmDatatype", "isPrimaryKey", "isForeignKey", "fkDomain", "fkClass", "isStandardValidConcept", "measureValueCompleteness", "standardConceptRecordCompleteness", "sourceConceptRecordCompleteness", "plausibleValueLow", "plausibleValueHigh", "plausibleTemporalAfter", "plausibleDuringLife", "withinVisitDates", "measurePersonCompleteness"]
    cat_by_name = {n: ("Conformance" if i < 9 else "Completeness" if i < 12 else "Plausibility") for i, n in enumerate(names)}
    for t in tables:
        for n in names:
            for ctx in CONTEXTS:
                if rng.random() < 0.55:
                    continue
                failed = int(rng.random() < 0.07)
                checks.append((t, n, cat_by_name[n], ctx, failed, round(float(rng.random() * 3), 2) if failed else 0.0))
    dq = pa.table({"cdm_table": [c[0] for c in checks], "check_name": [c[1] for c in checks], "category": [c[2] for c in checks], "context": [c[3] for c in checks], "failed": [c[4] for c in checks], "pct_violated_rows": [c[5] for c in checks]})

    return {"person": person, "observation_period": observation_period, "condition_occurrence": condition, "drug_exposure": drug, "visit_occurrence": visit, "measurement": measurement, "concept": concept, "dq_results": dq}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, table in gen().items():
        pq.write_table(table, OUT / f"{name}.parquet", compression="zstd")
        print(f"{name}: {table.num_rows} rows")


if __name__ == "__main__":
    main()
