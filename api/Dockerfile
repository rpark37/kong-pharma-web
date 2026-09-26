FROM python:3.11-slim
WORKDIR /srv
COPY pyproject.toml ./
COPY app ./app
COPY scripts ./scripts
RUN pip install --no-cache-dir . \
 && python scripts/extract_ga4.py --synthetic \
 && python scripts/generate_omop_synthetic.py \
 && python scripts/build_atlas.py
ENV API_CORS_ORIGINS=https://rpark37.github.io,https://www.kongspharmaceuticals.com
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
