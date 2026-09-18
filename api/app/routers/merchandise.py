"""Google Merchandise Store (GA4 sample) endpoints."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

from ..db import get_db
from ..queries import date_filter

router = APIRouter(prefix="/api/merchandise", tags=["merchandise"])


def _range(start: date | None, end: date | None) -> tuple[str, list]:
    return date_filter("event_date", start, end)


@router.get("/kpis")
def kpis(start: date | None = Query(None, alias="from"), end: date | None = Query(None, alias="to")) -> dict:
    db = get_db()
    db.require("ga4_events")
    where, params = _range(start, end)
    row = db.one(
        f"""
        SELECT COUNT(DISTINCT user_pseudo_id) AS users,
               COUNT(DISTINCT user_pseudo_id || '-' || ga_session_id) AS sessions,
               COUNT(*) AS events,
               COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN transaction_id END) AS purchases,
               COALESCE(SUM(CASE WHEN event_name = 'purchase' THEN purchase_revenue END), 0) AS revenue,
               MIN(event_date) AS first_day, MAX(event_date) AS last_day
        FROM ga4_events WHERE 1=1 {where}
        """,
        params,
    )
    sessions = row.get("sessions") or 0
    purchases = row.get("purchases") or 0
    row["conversion_rate"] = (purchases / sessions) if sessions else 0.0
    row["avg_order_value"] = (row["revenue"] / purchases) if purchases else 0.0
    src = (get_db().data_dir / "ga4" / "SOURCE")
    row["source"] = src.read_text().strip() if src.exists() else "unknown"
    return row


@router.get("/daily")
def daily(start: date | None = Query(None, alias="from"), end: date | None = Query(None, alias="to")) -> list[dict]:
    db = get_db()
    db.require("ga4_events")
    where, params = _range(start, end)
    return db.rows(
        f"""
        SELECT event_date AS day,
               COUNT(DISTINCT user_pseudo_id || '-' || ga_session_id) AS sessions,
               COUNT(DISTINCT user_pseudo_id) AS users,
               COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN transaction_id END) AS purchases,
               COALESCE(SUM(CASE WHEN event_name = 'purchase' THEN purchase_revenue END), 0) AS revenue
        FROM ga4_events WHERE 1=1 {where}
        GROUP BY 1 ORDER BY 1
        """,
        params,
    )


@router.get("/funnel")
def funnel(start: date | None = Query(None, alias="from"), end: date | None = Query(None, alias="to")) -> list[dict]:
    db = get_db()
    db.require("ga4_events")
    where, params = _range(start, end)
    steps = ["session_start", "view_item", "add_to_cart", "begin_checkout", "purchase"]
    rows = db.rows(
        f"""
        SELECT event_name AS step, COUNT(DISTINCT user_pseudo_id || '-' || ga_session_id) AS sessions
        FROM ga4_events WHERE event_name IN ({', '.join('?' for _ in steps)}) {where}
        GROUP BY 1
        """,
        [*steps, *params],
    )
    by_name = {r["step"]: r["sessions"] for r in rows}
    out = []
    first = by_name.get(steps[0], 0) or 0
    prev = first
    for i, s in enumerate(steps):
        n = by_name.get(s, 0) or 0
        out.append({"order": i, "step": s, "sessions": n, "pct_of_first": (n / first) if first else 0.0, "pct_of_previous": (n / prev) if prev else 0.0})
        prev = n
    return out


def _group(column: str, alias: str, start: date | None, end: date | None, limit: int) -> list[dict]:
    db = get_db()
    db.require("ga4_events")
    where, params = _range(start, end)
    return db.rows(
        f"""
        SELECT {column} AS {alias},
               COUNT(DISTINCT user_pseudo_id || '-' || ga_session_id) AS sessions,
               COUNT(DISTINCT user_pseudo_id) AS users,
               COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN transaction_id END) AS purchases,
               COALESCE(SUM(CASE WHEN event_name = 'purchase' THEN purchase_revenue END), 0) AS revenue
        FROM ga4_events WHERE {column} IS NOT NULL {where}
        GROUP BY 1 ORDER BY sessions DESC LIMIT ?
        """,
        [*params, limit],
    )


@router.get("/by-country")
def by_country(start: date | None = Query(None, alias="from"), end: date | None = Query(None, alias="to"), limit: int = Query(15, ge=1, le=100)) -> list[dict]:
    return _group("country", "country", start, end, limit)


@router.get("/by-device")
def by_device(start: date | None = Query(None, alias="from"), end: date | None = Query(None, alias="to")) -> list[dict]:
    return _group("device_category", "device", start, end, 10)


@router.get("/traffic-sources")
def traffic_sources(start: date | None = Query(None, alias="from"), end: date | None = Query(None, alias="to"), limit: int = Query(10, ge=1, le=50)) -> list[dict]:
    return _group("traffic_source || ' / ' || traffic_medium", "source", start, end, limit)


@router.get("/top-items")
def top_items(start: date | None = Query(None, alias="from"), end: date | None = Query(None, alias="to"), limit: int = Query(12, ge=1, le=100)) -> list[dict]:
    db = get_db()
    db.require("ga4_items")
    where, params = date_filter("CAST(event_timestamp AS DATE)", start, end)
    return db.rows(
        f"""
        SELECT item_name AS item, item_category AS category, item_brand AS brand,
               SUM(quantity) AS quantity, SUM(item_revenue) AS revenue, COUNT(DISTINCT transaction_id) AS orders
        FROM ga4_items WHERE event_name = 'purchase' {where}
        GROUP BY 1, 2, 3 ORDER BY revenue DESC LIMIT ?
        """,
        [*params, limit],
    )


@router.get("/revenue-cube")
def revenue_cube(start: date | None = Query(None, alias="from"), end: date | None = Query(None, alias="to"), countries: int = Query(8, ge=1, le=30)) -> list[dict]:
    """Revenue by country x month, for the 3D MorphCharts bar chart."""
    db = get_db()
    db.require("ga4_events")
    where, params = _range(start, end)
    return db.rows(
        f"""
        WITH top AS (
          SELECT country FROM ga4_events WHERE event_name = 'purchase' {where}
          GROUP BY 1 ORDER BY SUM(purchase_revenue) DESC LIMIT ?
        )
        SELECT e.country, strftime(date_trunc('month', e.event_date), '%Y-%m') AS month,
               SUM(e.purchase_revenue) AS revenue, COUNT(DISTINCT e.transaction_id) AS purchases
        FROM ga4_events e JOIN top USING (country)
        WHERE e.event_name = 'purchase' {where.replace('event_date', 'e.event_date')}
        GROUP BY 1, 2 ORDER BY 1, 2
        """,
        [*params, countries, *params],
    )
