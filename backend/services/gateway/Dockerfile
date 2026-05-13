FROM python:3.12-slim

WORKDIR /app

COPY backend/services/gateway/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/packages/common /app/packages/common
RUN pip install -e /app/packages/common

COPY backend/services/gateway /app/services/gateway

ENV PYTHONPATH=/app

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
