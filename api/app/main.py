from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import get_db
from .routers import ares, atlas, merchandise
from .settings import CORS_ORIGINS

app = FastAPI(
    title="Kong's Labs API",
    version="0.1.0",
    description="DuckDB-backed endpoints for the Google Merchandise, Ares and Human Atlas pages.",
)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])
app.include_router(merchandise.router)
app.include_router(ares.router)
app.include_router(atlas.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    db = get_db()
    return {"status": "ok", "datasets": sorted(db.available)}
