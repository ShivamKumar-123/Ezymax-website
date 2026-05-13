FROM python:3.12-slim

WORKDIR /app

COPY backend/services/risk-engine/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/packages/common /app/packages/common
RUN pip install -e /app/packages/common

COPY backend/services/risk-engine /app/services/risk_engine

ENV PYTHONPATH=/app

# H8 — drop root.
RUN groupadd --system --gid 1001 fxartha \
 && useradd  --system --uid 1001 --gid fxartha --shell /usr/sbin/nologin fxartha
USER fxartha

CMD ["python", "-m", "services.risk_engine.src.main"]
