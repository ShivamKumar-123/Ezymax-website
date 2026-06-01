# Two-stage build — see backend/services/gateway/Dockerfile for the
# rationale. Same pattern: builder image with gcc/libpq-dev produces a
# wheelhouse; slim runtime installs the wheels with no compiler.

# ── Stage 1: build wheels ──────────────────────────────────────────────
FROM python:3.12-slim AS builder

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY backend/services/admin/requirements.txt /build/requirements.txt
RUN pip wheel --no-cache-dir --wheel-dir=/wheels -r /build/requirements.txt

COPY backend/packages/common /build/packages/common
RUN pip wheel --no-cache-dir --wheel-dir=/wheels /build/packages/common

# ── Stage 2: slim runtime ──────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/*.whl \
 && rm -rf /wheels

COPY backend/packages/common /app/packages/common
COPY backend/services/admin /app

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1

# Drop root — H8 from the security audit. Same uploads/ chown path as
# gateway so any admin tooling that writes there still works.
RUN groupadd --system --gid 1001 fxartha \
 && useradd  --system --uid 1001 --gid fxartha --shell /usr/sbin/nologin fxartha \
 && mkdir -p /app/uploads \
 && chown -R fxartha:fxartha /app/uploads
USER fxartha

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
