# syntax=docker/dockerfile:1.7
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# curl so any platform-injected healthcheck command can run. We do NOT ship
# a HEALTHCHECK directive of our own — Timeweb Cloud Apps injects its own
# probe against the path set in the UI, and having two competing
# healthchecks leaves the container stuck in "unhealthy".
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
