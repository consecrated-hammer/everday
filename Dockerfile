# =============================================================================
# Unified Dockerfile - Frontend + Backend in single container
# =============================================================================
# Build frontend
FROM node:25-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_APP_VERSION
ENV VITE_APP_VERSION=$VITE_APP_VERSION

ARG VITE_BUILD_TIME
ENV VITE_BUILD_TIME=$VITE_BUILD_TIME

ARG VITE_IMAGE_TAG
ENV VITE_IMAGE_TAG=$VITE_IMAGE_TAG

ARG VITE_BUILD_ENV
ENV VITE_BUILD_ENV=$VITE_BUILD_ENV

ARG VITE_COMMIT_SHA
ENV VITE_COMMIT_SHA=$VITE_COMMIT_SHA

RUN npm run build

# =============================================================================
# Build final image with backend + frontend static files
FROM python:3.14-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl gnupg2 apt-transport-https ca-certificates unixodbc \
  && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/microsoft-prod.list \
  && apt-get update \
  && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/app /app/app
COPY backend/alembic /app/alembic
COPY backend/alembic.ini /app/alembic.ini
COPY backend/tests /app/tests

COPY --from=frontend-build /frontend/dist /app/app/static

RUN mkdir -p /app/logs

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
