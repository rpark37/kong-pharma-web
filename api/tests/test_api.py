from __future__ import annotations

import pytest


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert "ga4_events" in r.json()["datasets"]


def test_kpis_and_daily(client):
    k = client.get("/api/merchandise/kpis").json()
    assert k["sessions"] > 0 and k["users"] > 0
    assert 0 <= k["conversion_rate"] <= 1
    daily = client.get("/api/merchandise/daily", params={"from": "2020-11-01", "to": "2020-11-30"}).json()
    assert daily and all(str(d["day"]).startswith("2020-11") for d in daily)
    assert sum(d["sessions"] for d in daily) <= k["sessions"]


def test_funnel_is_monotonic(client):
    steps = client.get("/api/merchandise/funnel").json()
    assert [s["step"] for s in steps] == ["session_start", "view_item", "add_to_cart", "begin_checkout", "purchase"]
    sessions = [s["sessions"] for s in steps]
    assert sessions == sorted(sessions, reverse=True)
    assert steps[0]["pct_of_first"] == 1.0


@pytest.mark.parametrize("path", ["/api/merchandise/by-country", "/api/merchandise/by-device", "/api/merchandise/traffic-sources", "/api/merchandise/top-items", "/api/merchandise/revenue-cube"])
def test_merchandise_groups(client, path):
    rows = client.get(path).json()
    assert isinstance(rows, list) and rows


def test_bad_date_is_422(client):
    assert client.get("/api/merchandise/kpis", params={"from": "not-a-date"}).status_code == 422
    assert client.get("/api/merchandise/by-country", params={"limit": 0}).status_code == 422


@pytest.mark.parametrize("path", [
    "/api/ares/summary", "/api/ares/records-by-domain", "/api/ares/person/age-at-first-observation", "/api/ares/person/year-of-birth",
    "/api/ares/person/sex", "/api/ares/person/race", "/api/ares/observation-period/length", "/api/ares/observation-period/cumulative",
    "/api/ares/observation-period/age-by-sex", "/api/ares/density/records-per-month", "/api/ares/density/records-per-person",
    "/api/ares/density/concepts-per-person", "/api/ares/concepts/condition/top", "/api/ares/quality", "/api/ares/quality/failures",
])
def test_ares_endpoints(client, path):
    r = client.get(path)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body


def test_ares_prevalence_and_unknown_domain(client):
    top = client.get("/api/ares/concepts/drug/top", params={"limit": 1}).json()
    rows = client.get(f"/api/ares/concepts/drug/{top[0]['concept_id']}/prevalence").json()
    assert rows and sum(r["records"] for r in rows) == top[0]["records"]
    assert client.get("/api/ares/concepts/nope/top").status_code == 404


def test_atlas(client):
    stats = client.get("/api/atlas/stats").json()
    assert stats["parts"] == 2 and stats["concepts"] == 2
    systems = client.get("/api/atlas/systems").json()
    assert {s["system"] for s in systems} == {"cardiac", "respiratory"}
    parts = client.get("/api/atlas/parts", params={"system": "cardiac"}).json()
    assert [p["id"] for p in parts] == ["FJ1"]
    found = client.get("/api/atlas/concepts", params={"q": "lung"}).json()
    assert found[0]["concept_id"] == "FMA7310" and found[0]["elements"] == ["FJ2"]


def test_synthetic_generators_are_deterministic():
    import extract_ga4
    import generate_omop_synthetic

    a, _ = extract_ga4.synthetic(seed=7, users=50)
    b, _ = extract_ga4.synthetic(seed=7, users=50)
    assert a.num_rows == b.num_rows and a.to_pylist()[:5] == b.to_pylist()[:5]
    p1 = generate_omop_synthetic.gen(seed=3, n_persons=40)["condition_occurrence"]
    p2 = generate_omop_synthetic.gen(seed=3, n_persons=40)["condition_occurrence"]
    assert p1.num_rows == p2.num_rows
