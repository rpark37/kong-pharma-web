.PHONY: install data serve test snapshot openapi
install:
	uv sync --extra dev
data:
	uv run python scripts/extract_ga4.py
	uv run python scripts/generate_omop_synthetic.py
	uv run python scripts/build_atlas.py
serve:
	uv run uvicorn app.main:app --reload --port 8000
test:
	uv run pytest -q
snapshot:
	uv run python scripts/snapshot_api.py
openapi:
	uv run python scripts/export_openapi.py
