# Two-stage build: a fat builder with the compiler toolchain that produces
# a wheelhouse, then a slim runtime that copies the pre-built site-packages
# in. Cuts the final image from ~500 MB to ~200 MB and removes pip + gcc
# from the runtime attack surface.

# ── Stage 1: build wheels ──────────────────────────────────────────────
FROM python:3.12-slim AS builder

# build-essential covers gcc + g++; libpq-dev is needed for psycopg2 source
# builds when no wheel matches. Removed from the runtime image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY backend/services/gateway/requirements.txt /build/requirements.txt
RUN pip wheel --no-cache-dir --wheel-dir=/wheels -r /build/requirements.txt

COPY backend/packages/common /build/packages/common
RUN pip wheel --no-cache-dir --wheel-dir=/wheels /build/packages/common

# ── Stage 2: slim runtime ──────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install wheels built above, then drop the wheelhouse to keep the layer
# size down. No pip / gcc / build-essential in the runtime image.
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/*.whl \
 && rm -rf /wheels

# Source mounted at runtime under dev compose; baked in for prod images.
COPY backend/packages/common /app/packages/common
COPY backend/services/gateway /app/services/gateway

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1

# Run as a dedicated unprivileged user so a container escape from a
# code-execution bug doesn't map to host root (audit H8). uploads/ is
# the only writable path; everything else is read-only at runtime.
RUN groupadd --system --gid 1001 fxartha \
 && useradd  --system --uid 1001 --gid fxartha --shell /usr/sbin/nologin fxartha \
 && mkdir -p /app/uploads \
 && chown -R fxartha:fxartha /app/uploads
USER fxartha

EXPOSE 8000

CMD ["uvicorn", "services.gateway.src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
