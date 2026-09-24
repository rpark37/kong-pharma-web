"""Build the GA4 Google Merchandise Store dataset as Parquet.

With Google Cloud credentials (GOOGLE_APPLICATION_CREDENTIALS and GA4_BQ_PROJECT) this pulls the
public sample `bigquery-public-data.ga4_obfuscated_sample_ecommerce` (2020-11-01..2021-01-31).
Without credentials it generates a schema-faithful synthetic dataset with a fixed seed so the
API, tests and UI behave identically. Output: data/ga4/events.parquet and data/ga4/items.parquet.
"""
from __future__ import annotations

import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

OUT = Path(os.environ.get("KONG_DATA_DIR", Path(__file__).resolve().parent.parent / "data")) / "ga4"
START = date(2020, 11, 1)
END = date(2021, 1, 31)

COUNTRIES = [("United States", 0.42), ("India", 0.11), ("Canada", 0.06), ("United Kingdom", 0.05), ("Germany", 0.04), ("Japan", 0.035), ("France", 0.03), ("Brazil", 0.03), ("Australia", 0.025), ("Spain", 0.02), ("Taiwan", 0.02), ("Mexico", 0.02), ("Netherlands", 0.015), ("South Korea", 0.015), ("Singapore", 0.01), ("Italy", 0.01), ("Turkey", 0.01), ("Vietnam", 0.01), ("Philippines", 0.01), ("Other", 0.08)]
DEVICES = [("desktop", 0.58), ("mobile", 0.38), ("tablet", 0.04)]
OS_BY_DEVICE = {"desktop": ["Windows", "Macintosh", "Linux", "Chrome OS"], "mobile": ["Android", "iOS"], "tablet": ["iOS", "Android"]}
SOURCES = [("google", "organic", "(organic)", 0.46), ("(direct)", "(none)", "(direct)", 0.28), ("google", "cpc", "Brand Campaign", 0.07), ("youtube.com", "referral", "(referral)", 0.06), ("<Other>", "referral", "(referral)", 0.05), ("newsletter", "email", "Holiday Promo", 0.04), ("facebook", "social", "(social)", 0.02), ("bing", "organic", "(organic)", 0.02)]
ITEMS = [
    ("9180535", "Google Zip Hoodie F/C", "Apparel", "Google", 60.0, 0.06),
    ("9180528", "Google Crewneck Sweatshirt Navy", "Apparel", "Google", 45.0, 0.05),
    ("9182769", "Google Camp Mug Ivory", "Drinkware", "Google", 20.0, 0.07),
    ("9180763", "Google Black Cloud Zip Hoodie", "Apparel", "Google", 55.0, 0.04),
    ("9183234", "YouTube Twill Cap", "Apparel", "YouTube", 22.0, 0.05),
    ("9182802", "Google Leather Strap Hat Black", "Apparel", "Google", 25.0, 0.04),
    ("9180766", "Google Tee White", "Apparel", "Google", 22.0, 0.08),
    ("9184710", "Google Land & Sea Cotton Cap", "Apparel", "Google", 24.0, 0.03),
    ("9182780", "Google Stainless Steel Bottle Blue", "Drinkware", "Google", 30.0, 0.05),
    ("9181237", "Google Recycled Notebook", "Office", "Google", 12.0, 0.06),
    ("9181234", "Google Pen Navy", "Office", "Google", 3.0, 0.07),
    ("9181120", "Android Large Removable Sticker Sheet", "Accessories", "Android", 2.5, 0.05),
    ("9181148", "Android Iconic Hat Green", "Apparel", "Android", 24.0, 0.03),
    ("9180775", "Google Bike Tee Navy", "Apparel", "Google", 24.0, 0.04),
    ("9183248", "YouTube Leather Strap Hat Black", "Apparel", "YouTube", 27.0, 0.03),
    ("9182716", "Google Kids Tee Green", "Apparel", "Google", 14.0, 0.04),
    ("9183009", "Google Chicago Campus Mug", "Drinkware", "Google", 16.0, 0.03),
    ("9184711", "Google NYC Campus Tote", "Bags", "Google", 20.0, 0.04),
    ("9180862", "Google Toddler Hoodie Blue", "Apparel", "Google", 35.0, 0.02),
    ("9182741", "Google Incognito Techpack V2", "Bags", "Google", 120.0, 0.02),
    ("9181103", "Google Speckled Beanie Navy", "Apparel", "Google", 20.0, 0.03),
    ("9183107", "Google Mural Collab Sticker Sheet", "Accessories", "Google", 3.5, 0.04),
    ("9182684", "Google Cork Base Tumbler", "Drinkware", "Google", 22.0, 0.03),
]


def synthetic(seed: int = 42, users: int = 12000) -> tuple[pa.Table, pa.Table]:
    rng = np.random.default_rng(seed)
    days = (END - START).days + 1
    country_names = [c for c, _ in COUNTRIES]
    country_p = np.array([p for _, p in COUNTRIES]); country_p /= country_p.sum()
    device_names = [d for d, _ in DEVICES]
    device_p = np.array([p for _, p in DEVICES]); device_p /= device_p.sum()
    source_p = np.array([s[3] for s in SOURCES]); source_p /= source_p.sum()
    item_p = np.array([i[5] for i in ITEMS]); item_p /= item_p.sum()

    ev_rows: dict[str, list] = {k: [] for k in ["event_date", "event_timestamp", "event_name", "user_pseudo_id", "ga_session_id", "device_category", "operating_system", "country", "traffic_source", "traffic_medium", "traffic_name", "transaction_id", "purchase_revenue", "total_item_quantity"]}
    it_rows: dict[str, list] = {k: [] for k in ["event_timestamp", "user_pseudo_id", "event_name", "transaction_id", "item_id", "item_name", "item_category", "item_brand", "price", "quantity", "item_revenue"]}

    tx_counter = 0
    for u in range(users):
        user_id = f"{rng.integers(10**9, 10**10)}.{rng.integers(10**9, 10**10)}"
        country = country_names[rng.choice(len(country_names), p=country_p)]
        device = device_names[rng.choice(len(device_names), p=device_p)]
        osys = OS_BY_DEVICE[device][rng.integers(len(OS_BY_DEVICE[device]))]
        n_sessions = 1 + rng.geometric(0.55) - 1
        first_day = int(rng.integers(0, days))
        for s in range(n_sessions):
            day = min(days - 1, first_day + int(rng.geometric(0.25)) * s)
            d = START + timedelta(days=day)
            # holiday lift late November / December
            lift = 1.35 if (d.month == 11 and d.day >= 23) or (d.month == 12 and d.day <= 22) else 1.0
            src = SOURCES[rng.choice(len(SOURCES), p=source_p)]
            session_id = int(rng.integers(10**9, 2 * 10**9))
            t0 = datetime(d.year, d.month, d.day, int(rng.integers(0, 24)), int(rng.integers(0, 60)), int(rng.integers(0, 60)))

            def emit(name: str, ts: datetime, tx: str | None = None, revenue: float | None = None, qty: int | None = None) -> None:
                ev_rows["event_date"].append(d)
                ev_rows["event_timestamp"].append(ts)
                ev_rows["event_name"].append(name)
                ev_rows["user_pseudo_id"].append(user_id)
                ev_rows["ga_session_id"].append(session_id)
                ev_rows["device_category"].append(device)
                ev_rows["operating_system"].append(osys)
                ev_rows["country"].append(country)
                ev_rows["traffic_source"].append(src[0])
                ev_rows["traffic_medium"].append(src[1])
                ev_rows["traffic_name"].append(src[2])
                ev_rows["transaction_id"].append(tx)
                ev_rows["purchase_revenue"].append(revenue)
                ev_rows["total_item_quantity"].append(qty)

            emit("session_start", t0)
            n_pages = int(rng.geometric(0.35))
            ts = t0
            for _ in range(n_pages):
                ts += timedelta(seconds=int(rng.integers(5, 120)))
                emit("page_view", ts)
            viewed = rng.random() < 0.55 * lift
            if not viewed:
                continue
            n_items = int(rng.integers(1, 4))
            picks = rng.choice(len(ITEMS), size=n_items, replace=False, p=item_p)
            for p in picks:
                ts += timedelta(seconds=int(rng.integers(10, 90)))
                emit("view_item", ts)
            if rng.random() > 0.32 * lift:
                continue
            cart = [p for p in picks if rng.random() < 0.7] or [picks[0]]
            for p in cart:
                ts += timedelta(seconds=int(rng.integers(5, 60)))
                emit("add_to_cart", ts)
            if rng.random() > 0.55:
                continue
            ts += timedelta(seconds=int(rng.integers(20, 200)))
            emit("begin_checkout", ts)
            if rng.random() > 0.5 * lift:
                continue
            ts += timedelta(seconds=int(rng.integers(30, 300)))
            tx_counter += 1
            tx = f"T{tx_counter:07d}"
            revenue = 0.0
            qty = 0
            for p in cart:
                item = ITEMS[p]
                q = int(rng.integers(1, 3))
                rev = round(item[4] * q, 2)
                revenue += rev
                qty += q
                it_rows["event_timestamp"].append(ts)
                it_rows["user_pseudo_id"].append(user_id)
                it_rows["event_name"].append("purchase")
                it_rows["transaction_id"].append(tx)
                it_rows["item_id"].append(item[0])
                it_rows["item_name"].append(item[1])
                it_rows["item_category"].append(item[2])
                it_rows["item_brand"].append(item[3])
                it_rows["price"].append(item[4])
                it_rows["quantity"].append(q)
                it_rows["item_revenue"].append(rev)
            emit("purchase", ts, tx, round(revenue, 2), qty)

    events = pa.table({
        "event_date": pa.array(ev_rows["event_date"], pa.date32()),
        "event_timestamp": pa.array(ev_rows["event_timestamp"], pa.timestamp("us")),
        "event_name": pa.array(ev_rows["event_name"], pa.string()),
        "user_pseudo_id": pa.array(ev_rows["user_pseudo_id"], pa.string()),
        "ga_session_id": pa.array(ev_rows["ga_session_id"], pa.int64()),
        "device_category": pa.array(ev_rows["device_category"], pa.string()),
        "operating_system": pa.array(ev_rows["operating_system"], pa.string()),
        "country": pa.array(ev_rows["country"], pa.string()),
        "traffic_source": pa.array(ev_rows["traffic_source"], pa.string()),
        "traffic_medium": pa.array(ev_rows["traffic_medium"], pa.string()),
        "traffic_name": pa.array(ev_rows["traffic_name"], pa.string()),
        "transaction_id": pa.array(ev_rows["transaction_id"], pa.string()),
        "purchase_revenue": pa.array(ev_rows["purchase_revenue"], pa.float64()),
        "total_item_quantity": pa.array(ev_rows["total_item_quantity"], pa.int64()),
    })
    items = pa.table({
        "event_timestamp": pa.array(it_rows["event_timestamp"], pa.timestamp("us")),
        "user_pseudo_id": pa.array(it_rows["user_pseudo_id"], pa.string()),
        "event_name": pa.array(it_rows["event_name"], pa.string()),
        "transaction_id": pa.array(it_rows["transaction_id"], pa.string()),
        "item_id": pa.array(it_rows["item_id"], pa.string()),
        "item_name": pa.array(it_rows["item_name"], pa.string()),
        "item_category": pa.array(it_rows["item_category"], pa.string()),
        "item_brand": pa.array(it_rows["item_brand"], pa.string()),
        "price": pa.array(it_rows["price"], pa.float64()),
        "quantity": pa.array(it_rows["quantity"], pa.int64()),
        "item_revenue": pa.array(it_rows["item_revenue"], pa.float64()),
    })
    return events, items


BQ_EVENTS_SQL = """
SELECT PARSE_DATE('%Y%m%d', event_date) AS event_date,
       TIMESTAMP_MICROS(event_timestamp) AS event_timestamp,
       event_name, user_pseudo_id,
       (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id,
       device.category AS device_category, device.operating_system,
       geo.country AS country,
       traffic_source.source AS traffic_source, traffic_source.medium AS traffic_medium, traffic_source.name AS traffic_name,
       ecommerce.transaction_id, ecommerce.purchase_revenue, ecommerce.total_item_quantity
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131'
"""
BQ_ITEMS_SQL = """
SELECT TIMESTAMP_MICROS(event_timestamp) AS event_timestamp, user_pseudo_id, event_name, ecommerce.transaction_id,
       item.item_id, item.item_name, item.item_category, item.item_brand, item.price, item.quantity, item.item_revenue
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`, UNNEST(items) AS item
WHERE _TABLE_SUFFIX BETWEEN '20201101' AND '20210131' AND event_name = 'purchase'
"""


def from_bigquery() -> tuple[pa.Table, pa.Table]:
    from google.cloud import bigquery  # type: ignore

    client = bigquery.Client(project=os.environ.get("GA4_BQ_PROJECT"))
    events = client.query(BQ_EVENTS_SQL).to_arrow()
    items = client.query(BQ_ITEMS_SQL).to_arrow()
    return events, items


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    use_bq = bool(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")) and "--synthetic" not in sys.argv
    if use_bq:
        print("extracting from BigQuery public dataset...")
        events, items = from_bigquery()
        source = "bigquery"
    else:
        print("no credentials: generating synthetic GA4 sample (seed 42)...")
        events, items = synthetic()
        source = "synthetic"
    pq.write_table(events, OUT / "events.parquet", compression="zstd")
    pq.write_table(items, OUT / "items.parquet", compression="zstd")
    (OUT / "SOURCE").write_text(source + "\n")
    print(f"wrote {events.num_rows} events, {items.num_rows} items to {OUT} ({source})")


if __name__ == "__main__":
    main()
